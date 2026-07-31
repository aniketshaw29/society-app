import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// ---------------------------------------------------------------------------
// Reports hub screen
// ---------------------------------------------------------------------------

type DatePreset = 'today' | 'week' | 'month' | 'custom';

function getPresetDates(preset: DatePreset): { fromDate?: string; toDate?: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (preset === 'today') return { fromDate: today, toDate: today };
  if (preset === 'week') {
    const from = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
    return { fromDate: from, toDate: today };
  }
  if (preset === 'month') {
    const from = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
    return { fromDate: from, toDate: today };
  }
  return {};
}

const REPORTS = [
  {
    key: 'visitor-log',
    title: 'Visitor Log',
    description: 'All visitor entries and exits with approval status',
    icon: 'person-outline' as const,
    color: '#2563EB',
    bg: '#EFF6FF',
    route: '/(admin)/reports/visitor-log',
  },
  {
    key: 'staff-log',
    title: 'Staff Visits',
    description: 'Recurring staff entry and exit records',
    icon: 'briefcase-outline' as const,
    color: '#D97706',
    bg: '#FFFBEB',
    route: '/(admin)/reports/staff-log',
  },
  {
    key: 'sos-history',
    title: 'SOS History',
    description: 'Emergency alerts with resolution times',
    icon: 'warning-outline' as const,
    color: '#DC2626',
    bg: '#FEF2F2',
    route: '/(admin)/reports/sos-history',
  },
];

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Custom', value: 'custom' },
];

export default function ReportsIndexScreen() {
  const [selectedPreset, setSelectedPreset] = React.useState<DatePreset>('week');

  function navigate(route: string) {
    const dates = getPresetDates(selectedPreset);
    const params = new URLSearchParams();
    if (dates.fromDate) params.set('fromDate', dates.fromDate);
    if (dates.toDate) params.set('toDate', dates.toDate);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    router.push(`${route}${suffix}` as Parameters<typeof router.push>[0]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Date quick-select */}
        <Text style={styles.sectionTitle}>Date Range</Text>
        <View style={styles.presetRow}>
          {DATE_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.presetChip,
                selectedPreset === p.value && styles.presetChipActive,
              ]}
              onPress={() => setSelectedPreset(p.value)}
            >
              <Text
                style={[
                  styles.presetText,
                  selectedPreset === p.value && styles.presetTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Report cards */}
        <Text style={styles.sectionTitle}>Reports</Text>
        {REPORTS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={styles.reportCard}
            onPress={() => navigate(r.route)}
            activeOpacity={0.8}
          >
            <View style={[styles.reportIcon, { backgroundColor: r.bg }]}>
              <Ionicons name={r.icon} size={24} color={r.color} />
            </View>
            <View style={styles.reportText}>
              <Text style={styles.reportTitle}>{r.title}</Text>
              <Text style={styles.reportDesc}>{r.description}</Text>
            </View>
            <View style={styles.viewBtn}>
              <Text style={[styles.viewBtnText, { color: r.color }]}>View Report</Text>
              <Ionicons name="chevron-forward" size={14} color={r.color} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 0 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  presetChipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  presetText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  presetTextActive: { color: '#FFFFFF' },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  reportIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: { flex: 1 },
  reportTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  reportDesc: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewBtnText: { fontSize: 12, fontWeight: '700' },
});
