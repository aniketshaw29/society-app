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
import { VisitorHistoryItem } from '@/components/resident/VisitorHistoryItem';
import type { HistoryFilters, VisitorLogStatus } from '@/types';

type StatusChip = VisitorLogStatus | '';

const STATUS_CHIPS: { key: StatusChip; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'entered', label: 'Entered' },
  { key: 'exited', label: 'Exited' },
];

export default function ResidentVisitorsScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusChip>('');
  const { visitors, loading, hasMore, total, fetchPage, loadMore } =
    useVisitorHistory('resident');

  const applyFilters = useCallback(
    (status: StatusChip) => {
      const filters: HistoryFilters = {
        status: status,
        limit: 20,
      };
      fetchPage(1, filters).catch(() => null);
    },
    [fetchPage]
  );

  useEffect(() => {
    applyFilters(statusFilter);
  }, [statusFilter, applyFilters]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadMore().catch(() => null);
    }
  }, [loading, hasMore, loadMore]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Visitors</Text>
        <Text style={styles.subtitle}>
          {total} visitor{total !== 1 ? 's' : ''} total
        </Text>
      </View>

      {/* Status filter chips */}
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

      {/* Visitor list */}
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
          loading ? (
            <ActivityIndicator style={styles.loader} color="#1a73e8" />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No visitors yet</Text>
              <Text style={styles.emptyHint}>
                Visitors will appear here once your guard logs them.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
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
  loader: {
    paddingVertical: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: '#D1D5DB',
    marginTop: 8,
    textAlign: 'center',
  },
});
