import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface CompressOptions {
  /** Target max size in bytes. Default: 200 * 1024 (200 KB) */
  maxBytes?: number;
  /** Width to resize to before quality reduction. Default: 1024 */
  maxWidth?: number;
}

// ============================================================
// Hook
// ============================================================

/**
 * Encapsulates camera permission, image compression, and photo upload
 * for the guard visitor capture flow.
 */
export function usePhotoCapture() {
  // ── Request Camera Permission ────────────────────────────────────────────

  /**
   * Requests camera access.
   * Returns true if granted, false otherwise.
   * Uses the Camera module's permission API via expo-camera.
   * (The actual permission request is in capture-photo.tsx using useCameraPermissions;
   *  this function is a fallback for imperative-style checks.)
   */
  const requestPermission = async (): Promise<boolean> => {
    // Dynamic import to avoid import issues in test environments
    const { Camera } = await import('expo-camera');
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  // ── Compress Image ───────────────────────────────────────────────────────

  /**
   * Compresses a photo URI to ≤ maxBytes (default 200 KB).
   * Resizes width to maxWidth (default 1024) first, then reduces JPEG quality
   * in steps until the target size is met.
   * Returns the compressed file URI.
   */
  const compressImage = async (
    uri: string,
    options: CompressOptions = {}
  ): Promise<string> => {
    const { maxBytes = 200 * 1024, maxWidth = 1024 } = options;

    // Step 1: resize to maxWidth while preserving aspect ratio
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Step 2: check size and reduce quality if needed
    let currentUri = resized.uri;
    const fileInfo = await FileSystem.getInfoAsync(currentUri, { size: true });

    if (fileInfo.exists && 'size' in fileInfo && fileInfo.size <= maxBytes) {
      return currentUri;
    }

    // Iteratively reduce quality until size fits
    for (const quality of [0.7, 0.5, 0.35, 0.2]) {
      const reduced = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      currentUri = reduced.uri;

      const info = await FileSystem.getInfoAsync(currentUri, { size: true });
      if (info.exists && 'size' in info && info.size <= maxBytes) {
        break;
      }
    }

    return currentUri;
  };

  // ── Upload Visitor Photo ─────────────────────────────────────────────────

  /**
   * Uploads a compressed photo to Supabase Storage at:
   *   visitor-photos/{societyId}/{visitorId}.jpg
   *
   * Then calls POST /visitors/:id/photo-url to generate a 1-hour signed URL
   * and persist it on the visitor_logs row.
   *
   * Returns the signed URL.
   */
  const uploadVisitorPhoto = async (
    uri: string,
    societyId: string,
    visitorId: string
  ): Promise<string> => {
    const storagePath = `${societyId}/${visitorId}.jpg`;

    // Read file as base64 and convert to Blob for upload
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to binary array
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const { error: uploadError } = await supabase.storage
      .from('visitor-photos')
      .upload(storagePath, byteArray, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    // Get signed URL via backend (which also persists it on visitor_logs)
    const response = await api.post<{ signedUrl: string }>(
      `/visitors/${visitorId}/photo-url`,
      { storagePath }
    );

    return response.data.signedUrl;
  };

  // ── Get Signed URL ───────────────────────────────────────────────────────

  /**
   * Generates a 1-hour signed URL for an already-uploaded storage path.
   */
  const getSignedUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) {
      throw new Error(`Could not generate signed URL: ${error?.message ?? 'Unknown error'}`);
    }

    return data.signedUrl;
  };

  return {
    requestPermission,
    compressImage,
    uploadVisitorPhoto,
    getSignedUrl,
  };
}
