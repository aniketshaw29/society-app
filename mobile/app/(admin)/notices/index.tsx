import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotices } from '@/hooks/useNotices';
import type { Notice, NoticeType, NoticeStatus } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<NoticeType, string> = {
  urgent: '#DC2626',
  event: '#2563EB',
  maintenance: '#D97706',
  general: '#6B7280',
};

const STATUS_COLORS: Record<NoticeStatus, { bg: string; text: string }> = {
  published: { bg: '#DCFCE7', text: '#166534' },
  draft: { bg: '#FEF9C3', text: '#92400E' },
  archived: { bg: '#F3F4F6', text: '#6B7280' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

// ---------------------------------------------------------------------------
// Notice Management Card
// ---------------------------------------------------------------------------

interface NoticeManageCardProps {
  notice: Notice;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
}

function NoticeManageCard({ notice, onEdit, onArchive }: NoticeManageCardProps) {
  const statusStyle = STATUS_COLORS[notice.status] ?? STATUS_COLORS.published;
  const typeColor = TYPE_COLORS[notice.noticeType] ?? '#6B7280';

  return (
    <View style={[styles.card, { borderLeftColor: typeColor }]}>
      <View style={styles.cardTop}>
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {notice.noticeType.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {notice.status.toUpperCase()}
            </Text>
          </View>
          {notice.isPinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={10} color="#F97316" />
            </View>
          )}
        </View>

        {notice.status !== 'archived' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onEdit(notice.id)}
            >
              <Ionicons name="pencil-outline" size={16} color="#1a73e8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onArchive(notice.id)}
            >
              <Ionicons name="archive-outline" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{notice.title}</Text>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>
            {notice.audience === 'all'
              ? 'Everyone'
              : notice.audience === 'guards'
              ? 'Guards'
              : 'Building'}
          </Text>
        </View>
        <Text style={styles.metaDate}>
          {notice.status === 'draft' && notice.scheduledAt
            ? `Scheduled: ${formatDate(notice.scheduledAt)}`
            : notice.publishedAt
            ? formatDate(notice.publishedAt)
            : formatDate(notice.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

type Tab = 'published' | 'draft' | 'archived';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AdminNoticesScreen() {
  const { notices, loading, archive, refresh } = useNotices('admin');
  const [activeTab, setActiveTab] = useState<Tab>('published');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filtered = notices.filter((n) => n.status === activeTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && filtered.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <NoticeManageCard
              notice={item}
              onEdit={(id) => router.push(`/(admin)/notices/edit?id=${id}`)}
              onArchive={(id) => void archive(id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No {activeTab} notices</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(admin)/notices/create')}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1a73e8',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#1a73e8' },
  listContent: { padding: 16, paddingBottom: 88 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  pinnedBadge: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 30, height: 30,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  metaDate: { fontSize: 11, color: '#9CA3AF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
