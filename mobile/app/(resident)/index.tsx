import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useVisitorApproval, type VisitorLog } from '@/hooks/useVisitorApproval';
import VisitorApprovalCard from '@/components/resident/VisitorApprovalCard';

// ============================================================
// Helpers
// ============================================================

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function statusColor(status: VisitorLog['status']): string {
  const map: Record<string, string> = {
    pending: '#F59E0B',
    approved: '#10B981',
    denied: '#EF4444',
    entered: '#3B82F6',
    exited: '#6B7280',
    expired: '#9CA3AF',
  };
  return map[status] ?? '#6B7280';
}

// ============================================================
// Recent visitor row
// ============================================================

function RecentVisitorRow({ visitor }: { visitor: VisitorLog }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={recentStyles.row}
      onPress={() => router.push(`/(resident)/approve/${visitor.id}` as never)}
      activeOpacity={0.7}
    >
      <View style={recentStyles.info}>
        <Text style={recentStyles.name} numberOfLines={1}>
          {visitor.visitorName}
        </Text>
        <Text style={recentStyles.meta} numberOfLines={1}>
          {visitor.purpose} · {formatDate(visitor.createdAt)}{' '}
          {formatTime(visitor.createdAt)}
        </Text>
      </View>
      <View
        style={[
          recentStyles.statusDot,
          { backgroundColor: statusColor(visitor.status) },
        ]}
      />
    </TouchableOpacity>
  );
}

const recentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
});

// ============================================================
// Section header
// ============================================================

function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: number;
}) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>{title}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={sectionStyles.badge}>
          <Text style={sectionStyles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

// ============================================================
// Main screen
// ============================================================

export default function ResidentHomeScreen() {
  const router = useRouter();
  const { user, flatId, societyId } = useAuthStore((s) => ({
    user: s.user,
    flatId: s.flatId,
    societyId: s.societyId,
  }));

  const {
    fetchPendingForFlat,
    approveVisitor,
    denyVisitor,
    subscribeToFlatVisitors,
  } = useVisitorApproval();

  const [pending, setPending] = useState<VisitorLog[]>([]);
  const [recent, setRecent] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!flatId) return;
    try {
      const pendingList = await fetchPendingForFlat(flatId);
      setPending(pendingList);

      // Recent: last 10 (any status) — use supabase directly
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('visitor_logs')
        .select(
          `id, society_id, flat_id, guard_id,
           visitor_name, visitor_phone, visitor_photo_url,
           vehicle_number, purpose, entry_method, status,
           approved_by, approved_at, entry_time, exit_time,
           created_at, updated_at`
        )
        .eq('flat_id', flatId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecent(
          data.map((row) => ({
            id: row.id as string,
            societyId: (row.society_id as string) ?? '',
            flatId: (row.flat_id as string) ?? '',
            guardId: (row.guard_id as string | null) ?? null,
            visitorName: (row.visitor_name as string) ?? '',
            visitorPhone: (row.visitor_phone as string | null) ?? null,
            visitorPhotoUrl: (row.visitor_photo_url as string | null) ?? null,
            vehicleNumber: (row.vehicle_number as string | null) ?? null,
            purpose: (row.purpose as string) ?? '',
            entryMethod: (row.entry_method as string) ?? 'manual',
            status: (row.status as VisitorLog['status']) ?? 'pending',
            approvedBy: (row.approved_by as string | null) ?? null,
            approvedAt: (row.approved_at as string | null) ?? null,
            entryTime: (row.entry_time as string | null) ?? null,
            exitTime: (row.exit_time as string | null) ?? null,
            createdAt: (row.created_at as string) ?? '',
            updatedAt: (row.updated_at as string) ?? '',
          }))
        );
      }
    } catch (err) {
      console.error('[ResidentHome] loadData error:', err);
    }
  }, [flatId, fetchPendingForFlat]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Realtime subscription for pending visitors
  useEffect(() => {
    if (!flatId) return;
    const unsub = subscribeToFlatVisitors(flatId, (updated) => {
      setPending(updated);
    });
    return unsub;
  }, [flatId, subscribeToFlatVisitors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleApprove = useCallback(
    async (visitorId: string) => {
      try {
        await approveVisitor(visitorId);
        setPending((prev) => prev.filter((v) => v.id !== visitorId));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to approve visitor';
        Alert.alert('Error', msg);
      }
    },
    [approveVisitor]
  );

  const handleDeny = useCallback(
    async (visitorId: string) => {
      try {
        await denyVisitor(visitorId);
        setPending((prev) => prev.filter((v) => v.id !== visitorId));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to deny visitor';
        Alert.alert('Error', msg);
      }
    },
    [denyVisitor]
  );

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color="#1B6B3A" />
      </SafeAreaView>
    );
  }

  const displayName = user?.user_metadata?.full_name as string | undefined;

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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {displayName ? `Hi, ${displayName.split(' ')[0]}` : 'Welcome'}
            </Text>
            {flatId && (
              <Text style={styles.flatLabel}>Flat {flatId.slice(-6).toUpperCase()}</Text>
            )}
          </View>

          {/* SOS button */}
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={() => router.push('/(admin)/sos' as never)}
            accessibilityRole="button"
            accessibilityLabel="SOS emergency alert"
          >
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Pending approvals */}
        <SectionHeader
          title="Pending Approvals"
          badge={pending.length}
        />
        {pending.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No pending approvals</Text>
          </View>
        ) : (
          pending.map((v) => (
            <VisitorApprovalCard
              key={v.id}
              visitor={v}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          ))
        )}

        {/* Quick actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => Alert.alert('Pre-approve', 'Coming soon')}
            accessibilityRole="button"
          >
            <Text style={styles.quickBtnIcon}>👤</Text>
            <Text style={styles.quickBtnLabel}>Pre-approve Guest</Text>
          </TouchableOpacity>
        </View>

        {/* Recent visitors */}
        <SectionHeader title="Recent Visitors" />
        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No recent visitors</Text>
          </View>
        ) : (
          recent.map((v) => <RecentVisitorRow key={v.id} visitor={v} />)
        )}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  flatLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  sosBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  quickBtnIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  quickBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});

