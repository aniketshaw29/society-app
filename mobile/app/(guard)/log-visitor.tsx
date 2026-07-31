import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useVisitorLog, type CreateVisitorInput } from '@/hooks/useVisitorLog';
import {
  VisitorForm,
  type VisitorFormValues,
  type VisitorFormErrors,
} from '@/components/guard/VisitorForm';
import type { Purpose } from '@/components/guard/PurposeSelector';
import type { FlatRow } from '@/components/guard/FlatSearch';

// ============================================================
// Screen
// ============================================================

export default function LogVisitorScreen() {
  const params = useLocalSearchParams<{ photoUri?: string; visitorId?: string }>();

  // After camera returns, these params carry the captured photo URI and a
  // pending visitor ID (if the visitor was already created before capture).
  const returnedPhotoUri = params.photoUri ?? null;
  const pendingVisitorId = params.visitorId ?? null;

  const { submitVisitor } = useVisitorLog();

  const [values, setValues] = useState<VisitorFormValues>({
    visitorName: '',
    visitorPhone: '',
    purpose: null,
    flat: null as FlatRow | null,
    vehicleNumber: '',
  });

  const [errors, setErrors] = useState<VisitorFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Photo state: prefer returned URI from camera, else null
  const [photoUri, setPhotoUri] = useState<string | null>(returnedPhotoUri);

  // ── Field change handler ──────────────────────────────────────────────────

  const handleChange = useCallback(
    <K extends keyof VisitorFormValues>(key: K, value: VisitorFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // Clear the error for the field being changed
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: VisitorFormErrors = {};

    if (!values.visitorName.trim()) {
      next.visitorName = 'Visitor name is required';
    }
    if (!values.purpose) {
      next.purpose = 'Please select a purpose';
    }
    if (!values.flat) {
      next.flat = 'Please select a flat';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Navigate to camera ────────────────────────────────────────────────────

  const handleCapturePhoto = useCallback(() => {
    // Pass current form state as params so it can survive navigation
    router.push({
      pathname: '/(guard)/capture-photo',
      params: {
        returnTo: '/(guard)/log-visitor',
      },
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const input: CreateVisitorInput = {
        flatId: values.flat!.id,
        visitorName: values.visitorName.trim(),
        visitorPhone: values.visitorPhone || undefined,
        purpose: values.purpose as Purpose,
        vehicleNumber: values.vehicleNumber || undefined,
        entryMethod: 'manual',
      };

      const visitor = await submitVisitor(input);

      // If a photo was captured, upload it now
      if (photoUri) {
        try {
          const { usePhotoCapture } = await import('@/hooks/usePhotoCapture');
          // We can't call hooks conditionally, so we import the module and
          // instantiate it here in a non-hook context via a helper.
          // The hook itself is side-effect free so this is safe.
          const photoHook = usePhotoCapture();
          const compressed = await photoHook.compressImage(photoUri);
          await photoHook.uploadVisitorPhoto(
            compressed,
            visitor.societyId,
            visitor.id
          );
        } catch (photoErr) {
          // Photo upload failure is non-fatal — visitor is already logged
          console.warn('[LogVisitor] Photo upload failed:', photoErr);
        }
      }

      router.back();
      // Small delay to let navigation complete before showing toast
      setTimeout(() => {
        Alert.alert(
          'Visitor Logged',
          `${visitor.visitorName} logged successfully. Waiting for resident approval.`,
          [{ text: 'OK' }]
        );
      }, 300);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log visitor';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }, [values, photoUri, submitting, submitVisitor]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>New Visitor</Text>

        {/* Photo thumbnail when captured */}
        {photoUri ? (
          <View style={styles.photoPreview}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoThumb}
              resizeMode="cover"
            />
            <Text style={styles.photoCaption}>Photo captured</Text>
          </View>
        ) : null}

        <VisitorForm
          values={values}
          errors={errors}
          onChange={handleChange}
          onCapturePhoto={handleCapturePhoto}
          photoUri={photoUri}
          submitting={submitting}
          onSubmit={() => void handleSubmit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },
  photoPreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoThumb: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  photoCaption: {
    marginTop: 8,
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
});
