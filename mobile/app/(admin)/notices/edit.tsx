import React, { useState, useEffect } from 'react';
import { Alert, ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useNotices } from '@/hooks/useNotices';
import { NoticeForm } from '@/components/admin/NoticeForm';
import type { CreateNoticeInput, Notice } from '@/types';

// ---------------------------------------------------------------------------
// Edit Notice screen
// Reads notice by ID from the loaded list, prefills the form.
// ---------------------------------------------------------------------------

export default function EditNoticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { notices, update } = useNotices('admin');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Find notice in already-loaded list
  useEffect(() => {
    if (id && notices.length > 0) {
      const found = notices.find((n) => n.id === id) ?? null;
      setNotice(found);
    }
  }, [id, notices]);

  async function handleSubmit(data: CreateNoticeInput, _publish: boolean) {
    if (!id) return;
    setSubmitting(true);
    try {
      await update(id, data);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update notice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!notice && notices.length > 0) {
    // Notice not found in list
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  const initialValues: Partial<CreateNoticeInput> | undefined = notice
    ? {
        title: notice.title,
        body: notice.body,
        noticeType: notice.noticeType,
        audience: notice.audience,
        isPinned: notice.isPinned,
        scheduledAt: notice.scheduledAt,
      }
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NoticeForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
