import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityItem } from '@/hooks/useAdminDashboard';

// ============================================================
// Types
// ============================================================

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

// ============================================================
// Time-ago helper
// ============================================================

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// ============================================================
// Status badge config
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  entered: { label: 'Entered', bg: '#DBEAFE', text: '#1E40AF' },
  exited: { label: 'Exited', bg: '#F3F4F6', text: '#374151' },
  denied: { label: 'Denied', bg: '#FEE2E2', text: '#991B1B' },
  active: { label: 'Active', bg: '#FEE2E2', text: '#991B1B' },
  resolved: { label: 'Resolved', bg: '#D1FAE5', text: '#065F46' },
};

// ============================================================
// Skeleton row
// ============================================================

function SkeletonRow() {
  return (
    <View style={[styles.row, styles.skeletonRow]}>
      <View style={[styles.iconCircle, { backgroundColor: '#E5E7EB' }]} />
      <View style={styles.rowBody}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

// ============================================================
// Single item
// ============================================================

function ActivityRow({ item }: { item: ActivityItem }) {
  const isVisitor = item.type === 'visitor';
  const isSos = item.type === 'sos';

  const iconName = isVisitor ? 'person-outline' : 'warning-outline';
  const iconColor = isSos ? '#DC2626' : '#1a73e8';
  const iconBg = isSos ? '#FEE2E2' : '#EFF6FF';

  const statusConf = STATUS_CONFIG[item.status] ?? { label: item.status, bg: '#F3F4F6', text: '#374151' };

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.summary} numberOfLines={1}>{item.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          <View style={[styles.badge, { backgroundColor: statusConf.bg }]}>
            <Text style={[styles.badgeText, { color: statusConf.text }]}>{statusConf.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// Component
// ============================================================

export function ActivityFeed({ items, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <View>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={36} color="#D1D5DB" />
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      renderItem={({ item }) => <ActivityRow item={item} />}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  skeletonRow: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
  },
  summary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F3F4F6',
    marginLeft: 50,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
});
