-- ============================================================
-- Migration 003: Storage Buckets and Policies
-- ============================================================

-- -------------------------
-- CREATE STORAGE BUCKETS
-- -------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'visitor-photos',
    'visitor-photos',
    false,
    5242880,  -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'profile-photos',
    'profile-photos',
    false,
    2097152,  -- 2 MB
    ARRAY['image/jpeg', 'image/png']
  ),
  (
    'staff-id-proofs',
    'staff-id-proofs',
    false,
    5242880,  -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  ),
  (
    'notice-attachments',
    'notice-attachments',
    false,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  ),
  (
    'society-logos',
    'society-logos',
    true,
    2097152,  -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
  );

-- ============================================================
-- STORAGE RLS POLICIES
-- Storage paths follow convention: {society_id}/{...}/{filename}
-- ============================================================

-- -------------------------
-- visitor-photos
-- Residents can upload photos for visitors at their flat.
-- Path: visitor-photos/{society_id}/{flat_id}/{filename}
-- -------------------------

CREATE POLICY "residents_upload_visitor_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'visitor-photos'
    AND (
      -- Super admins can upload anywhere
      auth.jwt() ->> 'role' = 'super_admin'
      -- Residents upload under their own society path
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) IN ('flat_owner', 'tenant', 'guard', 'society_admin')
      )
    )
  );

CREATE POLICY "society_members_read_visitor_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visitor-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = (
        SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "guards_society_admin_delete_visitor_photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'visitor-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) IN ('guard', 'society_admin')
      )
    )
  );

-- -------------------------
-- profile-photos
-- Users can manage their own profile photo.
-- Path: profile-photos/{user_id}/{filename}
-- -------------------------

CREATE POLICY "users_upload_own_profile_photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "authenticated_read_profile_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      -- Can see own photo
      OR (storage.foldername(name))[1] = auth.uid()::text
      -- Can see photos of same-society members
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id::text = (storage.foldername(name))[1]
        AND up.society_id = (
          SELECT society_id FROM user_profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "users_update_own_profile_photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "users_delete_own_profile_photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- -------------------------
-- staff-id-proofs
-- Residents upload for their own flat staff.
-- Path: staff-id-proofs/{society_id}/{flat_id}/{filename}
-- -------------------------

CREATE POLICY "residents_upload_staff_id_proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-id-proofs'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) IN ('flat_owner', 'tenant', 'society_admin')
      )
    )
  );

CREATE POLICY "society_members_read_staff_id_proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-id-proofs'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = (
        SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "residents_delete_own_flat_staff_id_proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-id-proofs'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) IN ('flat_owner', 'tenant', 'society_admin')
      )
    )
  );

-- -------------------------
-- notice-attachments
-- Society admins can upload attachments for notices.
-- Path: notice-attachments/{society_id}/{filename}
-- -------------------------

CREATE POLICY "society_admin_upload_notice_attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'notice-attachments'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) = 'society_admin'
      )
    )
  );

CREATE POLICY "society_members_read_notice_attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'notice-attachments'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (storage.foldername(name))[1] = (
        SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "society_admin_delete_notice_attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'notice-attachments'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) = 'society_admin'
      )
    )
  );

-- -------------------------
-- society-logos (public bucket)
-- Society admins upload logos.
-- Path: society-logos/{society_id}/{filename}
-- Anyone can read (public bucket).
-- -------------------------

CREATE POLICY "society_admin_upload_society_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'society-logos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) = 'society_admin'
      )
    )
  );

CREATE POLICY "public_read_society_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'society-logos');

CREATE POLICY "society_admin_delete_society_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'society-logos'
    AND (
      auth.jwt() ->> 'role' = 'super_admin'
      OR (
        (storage.foldername(name))[1] = (
          SELECT society_id::text FROM user_profiles WHERE id = auth.uid()
        )
        AND (
          SELECT role FROM user_profiles WHERE id = auth.uid()
        ) = 'society_admin'
      )
    )
  );
