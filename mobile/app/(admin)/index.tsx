import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { KpiCard } from '@/components/admin/KpiCard';
import { VisitorTrendChart } from '@/components/admin/VisitorTrendChart';
import { ActivityFeed } from '@/components/admin/ActivityFeed';

// ============================================================
// Quick action config
// ============================================================

const QUICK_ACTIONS = [
  { label: 'Add Notice', icon: 'megaphone-outline', route: '/(admin)/notices/index' },
  { label: 'Reports', icon: 'bar-chart-outline', route: '/(admin)/reports/index' },
  { label: 'Manage', icon: 'settings-outline', route: '/(admin)/manage/buildings' },
] as const;

// ============================================================
// Screen
// ============================================================

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { stats, activity, loading, error, refresh } = useAdminDashboard();
  const societyStore = useSocietyStore();
  const societyName = societyStore.society?.name ?? 'Society';

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1a73e8"
            colors={['#1a73e8']}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.societyName} numberOfLines={1}>{societyName}</Text>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#1a73e8" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => router.push('/(admin)/manage/residents' as never)}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* ── Error banner ────────────────────────────────────── */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── KPI Grid ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.kpiGrid}>
          <KpiCard
            title="Total Flats"
            value={stats?.totalFlats ?? 0}
            icon="home-outline"
            color="#1a73e8"
            loading={loading}
          />
          <KpiCard
            title="Occupied"
            value={stats?.occupiedFlats ?? 0}
            icon="checkmark-circle-outline"
            color="#10B981"
            loading={loading}
          />
        </View>
        <View style={styles.kpiGrid}>
          <KpiCard
            title="Guards On Duty"
            value={stats?.guardsOnDuty ?? 0}
            icon="shield-outline"
            color="#8B5CF6"
            loading={loading}
          />
          <KpiCard
            title="Visitors Today"
            value={stats?.visitorsToday ?? 0}
            icon="walk-outline"
            color="#F59E0B"
            loading={loading}
          />
        </View>
        <View style={[styles.kpiGrid, styles.kpiGridSingle]}>
          <KpiCard
            title="Active SOS"
            value={stats?.activeSos ?? 0}
            icon="warning-outline"
            color={stats?.activeSos && stats.activeSos > 0 ? '#DC2626' : '#6B7280'}
            loading={loading}
          />
          <View style={styles.kpiSpacer} />
        </View>

        {/* ── Visitor Trend ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Visitor Trend (7 days)</Text>
        <View style={styles.card}>
          <VisitorTrendChart data={stats?.visitorTrend ?? []} />
        </View>

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={() => router.push(action.route as never)}
              activeOpacity={0.75}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={22} color="#1a73e8" />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Activity ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.card}>
          <ActivityFeed items={activity} loading={loading} />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// React import needed for useState
import React from 'react';

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  societyName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    flexShrink: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 0,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a73e8',
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },

  // Section title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    marginTop: 4,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiGridSingle: {
    marginBottom: 20,
  },
  kpiSpacer: {
    flex: 1,
  },

  // Card wrapper
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },

  bottomPad: {
    height: 24,
  },
});
