-- Vertical-Profil pro Tenant.
-- Bestimmt, welches Branchen-Profil (lib/verticals/) der Bot lädt — und damit
-- Guardrails, Safety-Texte, Capability-Antwort und verfügbare Integrationen.
--
-- NULL = nicht gesetzt: der Chat-Handler fällt dann auf die bisherige Namens-
-- Heuristik zurück (resolveVertical), Bestandskunden bleiben verhaltensgleich.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vertical TEXT;

-- Backfill: medizinisch benannte Bestands-Tenants explizit auf 'praxis' setzen.
-- Spiegelt die bisherige isMedicalTenant-Heuristik (nur auf dem Namen).
UPDATE tenants
SET vertical = 'praxis'
WHERE vertical IS NULL
  AND (
       name ILIKE '%arzt%'
    OR name ILIKE '%praxis%'
    OR name ILIKE '%medizin%'
    OR name ILIKE '%zahnarzt%'
    OR name ILIKE '%klinik%'
    OR name ILIKE '%therapie%'
    OR name ILIKE '%physio%'
    OR name ILIKE '%apotheke%'
  );
