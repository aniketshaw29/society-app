import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import type { VisitorLog, VisitorLogStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  VisitorLogStatus,
  { label: string; bg: string; text: string }
> = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  denied:   { label: 'Denied',   bg: '#FEE2E2', text: '#991B1B' },
  entered:  { label: 'Entered',  bg: '#DBEAFE', text: '#1E40AF' },
  exited:   { label: 'Exited',   bg: '#F3F4F6', text: '#374151' },
  expired:  { label: 'Expired',  bg: '#F3F4F6', text: '#9CA3AF' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VisitorCardProps {
  visitor: VisitorLog;
  onPress?: () => void;
  onMarkEntered?: () => void;
  onMarkExited?: () => void;
  justUpdated?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VisitorCard({
  visitor,
  onPress,
  onMarkEntered,
  onMarkExited,
  justUpdated = false,
}: VisitorCardProps) {
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Flash animation when status just changed
  useEffect(() => {
    if (!justUpdated) return;

    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, [justUpdated, visitor.status, flashAnim]);

  const flashColor =
    visitor.status === 'approved'
      ? 'rgba(16, 185, 129, 0.25)' // green
      : visitor.status === 'denied'
      ? 'rgba(239, 68, 68, 0.25)'  // red
      : 'transparent';

  const animatedBg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', flashColor],
  });

  const statusCfg = STATUS_CONFIG[visitor.status] ?? STATUS_CONFIG.pending;
  const timeAgo = formatTimeAgo(visitor.createdAt);
  const flatLabel = visitor.flat
    ? [visitor.flat.buildingName, visitor.flat.flatNumber].filter(Boolean).join(' - ')
    : visitor.flatId.slice(0, 8);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} testID={`visitor-card-${visitor.id}`}>
      <Animated.View style={[styles.card, { backgroundColor: animatedBg }]}>
        {/* Header row */}
        <View style={styles.row}>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {visitor.visitorName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {visitor.purpose ?? 'No purpose'} · {flatLabel}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.badgeText, { color: statusCfg.text }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Detail row */}
        <View style={styles.row}>
          <Text style={styles.meta}>
            {visitor.visitorPhone ?? 'No phone'}
            {visitor.vehicleNumber ? ` · ${visitor.vehicleNumber}` : ''}
          </Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Action buttons (guard actions) */}
        {(onMarkEntered || onMarkExited) && (
          <View style={styles.actions}>
            {visitor.status === 'approved' && onMarkEntered && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.enterBtn]}
                onPress={onMarkEntered}
                testID={`enter-btn-${visitor.id}`}
              >
                <Text style={styles.actionBtnText}>Mark Entered</Text>
              </TouchableOpacity>
            )}
            {visitor.status === 'entered' && onMarkExited && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.exitBtn]}
                onPress={onMarkExited}
                testID={`exit-btn-${visitor.id}`}
              >
                <Text style={styles.actionBtnText}>Mark Exited</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  enterBtn: {
    backgroundColor: '#10B981',
  },
  exitBtn: {
    backgroundColor: '#3B82F6',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
