import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface FlatFormData {
  flatNumber: string;
  floor: string;
  buildingId: string;
}

export interface FlatFormErrors {
  flatNumber?: string;
  floor?: string;
  buildingId?: string;
}

interface BuildingOption {
  id: string;
  name: string;
}

interface FlatFormProps {
  data: FlatFormData;
  errors: FlatFormErrors;
  onChange: (field: keyof FlatFormData, value: string) => void;
  buildings: BuildingOption[];
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
}

export function FlatForm({
  data,
  errors,
  onChange,
  buildings,
  onSubmit,
  loading = false,
  submitLabel = 'Add Flat',
}: FlatFormProps) {
  return (
    <View style={styles.container}>
      {/* Building selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Building</Text>
        <View style={styles.buildingRow}>
          {buildings.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.buildingChip,
                data.buildingId === b.id && styles.buildingChipSelected,
              ]}
              onPress={() => onChange('buildingId', b.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buildingChipText,
                  data.buildingId === b.id && styles.buildingChipTextSelected,
                ]}
              >
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.buildingId ? (
          <Text style={styles.errorText}>{errors.buildingId}</Text>
        ) : null}
      </View>

      <Input
        label="Flat Number"
        placeholder="e.g. A-101, 204"
        value={data.flatNumber}
        onChangeText={(v) => onChange('flatNumber', v)}
        error={errors.flatNumber}
        autoCapitalize="characters"
        returnKeyType="next"
      />

      <Input
        label="Floor"
        placeholder="e.g. 1"
        value={data.floor}
        onChangeText={(v) => onChange('floor', v.replace(/\D/g, ''))}
        error={errors.floor}
        keyboardType="number-pad"
        maxLength={3}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />

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
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  buildingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buildingChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  buildingChipSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#EFF6FF',
  },
  buildingChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  buildingChipTextSelected: {
    color: '#1a73e8',
    fontWeight: '700',
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
