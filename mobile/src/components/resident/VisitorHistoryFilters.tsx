import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HistoryFilters, HistoryDateRange, VisitorLogStatus } from '@/types';

// ============================================================
// Types
// ============================================================

interface VisitorHistoryFiltersProps {
  filters: HistoryFilters;
  onChange: (f: HistoryFilters) => void;
}

type DateChip = { key: HistoryDateRange | ''; label: string };
type StatusChip = { key: VisitorLogStatus | ''; label: string };

const DATE_CHIPS: DateChip[] = [
  { key: '',       label: 'All Time' },
  { key: 'today',  label: 'Today' },
  { key: 'week',   label: 'This Week' },
  { key: 'month',  label: 'This Month' },
];

const STATUS_CHIPS: StatusChip[] = [
  { key: '',         label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied',   label: 'Denied' },
  { key: 'entered',  label: 'Entered' },
  { key: 'exited',   label: 'Exited' },
];

// ============================================================
// Component
// ============================================================

export default function VisitorHistoryFilters({
  filters,
  onChange,
}: VisitorHistoryFiltersProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ ...filters, search: text, page: 1 });
      }, 300);
    },
    [filters, onChange]
  );

  const handleDateChip = useCallback(
    (key: HistoryDateRange | '') => {
      onChange({
        ...filters,
        dateRange: key || undefined,
        fromDate: undefined,
        toDate: undefined,
        page: 1,
      });
    },
    [filters, onChange]
  );

  const handleStatusChip = useCallback(
    (key: VisitorLogStatus | '') => {
      onChange({ ...filters, status: key, page: 1 });
    },
    [filters, onChange]
  );

  const currentSearch = filters.search ?? '';
  const currentDate = filters.dateRange ?? '';
  const currentStatus = filters.status ?? '';

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by visitor name..."
          placeholderTextColor="#9CA3AF"
          defaultValue={currentSearch}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
      </View>

      {/* Date range chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {DATE_CHIPS.map((chip) => (
          <TouchableOpacity
            key={`date-${chip.key || 'all'}`}
            style={[
              styles.chip,
              currentDate === chip.key && styles.chipActive,
            ]}
            onPress={() => handleDateChip(chip.key as HistoryDateRange | '')}
          >
            <Text
              style={[
                styles.chipText,
                currentDate === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {STATUS_CHIPS.map((chip) => (
          <TouchableOpacity
            key={`status-${chip.key || 'all'}`}
            style={[
              styles.chip,
              currentStatus === chip.key && styles.chipActiveStatus,
            ]}
            onPress={() => handleStatusChip(chip.key as VisitorLogStatus | '')}
            testID={`status-chip-${chip.key || 'all'}`}
          >
            <Text
              style={[
                styles.chipText,
                currentStatus === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  chipRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#1B6B3A',
  },
  chipActiveStatus: {
    backgroundColor: '#1a73e8',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
