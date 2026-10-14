-- ============================================================================
-- Sicherheits-Härtung für die AVV-Zusagen (TOM-Anlage)
--
--  1. Rate Limiting: Zähler-Tabelle + atomare Zählfunktion für die öffentlichen
--     Endpunkte (lib/security/rate-limit.ts). Gespeichert wird ein HMAC der IP,
--     nie die IP selbst; abgelaufene Einträge löscht pg_cron alle 15 Minuten.
--  2. Integrations-Zugangsdaten: Der Browser liest tenant_integrations nicht mehr
--     direkt (Config enthält verschlüsselte Tokens) — nur noch über die Server-API.
--  3. Alt-Spalten mit Klartext-Tokens in tenant_settings entfernen (nach
--     erneutem Backfill nach tenant_integrations, damit nichts verloren geht).
--
-- Einspielen: Supabase → SQL Editor → Inhalt einfügen → Run. Idempotent.
-- Danach: scripts/encrypt-integration-secrets.ts ausführen (docs/sicherheitsmassnahmen.md).
-- ============================================================================

-- ── 1) Rate Limiting ────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key      text primary key,          -- "<scope>:<HMAC der IP>"
  count    integer not null,
  reset_at timestamptz not null
);

comment on table public.rate_limits is
  'Anfragezähler für Rate Limiting. Enthält nur HMAC-Werte von IP-Adressen, Löschung nach Ablauf (≤ 1 h).';

create index if not exists idx_rate_limits_reset_at on public.rate_limits (reset_at);

-- RLS an, bewusst ohne Policy: nur die Service-Role (Server) erreicht die Tabelle.
alter table public.rate_limits enable row level security;

-- Zählt einen Treffer und liefert Stand + Fensterende. Atomar über das Upsert
-- (Zeilensperre) — parallele Anfragen derselben IP werden korrekt gezählt.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now()
                        then now() + make_interval(secs => p_window_seconds)
                        else r.reset_at end
  returning r.count, r.reset_at into v_count, v_reset;

  return jsonb_build_object('count', v_count, 'reset_at', v_reset);
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;

-- Aufräumen per pg_cron (läuft in der DB, unabhängig vom Deployment).
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('purge-rate-limits');
exception
  when others then null; -- Job existierte noch nicht
end;
$$;

select cron.schedule(
  'purge-rate-limits',
  '*/15 * * * *',
  $$delete from public.rate_limits where reset_at < now()$$
);

-- ── 2) tenant_integrations nur noch über den Server ─────────────────────────
-- Der Integrations-Editor lädt über GET /api/settings/integrations, das geheime
-- Felder nie herausgibt. Ohne Policy kommt der Browser nicht mehr an die Config.
drop policy if exists "Tenant sees own integrations" on public.tenant_integrations;

-- ── 3) Klartext-Alt-Spalten entfernen ───────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenant_settings'
      and column_name = 'hubspot_api_key'
  ) then
    -- Backfill wie in 20260603130000 — erfasst Werte, die seitdem dort landeten.
    insert into public.tenant_integrations (tenant_id, integration, enabled, config)
    select tenant_id, 'slack', true, jsonb_build_object('webhook_url', slack_webhook_url)
    from public.tenant_settings
    where slack_webhook_url is not null and slack_webhook_url <> ''
    on conflict (tenant_id, integration) do nothing;

    insert into public.tenant_integrations (tenant_id, integration, enabled, config)
    select tenant_id, 'hubspot', true, jsonb_build_object('api_key', hubspot_api_key)
    from public.tenant_settings
    where hubspot_api_key is not null and hubspot_api_key <> ''
    on conflict (tenant_id, integration) do nothing;

    insert into public.tenant_integrations (tenant_id, integration, enabled, config)
    select tenant_id, 'pipedrive', true, jsonb_build_object('api_key', pipedrive_api_key)
    from public.tenant_settings
    where pipedrive_api_key is not null and pipedrive_api_key <> ''
    on conflict (tenant_id, integration) do nothing;

    alter table public.tenant_settings
      drop column if exists slack_webhook_url,
      drop column if exists hubspot_api_key,
      drop column if exists pipedrive_api_key;
  end if;
end;
$$;
