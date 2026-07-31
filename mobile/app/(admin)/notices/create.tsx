import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNotices } from '@/hooks/useNotices';
import { NoticeForm } from '@/components/admin/NoticeForm';
import type { CreateNoticeInput } from '@/types';

// ---------------------------------------------------------------------------
// Create Notice screen
// ---------------------------------------------------------------------------

export default function CreateNoticeScreen() {
  const { create } = useNotices('admin');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: CreateNoticeInput, _publish: boolean) {
    setSubmitting(true);
    try {
      await create(data);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create notice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NoticeForm onSubmit={handleSubmit} submitting={submitting} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
});
