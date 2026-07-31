import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { CreateNoticeInput, NoticeType } from '@/types';
import { AudiencePicker } from './AudiencePicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoticeFormProps {
  initialValues?: Partial<CreateNoticeInput>;
  onSubmit: (data: CreateNoticeInput, publish: boolean) => Promise<void>;
  submitting?: boolean;
}

const NOTICE_TYPES: { value: NoticeType; label: string; color: string; icon: string }[] = [
  { value: 'general', label: 'General', color: '#6B7280', icon: 'information-circle-outline' },
  { value: 'urgent', label: 'Urgent', color: '#DC2626', icon: 'warning-outline' },
  { value: 'event', label: 'Event', color: '#2563EB', icon: 'calendar-outline' },
  { value: 'maintenance', label: 'Maintenance', color: '#D97706', icon: 'construct-outline' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoticeForm({ initialValues, onSubmit, submitting }: NoticeFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [body, setBody] = useState(initialValues?.body ?? '');
  const [noticeType, setNoticeType] = useState<NoticeType>(
    initialValues?.noticeType ?? 'general'
  );
  const [audience, setAudience] = useState(initialValues?.audience ?? 'all');
  const [isPinned, setIsPinned] = useState(initialValues?.isPinned ?? false);
  const [scheduleEnabled, setScheduleEnabled] = useState(
    !!initialValues?.scheduledAt
  );
  const [scheduledDate, setScheduledDate] = useState<Date>(
    initialValues?.scheduledAt
      ? new Date(initialValues.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync initialValues if they change (edit flow)
  useEffect(() => {
    if (initialValues?.title) setTitle(initialValues.title);
    if (initialValues?.body) setBody(initialValues.body);
    if (initialValues?.noticeType) setNoticeType(initialValues.noticeType);
    if (initialValues?.audience) setAudience(initialValues.audience);
    if (initialValues?.isPinned !== undefined) setIsPinned(initialValues.isPinned);
    if (initialValues?.scheduledAt) {
      setScheduleEnabled(true);
      setScheduledDate(new Date(initialValues.scheduledAt));
    }
  }, [
    initialValues?.title,
    initialValues?.body,
    initialValues?.noticeType,
    initialValues?.audience,
    initialValues?.isPinned,
    initialValues?.scheduledAt,
  ]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs['title'] = 'Title is required';
    if (!body.trim()) errs['body'] = 'Body is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildData(): CreateNoticeInput {
    return {
      title: title.trim(),
      body: body.trim(),
      noticeType,
      audience,
      isPinned,
      scheduledAt: scheduleEnabled ? scheduledDate.toISOString() : null,
    };
  }

  async function handlePublish() {
    if (!validate()) return;
    await onSubmit(buildData(), true);
  }

  async function handleDraft() {
    if (!validate()) return;
    await onSubmit(buildData(), false);
  }

  function handleDateChange(_event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (date) {
      const merged = new Date(scheduledDate);
      merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setScheduledDate(merged);
      if (Platform.OS === 'android') setShowTimePicker(true);
    }
  }

  function handleTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowTimePicker(false);
    if (date) {
      const merged = new Date(scheduledDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setScheduledDate(merged);
    }
  }

  const formattedSchedule = scheduledDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={[styles.input, errors['title'] ? styles.inputError : null]}
        placeholder="Notice title"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        returnKeyType="next"
      />
      {errors['title'] ? <Text style={styles.errorText}>{errors['title']}</Text> : null}

      {/* Body */}
      <Text style={styles.label}>Body *</Text>
      <TextInput
        style={[styles.textArea, errors['body'] ? styles.inputError : null]}
        placeholder="Write your announcement here... (up to 200 chars recommended)"
        placeholderTextColor="#9CA3AF"
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={5}
        maxLength={5000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{body.length} chars</Text>
      {errors['body'] ? <Text style={styles.errorText}>{errors['body']}</Text> : null}

      {/* Notice Type */}
      <Text style={styles.label}>Notice Type</Text>
      <View style={styles.typeRow}>
        {NOTICE_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[
              styles.typePill,
              noticeType === t.value && { backgroundColor: t.color, borderColor: t.color },
            ]}
            onPress={() => setNoticeType(t.value)}
          >
            <Ionicons
              name={t.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={noticeType === t.value ? '#FFFFFF' : t.color}
            />
            <Text
              style={[
                styles.typePillText,
                noticeType === t.value ? styles.typePillTextActive : { color: t.color },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Audience */}
      <Text style={styles.label}>Audience</Text>
      <AudiencePicker value={audience} onChange={setAudience} />

      {/* Pin Toggle */}
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>Pin this notice</Text>
          <Text style={styles.toggleSub}>Pinned notices appear at the top</Text>
        </View>
        <Switch
          value={isPinned}
          onValueChange={setIsPinned}
          trackColor={{ false: '#D1D5DB', true: '#1B6B3A' }}
          thumbColor={isPinned ? '#FFFFFF' : '#F9FAFB'}
        />
      </View>

      {/* Schedule Toggle */}
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>Schedule for later</Text>
          <Text style={styles.toggleSub}>Send at a specific date and time</Text>
        </View>
        <Switch
          value={scheduleEnabled}
          onValueChange={setScheduleEnabled}
          trackColor={{ false: '#D1D5DB', true: '#1B6B3A' }}
          thumbColor={scheduleEnabled ? '#FFFFFF' : '#F9FAFB'}
        />
      </View>

      {/* Date/Time Picker (visible when scheduled) */}
      {scheduleEnabled && (
        <View style={styles.scheduleBox}>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={16} color="#1B6B3A" />
            <Text style={styles.scheduleText}>{formattedSchedule}</Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={scheduledDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={scheduledDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.draftBtn]}
          onPress={handleDraft}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#374151" />
          ) : (
            <Text style={styles.draftBtnText}>Save Draft</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.publishBtn]}
          onPress={handlePublish}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={16} color="#FFFFFF" />
              <Text style={styles.publishBtnText}>
                {scheduleEnabled ? 'Schedule' : 'Publish'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 110,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    gap: 5,
    backgroundColor: '#FFFFFF',
  },
  typePillText: { fontSize: 13, fontWeight: '600' },
  typePillTextActive: { color: '#FFFFFF' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  scheduleBox: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  scheduleText: { flex: 1, fontSize: 14, color: '#111827' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    gap: 6,
  },
  draftBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  draftBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  publishBtn: { backgroundColor: '#1B6B3A' },
  publishBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
