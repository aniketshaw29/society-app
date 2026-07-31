import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SOSButton } from '@/components/resident/SOSButton';
import { SOSConfirmationModal } from '@/components/resident/SOSConfirmationModal';
import { useSOS } from '@/hooks/useSOS';
import type { SosAlert } from '@/types';

// ============================================================
// Helpers
// ============================================================

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ============================================================
// History row
// ============================================================

function SosHistoryRow({ alert }: { alert: SosAlert }) {
  const isActive = alert.status === 'active';
  return (
    <View style={histStyles.row}>
      <View
        style={[histStyles.dot, { backgroundColor: isActive ? '#DC2626' : '#9CA3AF' }]}
      />
      <View style={histStyles.info}>
        <Text style={histStyles.message} numberOfLines={2}>
          {alert.message}
        </Text>
        <Text style={histStyles.meta}>
          {formatRelative(alert.createdAt)}
          {alert.status === 'resolved' && alert.resolvedAt
            ? ` · Resolved ${formatRelative(alert.resolvedAt)}`
            : ''}
        </Text>
      </View>
      <View
        style={[
          histStyles.badge,
          { backgroundColor: isActive ? '#FEE2E2' : '#F3F4F6' },
        ]}
      >
        <Text
          style={[
            histStyles.badgeText,
            { color: isActive ? '#DC2626' : '#6B7280' },
          ]}
        >
          {isActive ? 'Active' : 'Resolved'}
        </Text>
      </View>
    </View>
  );
}

const histStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  info: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 3,
  },
  meta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ============================================================
// Success view
// ============================================================

function SuccessView({
  sosId,
  timestamp,
  onDismiss,
}: {
  sosId: string;
  timestamp: string;
  onDismiss: () => void;
}) {
  return (
    <View style={successStyles.container}>
      <Text style={successStyles.icon}>🚑</Text>
      <Text style={successStyles.title}>Help is on the way</Text>
      <Text style={successStyles.body}>
        All guards and the society admin have been alerted. Stay calm and wait
        for help.
      </Text>
      <View style={successStyles.metaBox}>
        <Text style={successStyles.metaLabel}>SOS ID</Text>
        <Text style={successStyles.metaValue} numberOfLines={1}>
          {sosId}
        </Text>
        <Text style={successStyles.metaLabel}>Alert sent at</Text>
        <Text style={successStyles.metaValue}>
          {new Date(timestamp).toLocaleString()}
        </Text>
      </View>
      <TouchableOpacity
        style={successStyles.safeBtn}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="I am safe now"
      >
        <Text style={successStyles.safeBtnText}>I'm safe now</Text>
      </TouchableOpacity>
    </View>
  );
}

const successStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 72,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  metaBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 28,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  safeBtn: {
    backgroundColor: '#1B6B3A',
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  safeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ============================================================
// Main Screen
// ============================================================

export default function SOSScreen() {
  const { trigger, history, loading, fetchHistory } = useSOS();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [triggeredId, setTriggeredId] = useState<string | null>(null);
  const [triggeredAt, setTriggeredAt] = useState<string | null>(null);

  // iOS-style fallback: on long-press completion show confirm modal
  // Android: direct trigger (SOSButton handles hold UX natively)
  const handleButtonTrigger = useCallback(() => {
    if (Platform.OS === 'ios') {
      setShowConfirmModal(true);
    } else {
      void doTrigger();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doTrigger = useCallback(async () => {
    setShowConfirmModal(false);
    try {
      const sos = await trigger();
      setTriggeredId(sos.id);
      setTriggeredAt(sos.createdAt);
      setTriggered(true);
    } catch (err) {
      console.error('[SOSScreen] trigger error:', err);
    }
  }, [trigger]);

  const handleDismissSuccess = useCallback(() => {
    setTriggered(false);
    setTriggeredId(null);
    setTriggeredAt(null);
    void fetchHistory();
  }, [fetchHistory]);

  // ── Success screen ───────────────────────────────────────
  if (triggered && triggeredId && triggeredAt) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'top']}>
        <SuccessView
          sosId={triggeredId}
          timestamp={triggeredAt}
          onDismiss={handleDismissSuccess}
        />
      </SafeAreaView>
    );
  }

  const recentHistory = history.slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Emergency Help</Text>
          <Text style={styles.subtitle}>
            Tap and hold to alert all guards and society admin
          </Text>
        </View>

        {/* SOS Button */}
        <View style={styles.buttonSection}>
          <SOSButton onTrigger={handleButtonTrigger} loading={loading} />
        </View>

        {/* Instructions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}>Hold the button for 3 seconds to send an alert</Text>
          <Text style={styles.infoRow}>Guards will be notified immediately</Text>
          <Text style={styles.infoRow}>Society admin will also be alerted</Text>
        </View>

        {/* History */}
        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Alerts</Text>
            {recentHistory.map((alert) => (
              <SosHistoryRow key={alert.id} alert={alert} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Confirmation modal (iOS fallback) */}
      <SOSConfirmationModal
        visible={showConfirmModal}
        onConfirm={() => void doTrigger()}
        onCancel={() => setShowConfirmModal(false)}
      />
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  buttonSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    gap: 8,
  },
  infoRow: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    paddingLeft: 4,
  },
  historySection: {
    width: '100%',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
});
