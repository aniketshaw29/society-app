import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface ResidentFormData {
  fullName: string;
  phone: string;
  residentType: 'owner' | 'tenant';
}

export interface ResidentFormErrors {
  fullName?: string;
  phone?: string;
  residentType?: string;
}

interface ResidentFormProps {
  data: ResidentFormData;
  errors: ResidentFormErrors;
  onChange: (field: keyof ResidentFormData, value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
}

export function ResidentForm({
  data,
  errors,
  onChange,
  onSubmit,
  loading = false,
  submitLabel = 'Add Resident',
}: ResidentFormProps) {
  return (
    <View style={styles.container}>
      <Input
        label="Full Name"
        placeholder="e.g. Priya Sharma"
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

      {/* Resident type toggle */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Resident Type</Text>
        <View style={styles.toggleRow}>
          {(['owner', 'tenant'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.toggleChip,
                data.residentType === type && styles.toggleChipSelected,
              ]}
              onPress={() => onChange('residentType', type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  data.residentType === type && styles.toggleTextSelected,
                ]}
              >
                {type === 'owner' ? 'Owner' : 'Tenant'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.residentType ? <Text style={styles.errorText}>{errors.residentType}</Text> : null}
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
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  toggleChipSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#EFF6FF',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextSelected: {
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
