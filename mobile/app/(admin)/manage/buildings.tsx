import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminManagement, MgmtBuilding } from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// Types
// ============================================================

type FormMode = 'add' | 'edit';

interface BuildingForm {
  name: string;
  totalFloors: string;
}

const EMPTY_FORM: BuildingForm = { name: '', totalFloors: '' };

// ============================================================
// Screen
// ============================================================

export default function BuildingsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const { buildings, buildingsLoading, fetchBuildings, updateBuilding, deleteBuilding, error, clearError } =
    useAdminManagement();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BuildingForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<BuildingForm>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (societyId) {
      void fetchBuildings(societyId);
    }
  }, [societyId, fetchBuildings]);

  // ── Filter ─────────────────────────────────────────────────

  const filtered = buildings.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Validate ───────────────────────────────────────────────

  function validate(): boolean {
    const errs: Partial<BuildingForm> = {};
    if (!form.name.trim()) errs.name = 'Building name is required';
    const floors = parseInt(form.totalFloors, 10);
    if (!form.totalFloors || isNaN(floors) || floors < 1)
      errs.totalFloors = 'Enter a valid number of floors (min 1)';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Open modal ────────────────────────────────────────────

  function openAdd() {
    setFormMode('add');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(building: MgmtBuilding) {
    setFormMode('edit');
    setEditingId(building.id);
    setForm({ name: building.name, totalFloors: String(building.totalFloors) });
    setFormErrors({});
    setShowModal(true);
  }

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate() || !societyId) return;
    setSubmitting(true);
    try {
      const payload = { name: form.name.trim(), totalFloors: parseInt(form.totalFloors, 10) };
      if (formMode === 'edit' && editingId) {
        await updateBuilding(societyId, editingId, payload);
      }
      // For 'add', navigate to onboarding flow (already handled)
      setShowModal(false);
    } catch {
      // error already set in hook
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────

  const handleDelete = useCallback((building: MgmtBuilding) => {
    Alert.alert(
      'Delete Building',
      `Delete "${building.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!societyId) return;
            try {
              await deleteBuilding(societyId, building.id);
            } catch (err: unknown) {
              const msg = (err as Error).message ?? 'Delete failed';
              Alert.alert('Cannot Delete', msg);
            }
          },
        },
      ]
    );
  }, [societyId, deleteBuilding]);

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtBuilding }) => (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name="business-outline" size={20} color="#1a73e8" />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowMeta}>
          {item.totalFloors} floors · {item.flatCount} flat{item.flatCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => openEdit(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="pencil-outline" size={18} color="#6B7280" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, styles.actionBtnDanger]}
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color="#DC2626" />
      </TouchableOpacity>
    </View>
  );

  // ── UI ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Ionicons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search buildings..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {buildingsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No buildings</Text>
              <Text style={styles.emptyHint}>
                {search ? 'No results for your search.' : 'Tap the button below to add a building.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {formMode === 'add' ? 'Add Building' : 'Edit Building'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={styles.fieldLabel}>Building Name</Text>
              <TextInput
                style={[styles.fieldInput, formErrors.name ? styles.fieldInputError : null]}
                placeholder="e.g. Tower A, Block 1"
                placeholderTextColor="#9CA3AF"
                value={form.name}
                onChangeText={(v) => { setForm((p) => ({ ...p, name: v })); setFormErrors((p) => ({ ...p, name: undefined })); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {formErrors.name ? <Text style={styles.fieldError}>{formErrors.name}</Text> : null}

              {/* Floors */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Number of Floors</Text>
              <TextInput
                style={[styles.fieldInput, formErrors.totalFloors ? styles.fieldInputError : null]}
                placeholder="e.g. 10"
                placeholderTextColor="#9CA3AF"
                value={form.totalFloors}
                onChangeText={(v) => { setForm((p) => ({ ...p, totalFloors: v.replace(/\D/g, '') })); setFormErrors((p) => ({ ...p, totalFloors: undefined })); }}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="done"
              />
              {formErrors.totalFloors ? <Text style={styles.fieldError}>{formErrors.totalFloors}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {formMode === 'add' ? 'Add Building' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  listContent: { paddingHorizontal: 12, paddingBottom: 100 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowMeta: { fontSize: 12, color: '#6B7280' },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionBtnDanger: { backgroundColor: '#FEF2F2' },
  separator: { height: 8 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  modalBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  fieldInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldError: { fontSize: 12, color: '#EF4444', marginTop: 4 },

  submitBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
