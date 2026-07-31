import { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { validateIndianPhone } from '@/utils/phone';

interface PhoneInputProps {
  value: string;
  onChangeText: (val: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Reusable Indian phone number input.
 * Renders a fixed "+91" prefix badge (non-editable), then a numeric TextInput.
 * Validates on blur — sets an inline error message if invalid.
 */
export function PhoneInput({ value, onChangeText, error, disabled = false }: PhoneInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChangeText(digits);
  };

  const isActive = value.length > 0;
  const isValid = value.length === 10 && validateIndianPhone(value);

  return (
    <View>
      <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
        <View
          style={[
            styles.phoneRow,
            isActive && !error ? styles.phoneRowActive : null,
            error ? styles.phoneRowError : null,
          ]}
        >
          {/* Non-editable +91 prefix */}
          <View style={styles.prefixContainer} accessibilityElementsHidden>
            <Text style={styles.prefixFlag}>🇮🇳</Text>
            <Text style={styles.prefixText}>+91</Text>
          </View>

          <View style={styles.divider} />

          <TextInput
            ref={inputRef}
            style={[styles.input, disabled && styles.inputDisabled]}
            placeholder="98765 43210"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={10}
            value={value}
            onChangeText={handleChangeText}
            editable={!disabled}
            returnKeyType="done"
            accessibilityLabel="Phone number input"
            testID="phone-input"
          />

          {isValid && !error ? (
            <Text style={styles.validIcon}>✓</Text>
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  phoneRowActive: {
    borderColor: BRAND_GREEN,
    backgroundColor: '#FAFFFD',
  },
  phoneRowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  prefixFlag: {
    fontSize: 15,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  divider: {
    width: 1.5,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: '#111827',
    letterSpacing: 1.5,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  validIcon: {
    paddingRight: 14,
    fontSize: 18,
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 2,
  },
});
