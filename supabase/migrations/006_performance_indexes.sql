-- ---------------------------------------------------------------------------
-- Migration 006: Additional performance indexes for Phase 7
-- (Core indexes already exist in 001_initial_schema.sql)
-- ---------------------------------------------------------------------------

-- Visitor logs hot paths
CREATE INDEX IF NOT EXISTS idx_visitor_logs_flat_status
  ON visitor_logs(flat_id, status) WHERE status IN ('pending', 'approved', 'entered');

CREATE INDEX IF NOT EXISTS idx_visitor_logs_guard_today
  ON visitor_logs(guard_id, created_at DESC);

-- Pre-approvals lookup by guest phone
CREATE INDEX IF NOT EXISTS idx_pre_approvals_guest_phone
  ON visitor_pre_approvals(guest_phone, status) WHERE status = 'active';

-- Recurring staff society search
CREATE INDEX IF NOT EXISTS idx_recurring_staff_society_search
  ON recurring_staff(society_id, phone, is_active);

-- FCM tokens lookup
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_platform
  ON fcm_tokens(user_id, platform);

-- Notices active lookup
CREATE INDEX IF NOT EXISTS idx_notices_society_published
  ON notices(society_id, publish_at DESC) WHERE status = 'published';

-- SOS active alerts
CREATE INDEX IF NOT EXISTS idx_sos_society_active
  ON sos_alerts(society_id, created_at DESC) WHERE status = 'active';

-- Audit: ANALYZE after index creation for better query planning
ANALYZE visitor_logs;
ANALYZE visitor_pre_approvals;
ANALYZE recurring_staff;
ANALYZE notices;
