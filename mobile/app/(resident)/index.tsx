import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { useResidentDashboard } from '@/hooks/useResidentDashboard';
import DashboardHeader from '@/components/resident/DashboardHeader';
import PendingApprovalBanner from '@/components/resident/PendingApprovalBanner';
import RecentVisitorsFeed from '@/components/resident/RecentVisitorsFeed';
import QuickActions from '@/components/resident/QuickActions';

// ============================================================
// Section header
// ============================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ============================================================
// Skeleton placeholders
// ============================================================

function SkeletonBanner() {
  return <View style={styles.skeletonBanner} />;
}

function SkeletonActions() {
  return (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

// ============================================================
// Main screen
// ============================================================

export default function ResidentHomeScreen() {
  const router = useRouter();
  const { user, flatId } = useAuthStore((s) => ({ user: s.user, flatId: s.flatId }));
  const { society } = useSocietyStore((s) => ({ society: s.society }));

  const { pendingCount, recentVisitors, loading, refresh } =
    useResidentDashboard(flatId);

  // Derive display values from auth metadata
  const fullName =
    (user?.user_metadata?.['full_name'] as string | undefined) ?? 'Resident';
  const flatNumber =
    (user?.user_metadata?.['flat_number'] as string | undefined) ??
    (flatId ? flatId.slice(-6).toUpperCase() : '');
  const societyName = society?.name ?? 'My Society';

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B6B3A"
          />
        }
      >
        {/* ── Header ────────────────────────────────────────── */}
        <DashboardHeader
          name={fullName}
          flatNumber={flatNumber}
          societyName={societyName}
        />

        {/* ── Pending Approval Banner ────────────────────────── */}
        <View style={styles.bannerWrap}>
          {loading ? (
            <SkeletonBanner />
          ) : (
            <PendingApprovalBanner
              count={pendingCount}
              onPress={() => router.push('/(resident)/visitors' as never)}
            />
          )}
        </View>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <SectionHeader title="Quick Actions" />
        {loading ? (
          <SkeletonActions />
        ) : (
          <QuickActions
            onPreApprove={() =>
              router.push('/(resident)/pre-approvals/create' as never)
            }
            onStaff={() => router.push('/(resident)/staff' as never)}
            onMembers={() =>
              router.push('/(resident)/flat-members' as never)
            }
            onSOS={() => router.push('/(resident)/sos' as never)}
          />
        )}

        {/* ── Recent Visitors ───────────────────────────────── */}
        <SectionHeader title="Recent Visitors" />
        <RecentVisitorsFeed visitors={recentVisitors} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bannerWrap: {
    marginTop: 16,
  },
  // Skeleton placeholders
  skeletonBanner: {
    height: 68,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonCard: {
    width: '47%',
    height: 90,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
});
