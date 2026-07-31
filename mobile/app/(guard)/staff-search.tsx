import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import api from '@/lib/api';
import type { StaffSearchResult } from '@/types';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  maid: '🧹',
  cook: '🍳',
  driver: '🚗',
  security: '🛡️',
  delivery: '📦',
  other: '👤',
};

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed_today: 'Staff is not allowed today.',
  outside_window: 'Outside the allowed time window.',
  staff_inactive: 'This staff member is inactive.',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StaffSearchScreen() {
  const societyId = useAuthStore((s) => s.societyId) ?? '';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [entryLoading, setEntryLoading] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (text: string) => {
      if (!text.trim() || !societyId) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const isPhone = /^\d+$/.test(text.trim());
        const params = new URLSearchParams({ societyId });
        if (isPhone) params.set('phone', text.trim());
        else params.set('name', text.trim());

        const res = await api.get<{ results: StaffSearchResult[] }>(
          `/recurring-staff/search?${params.toString()}`
        );
        setResults(res.data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [societyId]
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setEntryError({});
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void search(text), 400);
  };

  const handleLogEntry = useCallback(
    async (item: StaffSearchResult) => {
      Alert.alert(
        'Confirm Entry',
        `Log entry for ${item.staff.name}${item.flat ? ` (Flat ${item.flat.flatNumber})` : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Entry',
            onPress: async () => {
              setEntryLoading(item.staff.id);
              setEntryError((prev) => ({ ...prev, [item.staff.id]: '' }));
              try {
                await api.post('/visitors/staff-entry', { staffId: item.staff.id });
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Entry Logged', `${item.staff.name} has been logged in.`);
                // Remove from results list after successful entry
                setResults((prev) => prev.filter((r) => r.staff.id !== item.staff.id));
              } catch (err: unknown) {
                const code =
                  (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
                    ?.error?.code;
                const msg = code ? (ERROR_MESSAGES[code] ?? `Error: ${code}`) : 'Could not log entry.';
                setEntryError((prev) => ({ ...prev, [item.staff.id]: msg }));
              } finally {
                setEntryLoading(null);
              }
            },
          },
        ]
      );
    },
    []
  );

  const renderItem = ({ item }: { item: StaffSearchResult }) => {
    const icon = CATEGORY_ICONS[item.staff.category] ?? '👤';
    const err = entryError[item.staff.id];

    return (
      <View style={[styles.resultCard, !item.staff.isActive && styles.resultCardInactive]}>
        <View style={styles.resultLeft}>
          <View style={styles.categoryIcon}>
            <Text style={styles.categoryIconText}>{icon}</Text>
          </View>
        </View>

        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.staff.name}</Text>

          <View style={styles.resultMetaRow}>
            {item.flat && (
              <Text style={styles.resultMeta}>
                Flat {item.flat.flatNumber}
                {item.flat.buildingName ? ` · ${item.flat.buildingName}` : ''}
              </Text>
            )}
            {item.resident?.fullName && (
              <Text style={styles.resultMeta}>{item.resident.fullName}</Text>
            )}
          </View>

          {/* Allowed days */}
          <View style={styles.dayPills}>
            {DAY_SHORT.map((label, idx) => {
              const isAllowed = item.staff.allowedDays.includes(idx);
              return (
                <View key={idx} style={[styles.dayPill, isAllowed && styles.dayPillActive]}>
                  <Text style={[styles.dayPillText, isAllowed && styles.dayPillTextActive]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.timeWindow}>
            {item.staff.entryFrom} – {item.staff.entryUntil}
          </Text>

          {err ? <Text style={styles.entryError}>{err}</Text> : null}
        </View>

        <TouchableOpacity
          style={[
            styles.logBtn,
            (!item.staff.isActive || entryLoading === item.staff.id) && styles.logBtnDisabled,
          ]}
          onPress={() => void handleLogEntry(item)}
          disabled={!item.staff.isActive || entryLoading === item.staff.id}
        >
          {entryLoading === item.staff.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.logBtnText}>Log{'\n'}Entry</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone number…"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoFocus
          testID="staff-search-full-input"
        />
        {searching && (
          <ActivityIndicator size="small" color="#1a73e8" style={styles.searchSpinner} />
        )}
        {query.length > 0 && !searching && (
          <TouchableOpacity
            onPress={() => { setQuery(''); setResults([]); }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.staff.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          query.length > 0 && !searching ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No staff found for "{query}"</Text>
              <Text style={styles.emptyHint}>Try a different name or phone number.</Text>
            </View>
          ) : query.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Search for staff above</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontSize: 15,
    color: '#111827',
  },
  searchSpinner: { marginLeft: 8 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearBtnText: { color: '#9CA3AF', fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  resultCardInactive: { opacity: 0.6 },
  resultLeft: { marginRight: 12 },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: { fontSize: 20 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  resultMetaRow: { gap: 2, marginBottom: 6 },
  resultMeta: { fontSize: 12, color: '#6B7280' },
  dayPills: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  dayPill: {
    width: 26,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  dayPillActive: { backgroundColor: '#DCFCE7' },
  dayPillText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  dayPillTextActive: { color: '#166534' },
  timeWindow: { fontSize: 12, color: '#3B82F6', fontWeight: '600', fontVariant: ['tabular-nums'] },
  entryError: { fontSize: 12, color: '#EF4444', marginTop: 4 },

  logBtn: {
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    alignSelf: 'center',
  },
  logBtnDisabled: { backgroundColor: '#9CA3AF' },
  logBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
