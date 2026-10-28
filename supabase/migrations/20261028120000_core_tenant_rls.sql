-- ============================================================================
--  Row Level Security (RLS) für das Kundendashboard
-- ============================================================================
--
--  ZWECK
--  Ohne RLS kann JEDER mit dem öffentlichen anon-Key (steckt im JS-Bundle)
--  sämtliche Tabellen direkt über die Supabase-API auslesen — unabhängig von
--  Frontend-Sperren. Dieses Skript aktiviert RLS und erlaubt Zugriff nur noch:
--    • eingeloggten Nutzern auf die Daten IHRES Tenants
--    • super_admins auf alles
--
--  WICHTIG / BRICHT NICHTS:
--    • Der Service-Role-Key (Server/API-Routen, Chat-Widget) UMGEHT RLS — die
--      öffentliche Chatbot-Funktion (/api/chat, /api/widget, Lead-Erfassung)
--      läuft also unverändert weiter.
--    • Das Dashboard liest clientseitig mit der eingeloggten Sitzung → die
--      Policies unten greifen automatisch.
--
--  ANWENDEN
--    Bis 28.10.2026 lag dieses Skript als supabase/rls-policies.sql außerhalb
--    der Migrationen und wurde manuell ausgeführt. Ohne es liefert PostgREST dem
--    anon-Key alle Leads aller Tenants, und jeder eingeloggte Kunde könnte sich
--    über user_roles zum super_admin machen. Deshalb jetzt Pflicht-Migration in
--    jeder Installation (docs/sicherheitsmassnahmen.md, „Einrichtung je Projekt").
--    Supabase Dashboard → SQL Editor → dieses Skript einfügen → RUN.
--    (Idempotent: kann mehrfach ausgeführt werden, auch dort, wo das alte
--    Skript schon lief.)
--
--  ANNAHME: id / tenant_id / user_id sind vom Typ uuid. Falls bei euch text,
--  Rückgabetyp der Helper-Funktionen unten auf text ändern.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Helper-Funktionen (SECURITY DEFINER → lesen user_roles ohne RLS-Rekursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_roles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 2) RLS aktivieren
-- ---------------------------------------------------------------------------
alter table public.tenants                enable row level security;
alter table public.tenant_settings        enable row level security;
alter table public.user_roles             enable row level security;
alter table public.leads                  enable row level security;
alter table public.knowledge_items        enable row level security;
alter table public.embeddings             enable row level security;
alter table public.conversation_analytics enable row level security;
alter table public.unanswered_questions   enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Policies
--    Muster für tenant-gebundene Tabellen: Zugriff, wenn tenant_id == eigener
--    Tenant ODER super_admin. (DROP zuerst → idempotent.)
-- ---------------------------------------------------------------------------

-- tenants: nur die eigene Organisation sehen (Schreiben via Service-Role/Admin)
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select
  using (id = public.current_tenant_id() or public.is_super_admin());

-- user_roles: nur die eigene Zuordnung sehen; super_admin alles. Kein Client-Write.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select
  using (user_id = auth.uid() or public.is_super_admin());

-- tenant-gebundene Tabellen: volle CRUD, aber strikt tenant-isoliert.
drop policy if exists tenant_settings_rw on public.tenant_settings;
create policy tenant_settings_rw on public.tenant_settings
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists leads_rw on public.leads;
create policy leads_rw on public.leads
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists knowledge_items_rw on public.knowledge_items;
create policy knowledge_items_rw on public.knowledge_items
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists embeddings_rw on public.embeddings;
create policy embeddings_rw on public.embeddings
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists conversation_analytics_rw on public.conversation_analytics;
create policy conversation_analytics_rw on public.conversation_analytics
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists unanswered_questions_rw on public.unanswered_questions;
create policy unanswered_questions_rw on public.unanswered_questions
  for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4) Schreibschutz zusätzlich über Tabellenrechte
--    user_roles ist die einzige Quelle der super_admin-Autorität
--    (lib/auth-server.ts). Fehlt RLS einmal (neue Tabelle, Restore), sollen
--    Browser-Rollen sie trotzdem nicht beschreiben können. Geschrieben wird
--    beides ausschließlich über die Service-Role (create-tenant,
--    create-client-user, settings/wirkung).
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.user_roles, public.tenants from anon, authenticated;

-- ============================================================================
--  KONTROLLE NACH DEM AUSFÜHREN
--    select tablename, rowsecurity from pg_tables where schemaname = 'public';
--    -> rowsecurity muss bei allen obigen Tabellen 'true' sein.
--
--  TEST (sollte 0 Zeilen / Fehler liefern, OHNE eingeloggte Sitzung):
--    Im SQL-Editor als 'anon' rolle oder per REST mit anon-Key:
--    select * from leads;   -> keine Daten mehr.
--
--  Schreibschutz user_roles (beide Werte müssen 'false' sein):
--    select has_table_privilege('authenticated', 'public.user_roles', 'UPDATE'),
--           has_table_privilege('authenticated', 'public.user_roles', 'INSERT');
-- ============================================================================
