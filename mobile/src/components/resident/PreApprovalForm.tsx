import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { PhoneInput } from '@/components/PhoneInput';
import type { CreatePreApprovalInput } from '@/types';

// ============================================================
// Types
// ============================================================

interface PreApprovalFormProps {
  /** Called when the form is submitted with valid data */
  onSubmit: (data: CreatePreApprovalInput) => Promise<void> | void;
  loading?: boolean;
}

interface FormState {
  guestName: string;
  guestPhone: string;
  purpose: string;
  validFrom: Date;
  validUntil: Date;
}

interface FormErrors {
  guestName?: string;
  guestPhone?: string;
  validFrom?: string;
  validUntil?: string;
}

// ============================================================
// Defaults: validFrom = now, validUntil = now + 4 hours
// ============================================================

function defaultFrom(): Date {
  return new Date();
}

function defaultUntil(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 4);
  return d;
}

// ============================================================
// PreApprovalForm
// ============================================================

export function PreApprovalForm({ onSubmit, loading = false }: PreApprovalFormProps) {
  const [form, setForm] = useState<FormState>({
    guestName: '',
    guestPhone: '',
    purpose: '',
    validFrom: defaultFrom(),
    validUntil: defaultUntil(),
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // DateTimePicker visibility
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showUntilPicker, setShowUntilPicker] = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const now = new Date();

    if (!form.guestName.trim()) {
      errs.guestName = 'Guest name is required';
    }

    if (!form.guestPhone || form.guestPhone.length !== 10) {
      errs.guestPhone = 'Enter a valid 10-digit phone number';
    }

    if (form.validUntil <= now) {
      errs.validUntil = 'Valid Until must be in the future';
    }

    if (form.validFrom >= form.validUntil) {
      errs.validFrom = 'Valid From must be before Valid Until';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    await onSubmit({
      guestName: form.guestName.trim(),
      guestPhone: form.guestPhone,
      purpose: form.purpose.trim() || undefined,
      validFrom: form.validFrom.toISOString(),
      validUntil: form.validUntil.toISOString(),
    });
  }, [form, onSubmit, validate]);

  // ── DateTimePicker handlers ────────────────────────────────────────────────

  const onChangeFrom = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowFromPicker(Platform.OS === 'ios'); // keep open on iOS
    if (selected) {
      setForm((prev) => ({ ...prev, validFrom: selected }));
      setErrors((prev) => ({ ...prev, validFrom: undefined }));
    }
  };

  const onChangeUntil = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowUntilPicker(Platform.OS === 'ios');
    if (selected) {
      setForm((prev) => ({ ...prev, validUntil: selected }));
      setErrors((prev) => ({ ...prev, validUntil: undefined }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View>
      {/* Guest Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Guest Name *</Text>
        <TextInput
          style={[styles.input, errors.guestName ? styles.inputError : null]}
          placeholder="e.g. Ramesh Kumar"
          placeholderTextColor="#9CA3AF"
          value={form.guestName}
          onChangeText={(t) => {
            setForm((prev) => ({ ...prev, guestName: t }));
            setErrors((prev) => ({ ...prev, guestName: undefined }));
          }}
          returnKeyType="next"
          testID="guest-name-input"
        />
        {errors.guestName ? (
          <Text style={styles.errorText}>{errors.guestName}</Text>
        ) : null}
      </View>

      {/* Guest Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Guest Phone *</Text>
        <PhoneInput
          value={form.guestPhone}
          onChangeText={(t) => {
            setForm((prev) => ({ ...prev, guestPhone: t }));
            setErrors((prev) => ({ ...prev, guestPhone: undefined }));
          }}
          error={errors.guestPhone}
        />
      </View>

      {/* Purpose */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Purpose (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Birthday party, Plumber visit"
          placeholderTextColor="#9CA3AF"
          value={form.purpose}
          onChangeText={(t) => setForm((prev) => ({ ...prev, purpose: t }))}
          returnKeyType="done"
          testID="purpose-input"
        />
      </View>

      {/* Valid From */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Valid From *</Text>
        <TouchableOpacity
          style={[styles.dateButton, errors.validFrom ? styles.inputError : null]}
          onPress={() => setShowFromPicker(true)}
          testID="valid-from-btn"
          accessibilityLabel="Select valid from date and time"
        >
          <Text style={styles.dateButtonText}>
            {form.validFrom.toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
          <Text style={styles.dateIcon}>🗓</Text>
        </TouchableOpacity>
        {errors.validFrom ? (
          <Text style={styles.errorText}>{errors.validFrom}</Text>
        ) : null}
        {showFromPicker && (
          <DateTimePicker
            value={form.validFrom}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onChangeFrom}
            testID="from-datetime-picker"
          />
        )}
      </View>

      {/* Valid Until */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Valid Until *</Text>
        <TouchableOpacity
          style={[styles.dateButton, errors.validUntil ? styles.inputError : null]}
          onPress={() => setShowUntilPicker(true)}
          testID="valid-until-btn"
          accessibilityLabel="Select valid until date and time"
        >
          <Text style={styles.dateButtonText}>
            {form.validUntil.toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
          <Text style={styles.dateIcon}>🗓</Text>
        </TouchableOpacity>
        {errors.validUntil ? (
          <Text style={styles.errorText}>{errors.validUntil}</Text>
        ) : null}
        {showUntilPicker && (
          <DateTimePicker
            value={form.validUntil}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onChangeUntil}
            testID="until-datetime-picker"
          />
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, loading ? styles.submitBtnDisabled : null]}
        onPress={handleSubmit}
        disabled={loading}
        testID="submit-btn"
        accessibilityLabel="Send OTP to Guest"
      >
        <Text style={styles.submitBtnText}>
          {loading ? 'Sending OTP…' : 'Send OTP to Guest'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FAFAFA',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#111827',
  },
  dateIcon: {
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
