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
import { useAdminManagement, MgmtFlat, MgmtBuilding } from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// Types
// ============================================================

interface FlatForm {
  flatNumber: string;
  floor: string;
}

const EMPTY_FORM: FlatForm = { flatNumber: '', floor: '' };

// ============================================================
// Screen
// ============================================================

export default function FlatsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    buildings, buildingsLoading, fetchBuildings,
    flats, flatsLoading, fetchFlats, updateFlat, deleteFlat,
    error, clearError,
  } = useAdminManagement();

  const [search, setSearch] = useState('');
  const [filterBuildingId, setFilterBuildingId] = useState<string | null>(null);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FlatForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<FlatForm>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (societyId) {
      void fetchBuildings(societyId);
      void fetchFlats(societyId);
    }
  }, [societyId, fetchBuildings, fetchFlats]);

  // ── Filtering ─────────────────────────────────────────────

  const filtered = flats.filter((f) => {
    const matchesSearch = f.flatNumber.toLowerCase().includes(search.toLowerCase());
    const matchesBuilding = !filterBuildingId || f.buildingId === filterBuildingId;
    return matchesSearch && matchesBuilding;
  });

  const selectedBuilding = buildings.find((b) => b.id === filterBuildingId);

  // ── Validation ────────────────────────────────────────────

  function validate(): boolean {
    const errs: Partial<FlatForm> = {};
    if (!form.flatNumber.trim()) errs.flatNumber = 'Flat number is required';
    const floorNum = parseInt(form.floor, 10);
    if (form.floor === '' || isNaN(floorNum) || floorNum < 0)
      errs.floor = 'Enter a valid floor (0 or higher)';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Edit open ──────────────────────────────────────────────

  function openEdit(flat: MgmtFlat) {
    setEditingId(flat.id);
    setForm({ flatNumber: flat.flatNumber, floor: String(flat.floor) });
    setFormErrors({});
    setShowModal(true);
  }

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate() || !societyId || !editingId) return;
    setSubmitting(true);
    try {
      await updateFlat(societyId, editingId, {
        flatNumber: form.flatNumber.trim(),
        floor: parseInt(form.floor, 10),
      });
      setShowModal(false);
    } catch {
      // error in hook
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────

  const handleDelete = useCallback((flat: MgmtFlat) => {
    Alert.alert(
      'Delete Flat',
      `Delete flat "${flat.flatNumber}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!societyId) return;
            try {
              await deleteFlat(societyId, flat.id);
            } catch {
              Alert.alert('Cannot Delete', 'This flat has active residents. Deactivate them first.');
            }
          },
        },
      ]
    );
  }, [societyId, deleteFlat]);

  // ── Helpers ───────────────────────────────────────────────

  function buildingName(buildingId: string): string {
    return buildings.find((b) => b.id === buildingId)?.name ?? '—';
  }

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtFlat }) => (
    <View style={styles.row}>
      <View style={[styles.rowIcon, item.isOccupied ? styles.rowIconOccupied : styles.rowIconVacant]}>
        <Ionicons
          name={item.isOccupied ? 'home' : 'home-outline'}
          size={18}
          color={item.isOccupied ? '#1a73e8' : '#9CA3AF'}
        />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text style={styles.rowTitle}>Flat {item.flatNumber}</Text>
          <View style={[styles.badge, item.isOccupied ? styles.badgeOccupied : styles.badgeVacant]}>
            <Text style={[styles.badgeText, item.isOccupied ? styles.badgeTextOccupied : styles.badgeTextVacant]}>
              {item.isOccupied ? 'Occupied' : 'Vacant'}
            </Text>
          </View>
        </View>
        <Text style={styles.rowMeta}>
          Floor {item.floor} · {buildingName(item.buildingId)}
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
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Ionicons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Building filter */}
      <TouchableOpacity
        style={styles.filterBtn}
        onPress={() => setShowBuildingPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="business-outline" size={16} color="#6B7280" />
        <Text style={styles.filterBtnText}>
          {selectedBuilding ? selectedBuilding.name : 'All Buildings'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search flat number..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {flatsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No flats</Text>
              <Text style={styles.emptyHint}>
                {search || filterBuildingId
                  ? 'No flats match your filters.'
                  : 'Add flats via the onboarding flow.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Building picker modal */}
      <Modal
        visible={showBuildingPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuildingPicker(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Filter by Building</Text>
            <TouchableOpacity
              style={[styles.pickerOption, !filterBuildingId && styles.pickerOptionSelected]}
              onPress={() => { setFilterBuildingId(null); setShowBuildingPicker(false); }}
            >
              <Text style={styles.pickerOptionText}>All Buildings</Text>
              {!filterBuildingId && <Ionicons name="checkmark" size={18} color="#1a73e8" />}
            </TouchableOpacity>
            {buildings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.pickerOption, filterBuildingId === b.id && styles.pickerOptionSelected]}
                onPress={() => { setFilterBuildingId(b.id); setShowBuildingPicker(false); }}
              >
                <Text style={styles.pickerOptionText}>{b.name}</Text>
                {filterBuildingId === b.id && <Ionicons name="checkmark" size={18} color="#1a73e8" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerClose} onPress={() => setShowBuildingPicker(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Flat Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Flat</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Flat Number</Text>
              <TextInput
                style={[styles.fieldInput, formErrors.flatNumber ? styles.fieldInputError : null]}
                placeholder="e.g. 101, A-201"
                placeholderTextColor="#9CA3AF"
                value={form.flatNumber}
                onChangeText={(v) => { setForm((p) => ({ ...p, flatNumber: v })); setFormErrors((p) => ({ ...p, flatNumber: undefined })); }}
                returnKeyType="next"
              />
              {formErrors.flatNumber ? <Text style={styles.fieldError}>{formErrors.flatNumber}</Text> : null}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Floor</Text>
              <TextInput
                style={[styles.fieldInput, formErrors.floor ? styles.fieldInputError : null]}
                placeholder="e.g. 0 (ground), 1, 2..."
                placeholderTextColor="#9CA3AF"
                value={form.floor}
                onChangeText={(v) => { setForm((p) => ({ ...p, floor: v.replace(/\D/g, '') })); setFormErrors((p) => ({ ...p, floor: undefined })); }}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              {formErrors.floor ? <Text style={styles.fieldError}>{formErrors.floor}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
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

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },

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
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIconOccupied: { backgroundColor: '#EFF6FF' },
  rowIconVacant: { backgroundColor: '#F3F4F6' },
  rowInfo: { flex: 1 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowMeta: { fontSize: 12, color: '#6B7280' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeOccupied: { backgroundColor: '#DBEAFE' },
  badgeVacant: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextOccupied: { color: '#1E40AF' },
  badgeTextVacant: { color: '#6B7280' },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionBtnDanger: { backgroundColor: '#FEF2F2' },
  separator: { height: 8 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  // Building picker
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 20 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', paddingHorizontal: 20, marginBottom: 12 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  pickerOptionSelected: { backgroundColor: '#EFF6FF' },
  pickerOptionText: { flex: 1, fontSize: 15, color: '#111827' },
  pickerClose: { marginTop: 8, marginHorizontal: 20, paddingVertical: 14, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' },
  pickerCloseText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  modalBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB',
  },
  fieldInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldError: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
