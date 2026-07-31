import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { StaffCategory, CreateStaffInput } from '@/types';
import { DayOfWeekPicker } from './DayOfWeekPicker';

// ---------------------------------------------------------------------------
// Category options
// ---------------------------------------------------------------------------

const CATEGORIES: { value: StaffCategory; label: string; icon: string }[] = [
  { value: 'maid', label: 'Maid', icon: '🧹' },
  { value: 'cook', label: 'Cook', icon: '🍳' },
  { value: 'driver', label: 'Driver', icon: '🚗' },
  { value: 'security', label: 'Security', icon: '🛡️' },
  { value: 'delivery', label: 'Delivery', icon: '📦' },
  { value: 'other', label: 'Other', icon: '👤' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StaffFormProps {
  initialValues?: Partial<CreateStaffInput>;
  onSubmit: (data: CreateStaffInput) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: StaffFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');
  const [category, setCategory] = useState<StaffCategory>(initialValues?.category ?? 'maid');
  const [allowedDays, setAllowedDays] = useState<number[]>(
    initialValues?.allowedDays ?? [1, 2, 3, 4, 5]
  );
  const [entryFrom, setEntryFrom] = useState(initialValues?.entryFrom ?? '07:00');
  const [entryUntil, setEntryUntil] = useState(initialValues?.entryUntil ?? '09:00');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Name is required';
    if (phone && !/^\d{10}$/.test(phone)) e['phone'] = 'Phone must be 10 digits';
    if (allowedDays.length === 0) e['allowedDays'] = 'Select at least one day';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entryFrom)) e['entryFrom'] = 'Invalid time (HH:MM)';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entryUntil)) e['entryUntil'] = 'Invalid time (HH:MM)';
    if (entryFrom >= entryUntil) e['entryFrom'] = 'Entry From must be before Entry Until';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || undefined,
        category,
        allowedDays,
        entryFrom,
        entryUntil,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Could not save staff. Please try again.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={[styles.input, errors['name'] ? styles.inputError : null]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lakshmi"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
        />
        {errors['name'] && <Text style={styles.errorText}>{errors['name']}</Text>}
      </View>

      {/* Phone */}
      <View style={styles.field}>
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={[styles.input, errors['phone'] ? styles.inputError : null]}
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit number"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={10}
        />
        {errors['phone'] && <Text style={styles.errorText}>{errors['phone']}</Text>}
      </View>

      {/* Category */}
      <View style={styles.field}>
        <Text style={styles.label}>Category *</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryOption,
                category === cat.value && styles.categoryOptionActive,
              ]}
              onPress={() => setCategory(cat.value)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.value && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Allowed days */}
      <View style={styles.field}>
        <Text style={styles.label}>Allowed Days *</Text>
        <DayOfWeekPicker value={allowedDays} onChange={setAllowedDays} />
        {errors['allowedDays'] && <Text style={styles.errorText}>{errors['allowedDays']}</Text>}
      </View>

      {/* Time window */}
      <View style={styles.timeRow}>
        <View style={[styles.field, styles.timeField]}>
          <Text style={styles.label}>Entry From *</Text>
          <TextInput
            style={[styles.input, errors['entryFrom'] ? styles.inputError : null]}
            value={entryFrom}
            onChangeText={setEntryFrom}
            placeholder="07:00"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          {errors['entryFrom'] && <Text style={styles.errorText}>{errors['entryFrom']}</Text>}
        </View>

        <View style={[styles.field, styles.timeField]}>
          <Text style={styles.label}>Entry Until *</Text>
          <TextInput
            style={[styles.input, errors['entryUntil'] ? styles.inputError : null]}
            value={entryUntil}
            onChangeText={setEntryUntil}
            placeholder="09:00"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          {errors['entryUntil'] && <Text style={styles.errorText}>{errors['entryUntil']}</Text>}
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnLoading]}
        onPress={() => void handleSubmit()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitBtnText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4 },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  categoryOptionActive: {
    borderColor: '#1B6B3A',
    backgroundColor: '#F0FDF4',
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  categoryLabelActive: { color: '#1B6B3A' },

  // Time row
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },

  // Submit
  submitBtn: {
    backgroundColor: '#1B6B3A',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnLoading: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
