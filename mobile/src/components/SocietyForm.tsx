import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// ============================================================
// Indian States list
// ============================================================

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// ============================================================
// Types
// ============================================================

export interface SocietyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface SocietyFormErrors {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface SocietyFormProps {
  data: SocietyFormData;
  errors: SocietyFormErrors;
  onChange: (field: keyof SocietyFormData, value: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
}

// ============================================================
// Component
// ============================================================

export function SocietyForm({
  data,
  errors,
  onChange,
  onSubmit,
  submitLabel = 'Continue',
  loading = false,
}: SocietyFormProps) {
  const [showStatePicker, setShowStatePicker] = useState(false);

  return (
    <View style={styles.container}>
      <Input
        label="Society Name"
        placeholder="e.g. Sunrise Apartments"
        value={data.name}
        onChangeText={(v) => onChange('name', v)}
        error={errors.name}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Input
        label="Address"
        placeholder="Building/Street/Area"
        value={data.address}
        onChangeText={(v) => onChange('address', v)}
        error={errors.address}
        autoCapitalize="sentences"
        returnKeyType="next"
        multiline
        numberOfLines={2}
        style={styles.multiline}
      />

      <Input
        label="City"
        placeholder="e.g. Bangalore"
        value={data.city}
        onChangeText={(v) => onChange('city', v)}
        error={errors.city}
        autoCapitalize="words"
        returnKeyType="next"
      />

      {/* State picker */}
      <View style={styles.stateContainer}>
        <Text style={styles.label}>State</Text>
        <TouchableOpacity
          style={[styles.statePicker, errors.state ? styles.statePickerError : null]}
          onPress={() => setShowStatePicker((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Text style={[styles.statePickerText, !data.state && styles.placeholder]}>
            {data.state || 'Select State'}
          </Text>
          <Text style={styles.chevron}>{showStatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}

        {showStatePicker && (
          <ScrollView
            style={styles.stateDropdown}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {INDIAN_STATES.map((state) => (
              <TouchableOpacity
                key={state}
                style={[
                  styles.stateOption,
                  data.state === state && styles.stateOptionSelected,
                ]}
                onPress={() => {
                  onChange('state', state);
                  setShowStatePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.stateOptionText,
                    data.state === state && styles.stateOptionTextSelected,
                  ]}
                >
                  {state}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <Input
        label="Pincode"
        placeholder="6-digit pincode"
        value={data.pincode}
        onChangeText={(v) => onChange('pincode', v.replace(/\D/g, '').slice(0, 6))}
        error={errors.pincode}
        keyboardType="number-pad"
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />

      {onSubmit ? (
        <Button
          title={submitLabel}
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          style={styles.button}
        />
      ) : null}
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
  multiline: {
    height: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  stateContainer: {
    marginBottom: 16,
  },
  statePicker: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statePickerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  statePickerText: {
    fontSize: 16,
    color: '#111827',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  chevron: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF4444',
    lineHeight: 18,
  },
  stateDropdown: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    maxHeight: 220,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    zIndex: 999,
  },
  stateOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  stateOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  stateOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  stateOptionTextSelected: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
  },
});
