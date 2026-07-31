import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StaffForm } from '@/components/resident/StaffForm';
import { useRecurringStaff } from '@/hooks/useRecurringStaff';
import type { CreateStaffInput } from '@/types';

// ---------------------------------------------------------------------------
// Add / Edit staff screen
// Route: /(resident)/staff/add
// Optional query param: editId — if present, form pre-fills from existing staff
// ---------------------------------------------------------------------------

export default function AddStaffScreen() {
  const params = useLocalSearchParams<{ editId?: string }>();
  const { staff, add, update } = useRecurringStaff();
  const [loading, setLoading] = useState(false);

  const editId = params.editId;
  const existing = editId ? staff.find((s) => s.id === editId) : undefined;

  const handleSubmit = async (data: CreateStaffInput) => {
    setLoading(true);
    try {
      if (editId) {
        await update(editId, data);
      } else {
        await add(data);
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StaffForm
        initialValues={
          existing
            ? {
                name: existing.name,
                phone: existing.phone ?? undefined,
                category: existing.category,
                allowedDays: existing.allowedDays,
                entryFrom: existing.entryFrom,
                entryUntil: existing.entryUntil,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        submitLabel={editId ? 'Update Staff' : 'Add Staff'}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
});
