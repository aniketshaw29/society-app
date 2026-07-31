import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OtpVerifyForm } from '@/components/guard/OtpVerifyForm';
import { useOtpVerification } from '@/hooks/useOtpVerification';
import type { OtpVerifyResult } from '@/types';

// ============================================================
// OTP Entry Screen (Guard)
// ============================================================

type ScreenState = 'form' | 'success';

const AUTO_CLOSE_DELAY_MS = 3000;

export default function OtpVerifyScreen() {
  const { verify } = useOtpVerification();
  const [loading, setLoading] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [result, setResult] = useState<OtpVerifyResult | null>(null);

  // Scale-in animation for success card
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // ── Success animation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (screenState === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(guard)/gate');
        }
      }, AUTO_CLOSE_DELAY_MS);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [screenState, scaleAnim, opacityAnim]);

  // ── Verify handler ─────────────────────────────────────────────────────────

  const handleVerify = useCallback(
    async (guestPhone: string, otp: string) => {
      setLoading(true);
      try {
        const verifyResult = await verify(guestPhone, otp);
        setResult(verifyResult);
        setScreenState('success');
      } finally {
        setLoading(false);
      }
      // errors are thrown and caught by OtpVerifyForm
    },
    [verify]
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (screenState === 'success' && result) {
    const flatLabel = result.preApproval.flatNumber
      ? result.preApproval.buildingName
        ? `${result.preApproval.buildingName} – ${result.preApproval.flatNumber}`
        : result.preApproval.flatNumber
      : 'Unknown Flat';

    return (
      <SafeAreaView style={styles.successScreen} edges={['bottom']}>
        <Animated.View
          style={[
            styles.successCard,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
          testID="success-card"
        >
          <View style={styles.successIconCircle}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle} accessibilityLiveRegion="polite">
            Guest Admitted!
          </Text>

          <Text style={styles.successGuest}>{result.preApproval.guestName}</Text>
          <Text style={styles.successFlat}>{flatLabel}</Text>

          <Text style={styles.successHint}>Closing automatically…</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Form screen ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>OTP Entry</Text>
          <Text style={styles.subheading}>
            Enter the guest's phone number and the 6-digit OTP they received.
          </Text>

          <OtpVerifyForm onVerify={handleVerify} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 28,
  },

  // ── Success ──────────────────────────────────────────────────────────────
  successScreen: {
    flex: 1,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconText: {
    fontSize: 36,
    color: '#166534',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  successGuest: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  successFlat: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  successHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
