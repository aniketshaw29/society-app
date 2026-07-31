import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAdminReports } from '@/hooks/useAdminReports';
import { ReportFilters } from '@/components/admin/ReportFilters';
import { ReportTable, TableColumn } from '@/components/admin/ReportTable';
import { ExportButton } from '@/components/admin/ExportButton';
import type { ReportFilters as Filters, VisitorReportRow } from '@/types';

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Visitor', width: 130 },
  { key: 'flat', label: 'Flat', width: 80 },
  { key: 'building', label: 'Building', width: 100 },
  { key: 'purpose', label: 'Purpose', width: 90 },
  { key: 'status', label: 'Status', width: 80 },
  { key: 'guard', label: 'Guard', width: 110 },
  { key: 'entryTime', label: 'Entry', width: 130 },
  { key: 'exitTime', label: 'Exit', width: 130 },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VisitorLogScreen() {
  const params = useLocalSearchParams<{ fromDate?: string; toDate?: string }>();

  const [filters, setFilters] = useState<Filters>({
    fromDate: params.fromDate,
    toDate: params.toDate,
    page: 1,
    limit: 50,
  });
  const [rows, setRows] = useState<VisitorReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  const { fetchVisitorReport, exportToCsv } = useAdminReports();

  const load = useCallback(
    async (f: Filters, p: number, append = false) => {
      setLoading(true);
      try {
        const result = await fetchVisitorReport({ ...f, page: p });
        setRows((prev) => (append ? [...prev, ...result.visitors] : result.visitors));
        setTotal(result.total);
      } catch {
        Alert.alert('Error', 'Failed to load visitor report.');
      } finally {
        setLoading(false);
      }
    },
    [fetchVisitorReport]
  );

  useEffect(() => {
    void load(filters, 1, false);
    setPage(1);
  }, [filters]);

  function handleFiltersChange(f: Filters) {
    setFilters(f);
  }

  function handleLoadMore() {
    if (rows.length < total && !loading) {
      const next = page + 1;
      setPage(next);
      void load(filters, next, true);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportToCsv(rows as object[], 'visitor-log');
    } catch {
      Alert.alert('Error', 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ReportFilters
        filters={filters}
        onChange={handleFiltersChange}
        showStatusFilter
        statusOptions={['pending', 'approved', 'denied', 'entered', 'exited']}
      />

      <View style={styles.toolbar}>
        <Text style={styles.totalText}>{total} record{total !== 1 ? 's' : ''}</Text>
        <ExportButton onPress={handleExport} loading={exporting} disabled={rows.length === 0} />
      </View>

      <ReportTable
        columns={COLUMNS}
        data={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyText="No visitor records for the selected period."
      />

      {rows.length < total && !loading && (
        <View style={styles.loadMoreRow}>
          <Text style={styles.loadMoreBtn} onPress={handleLoadMore}>
            Load more ({total - rows.length} remaining)
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  totalText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  loadMoreRow: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  loadMoreBtn: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
});
