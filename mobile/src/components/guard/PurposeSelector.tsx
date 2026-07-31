import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';

// ============================================================
// Types
// ============================================================

export type Purpose = 'guest' | 'delivery' | 'service' | 'cab' | 'other';

export interface PurposeOption {
  value: Purpose;
  label: string;
  icon: string;
  description: string;
}

// ============================================================
// Purpose options
// ============================================================

export const PURPOSE_OPTIONS: PurposeOption[] = [
  { value: 'guest',    label: 'Guest',    icon: '👤', description: 'Personal visitor' },
  { value: 'delivery', label: 'Delivery', icon: '📦', description: 'Package / courier' },
  { value: 'service',  label: 'Service',  icon: '🔧', description: 'Plumber, electrician, etc.' },
  { value: 'cab',      label: 'Cab',      icon: '🚕', description: 'Taxi / ride-share' },
  { value: 'other',    label: 'Other',    icon: '📋', description: 'Other reason' },
];

// ============================================================
// Component
// ============================================================

interface PurposeSelectorProps {
  value: Purpose | null;
  onChange: (purpose: Purpose) => void;
  error?: string;
}

export function PurposeSelector({ value, onChange, error }: PurposeSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = PURPOSE_OPTIONS.find((o) => o.value === value) ?? null;

  const handleSelect = useCallback(
    (option: PurposeOption) => {
      onChange(option.value);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <View>
      {/* Trigger button */}
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Select purpose of visit"
      >
        {selectedOption ? (
          <View style={styles.selectedRow}>
            <Text style={styles.selectedIcon}>{selectedOption.icon}</Text>
            <Text style={styles.selectedLabel}>{selectedOption.label}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>Select purpose...</Text>
        )}
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {/* Bottom-sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>Purpose of Visit</Text>

          <FlatList
            data={PURPOSE_OPTIONS}
            keyExtractor={(item) => item.value}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  item.value === value ? styles.optionRowSelected : null,
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: item.value === value }}
              >
                <View style={styles.optionIconWrap}>
                  <Text style={styles.optionIcon}>{item.icon}</Text>
                </View>
                <View style={styles.optionTextWrap}>
                  <Text
                    style={[
                      styles.optionLabel,
                      item.value === value ? styles.optionLabelSelected : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.optionDescription}>{item.description}</Text>
                </View>
                {item.value === value ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
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
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedIcon: {
    fontSize: 18,
  },
  selectedLabel: {
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
  // Modal / sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingLeft: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 12,
  },
  optionRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIcon: {
    fontSize: 20,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  optionLabelSelected: {
    color: '#1D4ED8',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
  },
});
