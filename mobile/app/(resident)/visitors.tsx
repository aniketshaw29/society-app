import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVisitorHistory } from '@/hooks/useVisitorHistory';
import { VisitorHistoryItem } from '@/components/resident/VisitorHistoryItem';
import VisitorHistoryFilters from '@/components/resident/VisitorHistoryFilters';
import type { HistoryFilters } from '@/types';

const DEFAULT_FILTERS: HistoryFilters = {
  status: '',
  limit: 20,
};

export default function ResidentVisitorsScreen() {
  const router = useRouter();

  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const { visitors, loading, hasMore, total, fetchPage, loadMore } =
    useVisitorHistory('resident');

  // Use a ref to track whether we're doing initial load
  const initialLoadDone = useRef(false);

  const applyFilters = useCallback(
    (f: HistoryFilters) => {
      fetchPage(1, { ...f, limit: 20 }).catch(() => null);
    },
    [fetchPage]
  );

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      applyFilters(DEFAULT_FILTERS);
    }
  }, [applyFilters]);

  // Re-fetch when filters change (after initial load)
  const handleFiltersChange = useCallback(
    (f: HistoryFilters) => {
      setFilters(f);
      applyFilters(f);
    },
    [applyFilters]
  );

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

      {/* Filter bar (search + date range + status chips) */}
      <VisitorHistoryFilters filters={filters} onChange={handleFiltersChange} />

      {/* Visitor list */}
      <FlatList
        data={visitors}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VisitorHistoryItem
            visitor={item}
            onPress={() =>
              router.push(`/(resident)/approve/${item.id}` as never)
            }
          />
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color="#1a73e8" />
          ) : hasMore ? null : visitors.length > 0 ? (
            <Text style={styles.endText}>All caught up</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {filters.search || filters.status || filters.dateRange
                  ? 'No visitors match your filters'
                  : 'No visitors yet'}
              </Text>
              <Text style={styles.emptyHint}>
                {filters.search || filters.status || filters.dateRange
                  ? 'Try adjusting the search or filters above.'
                  : 'Visitors will appear here once your guard logs them.'}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loader: {
    paddingVertical: 16,
  },
  endText: {
    fontSize: 12,
    color: '#D1D5DB',
    textAlign: 'center',
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
    lineHeight: 20,
  },
});
