-- ============================================================================
--  Harte Obergrenze für Browser-Sitzungen (Audit NV-8)
-- ============================================================================
--
--  Die Dashboard-Regel „60 Min. inaktiv / Browser zu" wirkt nur im Browser, und
--  der Supabase-Free-Plan bietet keinen Inactivity-Timeout. Ein kopierter
--  Refresh-Token blieb damit unbegrenzt nutzbar. Supabase schreibt die
--  Anmeldezeit als amr-Claim in jeden Access-Token (bleibt beim Refresh
--  erhalten). Die RLS-Helfer lassen jetzt nur Sitzungen zu, deren Anmeldung
--  höchstens 12 Stunden zurückliegt. Dieselbe Grenze prüfen die API-Routen
--  (lib/auth-server.ts) und der Browser (lib/session-policy.ts).
--
--  Grenze ändern: 43200 hier, in 20261028120000_core_tenant_rls.sql und
--  MAX_SESSION_AGE_S in lib/session-age.ts gemeinsam anpassen.
--
--  ANWENDEN: Supabase Dashboard → SQL Editor → einfügen → RUN (idempotent).
-- ============================================================================

-- Ältester amr-Zeitstempel = Anmeldung. Nicht den jüngsten nehmen: Eine
-- MFA-Verifizierung hängt einen neuen Eintrag mit „jetzt" an, ein Angreifer mit
-- kopiertem Refresh-Token könnte die Uhr damit beliebig zurückstellen.
-- Fehlt der amr-Claim (z. B. Service-Aufrufe), wird nicht gesperrt: Der Claim
-- ist signiert, ihn zu entfernen hieße, den Token zu fälschen.
create or replace function public.session_is_fresh()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select min((m ->> 'timestamp')::bigint)
       from jsonb_array_elements(
              case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
            ) m
      where (m ->> 'timestamp') ~ '^[0-9]+$')
      > extract(epoch from now())::bigint - 43200,
    true)
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_roles
  where user_id = auth.uid() and public.session_is_fresh()
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
  ) and public.session_is_fresh()
$$;

-- Ältere Lese-Policies fragten user_roles direkt ab und gingen damit am
-- Alterscheck vorbei. conversation_analytics_rw / unanswered_questions_rw
-- (20261028120000) decken denselben Lesezugriff über die Helfer ab.
drop policy if exists "Tenant sees own analytics" on public.conversation_analytics;
drop policy if exists "Tenant sees own unanswered" on public.unanswered_questions;

-- ============================================================================
--  KONTROLLE NACH DEM AUSFÜHREN
--    select public.session_is_fresh();   -- im SQL-Editor ohne JWT: true
--    select policyname from pg_policies
--     where tablename in ('conversation_analytics', 'unanswered_questions');
--    -> nur conversation_analytics_rw und unanswered_questions_rw.
-- ============================================================================
