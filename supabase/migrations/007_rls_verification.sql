-- ---------------------------------------------------------------------------
-- Migration 007: RLS verification
-- Run this to confirm all tables have RLS enabled
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  missing_rls text[] := '{}';
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'societies','user_profiles','buildings','flats','guards',
      'visitor_logs','visitor_pre_approvals','recurring_staff',
      'staff_visits','notices','sos_alerts','fcm_tokens','audit_logs'
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relrowsecurity = true
    ) THEN
      missing_rls := array_append(missing_rls, tbl);
    END IF;
  END LOOP;

  IF array_length(missing_rls, 1) > 0 THEN
    RAISE EXCEPTION 'Tables missing RLS: %', missing_rls;
  END IF;

  RAISE NOTICE 'All tables have RLS enabled ✓';
END;
$$;
