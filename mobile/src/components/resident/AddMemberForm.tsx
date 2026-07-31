import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { PhoneInput } from '@/components/PhoneInput';
import type { AddMemberData } from '@/hooks/useFlatMembers';

interface AddMemberFormProps {
  onSubmit(data: AddMemberData): Promise<void>;
  onCancel(): void;
}

export default function AddMemberForm({ onSubmit, onCancel }: AddMemberFormProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [residentType, setResidentType] = useState<'owner' | 'tenant'>('tenant');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const validate = (): boolean => {
    let valid = true;
    if (fullName.trim().length < 2) {
      setNameError('Full name must be at least 2 characters');
      valid = false;
    } else {
      setNameError('');
    }
    if (phone.length !== 10) {
      setPhoneError('Enter a valid 10-digit mobile number');
      valid = false;
    } else {
      setPhoneError('');
    }
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        phone,
        fullName: fullName.trim(),
        residentType,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to add member';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full name */}
      <View style={styles.field}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, nameError ? styles.inputError : null]}
          placeholder="e.g. Priya Sharma"
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={(t) => {
            setFullName(t);
            if (nameError && t.trim().length >= 2) setNameError('');
          }}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {nameError ? (
          <Text style={styles.errorText}>{nameError}</Text>
        ) : null}
      </View>

      {/* Phone */}
      <View style={styles.field}>
        <Text style={styles.label}>Mobile Number</Text>
        <PhoneInput
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            if (phoneError && v.length === 10) setPhoneError('');
          }}
          error={phoneError}
        />
      </View>

      {/* Member type toggle */}
      <View style={styles.field}>
        <Text style={styles.label}>Member Type</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              residentType === 'tenant' && styles.toggleOptionActive,
            ]}
            onPress={() => setResidentType('tenant')}
          >
            <Text
              style={[
                styles.toggleText,
                residentType === 'tenant' && styles.toggleTextActive,
              ]}
            >
              Tenant
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              residentType === 'owner' && styles.toggleOptionActive,
            ]}
            onPress={() => setResidentType('owner')}
          >
            <Text
              style={[
                styles.toggleText,
                residentType === 'owner' && styles.toggleTextActive,
              ]}
            >
              Owner
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SMS note */}
      <View style={styles.smsNote}>
        <Text style={styles.smsNoteText}>
          An SMS invite will be sent to this number with a link to download the app.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitText}>Send Invite</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 5,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#1B6B3A',
    fontWeight: '700',
  },
  smsNote: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  smsNoteText: {
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#1B6B3A',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#86EFAC',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
