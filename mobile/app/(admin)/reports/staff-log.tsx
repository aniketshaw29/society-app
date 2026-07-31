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
import type { ReportFilters as Filters, StaffVisitReportRow } from '@/types';

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn[] = [
  { key: 'staffName', label: 'Staff Name', width: 130 },
  { key: 'staffCategory', label: 'Category', width: 100 },
  { key: 'flat', label: 'Flat', width: 80 },
  { key: 'building', label: 'Building', width: 100 },
  { key: 'staffPhone', label: 'Phone', width: 110 },
  { key: 'entryTime', label: 'Entry', width: 140 },
  { key: 'exitTime', label: 'Exit', width: 140 },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StaffLogScreen() {
  const params = useLocalSearchParams<{ fromDate?: string; toDate?: string }>();

  const [filters, setFilters] = useState<Filters>({
    fromDate: params.fromDate,
    toDate: params.toDate,
    page: 1,
    limit: 50,
  });
  const [rows, setRows] = useState<StaffVisitReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  const { fetchStaffReport, exportToCsv } = useAdminReports();

  const load = useCallback(
    async (f: Filters, p: number, append = false) => {
      setLoading(true);
      try {
        const result = await fetchStaffReport({ ...f, page: p });
        setRows((prev) => (append ? [...prev, ...result.visits] : result.visits));
        setTotal(result.total);
      } catch {
        Alert.alert('Error', 'Failed to load staff report.');
      } finally {
        setLoading(false);
      }
    },
    [fetchStaffReport]
  );

  useEffect(() => {
    void load(filters, 1, false);
    setPage(1);
  }, [filters]);

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
      await exportToCsv(rows as object[], 'staff-log');
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
        onChange={setFilters}
      />

      <View style={styles.toolbar}>
        <Text style={styles.totalText}>{total} record{total !== 1 ? 's' : ''}</Text>
        <ExportButton onPress={handleExport} loading={exporting} disabled={rows.length === 0} />
      </View>

      <ReportTable
        columns={COLUMNS}
        data={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No staff visit records for the selected period."
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
