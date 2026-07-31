import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { validateIndianPhone } from '@/utils/phone';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPhone } = useAuth();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const isValid = phone.length === 10 && validateIndianPhone(phone);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (error) setError(null);
  };

  const handleSendOtp = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      await signInWithPhone(phone);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: `+91${phone}` },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>SG</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.brand}>SocietyGate</Text>
          <Text style={styles.subtitle}>Enter your mobile number to continue</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Mobile Number</Text>

          <View
            style={[
              styles.phoneRow,
              error ? styles.phoneRowError : null,
              phone.length > 0 && !error ? styles.phoneRowActive : null,
            ]}
          >
            {/* +91 prefix — not editable */}
            <View style={styles.prefixContainer}>
              <Text style={styles.prefixFlag}>🇮🇳</Text>
              <Text style={styles.prefixText}>+91</Text>
            </View>

            <View style={styles.divider} />

            <TextInput
              ref={inputRef}
              style={styles.phoneInput}
              placeholder="98765 43210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={handleChangeText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
              editable={!loading}
              testID="phone-input"
              accessibilityLabel="Phone Number"
            />

            {phone.length === 10 && isValid && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.hintText}>
              A 6-digit OTP will be sent via SMS
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={!isValid || loading}
            activeOpacity={0.85}
            testID="send-otp-button"
            accessibilityLabel="Send OTP"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our{' '}
          <Text style={styles.disclaimerLink}>Terms of Service</Text> and{' '}
          <Text style={styles.disclaimerLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BRAND_GREEN = '#1B6B3A';
const BRAND_GREEN_DISABLED = '#8BB89E';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    marginBottom: 2,
  },
  brand: {
    fontSize: 30,
    color: BRAND_GREEN,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    overflow: 'hidden',
  },
  phoneRowActive: {
    borderColor: BRAND_GREEN,
    backgroundColor: '#FAFFFE',
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
    fontSize: 16,
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
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: '#111827',
    letterSpacing: 1.5,
  },
  checkmark: {
    paddingRight: 14,
    fontSize: 18,
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 20,
    marginLeft: 2,
  },
  button: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: BRAND_GREEN_DISABLED,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  disclaimerLink: {
    color: BRAND_GREEN,
    fontWeight: '500',
  },
});
