-- ============================================================================
-- Automatische Löschroutine (DSGVO Art. 5 Abs. 1 lit. e — Speicherbegrenzung)
--
-- Löscht personenbezogene Daten nach Ablauf der Aufbewahrungsfrist und
-- protokolliert jeden Lauf (Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO).
-- Die Fristen entsprechen dem Datenschutz-Textbaustein für Kundenübergaben
-- (docs/datenschutz-textbaustein.md) — beides muss übereinstimmen.
--
-- Fristen ändern: nur die drei INTERVAL-Werte in purge_expired_data() anpassen
-- und den Textbaustein mitziehen.
-- ============================================================================

-- pg_cron läuft in der Datenbank selbst — unabhängig vom Web-Deployment.
create extension if not exists pg_cron;

-- ── Protokoll der Löschläufe ────────────────────────────────────────────────
create table if not exists public.retention_log (
  id                 uuid primary key default gen_random_uuid(),
  run_at             timestamptz not null default now(),
  leads_deleted      integer not null default 0,
  analytics_deleted  integer not null default 0,
  unanswered_deleted integer not null default 0
);

comment on table public.retention_log is
  'Nachweis der automatischen Löschung (DSGVO Art. 5 Abs. 2). Enthält nur Zählwerte, keine personenbezogenen Daten.';

-- RLS an, bewusst OHNE Policy: damit erreichen weder anon noch authenticated
-- die Tabelle. Nur die Service-Role (Backend/Dashboard) umgeht RLS und liest.
alter table public.retention_log enable row level security;

-- ── Löschfunktion ───────────────────────────────────────────────────────────
create or replace function public.purge_expired_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leads      integer := 0;
  v_analytics  integer := 0;
  v_unanswered integer := 0;
begin
  -- Kontaktanfragen: 6 Monate nach Eingang
  delete from public.leads
   where created_at < now() - interval '6 months';
  get diagnostics v_leads = row_count;

  -- Konversations-Statistiken (enthalten first_user_message): 12 Monate
  delete from public.conversation_analytics
   where started_at < now() - interval '12 months';
  get diagnostics v_analytics = row_count;

  -- Unbeantwortete Fragen (enthalten Nutzereingaben): 12 Monate
  delete from public.unanswered_questions
   where created_at < now() - interval '12 months';
  get diagnostics v_unanswered = row_count;

  insert into public.retention_log (leads_deleted, analytics_deleted, unanswered_deleted)
  values (v_leads, v_analytics, v_unanswered);
end;
$$;

comment on function public.purge_expired_data() is
  'Löscht abgelaufene personenbezogene Daten und protokolliert den Lauf. Wird täglich per pg_cron ausgeführt.';

-- Ausführung nur durch den Cron-Job bzw. die Service-Role, nicht durch Clients.
revoke execute on function public.purge_expired_data() from public, anon, authenticated;

-- ── Zeitplan: täglich 03:15 UTC ─────────────────────────────────────────────
-- Idempotent: bestehenden Job zuerst entfernen, damit die Migration
-- gefahrlos erneut eingespielt werden kann.
do $$
begin
  perform cron.unschedule('purge-expired-data');
exception
  when others then null; -- Job existierte noch nicht
end;
$$;

select cron.schedule(
  'purge-expired-data',
  '15 3 * * *',
  $$select public.purge_expired_data()$$
);
