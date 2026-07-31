import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { usePreApprovals } from '@/hooks/usePreApprovals';
import { PreApprovalCard } from '@/components/resident/PreApprovalCard';
import {
  PreApprovalTabs,
  type PreApprovalTab,
} from '@/components/resident/PreApprovalTabs';
import type { PreApproval } from '@/types';

// ============================================================
// Helpers
// ============================================================

function isExpiredActive(pa: PreApproval): boolean {
  return pa.status === 'active' && new Date(pa.validUntil) < new Date();
}

function getTabItems(
  list: PreApproval[],
  tab: PreApprovalTab
): PreApproval[] {
  switch (tab) {
    case 'active':
      return list
        .filter((pa) => pa.status === 'active' && !isExpiredActive(pa))
        .sort(
          (a, b) =>
            new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
        );
    case 'used':
      return list
        .filter((pa) => pa.status === 'used')
        .sort(
          (a, b) =>
            new Date(b.usedAt ?? b.updatedAt).getTime() -
            new Date(a.usedAt ?? a.updatedAt).getTime()
        );
    case 'expired':
      return list
        .filter(
          (pa) =>
            pa.status === 'cancelled' ||
            pa.status === 'locked' ||
            isExpiredActive(pa)
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
  }
}

function getCounts(list: PreApproval[]) {
  return {
    active: list.filter((pa) => pa.status === 'active' && !isExpiredActive(pa))
      .length,
    used: list.filter((pa) => pa.status === 'used').length,
    expired: list.filter(
      (pa) =>
        pa.status === 'cancelled' ||
        pa.status === 'locked' ||
        isExpiredActive(pa)
    ).length,
  };
}

// ============================================================
// Screen
// ============================================================

export default function PreApprovalsScreen() {
  const { preApprovals, loading, cancel, refresh } = usePreApprovals();

  const [activeTab, setActiveTab] = useState<PreApprovalTab>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelPending, setCancelPending] = useState<string | null>(null);

  const counts = getCounts(preApprovals);
  const items = getTabItems(preApprovals, activeTab);

  // ── Pull-to-refresh ─────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ── Cancel ──────────────────────────────────────────────────
  const handleCancel = useCallback(
    (pa: PreApproval) => {
      Alert.alert(
        'Cancel Pre-Approval',
        `Cancel the pre-approval for ${pa.guestName}? They will not be able to enter using the QR or OTP.`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              setCancelPending(pa.id);
              try {
                await cancel(pa.id);
              } catch {
                Alert.alert(
                  'Error',
                  'Could not cancel the pre-approval. Please try again.'
                );
              } finally {
                setCancelPending(null);
              }
            },
          },
        ]
      );
    },
    [cancel]
  );

  // ── Show QR ─────────────────────────────────────────────────
  const handleShowQr = useCallback((pa: PreApproval) => {
    router.push(
      `/(resident)/pre-approvals/qr-modal?id=${pa.id}` as never
    );
  }, []);

  // ── Empty state ─────────────────────────────────────────────
  const renderEmpty = () => {
    const messages: Record<PreApprovalTab, { icon: string; title: string; body: string }> = {
      active: {
        icon: '🔑',
        title: 'No Active Pre-Approvals',
        body: 'Pre-approve guests so they can enter with a QR code or OTP — no wait for your approval.',
      },
      used: {
        icon: '✅',
        title: 'No Used Pre-Approvals',
        body: 'Pre-approvals that have been used by your guests will appear here.',
      },
      expired: {
        icon: '🕐',
        title: 'No Expired Pre-Approvals',
        body: 'Cancelled or expired pre-approvals will appear here.',
      },
    };

    const msg = messages[activeTab];

    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>{msg.icon}</Text>
        <Text style={styles.emptyTitle}>{msg.title}</Text>
        <Text style={styles.emptyBody}>{msg.body}</Text>
        {activeTab === 'active' && !loading && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/(resident)/pre-approvals/create')}
            testID="create-first-btn"
          >
            <Text style={styles.ctaBtnText}>Create First Pre-Approval</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render item ─────────────────────────────────────────────
  const renderItem = ({ item }: { item: PreApproval }) => {
    const isActive = item.status === 'active' && !isExpiredActive(item);
    const dimmed =
      item.status === 'cancelled' ||
      item.status === 'locked' ||
      isExpiredActive(item);

    return (
      <View style={dimmed ? styles.dimmedCard : undefined}>
        <PreApprovalCard
          preApproval={item}
          onCancel={isActive ? () => handleCancel(item) : undefined}
          onResendOtp={undefined}
        />
        {/* Active tab: "Show QR" button below card */}
        {isActive && (
          <TouchableOpacity
            style={styles.showQrBtn}
            onPress={() => handleShowQr(item)}
            accessibilityLabel={`Show QR for ${item.guestName}`}
          >
            <Text style={styles.showQrBtnText}>Show QR</Text>
          </TouchableOpacity>
        )}
        {/* Used tab: entry time + Approved badge */}
        {item.status === 'used' && item.usedAt && (
          <View style={styles.usedMeta}>
            <View style={styles.approvedBadge}>
              <Text style={styles.approvedBadgeText}>Approved</Text>
            </View>
            <Text style={styles.usedTime}>
              Entered {new Date(item.usedAt).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab bar */}
      <PreApprovalTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={counts}
      />

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B6B3A"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB — New Pre-approval */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(resident)/pre-approvals/create')}
        accessibilityRole="button"
        accessibilityLabel="New Pre-approval"
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabLabel}>New Pre-approval</Text>
      </TouchableOpacity>
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
    paddingTop: 8,
    paddingBottom: 96, // space for FAB
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: 96,
  },
  dimmedCard: {
    opacity: 0.6,
  },
  // Show QR button — rendered below the PreApprovalCard
  showQrBtn: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
    backgroundColor: BRAND_GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  showQrBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Used tab metadata
  usedMeta: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  approvedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  approvedBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  usedTime: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
    backgroundColor: BRAND_GREEN,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
