-- ============================================================
-- Migration 002: Row Level Security Policies
-- ============================================================

-- -------------------------
-- ENABLE RLS ON ALL TABLES
-- -------------------------
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_pre_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: reusable inline checks via security-definer functions
-- (defined here for use in policies below)
-- ============================================================

-- These are referenced via subselect in policies (SECURITY DEFINER functions
-- are defined in 004_functions.sql, but we need them available here).
-- We define them inline to avoid migration ordering issues.

CREATE OR REPLACE FUNCTION _get_my_society_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT society_id FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION _get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION _get_my_flat_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT flat_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- SOCIETIES
-- ============================================================

-- Super admins can do everything
CREATE POLICY "super_admin_all_societies"
  ON societies FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Society admins and members can view their own society
CREATE POLICY "members_select_own_society"
  ON societies FOR SELECT
  TO authenticated
  USING (id = _get_my_society_id());

-- Society admins can update their own society
CREATE POLICY "society_admin_update_own_society"
  ON societies FOR UPDATE
  TO authenticated
  USING (
    id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- USER_PROFILES
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_user_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Users can view and update their own profile
CREATE POLICY "users_select_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile (on signup)
CREATE POLICY "users_insert_own_profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Society admins can view all profiles in their society
CREATE POLICY "society_admin_select_society_profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- Society admins can update profiles in their society
CREATE POLICY "society_admin_update_society_profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- Guards can view profiles in their society (needed for flat lookup)
CREATE POLICY "guards_select_society_profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- ============================================================
-- BUILDINGS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_buildings"
  ON buildings FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- All authenticated members of the society can view buildings
CREATE POLICY "society_members_select_buildings"
  ON buildings FOR SELECT
  TO authenticated
  USING (society_id = _get_my_society_id());

-- Society admins can manage buildings
CREATE POLICY "society_admin_manage_buildings"
  ON buildings FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- FLATS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_flats"
  ON flats FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- All members of the society can view flats
CREATE POLICY "society_members_select_flats"
  ON flats FOR SELECT
  TO authenticated
  USING (society_id = _get_my_society_id());

-- Society admins can manage flats
CREATE POLICY "society_admin_manage_flats"
  ON flats FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- GUARDS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_guards"
  ON guards FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Guards can view their own record
CREATE POLICY "guards_select_own_record"
  ON guards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Society admins can manage guards in their society
CREATE POLICY "society_admin_manage_guards"
  ON guards FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- Society members can view active guards (for display in app)
CREATE POLICY "society_members_select_active_guards"
  ON guards FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND is_active = true
  );

-- ============================================================
-- VISITOR_LOGS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_visitor_logs"
  ON visitor_logs FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Guards can INSERT visitor logs for their society
CREATE POLICY "guards_insert_visitor_logs"
  ON visitor_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Guards can UPDATE visitor logs for their society (entry/exit times, status)
CREATE POLICY "guards_update_visitor_logs"
  ON visitor_logs FOR UPDATE
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Guards can view visitor logs for their society
CREATE POLICY "guards_select_society_visitor_logs"
  ON visitor_logs FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Residents can view visitor logs for their own flat only
CREATE POLICY "residents_select_own_flat_visitor_logs"
  ON visitor_logs FOR SELECT
  TO authenticated
  USING (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  );

-- Residents can approve/deny visitors to their flat (UPDATE status)
CREATE POLICY "residents_update_own_flat_visitor_logs"
  ON visitor_logs FOR UPDATE
  TO authenticated
  USING (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  )
  WITH CHECK (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  );

-- Society admins have full access to visitor logs in their society
CREATE POLICY "society_admin_manage_visitor_logs"
  ON visitor_logs FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- VISITOR_PRE_APPROVALS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_pre_approvals"
  ON visitor_pre_approvals FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Residents can create pre-approvals for their own flat
CREATE POLICY "residents_insert_pre_approvals"
  ON visitor_pre_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND resident_id = auth.uid()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  );

-- Residents can view their own pre-approvals
CREATE POLICY "residents_select_own_pre_approvals"
  ON visitor_pre_approvals FOR SELECT
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND society_id = _get_my_society_id()
  );

-- Residents can update (cancel) their own pre-approvals
CREATE POLICY "residents_update_own_pre_approvals"
  ON visitor_pre_approvals FOR UPDATE
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND society_id = _get_my_society_id()
  )
  WITH CHECK (
    resident_id = auth.uid()
    AND society_id = _get_my_society_id()
  );

-- Guards can view pre-approvals for their society (to validate OTPs)
CREATE POLICY "guards_select_society_pre_approvals"
  ON visitor_pre_approvals FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Guards can update pre-approvals to mark as used
CREATE POLICY "guards_update_pre_approvals_used"
  ON visitor_pre_approvals FOR UPDATE
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Society admins full access
CREATE POLICY "society_admin_manage_pre_approvals"
  ON visitor_pre_approvals FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- RECURRING_STAFF
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_recurring_staff"
  ON recurring_staff FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Residents can manage recurring staff for their own flat
CREATE POLICY "residents_manage_own_flat_staff"
  ON recurring_staff FOR ALL
  TO authenticated
  USING (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  )
  WITH CHECK (
    flat_id = _get_my_flat_id()
    AND society_id = _get_my_society_id()
    AND added_by = auth.uid()
    AND _get_my_role() IN ('flat_owner', 'tenant')
  );

-- Guards can view active recurring staff in their society
CREATE POLICY "guards_select_society_recurring_staff"
  ON recurring_staff FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
    AND is_active = true
  );

-- Society admins full access
CREATE POLICY "society_admin_manage_recurring_staff"
  ON recurring_staff FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- STAFF_VISITS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_staff_visits"
  ON staff_visits FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Guards can INSERT staff visits for their society
CREATE POLICY "guards_insert_staff_visits"
  ON staff_visits FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Guards can UPDATE staff visits (log exit times)
CREATE POLICY "guards_update_staff_visits"
  ON staff_visits FOR UPDATE
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Guards can view staff visits for their society
CREATE POLICY "guards_select_society_staff_visits"
  ON staff_visits FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'guard'
  );

-- Residents can view staff visits for their flat's staff
CREATE POLICY "residents_select_own_flat_staff_visits"
  ON staff_visits FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() IN ('flat_owner', 'tenant')
    AND EXISTS (
      SELECT 1 FROM recurring_staff rs
      WHERE rs.id = staff_visits.staff_id
      AND rs.flat_id = _get_my_flat_id()
    )
  );

-- Society admins full access
CREATE POLICY "society_admin_manage_staff_visits"
  ON staff_visits FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- NOTICES
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_notices"
  ON notices FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- All society members can view active notices
CREATE POLICY "society_members_select_notices"
  ON notices FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND (expires_at IS NULL OR expires_at > now())
    AND publish_at <= now()
  );

-- Society admins can manage notices
CREATE POLICY "society_admin_manage_notices"
  ON notices FOR ALL
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- ============================================================
-- SOS_ALERTS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_sos_alerts"
  ON sos_alerts FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- All society members can raise SOS
CREATE POLICY "society_members_insert_sos"
  ON sos_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id = _get_my_society_id()
    AND raised_by = auth.uid()
  );

-- All society members can view SOS alerts in their society
CREATE POLICY "society_members_select_sos"
  ON sos_alerts FOR SELECT
  TO authenticated
  USING (society_id = _get_my_society_id());

-- Users can update their own SOS alert
CREATE POLICY "users_update_own_sos"
  ON sos_alerts FOR UPDATE
  TO authenticated
  USING (
    raised_by = auth.uid()
    AND society_id = _get_my_society_id()
  )
  WITH CHECK (
    raised_by = auth.uid()
    AND society_id = _get_my_society_id()
  );

-- Guards and society admins can acknowledge/resolve SOS alerts
CREATE POLICY "guards_and_admins_update_sos"
  ON sos_alerts FOR UPDATE
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() IN ('guard', 'society_admin')
  )
  WITH CHECK (
    society_id = _get_my_society_id()
    AND _get_my_role() IN ('guard', 'society_admin')
  );

-- ============================================================
-- FCM_TOKENS
-- ============================================================

-- Super admins full access
CREATE POLICY "super_admin_all_fcm_tokens"
  ON fcm_tokens FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Users can manage their own FCM tokens
CREATE POLICY "users_manage_own_fcm_tokens"
  ON fcm_tokens FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUDIT_LOGS
-- ============================================================

-- Super admins can view all audit logs
CREATE POLICY "super_admin_all_audit_logs"
  ON audit_logs FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Society admins can view audit logs for their society
CREATE POLICY "society_admin_select_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    society_id = _get_my_society_id()
    AND _get_my_role() = 'society_admin'
  );

-- Service role can insert audit logs (used by backend)
CREATE POLICY "service_insert_audit_logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
