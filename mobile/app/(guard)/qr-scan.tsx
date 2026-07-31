import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { QRScanner } from '@/components/guard/QRScanner';
import { decodeQrPayload } from '@/lib/qrcode';
import api from '@/lib/api';
import type { VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScanState = 'idle' | 'scanning' | 'verifying' | 'success' | 'error';

interface VerifyQrResponse {
  visitor: VisitorLog;
  guestName: string;
  flatNumber: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_qr: 'Invalid QR code. Please scan the correct QR from the resident.',
  expired_qr: 'This QR code has expired (valid for 24 hours only).',
  already_used: 'This QR has already been used to admit a guest.',
  pre_approval_expired: 'The pre-approval for this QR has expired.',
  VALIDATION_ERROR: 'Malformed QR data. Please try again.',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function QrScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [result, setResult] = useState<VerifyQrResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleScan = useCallback(
    async (data: string) => {
      if (scanState !== 'scanning') return;

      // Quick client-side decode to show early error
      const decoded = decodeQrPayload(data);
      if (!decoded) {
        setScanState('error');
        setErrorCode('invalid_qr');
        return;
      }

      setScanState('verifying');

      try {
        const res = await api.post<VerifyQrResponse>('/pre-approvals/verify-qr', {
          qrPayload: data,
        });
        setResult(res.data);
        setScanState('success');
      } catch (err: unknown) {
        const code =
          (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error
            ?.code ?? 'invalid_qr';
        setErrorCode(code);
        setScanState('error');
      }
    },
    [scanState]
  );

  const handleReset = () => {
    setResult(null);
    setErrorCode(null);
    setScanState('scanning');
  };

  const handleEnterOTP = () => {
    router.back();
    // Navigate to OTP entry — assumes gate screen has OTP option
  };

  // ---- Verifying overlay ----
  if (scanState === 'verifying') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.verifyingText}>Verifying QR code…</Text>
      </SafeAreaView>
    );
  }

  // ---- Success ----
  if (scanState === 'success' && result) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.successContainer}>
            <View style={styles.successIconRing}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Guest Admitted!</Text>
            <Text style={styles.successGuest}>{result.guestName}</Text>
            {result.flatNumber && (
              <Text style={styles.successFlat}>Flat {result.flatNumber}</Text>
            )}
            <Text style={styles.successSubtitle}>Visitor log created via QR code</Text>

            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanAnotherBtn} onPress={handleReset}>
              <Text style={styles.scanAnotherText}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Error ----
  if (scanState === 'error') {
    const message = errorCode
      ? (ERROR_MESSAGES[errorCode] ?? `Error: ${errorCode}`)
      : 'An unexpected error occurred.';

    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconRing}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>Entry Denied</Text>
          <Text style={styles.errorMessage}>{message}</Text>

          <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
            <Text style={styles.retryBtnText}>Scan Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.otpBtn} onPress={handleEnterOTP}>
            <Text style={styles.otpBtnText}>Enter OTP Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Scanning ----
  return (
    <View style={styles.scannerContainer}>
      <QRScanner
        onScan={handleScan}
        onEnterOTP={handleEnterOTP}
        scanning={scanState === 'scanning'}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    gap: 16,
  },
  verifyingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scroll: { flexGrow: 1 },
  scannerContainer: { flex: 1 },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  successIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successIconText: { fontSize: 40, color: '#10B981' },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  successGuest: { fontSize: 20, fontWeight: '700', color: '#1B6B3A' },
  successFlat: { fontSize: 16, color: '#6B7280' },
  successSubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  doneBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  scanAnotherBtn: { paddingVertical: 12 },
  scanAnotherText: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorIconText: { fontSize: 36, color: '#EF4444', fontWeight: '700' },
  errorTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  errorMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  otpBtn: { paddingVertical: 10 },
  otpBtnText: { color: '#1a73e8', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
