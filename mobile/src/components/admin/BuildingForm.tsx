import {
  View,
  StyleSheet,
} from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface BuildingFormData {
  name: string;
  totalFloors: string;
}

export interface BuildingFormErrors {
  name?: string;
  totalFloors?: string;
}

interface BuildingFormProps {
  data: BuildingFormData;
  errors: BuildingFormErrors;
  onChange: (field: keyof BuildingFormData, value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
}

export function BuildingForm({
  data,
  errors,
  onChange,
  onSubmit,
  loading = false,
  submitLabel = 'Add Building',
}: BuildingFormProps) {
  return (
    <View style={styles.container}>
      <Input
        label="Building Name"
        placeholder="e.g. Tower A, Block 1"
        value={data.name}
        onChangeText={(v) => onChange('name', v)}
        error={errors.name}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Input
        label="Number of Floors"
        placeholder="e.g. 10"
        value={data.totalFloors}
        onChangeText={(v) => onChange('totalFloors', v.replace(/\D/g, ''))}
        error={errors.totalFloors}
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
  button: {
    marginTop: 4,
  },
});
