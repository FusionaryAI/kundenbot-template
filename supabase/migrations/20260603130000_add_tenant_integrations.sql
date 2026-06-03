-- Pro-Tenant Integrationskonfiguration.
-- Ersetzt das bisherige "eine Spalte pro Anbieter"-Schema in tenant_settings
-- durch eine erweiterbare Tabelle: neue Integration = neue Zeile, kein ALTER.
-- `integration` referenziert eine Adapter-ID aus lib/integrations/registry.ts.
--
-- HINWEIS Sicherheit: config kann Secrets (API-Keys) enthalten. Aktuell als
-- Klartext gespeichert — zieht den bisherigen tenant_settings-Stand 1:1 um.
-- Folgeschritt: Secrets über Supabase Vault / pgsodium verschlüsseln.

CREATE TABLE IF NOT EXISTS tenant_integrations (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, integration)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
  ON tenant_integrations(tenant_id);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Gleiche Sichtbarkeitsregel wie bei den übrigen Tenant-Tabellen.
DROP POLICY IF EXISTS "Tenant sees own integrations" ON tenant_integrations;
CREATE POLICY "Tenant sees own integrations" ON tenant_integrations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Backfill aus den bisherigen tenant_settings-Spalten, damit Bestandskunden
-- ohne Unterbrechung weiter benachrichtigt werden.
INSERT INTO tenant_integrations (tenant_id, integration, enabled, config)
SELECT tenant_id, 'slack', TRUE, jsonb_build_object('webhook_url', slack_webhook_url)
FROM tenant_settings
WHERE slack_webhook_url IS NOT NULL AND slack_webhook_url <> ''
ON CONFLICT (tenant_id, integration) DO NOTHING;

INSERT INTO tenant_integrations (tenant_id, integration, enabled, config)
SELECT tenant_id, 'hubspot', TRUE, jsonb_build_object('api_key', hubspot_api_key)
FROM tenant_settings
WHERE hubspot_api_key IS NOT NULL AND hubspot_api_key <> ''
ON CONFLICT (tenant_id, integration) DO NOTHING;

INSERT INTO tenant_integrations (tenant_id, integration, enabled, config)
SELECT tenant_id, 'pipedrive', TRUE, jsonb_build_object('api_key', pipedrive_api_key)
FROM tenant_settings
WHERE pipedrive_api_key IS NOT NULL AND pipedrive_api_key <> ''
ON CONFLICT (tenant_id, integration) DO NOTHING;
