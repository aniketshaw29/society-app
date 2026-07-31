import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpInput } from '@/components/OtpInput';
import type { OtpVerifyError } from '@/types';

// ============================================================
// OtpVerifyForm
// ============================================================

interface OtpVerifyFormProps {
  onVerify: (guestPhone: string, otp: string) => Promise<void>;
  loading?: boolean;
}

export function OtpVerifyForm({ onVerify, loading = false }: OtpVerifyFormProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const [attemptsInfo, setAttemptsInfo] = useState<string | undefined>();

  // Shake animation for wrong OTP
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50,  useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    let valid = true;

    if (!phone || phone.length !== 10) {
      setPhoneError('Enter a valid 10-digit phone number');
      valid = false;
    } else {
      setPhoneError(undefined);
    }

    if (!otp || otp.length !== 6) {
      setOtpError('Enter the 6-digit OTP');
      valid = false;
    } else {
      setOtpError(undefined);
    }

    return valid;
  }, [phone, otp]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setOtpError(undefined);
    setAttemptsInfo(undefined);

    try {
      await onVerify(phone, otp);
    } catch (raw: unknown) {
      const err = raw as OtpVerifyError;
      const code = err?.code;

      if (code === 'wrong_otp') {
        triggerShake();
        setOtp('');
        const remaining = err.attemptsRemaining;
        setOtpError('Incorrect OTP');
        if (remaining !== undefined) {
          setAttemptsInfo(
            `${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout`
          );
        }
      } else if (code === 'locked') {
        setOtpError('Pre-approval is locked. Ask resident to create a new one.');
      } else if (code === 'expired') {
        setOtpError('This pre-approval has expired.');
      } else if (code === 'already_used') {
        setOtpError('This OTP has already been used.');
      } else if (code === 'not_found') {
        setPhoneError('No active pre-approval found for this number.');
      } else {
        setOtpError(err?.message ?? 'Verification failed. Please try again.');
      }
    }
  }, [phone, otp, validate, onVerify, triggerShake]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View>
      {/* Guest Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Guest Phone</Text>
        <PhoneInput
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setPhoneError(undefined);
          }}
          error={phoneError}
        />
      </View>

      {/* OTP */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Guest's OTP</Text>
        <OtpInput
          value={otp}
          onChange={(v) => {
            setOtp(v);
            setOtpError(undefined);
            setAttemptsInfo(undefined);
          }}
          shakeAnim={shakeAnim}
          error={otpError}
          disabled={loading}
        />
        {attemptsInfo ? (
          <Text style={styles.attemptsText}>{attemptsInfo}</Text>
        ) : null}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.verifyBtn, loading ? styles.verifyBtnDisabled : null]}
        onPress={handleSubmit}
        disabled={loading}
        testID="verify-btn"
        accessibilityLabel="Verify and Allow Entry"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.verifyBtnText}>Verify &amp; Allow Entry</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  attemptsText: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  verifyBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
