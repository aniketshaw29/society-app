import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import api from '@/lib/api';
import type { PreApproval } from '@/types';
import { PreApprovalQR } from '@/components/resident/PreApprovalQR';

// ---------------------------------------------------------------------------
// Pre-approval detail screen
// Route: /(resident)/pre-approvals/[id]
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  active: '#10B981',
  used: '#6B7280',
  cancelled: '#EF4444',
  expired: '#F59E0B',
};

export default function PreApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [preApproval, setPreApproval] = useState<PreApproval | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load pre-approval
  const loadPreApproval = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ preApproval: PreApproval }>(`/pre-approvals/${id}`);
      setPreApproval(res.data.preApproval);
    } catch {
      setError('Could not load pre-approval details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPreApproval();
  }, [loadPreApproval]);

  // Fetch QR payload
  const handleShowQr = async () => {
    if (!id || loadingQr) return;
    setLoadingQr(true);
    try {
      const res = await api.post<{ qrPayload: string }>(`/pre-approvals/${id}/qr`);
      setQrPayload(res.data.qrPayload);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code;
      const msg =
        code === 'already_used'
          ? 'This pre-approval has already been used.'
          : code === 'pre_approval_expired'
          ? 'This pre-approval has expired.'
          : 'Could not generate QR code.';
      Alert.alert('Error', msg);
    } finally {
      setLoadingQr(false);
    }
  };

  // Cancel pre-approval
  const handleCancel = () => {
    Alert.alert(
      'Cancel Pre-approval',
      `Are you sure you want to cancel the pre-approval for ${preApproval?.guestName ?? 'this guest'}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setCancelling(true);
            try {
              await api.delete(`/pre-approvals/${id}`);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not cancel pre-approval. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B3A" />
      </SafeAreaView>
    );
  }

  if (error || !preApproval) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Pre-approval not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadPreApproval}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const validFrom = new Date(preApproval.validFrom);
  const validUntil = new Date(preApproval.validUntil);
  const isActive = preApproval.status === 'active';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${STATUS_COLOR[preApproval.status] ?? '#6B7280'}20` },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: STATUS_COLOR[preApproval.status] ?? '#6B7280' },
              ]}
            >
              {preApproval.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Guest info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guest Details</Text>
          <DetailRow label="Name" value={preApproval.guestName} />
          {preApproval.guestPhone && (
            <DetailRow label="Phone" value={preApproval.guestPhone} />
          )}
          <DetailRow label="Valid From" value={validFrom.toLocaleString()} />
          <DetailRow label="Valid Until" value={validUntil.toLocaleString()} />
          {preApproval.purpose && (
            <DetailRow label="Note" value={preApproval.purpose} />
          )}
          {preApproval.usedAt && (
            <DetailRow label="Used At" value={new Date(preApproval.usedAt).toLocaleString()} />
          )}
        </View>

        {/* QR code section */}
        {isActive && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Show QR Code</Text>
            {qrPayload ? (
              <PreApprovalQR
                qrPayload={qrPayload}
                guestName={preApproval.guestName}
                validUntil={validUntil}
              />
            ) : (
              <TouchableOpacity
                style={styles.showQrBtn}
                onPress={handleShowQr}
                disabled={loadingQr}
              >
                {loadingQr ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.showQrBtnText}>Show QR Code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        {isActive && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Pre-approval</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 40 },
  statusRow: { flexDirection: 'row', marginBottom: 16 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
  showQrBtn: {
    backgroundColor: '#1B6B3A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  showQrBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1B6B3A',
    borderRadius: 8,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
