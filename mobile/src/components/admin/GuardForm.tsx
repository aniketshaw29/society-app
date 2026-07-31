import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export type GuardShift = 'morning' | 'afternoon' | 'night';

export interface GuardFormData {
  fullName: string;
  phone: string;
  gateName: string;
  shift: GuardShift;
}

export interface GuardFormErrors {
  fullName?: string;
  phone?: string;
  gateName?: string;
  shift?: string;
}

const SHIFTS: { value: GuardShift; label: string; emoji: string }[] = [
  { value: 'morning', label: 'Morning', emoji: '🌅' },
  { value: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { value: 'night', label: 'Night', emoji: '🌙' },
];

interface GuardFormProps {
  data: GuardFormData;
  errors: GuardFormErrors;
  onChange: (field: keyof GuardFormData, value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
}

export function GuardForm({
  data,
  errors,
  onChange,
  onSubmit,
  loading = false,
  submitLabel = 'Add Guard',
}: GuardFormProps) {
  return (
    <View style={styles.container}>
      <Input
        label="Full Name"
        placeholder="e.g. Ramesh Singh"
        value={data.fullName}
        onChangeText={(v) => onChange('fullName', v)}
        error={errors.fullName}
        autoCapitalize="words"
        returnKeyType="next"
      />

      {/* Phone with +91 prefix */}
      <View style={styles.phoneGroup}>
        <Text style={styles.label}>Mobile Number</Text>
        <View style={[styles.phoneRow, errors.phone ? styles.phoneRowError : null]}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <Input
            placeholder="10-digit number"
            value={data.phone}
            onChangeText={(v) => onChange('phone', v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="next"
            containerStyle={styles.phoneInputContainer}
            style={styles.phoneInput}
          />
        </View>
        {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
      </View>

      <Input
        label="Gate Name (optional)"
        placeholder="e.g. Main Gate, North Gate"
        value={data.gateName}
        onChangeText={(v) => onChange('gateName', v)}
        error={errors.gateName}
        autoCapitalize="words"
        returnKeyType="next"
      />

      {/* Shift picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Shift</Text>
        <View style={styles.shiftRow}>
          {SHIFTS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.shiftChip,
                data.shift === value && styles.shiftChipSelected,
              ]}
              onPress={() => onChange('shift', value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.shiftText,
                  data.shift === value && styles.shiftTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.shift ? <Text style={styles.errorText}>{errors.shift}</Text> : null}
      </View>

      <Button
        title={submitLabel}
        onPress={onSubmit}
        loading={loading}
        disabled={loading}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  phoneGroup: {
    marginBottom: 16,
  },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  phoneRowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  prefix: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1.5,
    borderRightColor: '#D1D5DB',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  phoneInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  phoneInput: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    fontSize: 18,
    letterSpacing: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  shiftRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shiftChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  shiftChipSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#EFF6FF',
  },
  shiftText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  shiftTextSelected: {
    color: '#1a73e8',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF4444',
  },
  button: {
    marginTop: 4,
  },
});
