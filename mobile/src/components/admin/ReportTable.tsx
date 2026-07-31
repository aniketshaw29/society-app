import React from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableColumn {
  key: string;
  label: string;
  width: number;
}

interface ReportTableProps {
  columns: TableColumn[];
  data: Record<string, unknown>[];
  loading: boolean;
  emptyText?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportTable({
  columns,
  data,
  loading,
  emptyText = 'No data found.',
}: ReportTableProps) {
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  function renderCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  if (loading && data.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B3A" />
        <Text style={styles.loadingText}>Loading report…</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scrollH}>
      <View style={{ width: totalWidth }}>
        {/* Header */}
        <View style={styles.headerRow}>
          {columns.map((col) => (
            <View key={col.key} style={[styles.cell, { width: col.width }, styles.headerCell]}>
              <Text style={styles.headerText} numberOfLines={1}>{col.label}</Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {data.length === 0 && !loading ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(_item, index) => String(index)}
            renderItem={({ item, index }) => (
              <View style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt]}>
                {columns.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.cellText} numberOfLines={2}>
                      {renderCell(item[col.key])}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator size="small" color="#1B6B3A" style={styles.footerLoader} />
              ) : null
            }
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollH: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1B6B3A',
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  dataRowAlt: { backgroundColor: '#F9FAFB' },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    justifyContent: 'center',
  },
  headerCell: { borderRightColor: 'rgba(255,255,255,0.2)' },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cellText: { fontSize: 12, color: '#374151', lineHeight: 17 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: '#6B7280' },
  emptyRow: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  footerLoader: { marginVertical: 16 },
});
