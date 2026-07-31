import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useRecurringStaff } from '@/hooks/useRecurringStaff';
import { StaffCard } from '@/components/resident/StaffCard';
import type { RecurringStaff, StaffCategory } from '@/types';

// ---------------------------------------------------------------------------
// Category display order + labels
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: StaffCategory[] = ['maid', 'cook', 'driver', 'security', 'delivery', 'other'];
const CATEGORY_LABELS: Record<StaffCategory, string> = {
  maid: 'Maid',
  cook: 'Cook',
  driver: 'Driver',
  security: 'Security',
  delivery: 'Delivery',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StaffListScreen() {
  const { staff, loading, error, refresh, update, deactivate } = useRecurringStaff();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await update(id, { isActive: active });
    } catch {
      Alert.alert('Error', 'Could not update staff status. Please try again.');
    }
  };

  const handleDelete = (staffMember: RecurringStaff) => {
    Alert.alert(
      'Remove Staff',
      `Remove ${staffMember.name} from your staff list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivate(staffMember.id);
            } catch {
              Alert.alert('Error', 'Could not remove staff. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Group staff by category for section list
  const sections = CATEGORY_ORDER
    .map((cat) => ({
      title: CATEGORY_LABELS[cat],
      category: cat,
      data: staff.filter((s) => s.category === cat),
    }))
    .filter((s) => s.data.length > 0);

  if (loading && staff.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B3A" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refresh()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {staff.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Staff Added</Text>
          <Text style={styles.emptySubtitle}>
            Add your household staff (maid, cook, driver, etc.) to manage their entry.
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(resident)/staff/add')}
          >
            <Text style={styles.addBtnText}>+ Add Staff</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <StaffCard
              staff={item}
              onToggleActive={(id, active) => void handleToggleActive(id, active)}
              onEdit={(s) => router.push({ pathname: '/(resident)/staff/add', params: { editId: s.id } })}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void refresh()}
              tintColor="#1B6B3A"
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      {staff.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(resident)/staff/add')}
          testID="add-staff-fab"
        >
          <Text style={styles.fabText}>+ Add Staff</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1B6B3A',
    borderRadius: 8,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 88 },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  addBtn: {
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
