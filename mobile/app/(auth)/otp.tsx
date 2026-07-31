import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { maskPhone } from '@/utils/phone';
import { OtpInput } from '@/components/OtpInput';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyOtp, signInWithPhone } = useAuth();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Shake animation ref — passed down to OtpInput
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // ── Shake trigger ──────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Verify ─────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (code: string) => {
      if (!phone) {
        setError('Phone number missing. Please go back and try again.');
        return;
      }
      if (code.length !== OTP_LENGTH) return;

      setLoading(true);
      setError(null);

      try {
        const { isNewUser } = await verifyOtp(phone, code);

        if (isNewUser) {
          router.replace('/(onboarding)/choose');
        } else {
          router.replace('/(app)' as never);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Invalid OTP. Please try again.';
        setError(message);
        setOtp('');
        triggerShake();
      } finally {
        setLoading(false);
      }
    },
    [phone, verifyOtp, router, triggerShake]
  );

  // Auto-submit when all 6 digits are filled
  const handleOtpChange = (value: string) => {
    setOtp(value);
    if (error) setError(null);
    if (value.length === OTP_LENGTH) {
      handleVerify(value);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend || !phone || resending) return;

    setResending(true);
    setCanResend(false);
    setTimer(RESEND_SECONDS);
    setOtp('');
    setError(null);

    try {
      // Extract 10-digit number from +91XXXXXXXXXX
      const digits = phone.replace(/^\+91/, '');
      await signInWithPhone(digits);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not resend OTP. Please try again.';
      setError(message);
      setCanResend(true);
    } finally {
      setResending(false);
    }
  };

  const isComplete = otp.length === OTP_LENGTH;

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
        {/* Back link */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Change number"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← Change number</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>📱</Text>
          </View>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>
              {phone ? maskPhone(phone) : ''}
            </Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <OtpInput
            value={otp}
            onChange={handleOtpChange}
            length={OTP_LENGTH}
            disabled={loading}
            shakeAnim={shakeAnim}
            error={error ?? undefined}
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (!isComplete || loading) && styles.buttonDisabled]}
            onPress={() => handleVerify(otp)}
            disabled={!isComplete || loading}
            activeOpacity={0.85}
            testID="verify-button"
            accessibilityLabel="Verify"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {/* Resend row */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                accessibilityRole="button"
                accessibilityLabel="Resend OTP"
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#1B6B3A" />
                ) : (
                  <Text style={styles.resendActive}>Resend OTP</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendTimer}>
                Resend OTP in{' '}
                <Text style={styles.timerCount}>{timer}s</Text>
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.helpText}>
          Didn't receive the code? Check your SMS inbox or try resending.
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
    paddingTop: 56,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 32,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneHighlight: {
    color: BRAND_GREEN,
    fontWeight: '700',
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
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  button: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  resendRow: {
    alignItems: 'center',
    minHeight: 24,
  },
  resendTimer: {
    fontSize: 14,
    color: '#6B7280',
  },
  timerCount: {
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  resendActive: {
    fontSize: 14,
    color: BRAND_GREEN,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
