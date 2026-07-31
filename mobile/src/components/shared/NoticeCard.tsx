import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Notice, NoticeType } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIST(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const TYPE_CONFIG: Record<
  NoticeType,
  { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  urgent: { color: '#DC2626', bgColor: '#FEF2F2', icon: 'warning-outline', label: 'URGENT' },
  event: { color: '#2563EB', bgColor: '#EFF6FF', icon: 'calendar-outline', label: 'EVENT' },
  maintenance: { color: '#D97706', bgColor: '#FFFBEB', icon: 'construct-outline', label: 'MAINTENANCE' },
  general: { color: '#6B7280', bgColor: '#F9FAFB', icon: 'information-circle-outline', label: 'GENERAL' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoticeCardProps {
  notice: Notice;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoticeCard({ notice }: NoticeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[notice.noticeType] ?? TYPE_CONFIG.general;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: config.color }]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      {/* Header row: type badge + pinned badge */}
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={12} color={config.color} />
          <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
        </View>
        {notice.isPinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={11} color="#FFFFFF" />
            <Text style={styles.pinnedLabel}>PINNED</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
        {notice.title}
      </Text>

      {/* Body */}
      <Text
        style={styles.body}
        numberOfLines={expanded ? undefined : 2}
      >
        {notice.body}
      </Text>

      {/* Footer: time + expand hint */}
      <View style={styles.footer}>
        <Text style={styles.time}>
          {notice.publishedAt ? formatIST(notice.publishedAt) : '—'}
        </Text>
        <Text style={styles.expandHint}>
          {expanded ? 'Show less' : 'Read more'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  pinnedLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  expandHint: {
    fontSize: 11,
    color: '#1B6B3A',
    fontWeight: '600',
  },
});
