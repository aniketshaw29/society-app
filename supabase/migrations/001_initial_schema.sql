-- ============================================================
-- Migration 001: Initial Schema
-- Society Management SaaS Platform
-- ============================================================

-- -------------------------
-- ENUMS
-- -------------------------
CREATE TYPE user_role AS ENUM ('super_admin', 'society_admin', 'guard', 'flat_owner', 'tenant');
CREATE TYPE visitor_status AS ENUM ('pending', 'approved', 'denied', 'entered', 'exited', 'expired');
CREATE TYPE visitor_entry_method AS ENUM ('manual', 'qr_code', 'otp', 'pre_approved');
CREATE TYPE resident_type AS ENUM ('owner', 'tenant');
CREATE TYPE staff_category AS ENUM ('maid', 'cook', 'driver', 'security', 'delivery', 'other');
CREATE TYPE notice_type AS ENUM ('general', 'urgent', 'event', 'maintenance');
CREATE TYPE sos_status AS ENUM ('active', 'acknowledged', 'resolved');
CREATE TYPE guard_shift AS ENUM ('morning', 'afternoon', 'night');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');

-- -------------------------
-- TABLES
-- -------------------------

CREATE TABLE societies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  total_flats integer DEFAULT 0,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text,
  role user_role NOT NULL DEFAULT 'flat_owner',
  society_id uuid REFERENCES societies(id) ON DELETE SET NULL,
  flat_id uuid, -- FK added after flats table
  avatar_url text,
  fcm_token text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name text NOT NULL, -- "A Block", "Tower 1"
  total_floors integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE flats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  flat_number text NOT NULL,
  floor integer DEFAULT 0,
  is_occupied boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(society_id, building_id, flat_number)
);

-- Add FK from user_profiles to flats (circular dependency resolved)
ALTER TABLE user_profiles
  ADD CONSTRAINT fk_user_profiles_flat
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE SET NULL;

CREATE TABLE guards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  gate_name text DEFAULT 'Main Gate',
  shift guard_shift DEFAULT 'morning',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  guard_id uuid REFERENCES guards(id) ON DELETE SET NULL,
  visitor_name text NOT NULL,
  visitor_phone text,
  visitor_photo_url text,
  vehicle_number text,
  purpose text,
  entry_method visitor_entry_method NOT NULL DEFAULT 'manual',
  status visitor_status NOT NULL DEFAULT 'pending',
  pre_approval_id uuid, -- FK added after visitor_pre_approvals
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  entry_time timestamptz,
  exit_time timestamptz,
  otp_hash text,
  qr_token text,
  device_id text,  -- for offline sync
  local_id text,   -- for offline sync
  sync_status sync_status DEFAULT 'synced',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE visitor_pre_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_name text NOT NULL,
  visitor_phone text,
  otp_hash text NOT NULL,
  otp_attempts integer DEFAULT 0,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add FK from visitor_logs to visitor_pre_approvals (resolved after both tables exist)
ALTER TABLE visitor_logs
  ADD CONSTRAINT fk_visitor_pre_approval
  FOREIGN KEY (pre_approval_id) REFERENCES visitor_pre_approvals(id) ON DELETE SET NULL;

CREATE TABLE recurring_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  category staff_category NOT NULL,
  id_proof_url text,
  allowed_days integer[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon..7=Sun
  allowed_from time DEFAULT '07:00',
  allowed_until time DEFAULT '21:00',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staff_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES recurring_staff(id) ON DELETE CASCADE,
  guard_id uuid REFERENCES guards(id) ON DELETE SET NULL,
  entry_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz,
  device_id text,
  local_id text,
  sync_status sync_status DEFAULT 'synced',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  notice_type notice_type DEFAULT 'general',
  is_pinned boolean DEFAULT false,
  publish_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
  message text DEFAULT 'Emergency! Please help.',
  status sos_status DEFAULT 'active',
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL, -- 'ios' | 'android'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES societies(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- -------------------------
-- INDEXES
-- -------------------------
CREATE INDEX idx_visitor_logs_society_flat ON visitor_logs(society_id, flat_id);
CREATE INDEX idx_visitor_logs_created ON visitor_logs(society_id, created_at DESC);
CREATE INDEX idx_visitor_logs_status ON visitor_logs(society_id, status) WHERE status = 'pending';
CREATE INDEX idx_visitor_logs_sync ON visitor_logs(sync_status) WHERE sync_status = 'pending';
CREATE INDEX idx_staff_visits_society ON staff_visits(society_id, entry_time DESC);
CREATE INDEX idx_recurring_staff_flat ON recurring_staff(flat_id);
CREATE INDEX idx_notices_society ON notices(society_id, publish_at DESC);
CREATE INDEX idx_sos_active ON sos_alerts(society_id, status) WHERE status = 'active';
CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);
CREATE INDEX idx_user_profiles_society ON user_profiles(society_id);
CREATE INDEX idx_user_profiles_flat ON user_profiles(flat_id);

-- -------------------------
-- UPDATED_AT TRIGGER
-- -------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER societies_updated_at
  BEFORE UPDATE ON societies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER visitor_logs_updated_at
  BEFORE UPDATE ON visitor_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
