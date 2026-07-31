import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export interface FlatItem {
  id: string;
  buildingId: string;
  buildingName?: string;
  flatNumber: string;
  floor: number;
  isOccupied: boolean;
}

interface FlatPickerProps {
  flats: FlatItem[];
  selectedId: string | null;
  onSelect: (flat: FlatItem) => void;
  disabled?: boolean;
}

/**
 * Searchable flat picker. Shows building name > flat number > occupied status.
 * Single-select with highlight.
 */
export function FlatPicker({ flats, selectedId, onSelect, disabled = false }: FlatPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = flats.filter((f) => {
    const search = query.toLowerCase();
    return (
      f.flatNumber.toLowerCase().includes(search) ||
      (f.buildingName?.toLowerCase().includes(search) ?? false)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search flat number or building..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          clearButtonMode="while-editing"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {query ? 'No flats match your search.' : 'No flats available.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => !disabled && onSelect(item)}
                activeOpacity={0.7}
                disabled={disabled}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.flatNumber, isSelected && styles.textSelected]}>
                    {item.buildingName ? `${item.buildingName} — ` : ''}
                    {item.flatNumber}
                  </Text>
                  <Text style={styles.floor}>Floor {item.floor}</Text>
                </View>
                <View style={styles.rowRight}>
                  {item.isOccupied && (
                    <View style={styles.occupiedBadge}>
                      <Text style={styles.occupiedText}>Occupied</Text>
                    </View>
                  )}
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  list: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    maxHeight: 300,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowSelected: {
    backgroundColor: '#EFF6FF',
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  flatNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  floor: {
    fontSize: 12,
    color: '#6B7280',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  occupiedBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  occupiedText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#1a73e8',
    fontWeight: '700',
  },
  textSelected: {
    color: '#1a73e8',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
