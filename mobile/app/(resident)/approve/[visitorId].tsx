import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVisitorApproval, type VisitorLog } from '@/hooks/useVisitorApproval';

// ============================================================
// Helpers
// ============================================================

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================
// Status badge
// ============================================================

function StatusBadge({ status }: { status: VisitorLog['status'] }) {
  const config: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    pending: { label: 'Pending', bg: '#FEF3C7', text: '#92400E' },
    approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
    denied: { label: 'Denied', bg: '#FEE2E2', text: '#991B1B' },
    entered: { label: 'Entered', bg: '#DBEAFE', text: '#1E40AF' },
    exited: { label: 'Exited', bg: '#F3F4F6', text: '#374151' },
    expired: { label: 'Expired', bg: '#F3F4F6', text: '#6B7280' },
  };
  const c = config[status] ?? config['pending']!;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ============================================================
// Main screen
// ============================================================

export default function ApproveVisitorScreen() {
  const { visitorId } = useLocalSearchParams<{ visitorId: string }>();
  const router = useRouter();
  const { fetchVisitorDetail, approveVisitor, denyVisitor } = useVisitorApproval();

  const [visitor, setVisitor] = useState<VisitorLog | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<'approve' | 'deny' | null>(null);
  const [done, setDone] = useState<'approved' | 'denied' | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load visitor details
  useEffect(() => {
    if (!visitorId) return;

    setPageLoading(true);
    fetchVisitorDetail(visitorId)
      .then((v) => setVisitor(v))
      .catch((err) => {
        const msg =
          err instanceof Error ? err.message : 'Could not load visitor details';
        setFetchError(msg);
      })
      .finally(() => setPageLoading(false));
  }, [visitorId, fetchVisitorDetail]);

  // Auto-close after successful action
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      router.back();
    }, 2000);
    return () => clearTimeout(timer);
  }, [done, router]);

  const handleApprove = useCallback(async () => {
    if (!visitorId || actionBusy) return;
    setActionBusy('approve');
    try {
      await approveVisitor(visitorId);
      setDone('approved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve visitor';
      Alert.alert('Error', msg);
    } finally {
      setActionBusy(null);
    }
  }, [visitorId, actionBusy, approveVisitor]);

  const handleDeny = useCallback(async () => {
    if (!visitorId || actionBusy) return;

    Alert.alert(
      'Deny Entry',
      'Are you sure you want to deny entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            setActionBusy('deny');
            try {
              await denyVisitor(visitorId);
              setDone('denied');
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Failed to deny visitor';
              Alert.alert('Error', msg);
            } finally {
              setActionBusy(null);
            }
          },
        },
      ]
    );
  }, [visitorId, actionBusy, denyVisitor]);

  // ── Loading state ────────────────────────────────────────
  if (pageLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color="#1B6B3A" />
      </SafeAreaView>
    );
  }

  // ── Error state ──────────────────────────────────────────
  if (fetchError || !visitor) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Text style={styles.errorText}>
          {fetchError ?? 'Visitor not found'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Success state (post-action) ──────────────────────────
  if (done) {
    const approved = done === 'approved';
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <View style={[styles.successIcon, { backgroundColor: approved ? '#D1FAE5' : '#FEE2E2' }]}>
          <Text style={styles.successEmoji}>{approved ? '✓' : '✕'}</Text>
        </View>
        <Text style={styles.successTitle}>
          {approved ? 'Entry Approved' : 'Entry Denied'}
        </Text>
        <Text style={styles.successSub}>Closing in a moment…</Text>
      </SafeAreaView>
    );
  }

  const alreadyActioned =
    visitor.status === 'approved' || visitor.status === 'denied';

  // ── Main view ────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Visitor photo */}
        <View style={styles.photoContainer}>
          {visitor.visitorPhotoUrl ? (
            <Image
              source={{ uri: visitor.visitorPhotoUrl }}
              style={styles.photo}
              accessibilityLabel={`Photo of ${visitor.visitorName}`}
            />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoInitials}>
                {getInitials(visitor.visitorName)}
              </Text>
            </View>
          )}
        </View>

        {/* Name + status */}
        <Text style={styles.visitorName}>{visitor.visitorName}</Text>
        <StatusBadge status={visitor.status} />

        {/* Details card */}
        <View style={styles.detailsCard}>
          <DetailRow label="Purpose" value={visitor.purpose} />
          <DetailRow label="Date" value={formatDate(visitor.createdAt)} />
          <DetailRow label="Time" value={formatTime(visitor.createdAt)} />
          {visitor.visitorPhone && (
            <DetailRow label="Phone" value={visitor.visitorPhone} />
          )}
          {visitor.vehicleNumber && (
            <DetailRow label="Vehicle" value={visitor.vehicleNumber} />
          )}
          {visitor.flat && (
            <DetailRow
              label="Flat"
              value={
                visitor.flat.buildingName
                  ? `${visitor.flat.buildingName} • ${visitor.flat.flatNumber}`
                  : visitor.flat.flatNumber
              }
            />
          )}
          {visitor.status === 'approved' && visitor.approvedAt && (
            <DetailRow
              label="Approved at"
              value={`${formatDate(visitor.approvedAt)} ${formatTime(visitor.approvedAt)}`}
            />
          )}
          {visitor.status === 'denied' && visitor.approvedAt && (
            <DetailRow
              label="Denied at"
              value={`${formatDate(visitor.approvedAt)} ${formatTime(visitor.approvedAt)}`}
            />
          )}
        </View>

        {/* Action buttons — only shown for pending visitors */}
        {!alreadyActioned && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.allowBtn,
                actionBusy !== null && styles.actionBtnDisabled,
              ]}
              onPress={handleApprove}
              disabled={actionBusy !== null}
              accessibilityRole="button"
              accessibilityLabel="Allow entry"
            >
              {actionBusy === 'approve' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.allowBtnText}>Allow Entry</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.denyBtn,
                actionBusy !== null && styles.actionBtnDisabled,
              ]}
              onPress={handleDeny}
              disabled={actionBusy !== null}
              accessibilityRole="button"
              accessibilityLabel="Deny entry"
            >
              {actionBusy === 'deny' ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text style={styles.denyBtnText}>Deny</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Already actioned message */}
        {alreadyActioned && (
          <View style={styles.alreadyActioned}>
            <Text style={styles.alreadyActionedText}>
              {visitor.status === 'approved'
                ? 'This visitor has already been approved by another family member.'
                : 'This visitor has already been denied by another family member.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Detail row sub-component
// ============================================================

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
});

// ============================================================
// Main styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
  },
  photoContainer: {
    marginBottom: 16,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
  },
  photoFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1B6B3A',
  },
  visitorName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  allowBtn: {
    backgroundColor: '#1B6B3A',
  },
  denyBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  denyBtnText: {
    color: '#DC2626',
    fontSize: 17,
    fontWeight: '700',
  },
  alreadyActioned: {
    marginTop: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  alreadyActionedText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1B6B3A',
    borderRadius: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#6B7280',
  },
});
