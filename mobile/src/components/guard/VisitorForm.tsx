import { View, Text, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/PhoneInput';
import {
  PurposeSelector,
  type Purpose,
} from '@/components/guard/PurposeSelector';
import { FlatSearch, type FlatRow } from '@/components/guard/FlatSearch';

// ============================================================
// Types
// ============================================================

export interface VisitorFormValues {
  visitorName: string;
  visitorPhone: string;
  purpose: Purpose | null;
  flat: FlatRow | null;
  vehicleNumber: string;
}

export interface VisitorFormErrors {
  visitorName?: string;
  purpose?: string;
  flat?: string;
}

interface VisitorFormProps {
  values: VisitorFormValues;
  errors: VisitorFormErrors;
  onChange: <K extends keyof VisitorFormValues>(key: K, value: VisitorFormValues[K]) => void;
  onCapturePhoto: () => void;
  photoUri?: string | null;
  submitting?: boolean;
  onSubmit: () => void;
}

// ============================================================
// Component
// ============================================================

/**
 * Reusable visitor entry form.
 * Pure presentational: all state lives in the parent screen.
 */
export function VisitorForm({
  values,
  errors,
  onChange,
  onCapturePhoto,
  photoUri,
  submitting = false,
  onSubmit,
}: VisitorFormProps) {
  return (
    <View style={styles.container}>
      {/* Visitor Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Visitor Name <Text style={styles.required}>*</Text>
        </Text>
        <Input
          placeholder="e.g. Ramesh Kumar"
          value={values.visitorName}
          onChangeText={(v) => onChange('visitorName', v)}
          error={errors.visitorName}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone (optional)</Text>
        <PhoneInput
          value={values.visitorPhone}
          onChangeText={(v) => onChange('visitorPhone', v)}
        />
      </View>

      {/* Purpose */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Purpose <Text style={styles.required}>*</Text>
        </Text>
        <PurposeSelector
          value={values.purpose}
          onChange={(p) => onChange('purpose', p)}
          error={errors.purpose}
        />
      </View>

      {/* Flat to visit */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Flat to Visit <Text style={styles.required}>*</Text>
        </Text>
        <FlatSearch
          value={values.flat}
          onChange={(f) => onChange('flat', f)}
          error={errors.flat}
        />
      </View>

      {/* Vehicle Number */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Vehicle Number (optional)</Text>
        <Input
          placeholder="e.g. KA05 MX 1234"
          value={values.vehicleNumber}
          onChangeText={(v) => onChange('vehicleNumber', v)}
          autoCapitalize="characters"
          returnKeyType="done"
        />
      </View>

      {/* Photo capture */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Visitor Photo (optional)</Text>
        <Button
          title={photoUri ? 'Retake Photo' : 'Capture Photo'}
          variant="secondary"
          onPress={onCapturePhoto}
          style={styles.photoButton}
        />
        {photoUri ? (
          <Text style={styles.photoHint}>Photo captured — tap to retake</Text>
        ) : null}
      </View>

      {/* Submit */}
      <Button
        title="Log Visitor"
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submitButton}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
  },
  photoButton: {
    marginTop: 0,
  },
  photoHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 8,
  },
});
