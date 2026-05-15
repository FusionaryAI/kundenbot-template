-- ROI / Wirkung Dashboard
-- Adds tenant ROI config columns + conversation_analytics table.
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).

-- ============================================================
-- 1. tenants: ROI config
-- ============================================================
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS hourly_rate_eur NUMERIC DEFAULT 35;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS avg_handling_time_minutes NUMERIC DEFAULT 4;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{
    "mo": {"open": "08:00", "close": "18:00"},
    "di": {"open": "08:00", "close": "18:00"},
    "mi": {"open": "08:00", "close": "18:00"},
    "do": {"open": "08:00", "close": "18:00"},
    "fr": {"open": "08:00", "close": "16:00"},
    "sa": null,
    "so": null
  }'::jsonb;

-- ============================================================
-- 2. conversation_analytics
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INT DEFAULT 0,
  outside_business_hours BOOLEAN DEFAULT FALSE,
  resulted_in_lead BOOLEAN DEFAULT FALSE,
  avg_similarity NUMERIC,
  first_user_message TEXT,
  topic_category TEXT,
  fallback_count INT DEFAULT 0,
  similarity_sum NUMERIC DEFAULT 0,
  similarity_samples INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique per (tenant, conversation) so we can upsert from chat API
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_analytics_tenant_conv
  ON conversation_analytics(tenant_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_conv_analytics_tenant_date
  ON conversation_analytics(tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_analytics_outside_hours
  ON conversation_analytics(tenant_id, outside_business_hours)
  WHERE outside_business_hours = TRUE;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- The plan references a `tenant_members` table; this project uses `user_roles`.
-- We use user_roles(user_id, tenant_id) instead.
DROP POLICY IF EXISTS "Tenant sees own analytics" ON conversation_analytics;
CREATE POLICY "Tenant sees own analytics" ON conversation_analytics
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

-- Writes happen via API routes using the service role key, which bypasses RLS.

-- ============================================================
-- 4. updated_at trigger (optional but useful)
-- ============================================================
CREATE OR REPLACE FUNCTION conversation_analytics_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conv_analytics_touch ON conversation_analytics;
CREATE TRIGGER trg_conv_analytics_touch
  BEFORE UPDATE ON conversation_analytics
  FOR EACH ROW
  EXECUTE FUNCTION conversation_analytics_touch_updated_at();
