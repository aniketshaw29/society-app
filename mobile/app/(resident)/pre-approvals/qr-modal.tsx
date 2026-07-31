import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import api from '@/lib/api';
import type { PreApproval } from '@/types';
import { PreApprovalQR } from '@/components/resident/PreApprovalQR';

// ---------------------------------------------------------------------------
// QR Modal — shown as a sheet from the pre-approvals list
// Route: /(resident)/pre-approvals/qr-modal?id=<pre_approval_id>
// ---------------------------------------------------------------------------

export default function QrModal() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [preApproval, setPreApproval] = useState<PreApproval | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('No pre-approval ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch pre-approval details + QR payload in parallel
      const [detailRes, qrRes] = await Promise.all([
        api.get<{ preApproval: PreApproval }>(`/pre-approvals/${id}`),
        api.post<{ qrPayload: string }>(`/pre-approvals/${id}/qr`),
      ]);

      setPreApproval(detailRes.data.preApproval);
      setQrPayload(qrRes.data.qrPayload);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code;

      if (code === 'already_used') {
        setError('This pre-approval has already been used.');
      } else if (code === 'pre_approval_expired') {
        setError('This pre-approval has expired.');
      } else if (code === 'NOT_FOUND') {
        setError('Pre-approval not found.');
      } else {
        setError('Could not generate QR code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClose = () => {
    router.back();
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} accessibilityLabel="Close">
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B6B3A" />
          <Text style={styles.loadingText}>Generating QR code…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error || !preApproval || !qrPayload) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} accessibilityLabel="Close">
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>QR Unavailable</Text>
          <Text style={styles.errorBody}>{error ?? 'Unknown error'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const validUntil = new Date(preApproval.validUntil);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guest QR Code</Text>
        <TouchableOpacity onPress={handleClose} accessibilityLabel="Close QR modal">
          <Text style={styles.closeBtn}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* QR Component — handles share internally */}
      <PreApprovalQR
        qrPayload={qrPayload}
        guestName={preApproval.guestName}
        validUntil={validUntil}
      />

      {/* Validity blurb */}
      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Guest</Text>
        <Text style={styles.infoValue}>{preApproval.guestName}</Text>
        {preApproval.guestPhone ? (
          <>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{preApproval.guestPhone}</Text>
          </>
        ) : null}
        <Text style={styles.infoLabel}>Valid Until</Text>
        <Text style={styles.infoValue}>{validUntil.toLocaleString()}</Text>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    fontSize: 16,
    color: '#1B6B3A',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#1B6B3A',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoBox: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
});
