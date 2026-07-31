import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// Types
// ============================================================

export interface FlatRow {
  id: string;
  flatNumber: string;
  floor: number;
  buildingId: string;
  buildingName: string | null;
  isOccupied: boolean;
}

interface ApiFlatRow {
  id: string;
  flat_number: string;
  floor: number;
  building_id: string;
  is_occupied: boolean;
  buildings: { id: string; name: string } | null;
}

// ============================================================
// Component
// ============================================================

interface FlatSearchProps {
  value: FlatRow | null;
  onChange: (flat: FlatRow) => void;
  error?: string;
}

export function FlatSearch({ value, onChange, error }: FlatSearchProps) {
  const societyId = useAuthStore((s) => s.societyId);
  const [query, setQuery] = useState('');
  const [allFlats, setAllFlats] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Cache flats locally — only fetch once per mount
  const fetched = useRef(false);

  const fetchFlats = useCallback(async () => {
    if (!societyId || fetched.current) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<{ flats: ApiFlatRow[] }>(
        `/societies/${societyId}/flats`
      );
      const mapped: FlatRow[] = (res.data.flats ?? []).map((f) => ({
        id: f.id,
        flatNumber: f.flat_number,
        floor: f.floor,
        buildingId: f.building_id,
        buildingName: f.buildings?.name ?? null,
        isOccupied: f.is_occupied,
      }));
      setAllFlats(mapped);
      fetched.current = true;
    } catch {
      setFetchError('Failed to load flats. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => {
    void fetchFlats();
  }, [fetchFlats]);

  // Filter by flat number or building name
  const filtered = query.trim().length === 0
    ? allFlats
    : allFlats.filter((f) => {
        const q = query.toLowerCase();
        return (
          f.flatNumber.toLowerCase().includes(q) ||
          (f.buildingName ?? '').toLowerCase().includes(q)
        );
      });

  const handleSelect = useCallback(
    (flat: FlatRow) => {
      onChange(flat);
      setOpen(false);
      setQuery('');
    },
    [onChange]
  );

  const displayLabel = value
    ? `${value.buildingName ? `${value.buildingName} - ` : ''}${value.flatNumber}`
    : null;

  return (
    <View>
      {/* Trigger */}
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : null]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Search and select flat"
      >
        {displayLabel ? (
          <Text style={styles.selectedText}>{displayLabel}</Text>
        ) : (
          <Text style={styles.placeholder}>Search flat number...</Text>
        )}
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {/* Inline dropdown panel */}
      {open ? (
        <View style={styles.panel}>
          <TextInput
            style={styles.searchInput}
            placeholder="Type flat no. or building..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoFocus
            clearButtonMode="while-editing"
            accessibilityLabel="Search flats"
          />

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color="#1a73e8" />
              <Text style={styles.loadingText}>Loading flats...</Text>
            </View>
          ) : fetchError ? (
            <TouchableOpacity style={styles.centerBox} onPress={() => {
              fetched.current = false;
              void fetchFlats();
            }}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </TouchableOpacity>
          ) : filtered.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>No flats found</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.flatRow,
                    item.id === value?.id ? styles.flatRowSelected : null,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: item.id === value?.id }}
                >
                  <View style={styles.flatRowContent}>
                    {item.buildingName ? (
                      <Text style={styles.buildingLabel}>{item.buildingName}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.flatNumber,
                        item.id === value?.id ? styles.flatNumberSelected : null,
                      ]}
                    >
                      {item.flatNumber}
                    </Text>
                    <Text style={styles.floorLabel}>
                      Floor {item.floor}
                      {item.isOccupied ? '' : ' · Vacant'}
                    </Text>
                  </View>
                  {item.id === value?.id ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    minHeight: 50,
  },
  triggerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  selectedText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  placeholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  chevron: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF4444',
    lineHeight: 18,
  },
  panel: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  list: {
    maxHeight: 220,
  },
  centerBox: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  flatRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  flatRowContent: {
    flex: 1,
  },
  buildingLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  flatNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  flatNumberSelected: {
    color: '#1D4ED8',
  },
  floorLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  checkmark: {
    fontSize: 16,
    color: '#1D4ED8',
    fontWeight: '700',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
});
