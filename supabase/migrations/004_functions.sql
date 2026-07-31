-- ============================================================
-- Migration 004: Helper Functions and Triggers
-- ============================================================

-- -------------------------
-- USER CONTEXT FUNCTIONS
-- -------------------------

-- Get current user's society_id
CREATE OR REPLACE FUNCTION get_my_society_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT society_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Get current user's flat_id
CREATE OR REPLACE FUNCTION get_my_flat_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT flat_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Check if current user is society admin of given society
CREATE OR REPLACE FUNCTION is_society_admin(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND society_id = p_society_id
    AND role = 'society_admin'
  );
$$;

-- Check if current user is guard of given society
CREATE OR REPLACE FUNCTION is_guard(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND society_id = p_society_id
    AND role = 'guard'
  );
$$;

-- Check if current user is a resident (flat_owner or tenant) with access to flat
CREATE OR REPLACE FUNCTION is_flat_resident(p_flat_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND flat_id = p_flat_id
    AND role IN ('flat_owner', 'tenant')
  );
$$;

-- -------------------------
-- FLAT COUNT TRIGGER
-- -------------------------

-- Increment flat count when a new flat is inserted
CREATE OR REPLACE FUNCTION increment_society_flat_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE societies
  SET total_flats = total_flats + 1
  WHERE id = NEW.society_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER flat_count_trigger
  AFTER INSERT ON flats
  FOR EACH ROW EXECUTE FUNCTION increment_society_flat_count();

-- Decrement flat count when a flat is deleted
CREATE OR REPLACE FUNCTION decrement_society_flat_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE societies
  SET total_flats = GREATEST(total_flats - 1, 0)
  WHERE id = OLD.society_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER flat_count_decrement_trigger
  AFTER DELETE ON flats
  FOR EACH ROW EXECUTE FUNCTION decrement_society_flat_count();

-- -------------------------
-- AUDIT LOG FUNCTION
-- -------------------------

CREATE OR REPLACE FUNCTION log_audit_event(
  p_society_id uuid,
  p_action text,
  p_table_name text,
  p_record_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_logs (society_id, actor_id, action, table_name, record_id, old_data, new_data)
  VALUES (p_society_id, auth.uid(), p_action, p_table_name, p_record_id, p_old_data, p_new_data);
END;
$$;

-- -------------------------
-- OTP GENERATION FUNCTION
-- -------------------------

-- Generate a numeric OTP and return its SHA-256 hash (store hash, not plaintext)
CREATE OR REPLACE FUNCTION generate_otp_hash(otp text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(otp, 'sha256'), 'hex');
$$;

-- -------------------------
-- VISITOR LOG STATUS FUNCTION
-- -------------------------

-- Expire pending visitors that have passed validity window
CREATE OR REPLACE FUNCTION expire_stale_pre_approvals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH updated AS (
    UPDATE visitor_pre_approvals
    SET is_used = true
    WHERE valid_until < now()
    AND is_used = false
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM updated;

  RETURN expired_count;
END;
$$;

-- -------------------------
-- SOCIETY STATS FUNCTION
-- -------------------------

CREATE OR REPLACE FUNCTION get_society_stats(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  stats jsonb;
BEGIN
  -- Only accessible by society admins or super admins of that society
  IF NOT (
    auth.jwt() ->> 'role' = 'super_admin'
    OR is_society_admin(p_society_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'total_flats',       (SELECT total_flats FROM societies WHERE id = p_society_id),
    'occupied_flats',    (SELECT count(*) FROM flats WHERE society_id = p_society_id AND is_occupied = true),
    'total_residents',   (SELECT count(*) FROM user_profiles WHERE society_id = p_society_id AND role IN ('flat_owner', 'tenant') AND is_active = true),
    'total_guards',      (SELECT count(*) FROM guards WHERE society_id = p_society_id AND is_active = true),
    'pending_visitors',  (SELECT count(*) FROM visitor_logs WHERE society_id = p_society_id AND status = 'pending'),
    'active_sos',        (SELECT count(*) FROM sos_alerts WHERE society_id = p_society_id AND status = 'active'),
    'today_visitors',    (SELECT count(*) FROM visitor_logs WHERE society_id = p_society_id AND created_at::date = current_date)
  ) INTO stats;

  RETURN stats;
END;
$$;

-- -------------------------
-- FLAT OCCUPANCY TRIGGER
-- -------------------------

-- Auto-update flat.is_occupied when a resident is assigned to or unassigned from a flat
CREATE OR REPLACE FUNCTION sync_flat_occupancy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When a user's flat_id changes (assignment or removal)
  IF TG_OP = 'UPDATE' THEN
    -- Mark old flat as potentially unoccupied
    IF OLD.flat_id IS NOT NULL AND OLD.flat_id IS DISTINCT FROM NEW.flat_id THEN
      UPDATE flats
      SET is_occupied = EXISTS (
        SELECT 1 FROM user_profiles
        WHERE flat_id = OLD.flat_id
        AND is_active = true
        AND role IN ('flat_owner', 'tenant')
        AND id != OLD.id
      )
      WHERE id = OLD.flat_id;
    END IF;

    -- Mark new flat as occupied
    IF NEW.flat_id IS NOT NULL THEN
      UPDATE flats
      SET is_occupied = true
      WHERE id = NEW.flat_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_flat_occupancy_trigger
  AFTER UPDATE OF flat_id ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_flat_occupancy();
