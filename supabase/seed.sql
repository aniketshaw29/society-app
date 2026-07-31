-- =============================================================================
-- Seed data for local development
-- Society App — supabase/seed.sql
--
-- Run automatically by `supabase db reset` or manually via:
--   supabase db seed
--
-- Assumes 001_initial_schema.sql has already been applied.
-- All IDs are deterministic UUIDs so re-seeding is idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Societies
-- -----------------------------------------------------------------------------
INSERT INTO societies (
  id,
  name,
  address,
  city,
  state,
  pincode,
  invite_code,
  total_flats,
  is_active,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Sunrise Apartments',
  '14, Sunrise Layout, Whitefield',
  'Bangalore',
  'Karnataka',
  '560066',
  'SUNRISE2024',
  0,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Buildings
-- -----------------------------------------------------------------------------
INSERT INTO buildings (
  id,
  society_id,
  name,
  total_floors,
  created_at
) VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'A Block',
    5,
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'B Block',
    4,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Flats (triggers will increment total_flats on societies)
-- -----------------------------------------------------------------------------
INSERT INTO flats (
  id,
  society_id,
  building_id,
  flat_number,
  floor,
  is_occupied,
  created_at
) VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'A-101',
    1,
    false,
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'A-102',
    1,
    false,
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'B-101',
    1,
    false,
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'B-102',
    1,
    false,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Auth users (local dev only — use Supabase Auth in production)
-- Password for all test users: Test@1234
-- -----------------------------------------------------------------------------

-- Society Admin
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'admin@sunriseapts.test',
  crypt('Test@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  now(), now(),
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Guard
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'guard@sunriseapts.test',
  crypt('Test@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ravi Guard"}',
  now(), now(),
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Resident (flat owner)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'resident@sunriseapts.test',
  crypt('Test@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Priya Sharma"}',
  now(), now(),
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- User profiles
-- -----------------------------------------------------------------------------

-- Society Admin profile
INSERT INTO user_profiles (
  id, phone, full_name, role, society_id, flat_id, is_active, created_at, updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '+919900000001',
  'Admin User',
  'society_admin',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  true,
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Guard profile
INSERT INTO user_profiles (
  id, phone, full_name, role, society_id, flat_id, is_active, created_at, updated_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '+919900000002',
  'Ravi Guard',
  'guard',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  true,
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Resident profile (assigned to flat A-101)
INSERT INTO user_profiles (
  id, phone, full_name, role, society_id, flat_id, is_active, created_at, updated_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '+919900000003',
  'Priya Sharma',
  'flat_owner',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333301',
  true,
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Guards table entry
-- -----------------------------------------------------------------------------
INSERT INTO guards (
  id, user_id, society_id, gate_name, shift, is_active, created_at
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'Main Gate',
  'morning',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Mark flat A-101 as occupied (resident assigned above)
UPDATE flats
SET is_occupied = true
WHERE id = '33333333-3333-3333-3333-333333333301';

-- -----------------------------------------------------------------------------
-- Sample notice
-- -----------------------------------------------------------------------------
INSERT INTO notices (
  id, society_id, posted_by, title, body, notice_type, is_pinned, publish_at, created_at
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Welcome to Sunrise Apartments!',
  'Dear Residents, welcome to your new society management platform. Please complete your profiles and verify your flat details. For support contact admin@sunriseapts.test.',
  'general',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
