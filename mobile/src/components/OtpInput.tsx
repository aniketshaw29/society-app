import {
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  Animated,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  disabled?: boolean;
  /** Pass a shared Animated.Value; the component applies a shake translateX when it changes */
  shakeAnim?: Animated.Value;
  error?: string;
}

/**
 * OTP input with individual digit boxes.
 * - Auto-advances forward on digit entry
 * - Backspace moves focus back
 * - Paste support: detects 6+ digit clipboard string and fills all boxes
 * - Shake animation driven by the shakeAnim prop (parent triggers it)
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  shakeAnim,
  error,
}: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Digits derived from value string
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  // Focus first empty box when value is cleared externally
  useEffect(() => {
    if (value === '') {
      inputRefs.current[0]?.focus();
    }
  }, [value]);

  // ── Per-box change ─────────────────────────────────────────────────────────
  const handleChange = (text: string, index: number) => {
    // Check for paste (length > 1 means the user pasted)
    const stripped = text.replace(/\D/g, '');
    if (stripped.length > 1) {
      const filled = stripped.slice(0, length);
      onChange(filled.padEnd(length, '').slice(0, length));
      const lastFilled = Math.min(filled.length - 1, length - 1);
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    const digit = stripped.slice(-1);
    const updatedDigits = [...digits];
    updatedDigits[index] = digit;
    const newValue = updatedDigits.join('');
    onChange(newValue);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ── Backspace ──────────────────────────────────────────────────────────────
  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (digits[index]) {
        // Clear current box
        const updatedDigits = [...digits];
        updatedDigits[index] = '';
        onChange(updatedDigits.join(''));
      } else if (index > 0) {
        // Move focus back and clear previous
        const updatedDigits = [...digits];
        updatedDigits[index - 1] = '';
        onChange(updatedDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const translateX = shakeAnim ?? new Animated.Value(0);

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
      >
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.box,
              digit ? styles.boxFilled : null,
              error ? styles.boxError : null,
              disabled && styles.boxDisabled,
            ]}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={length} // Allow >1 for paste detection on Android
            textAlign="center"
            selectTextOnFocus
            editable={!disabled}
            caretHidden
            accessibilityLabel={`OTP digit ${index + 1}`}
            testID={`otp-input-${index}`}
          />
        ))}
      </Animated.View>

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
  wrapper: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: BRAND_GREEN,
    backgroundColor: '#F0FFF7',
    color: BRAND_GREEN,
  },
  boxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
    color: '#DC2626',
  },
  boxDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
});
