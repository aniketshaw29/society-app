import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useVisitorHistory } from '@/hooks/useVisitorHistory';
import { VisitorHistoryItem } from '@/components/guard/VisitorHistoryItem';
import type { HistoryFilters, VisitorLogStatus } from '@/types';

// ---------------------------------------------------------------------------
// Date range tabs
// ---------------------------------------------------------------------------

type DateTab = 'today' | 'week' | 'month';

const DATE_TABS: { key: DateTab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

// ---------------------------------------------------------------------------
// Status filter chips
// ---------------------------------------------------------------------------

type StatusChip = VisitorLogStatus | '';

const STATUS_CHIPS: { key: StatusChip; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'entered', label: 'Entered' },
  { key: 'exited', label: 'Exited' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GuardHistoryScreen() {
  const [dateTab, setDateTab] = useState<DateTab>('today');
  const [statusFilter, setStatusFilter] = useState<StatusChip>('');
  const { visitors, loading, hasMore, total, fetchPage, loadMore } =
    useVisitorHistory('guard');

  const applyFilters = useCallback(
    (tab: DateTab, status: StatusChip) => {
      const filters: HistoryFilters = {
        dateRange: tab,
        status: status,
        limit: 20,
      };
      fetchPage(1, filters).catch(() => null);
    },
    [fetchPage]
  );

  // Initial load and re-fetch when filters change
  useEffect(() => {
    applyFilters(dateTab, statusFilter);
  }, [dateTab, statusFilter, applyFilters]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadMore().catch(() => null);
    }
  }, [loading, hasMore, loadMore]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Date tabs */}
      <View style={styles.tabRow}>
        {DATE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, dateTab === tab.key && styles.tabActive]}
            onPress={() => setDateTab(tab.key)}
            testID={`date-tab-${tab.key}`}
          >
            <Text
              style={[styles.tabText, dateTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status chips */}
      <FlatList
        horizontal
        data={STATUS_CHIPS}
        keyExtractor={(c) => c.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        renderItem={({ item: chip }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === chip.key && styles.chipActive]}
            onPress={() => setStatusFilter(chip.key)}
            testID={`status-chip-${chip.key || 'all'}`}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Result count */}
      {!loading && (
        <Text style={styles.resultCount}>
          {total} visitor{total !== 1 ? 's' : ''}
        </Text>
      )}

      {/* List */}
      <FlatList
        data={visitors}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VisitorHistoryItem
            visitor={item}
            onPress={() => router.push(`/(guard)/visitor-detail/${item.id}`)}
          />
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading ? <ActivityIndicator style={styles.loader} color="#1a73e8" /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No visitors found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1a73e8',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1a73e8',
    fontWeight: '700',
  },
  chipsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#1a73e8',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  loader: {
    paddingVertical: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
