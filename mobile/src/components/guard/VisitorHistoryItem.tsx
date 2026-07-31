import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { VisitorLog, VisitorLogStatus } from '@/types';

const STATUS_CONFIG: Record<VisitorLogStatus, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  denied:   { label: 'Denied',   bg: '#FEE2E2', text: '#991B1B' },
  entered:  { label: 'Entered',  bg: '#DBEAFE', text: '#1E40AF' },
  exited:   { label: 'Exited',   bg: '#F3F4F6', text: '#374151' },
  expired:  { label: 'Expired',  bg: '#F3F4F6', text: '#9CA3AF' },
};

const PURPOSE_ICONS: Record<string, string> = {
  Guest: '👤',
  Delivery: '📦',
  Maintenance: '🔧',
  Cab: '🚗',
  Other: '🔹',
};

interface VisitorHistoryItemProps {
  visitor: VisitorLog;
  onPress?: () => void;
}

export function VisitorHistoryItem({ visitor, onPress }: VisitorHistoryItemProps) {
  const statusCfg = STATUS_CONFIG[visitor.status] ?? STATUS_CONFIG.pending;
  const purposeIcon = PURPOSE_ICONS[visitor.purpose ?? ''] ?? '🔹';
  const flatLabel = visitor.flat
    ? [visitor.flat.buildingName, visitor.flat.flatNumber].filter(Boolean).join(' - ')
    : visitor.flatId.slice(0, 8);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`history-item-${visitor.id}`}
    >
      <Text style={styles.icon}>{purposeIcon}</Text>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {visitor.visitorName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {flatLabel} · {visitor.purpose ?? 'No purpose'}
        </Text>
        <Text style={styles.time}>{formatDateTime(visitor.createdAt)}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
        <Text style={[styles.badgeText, { color: statusCfg.text }]}>
          {statusCfg.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
