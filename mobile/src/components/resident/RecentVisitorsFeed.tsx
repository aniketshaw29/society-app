import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { VisitorLog } from '@/hooks/useVisitorApproval';

// ============================================================
// Helpers
// ============================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#D97706' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  denied:   { label: 'Denied',   bg: '#FEE2E2', text: '#991B1B' },
  entered:  { label: 'Entered',  bg: '#DBEAFE', text: '#1D4ED8' },
  exited:   { label: 'Exited',   bg: '#F3F4F6', text: '#4B5563' },
  expired:  { label: 'Expired',  bg: '#F3F4F6', text: '#9CA3AF' },
};

// ============================================================
// Skeleton row
// ============================================================

function SkeletonRow() {
  return (
    <View style={skeletonStyles.row}>
      <View style={skeletonStyles.circle} />
      <View style={skeletonStyles.textGroup}>
        <View style={[skeletonStyles.line, { width: '55%' }]} />
        <View style={[skeletonStyles.line, { width: '35%', marginTop: 6 }]} />
      </View>
      <View style={skeletonStyles.badge} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  textGroup: { flex: 1 },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  badge: {
    width: 60,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    marginLeft: 10,
  },
});

// ============================================================
// Visitor row
// ============================================================

function VisitorRow({ visitor }: { visitor: VisitorLog }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[visitor.status] ?? STATUS_CONFIG['expired']!;
  const initials = visitor.visitorName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        router.push(`/(resident)/approve/${visitor.id}` as never)
      }
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {visitor.visitorName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {visitor.purpose} · {timeAgo(visitor.createdAt)}
        </Text>
      </View>

      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.badgeText, { color: cfg.text }]}>
          {cfg.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Main component
// ============================================================

interface RecentVisitorsFeedProps {
  visitors: VisitorLog[];
  loading: boolean;
}

export default function RecentVisitorsFeed({
  visitors,
  loading,
}: RecentVisitorsFeedProps) {
  if (loading) {
    return (
      <View>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  if (visitors.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyText}>No visitors yet</Text>
        <Text style={styles.emptyHint}>
          Visitors logged by your guard will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {visitors.map((v) => (
        <VisitorRow key={v.id} visitor={v} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  info: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});
