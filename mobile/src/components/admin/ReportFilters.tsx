import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { ReportFilters } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportFiltersProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  showGuardFilter?: boolean;
  showBuildingFilter?: boolean;
  showStatusFilter?: boolean;
  statusOptions?: string[];
}

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'This Week', days: 6 },
  { label: 'This Month', days: 29 },
];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportFilters({
  filters,
  onChange,
  showStatusFilter,
  statusOptions = ['pending', 'approved', 'denied', 'entered', 'exited', 'active', 'resolved'],
}: ReportFiltersProps) {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const fromDate = filters.fromDate ? new Date(filters.fromDate) : new Date();
  const toDate = filters.toDate ? new Date(filters.toDate) : new Date();

  function applyPreset(days: number) {
    const today = new Date();
    const from = new Date(Date.now() - days * 86400_000);
    onChange({ ...filters, fromDate: toDateStr(from), toDate: toDateStr(today) });
  }

  function handleFromChange(_e: DateTimePickerEvent, date?: Date) {
    setShowFromPicker(false);
    if (date) onChange({ ...filters, fromDate: toDateStr(date) });
  }

  function handleToChange(_e: DateTimePickerEvent, date?: Date) {
    setShowToPicker(false);
    if (date) onChange({ ...filters, toDate: toDateStr(date) });
  }

  const displayFrom = filters.fromDate
    ? new Date(filters.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'From';

  const displayTo = filters.toDate
    ? new Date(filters.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'To';

  return (
    <View style={styles.container}>
      {/* Quick presets */}
      <View style={styles.presetRow}>
        {DATE_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={styles.presetChip}
            onPress={() => applyPreset(p.days)}
          >
            <Text style={styles.presetText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date range pickers */}
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.dateBtnText}>{displayFrom}</Text>
        </TouchableOpacity>
        <Text style={styles.dateSep}>→</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.dateBtnText}>{displayTo}</Text>
        </TouchableOpacity>
      </View>

      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={toDate}
          onChange={handleFromChange}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={fromDate}
          maximumDate={new Date()}
          onChange={handleToChange}
        />
      )}

      {/* Status chips */}
      {showStatusFilter && (
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.statusChip, !filters.status && styles.statusChipActive]}
            onPress={() => onChange({ ...filters, status: undefined })}
          >
            <Text style={[styles.statusChipText, !filters.status && styles.statusChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {statusOptions.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, filters.status === s && styles.statusChipActive]}
              onPress={() => onChange({ ...filters, status: s })}
            >
              <Text style={[styles.statusChipText, filters.status === s && styles.statusChipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  presetText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dateBtnText: { fontSize: 13, color: '#374151' },
  dateSep: { fontSize: 14, color: '#9CA3AF' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statusChipActive: { backgroundColor: '#1B6B3A', borderColor: '#1B6B3A' },
  statusChipText: { fontSize: 12, color: '#374151' },
  statusChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
