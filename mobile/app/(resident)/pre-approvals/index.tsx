import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import api from '@/lib/api';
import { usePreApprovals } from '@/hooks/usePreApprovals';
import { PreApprovalCard } from '@/components/resident/PreApprovalCard';
import type { PreApproval } from '@/types';

// ============================================================
// Grouping helpers
// ============================================================

type GroupKey = 'Upcoming' | 'Used' | 'Cancelled';

interface Section {
  title: GroupKey;
  data: PreApproval[];
}

function groupPreApprovals(list: PreApproval[]): Section[] {
  const upcoming: PreApproval[] = [];
  const used: PreApproval[] = [];
  const cancelled: PreApproval[] = [];

  const now = new Date();

  for (const pa of list) {
    if (pa.status === 'used') {
      used.push(pa);
    } else if (pa.status === 'cancelled' || pa.status === 'locked') {
      cancelled.push(pa);
    } else {
      // active — may be upcoming or expired (expired still shown in upcoming with visual cue)
      upcoming.push(pa);
    }
  }

  // Sort upcoming: soonest valid_from first
  upcoming.sort(
    (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
  );

  const sections: Section[] = [];
  if (upcoming.length > 0) sections.push({ title: 'Upcoming', data: upcoming });
  if (used.length > 0) sections.push({ title: 'Used', data: used });
  if (cancelled.length > 0) sections.push({ title: 'Cancelled', data: cancelled });

  return sections;
}

// ============================================================
// Screen
// ============================================================

export default function PreApprovalsScreen() {
  const { preApprovals, loading, cancel, refresh } = usePreApprovals();
  const [refreshing, setRefreshing] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const sections = groupPreApprovals(preApprovals);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ── Cancel ──────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(
    (pa: PreApproval) => {
      Alert.alert(
        'Cancel Pre-Approval',
        `Cancel the pre-approval for ${pa.guestName}? They will not be able to enter using the OTP.`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancel(pa.id);
              } catch {
                Alert.alert('Error', 'Could not cancel the pre-approval. Please try again.');
              }
            },
          },
        ]
      );
    },
    [cancel]
  );

  // ── Resend OTP ──────────────────────────────────────────────────────────────

  const handleResendOtp = useCallback(async (pa: PreApproval) => {
    setResendingId(pa.id);
    try {
      await api.post('/pre-approvals/resend', { preApprovalId: pa.id });
      Alert.alert('OTP Sent', `A new OTP has been sent to ${pa.guestPhone}`);
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Please try again.');
    } finally {
      setResendingId(null);
    }
  }, []);

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!loading && preApprovals.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔑</Text>
          <Text style={styles.emptyTitle}>No Pre-Approvals Yet</Text>
          <Text style={styles.emptyBody}>
            Pre-approve guests so they can enter with a one-time OTP — no wait for your approval.
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/(resident)/pre-approvals/create')}
            testID="create-first-btn"
          >
            <Text style={styles.ctaBtnText}>Create First Pre-Approval</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Sections list ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <PreApprovalCard
            preApproval={item}
            onCancel={item.status === 'active' ? () => handleCancel(item) : undefined}
            onResendOtp={
              item.status === 'active'
                ? () => { void handleResendOtp(item); }
                : undefined
            }
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={null}
      />
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  list: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
