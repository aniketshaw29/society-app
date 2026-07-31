import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NoticeCard } from './NoticeCard';
import type { Notice } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoticeBoardProps {
  notices: Notice[];
  loading: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonBadge} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonBody} />
      <View style={styles.skeletonBodyShort} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoticeBoard({ notices, loading, onRefresh, refreshing }: NoticeBoardProps) {
  if (loading && notices.length === 0) {
    return (
      <View style={styles.container}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  const pinnedNotices = notices.filter((n) => n.isPinned);
  const unpinnedNotices = notices.filter((n) => !n.isPinned);

  const sections: Array<Notice | 'divider'> = [
    ...pinnedNotices,
    ...(pinnedNotices.length > 0 && unpinnedNotices.length > 0 ? (['divider'] as const) : []),
    ...unpinnedNotices,
  ];

  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => (item === 'divider' ? '__divider__' : item.id)}
      contentContainerStyle={styles.listContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptyBody}>
            Society announcements will appear here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item === 'divider') {
          return (
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Earlier</Text>
              <View style={styles.dividerLine} />
            </View>
          );
        }
        return <NoticeCard notice={item} />;
      }}
      ListFooterComponent={
        loading && notices.length > 0 ? (
          <ActivityIndicator size="small" color="#1B6B3A" style={styles.footerLoader} />
        ) : null
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptyBody: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Skeleton
  skeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  skeletonBadge: {
    width: 72,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '70%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    marginBottom: 6,
  },
  skeletonBody: {
    width: '100%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    marginBottom: 4,
  },
  skeletonBodyShort: {
    width: '55%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  footerLoader: {
    marginVertical: 16,
  },
});
