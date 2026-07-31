import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// DayOfWeekPicker
// 7 circular toggle buttons Mon–Sun
// value: number[] where 0=Sunday, 1=Monday, …, 6=Saturday
// ---------------------------------------------------------------------------

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayOfWeekPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
}

export function DayOfWeekPicker({ value, onChange }: DayOfWeekPickerProps) {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <View style={styles.row} accessibilityRole="group" accessibilityLabel="Days of week picker">
      {DAY_LABELS.map((label, index) => {
        const isSelected = value.includes(index);
        return (
          <TouchableOpacity
            key={index}
            style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
            onPress={() => toggle(index)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={DAY_FULL[index]}
          >
            <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BTN_SIZE = 36;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  dayBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dayBtnActive: {
    backgroundColor: '#1B6B3A',
    borderColor: '#1B6B3A',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  dayLabelActive: {
    color: '#FFFFFF',
  },
});
