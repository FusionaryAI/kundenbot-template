-- ============================================================================
--  tenant_settings: Kunden lesen, nur super_admin schreibt
-- ============================================================================
--
--  Die Zustellkonfiguration (lead_email, lead_enabled, lead_auto_reply) und die
--  Bot-Texte pflegt Fusionary im Admin-Bereich (/admin/[slug]); das
--  Kunden-Dashboard zeigt sie weder an noch schreibt es sie. Die bisherige
--  Policy tenant_settings_rw erlaubte Kunden trotzdem FOR ALL auf ihrer Zeile:
--  per PostgREST konnte ein Kundenkonto lead_email auf eine beliebige Adresse
--  setzen und Lead-Mails des Fusionary-Absenders an Dritte lenken – für den
--  Kunden unsichtbar, auch nach Passwortwechsel.
--
--  Server-Routen nutzen die Service-Role und sind nicht betroffen.
--
--  ANWENDEN: Supabase Dashboard → SQL Editor → einfügen → RUN (idempotent).
-- ============================================================================

drop policy if exists tenant_settings_rw on public.tenant_settings;

drop policy if exists tenant_settings_select on public.tenant_settings;
create policy tenant_settings_select on public.tenant_settings
  for select
  using (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists tenant_settings_admin_write on public.tenant_settings;
create policy tenant_settings_admin_write on public.tenant_settings
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================================
--  KONTROLLE NACH DEM AUSFÜHREN
--    select policyname, cmd from pg_policies where tablename = 'tenant_settings';
--    -> tenant_settings_select (SELECT) und tenant_settings_admin_write (ALL),
--       kein tenant_settings_rw mehr.
-- ============================================================================
