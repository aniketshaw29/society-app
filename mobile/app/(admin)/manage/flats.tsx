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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAdminManagement,
  type MgmtFlat,
  type MgmtResident,
} from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';
import { FlatForm, type FlatFormData, type FlatFormErrors } from '@/components/admin/FlatForm';
import { FlatPicker, type FlatItem } from '@/components/FlatPicker';
import api from '@/lib/api';

// ============================================================
// Constants
// ============================================================

const EMPTY_ADD_FORM: FlatFormData = { flatNumber: '', floor: '', buildingId: '' };
const EMPTY_ADD_ERRORS: FlatFormErrors = {};

// ============================================================
// Helpers
// ============================================================

function extractApiMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      status?: number;
      data?: { error?: { message?: string }; message?: string };
    };
  };
  return (
    e.response?.data?.error?.message ??
    e.response?.data?.message ??
    fallback
  );
}

function roleLabel(role: string): string {
  if (role === 'flat_owner') return 'Owner';
  if (role === 'tenant') return 'Tenant';
  return role;
}

// ============================================================
// Screen
// ============================================================

export default function FlatsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    buildings, fetchBuildings,
    flats, flatsLoading, fetchFlats, updateFlat, deleteFlat,
    residents, residentsLoading, fetchResidents, updateResident,
    error, clearError,
  } = useAdminManagement();

  // ── Filter state ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterBuildingId, setFilterBuildingId] = useState<string | null>(null);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);

  // ── Pull-to-refresh ───────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);

  // ── Flat detail bottom sheet ──────────────────────────────
  const [selectedFlat, setSelectedFlat] = useState<MgmtFlat | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // ── Reassign resident flat ────────────────────────────────
  const [reassignTarget, setReassignTarget] = useState<MgmtResident | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignFlatId, setReassignFlatId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  // All flats (unfiltered) for the picker
  const [allFlats, setAllFlats] = useState<MgmtFlat[]>([]);
  const [allFlatsLoading, setAllFlatsLoading] = useState(false);

  // ── Add flat modal ────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<FlatFormData>(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState<FlatFormErrors>(EMPTY_ADD_ERRORS);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // ── Edit flat modal ───────────────────────────────────────
  const [editTarget, setEditTarget] = useState<MgmtFlat | null>(null);
  const [editForm, setEditForm] = useState({ flatNumber: '', floor: '' });
  const [editErrors, setEditErrors] = useState<{ flatNumber?: string; floor?: string }>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Toast (for 409 / delete errors) ──────────────────────
  const [toast, setToast] = useState<string | null>(null);

  // ── Boot ──────────────────────────────────────────────────

  useEffect(() => {
    if (societyId) {
      void fetchBuildings(societyId);
      void fetchFlats(societyId);
    }
  }, [societyId, fetchBuildings, fetchFlats]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Pull-to-refresh ───────────────────────────────────────

  const onRefresh = useCallback(async () => {
    if (!societyId) return;
    setRefreshing(true);
    await Promise.all([
      fetchBuildings(societyId),
      fetchFlats(societyId, filterBuildingId ?? undefined),
    ]);
    setRefreshing(false);
  }, [societyId, fetchBuildings, fetchFlats, filterBuildingId]);

  // ── Filtering ─────────────────────────────────────────────

  const filtered = flats.filter((f) => {
    const matchesSearch = f.flatNumber.toLowerCase().includes(search.toLowerCase());
    const matchesBuilding = !filterBuildingId || f.buildingId === filterBuildingId;
    return matchesSearch && matchesBuilding;
  });

  const selectedBuilding = buildings.find((b) => b.id === filterBuildingId);

  function buildingName(buildingId: string): string {
    return buildings.find((b) => b.id === buildingId)?.name ?? '—';
  }

  // ── Flat detail ───────────────────────────────────────────

  const handleFlatPress = useCallback(async (flat: MgmtFlat) => {
    setSelectedFlat(flat);
    setShowDetail(true);
    if (societyId) {
      await fetchResidents(societyId);
    }
  }, [societyId, fetchResidents]);

  const flatResidents = residents.filter((r) => r.flatId === selectedFlat?.id);

  // ── Reassign ──────────────────────────────────────────────

  const openReassign = useCallback(async (resident: MgmtResident) => {
    setReassignTarget(resident);
    setReassignFlatId(resident.flatId);
    // Load all flats for picker
    if (societyId) {
      setAllFlatsLoading(true);
      try {
        const res = await api.get<{ flats: MgmtFlat[] }>(
          `/onboarding/societies/${societyId}/flats`
        );
        setAllFlats(res.data.flats ?? []);
      } catch {
        // ignore – show what we have
      } finally {
        setAllFlatsLoading(false);
      }
    }
    setShowReassign(true);
  }, [societyId]);

  const handleReassignConfirm = async () => {
    if (!reassignTarget || !societyId || !reassignFlatId) return;
    setReassigning(true);
    try {
      await updateResident(societyId, reassignTarget.id, { flatId: reassignFlatId });
      setShowReassign(false);
      setReassignTarget(null);
      await Promise.all([
        fetchFlats(societyId, filterBuildingId ?? undefined),
        fetchResidents(societyId),
      ]);
    } catch {
      // error in hook
    } finally {
      setReassigning(false);
    }
  };

  const pickerItems: FlatItem[] = allFlats.map((f) => ({
    id: f.id,
    buildingId: f.buildingId,
    buildingName: buildings.find((b) => b.id === f.buildingId)?.name,
    flatNumber: f.flatNumber,
    floor: f.floor,
    isOccupied: f.isOccupied,
  }));

  // ── Add flat ──────────────────────────────────────────────

  function validateAdd(): boolean {
    const errs: FlatFormErrors = {};
    if (!addForm.buildingId) errs.buildingId = 'Select a building';
    if (!addForm.flatNumber.trim()) errs.flatNumber = 'Flat number is required';
    const floorNum = parseInt(addForm.floor, 10);
    if (addForm.floor === '' || isNaN(floorNum) || floorNum < 0)
      errs.floor = 'Enter a valid floor (0 or higher)';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleAddSubmit = async () => {
    if (!validateAdd() || !societyId) return;
    setAddSubmitting(true);
    try {
      await api.post(`/onboarding/societies/${societyId}/flats`, {
        buildingId: addForm.buildingId,
        flatNumber: addForm.flatNumber.trim(),
        floor: parseInt(addForm.floor, 10),
      });
      setShowAddModal(false);
      setAddForm(EMPTY_ADD_FORM);
      await fetchFlats(societyId, filterBuildingId ?? undefined);
    } catch (err) {
      setToast(extractApiMessage(err, 'Failed to add flat'));
    } finally {
      setAddSubmitting(false);
    }
  };

  // ── Edit flat ─────────────────────────────────────────────

  function openEdit(flat: MgmtFlat) {
    setEditTarget(flat);
    setEditForm({ flatNumber: flat.flatNumber, floor: String(flat.floor) });
    setEditErrors({});
  }

  function validateEdit(): boolean {
    const errs: { flatNumber?: string; floor?: string } = {};
    if (!editForm.flatNumber.trim()) errs.flatNumber = 'Flat number is required';
    const floorNum = parseInt(editForm.floor, 10);
    if (editForm.floor === '' || isNaN(floorNum) || floorNum < 0)
      errs.floor = 'Enter a valid floor (0 or higher)';
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleEditSubmit = async () => {
    if (!validateEdit() || !societyId || !editTarget) return;
    setEditSubmitting(true);
    try {
      await updateFlat(societyId, editTarget.id, {
        flatNumber: editForm.flatNumber.trim(),
        floor: parseInt(editForm.floor, 10),
      });
      setEditTarget(null);
    } catch {
      // error in hook
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────

  const handleDelete = useCallback((flat: MgmtFlat) => {
    if (flat.isOccupied) {
      setToast('Cannot delete an occupied flat. Deactivate its residents first.');
      return;
    }
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
            } catch (err) {
              const e = err as { response?: { status?: number } };
              if (e.response?.status === 409) {
                setToast('Cannot delete: flat still has active residents.');
              } else {
                setToast('Failed to delete flat.');
              }
            }
          },
        },
      ]
    );
  }, [societyId, deleteFlat]);

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtFlat }) => (
    <View style={styles.row}>
      {/* Tappable content area */}
      <TouchableOpacity
        style={styles.rowPressable}
        onPress={() => handleFlatPress(item)}
        activeOpacity={0.7}
      >
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
      </TouchableOpacity>

      {/* Action buttons outside tappable area */}
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

      {/* Toast */}
      {toast ? (
        <View style={styles.toastBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#92400E" />
          <Text style={styles.toastText} numberOfLines={2}>{toast}</Text>
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
      {flatsLoading && !refreshing ? (
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
                  : 'Tap + to add a flat.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a73e8" />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setAddForm({ ...EMPTY_ADD_FORM, buildingId: filterBuildingId ?? '' });
          setAddErrors(EMPTY_ADD_ERRORS);
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ── Building picker ──────────────────────────────────── */}
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
              onPress={() => {
                setFilterBuildingId(null);
                setShowBuildingPicker(false);
                if (societyId) void fetchFlats(societyId);
              }}
            >
              <Text style={styles.pickerOptionText}>All Buildings</Text>
              {!filterBuildingId && <Ionicons name="checkmark" size={18} color="#1a73e8" />}
            </TouchableOpacity>
            {buildings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.pickerOption, filterBuildingId === b.id && styles.pickerOptionSelected]}
                onPress={() => {
                  setFilterBuildingId(b.id);
                  setShowBuildingPicker(false);
                  if (societyId) void fetchFlats(societyId, b.id);
                }}
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

      {/* ── Flat detail bottom sheet ─────────────────────────── */}
      <Modal
        visible={showDetail && !!selectedFlat}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.sheetBackdrop}>
          <SafeAreaView style={styles.detailSheet} edges={['bottom']}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailIcon, selectedFlat?.isOccupied ? styles.detailIconOccupied : styles.detailIconVacant]}>
                <Ionicons
                  name={selectedFlat?.isOccupied ? 'home' : 'home-outline'}
                  size={22}
                  color={selectedFlat?.isOccupied ? '#1a73e8' : '#9CA3AF'}
                />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailTitle}>Flat {selectedFlat?.flatNumber}</Text>
                <Text style={styles.detailSub}>
                  Floor {selectedFlat?.floor}
                  {selectedFlat ? ` · ${buildingName(selectedFlat.buildingId)}` : ''}
                </Text>
              </View>
              <View style={[styles.badge, selectedFlat?.isOccupied ? styles.badgeOccupied : styles.badgeVacant]}>
                <Text style={[styles.badgeText, selectedFlat?.isOccupied ? styles.badgeTextOccupied : styles.badgeTextVacant]}>
                  {selectedFlat?.isOccupied ? 'Occupied' : 'Vacant'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetail(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Residents */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>
                Residents{flatResidents.length > 0 ? ` (${flatResidents.length})` : ''}
              </Text>
              {residentsLoading ? (
                <View style={styles.detailLoading}>
                  <ActivityIndicator color="#1a73e8" size="small" />
                </View>
              ) : flatResidents.length === 0 ? (
                <Text style={styles.detailEmptyText}>No residents in this flat.</Text>
              ) : (
                flatResidents.map((r) => (
                  <View key={r.id} style={styles.residentRow}>
                    <View style={styles.residentAvatar}>
                      <Text style={styles.residentAvatarText}>
                        {r.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                    <View style={styles.residentInfo}>
                      <Text style={styles.residentName}>{r.fullName ?? 'Unknown'}</Text>
                      <Text style={styles.residentRole}>{roleLabel(r.role)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.reassignBtn}
                      onPress={() => openReassign(r)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.reassignBtnText}>Reassign</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Reassign flat modal ──────────────────────────────── */}
      <Modal
        visible={showReassign && !!reassignTarget}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReassign(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reassign Flat</Text>
            <TouchableOpacity onPress={() => setShowReassign(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.reassignBody}>
            <Text style={styles.reassignHint}>
              Move{' '}
              <Text style={styles.reassignName}>{reassignTarget?.fullName ?? 'resident'}</Text>
              {' '}to a new flat:
            </Text>
            {allFlatsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#1a73e8" />
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <FlatPicker
                  flats={pickerItems}
                  selectedId={reassignFlatId}
                  onSelect={(f) => setReassignFlatId(f.id)}
                />
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!reassignFlatId || reassigning) && styles.submitBtnDisabled,
              ]}
              onPress={handleReassignConfirm}
              disabled={!reassignFlatId || reassigning}
              activeOpacity={0.85}
            >
              {reassigning ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Confirm Reassign</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Add flat modal ───────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Flat</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <FlatForm
                data={addForm}
                errors={addErrors}
                onChange={(field, value) => {
                  setAddForm((p) => ({ ...p, [field]: value }));
                  setAddErrors((p) => ({ ...p, [field]: undefined }));
                }}
                buildings={buildings.map((b) => ({ id: b.id, name: b.name }))}
                onSubmit={handleAddSubmit}
                loading={addSubmitting}
                submitLabel="Add Flat"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit flat modal ──────────────────────────────────── */}
      <Modal
        visible={!!editTarget}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Flat</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Flat Number</Text>
              <TextInput
                style={[styles.fieldInput, editErrors.flatNumber ? styles.fieldInputError : null]}
                placeholder="e.g. 101, A-201"
                placeholderTextColor="#9CA3AF"
                value={editForm.flatNumber}
                onChangeText={(v) => {
                  setEditForm((p) => ({ ...p, flatNumber: v }));
                  setEditErrors((p) => ({ ...p, flatNumber: undefined }));
                }}
                returnKeyType="next"
              />
              {editErrors.flatNumber ? <Text style={styles.fieldError}>{editErrors.flatNumber}</Text> : null}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Floor</Text>
              <TextInput
                style={[styles.fieldInput, editErrors.floor ? styles.fieldInputError : null]}
                placeholder="e.g. 0 (ground), 1, 2..."
                placeholderTextColor="#9CA3AF"
                value={editForm.floor}
                onChangeText={(v) => {
                  setEditForm((p) => ({ ...p, floor: v.replace(/\D/g, '') }));
                  setEditErrors((p) => ({ ...p, floor: undefined }));
                }}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              {editErrors.floor ? <Text style={styles.fieldError}>{editErrors.floor}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, editSubmitting && styles.submitBtnDisabled]}
                onPress={handleEditSubmit}
                disabled={editSubmitting}
                activeOpacity={0.85}
              >
                {editSubmitting ? (
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },

  toastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  toastText: { color: '#92400E', fontSize: 13, flex: 1 },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginTop: 12,
    backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterBtnText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', margin: 12, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  separator: { height: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
    overflow: 'hidden',
  },
  rowPressable: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionBtnDanger: {},

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },

  // Picker modal
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, paddingTop: 20,
  },
  pickerTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    textAlign: 'center', paddingHorizontal: 20, marginBottom: 12,
  },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: { backgroundColor: '#EFF6FF' },
  pickerOptionText: { flex: 1, fontSize: 15, color: '#111827' },
  pickerClose: {
    marginTop: 8, marginHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center',
  },
  pickerCloseText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Flat detail sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  detailIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  detailIconOccupied: { backgroundColor: '#EFF6FF' },
  detailIconVacant: { backgroundColor: '#F3F4F6' },
  detailInfo: { flex: 1 },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  detailSub: { fontSize: 13, color: '#6B7280' },
  detailSection: { paddingHorizontal: 20, paddingVertical: 16 },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
  detailLoading: { paddingVertical: 20, alignItems: 'center' },
  detailEmptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },

  residentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, gap: 10,
  },
  residentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  residentAvatarText: { fontSize: 13, fontWeight: '700', color: '#1a73e8' },
  residentInfo: { flex: 1 },
  residentName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  residentRole: { fontSize: 12, color: '#6B7280' },
  reassignBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  reassignBtnText: { fontSize: 12, fontWeight: '600', color: '#1a73e8' },

  // Reassign modal
  reassignBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  reassignHint: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  reassignName: { fontWeight: '700', color: '#111827' },
  pickerContainer: { flex: 1, marginBottom: 16 },

  // Shared modal styles
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
    paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
