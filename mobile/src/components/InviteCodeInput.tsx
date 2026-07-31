import { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

const CODE_LENGTH = 6;
// Disallow O, 0, I, 1 to avoid confusion (matching backend)
const ALLOWED_REGEX = /^[A-HJ-NP-Z2-9]$/;

interface InviteCodeInputProps {
  value: string[];
  onChange: (chars: string[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * 6-box invite code input — each box accepts one uppercase alphanumeric
 * character. Excludes ambiguous characters O, 0, I, 1.
 */
export function InviteCodeInput({
  value,
  onChange,
  error,
  disabled = false,
}: InviteCodeInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (char: string, index: number) => {
    const upper = char.toUpperCase();
    // Strip disallowed chars
    const valid = upper.replace(/[^A-HJ-NP-Z2-9]/g, '').slice(-1);
    const updated = [...value];
    updated[index] = valid;
    onChange(updated);

    if (valid && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (value[index]) {
        // Clear current box
        const updated = [...value];
        updated[index] = '';
        onChange(updated);
      } else if (index > 0) {
        // Move to previous box
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (text: string, startIndex: number) => {
    // Handle paste: fill as many boxes as possible from startIndex
    const cleaned = text.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
    if (!cleaned.length) return;
    const updated = [...value];
    let charIdx = 0;
    for (let i = startIndex; i < CODE_LENGTH && charIdx < cleaned.length; i++) {
      updated[i] = cleaned[charIdx++];
    }
    onChange(updated);
    // Focus the next empty box
    const nextEmpty = updated.findIndex((c, i) => i >= startIndex && !c);
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus();
    } else {
      inputRefs.current[CODE_LENGTH - 1]?.focus();
    }
  };

  return (
    <View>
      <View style={styles.row}>
        {value.map((char, index) => (
          <TextInput
            key={index}
            ref={(r) => { inputRefs.current[index] = r; }}
            style={[
              styles.box,
              char ? styles.boxFilled : null,
              error ? styles.boxError : null,
            ]}
            value={char}
            onChangeText={(t) => {
              if (t.length > 1) {
                // Multi-char likely from paste
                handlePaste(t, index);
              } else {
                handleChange(t, index);
              }
            }}
            onKeyPress={(e) => handleKeyPress(e, index)}
            maxLength={6} // allow paste detection
            autoCapitalize="characters"
            autoCorrect={false}
            textAlign="center"
            selectTextOnFocus
            editable={!disabled}
            keyboardType="default"
            contextMenuHidden={false}
          />
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Text style={styles.hint}>Enter the 6-character code (no O, 0, I, 1)</Text>

      {/* Quick clear button */}
      {value.some(Boolean) && !disabled && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            onChange(Array(CODE_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
          }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#F9FAFB',
    textTransform: 'uppercase',
  },
  boxFilled: {
    borderColor: '#1a73e8',
    backgroundColor: '#EFF6FF',
  },
  boxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#EF4444',
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  clearText: {
    fontSize: 13,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
});
