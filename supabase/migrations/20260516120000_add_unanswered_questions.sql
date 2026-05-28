-- Unanswered questions log.
-- Captures the exact user question that triggered a fallback, so the monthly
-- report + dashboard can show customers which topics to add to their KB.

CREATE TABLE IF NOT EXISTS unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unanswered_tenant_date
  ON unanswered_questions(tenant_id, created_at DESC);

ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant sees own unanswered" ON unanswered_questions;
CREATE POLICY "Tenant sees own unanswered" ON unanswered_questions
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

-- Writes happen via API routes using the service role key (bypasses RLS).
