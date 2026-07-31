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
  type MgmtResident,
  type MgmtBuilding,
} from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';
import { ResidentTableRow } from '@/components/admin/ResidentTable';
import { DeactivateConfirmModal } from '@/components/admin/DeactivateConfirmModal';
import { FlatPicker, type FlatItem } from '@/components/FlatPicker';
import api from '@/lib/api';
import type { MgmtFlat } from '@/hooks/useAdminManagement';

// ============================================================
// Screen
// ============================================================

export default function ResidentsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    residents, residentsLoading,
    fetchResidents, updateResident, deactivateResident, resendInvite,
    buildings, fetchBuildings,
    error, clearError,
  } = useAdminManagement();

  // ── Search & filter ───────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterBuilding, setFilterBuilding] = useState<string | null>(null);

  // ── Pull-to-refresh ───────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);

  // ── Resident detail sheet ─────────────────────────────────
  const [selectedResident, setSelectedResident] = useState<MgmtResident | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // ── Reassign flat ─────────────────────────────────────────
  const [showReassign, setShowReassign] = useState(false);
  const [allFlats, setAllFlats] = useState<MgmtFlat[]>([]);
  const [allFlatsLoading, setAllFlatsLoading] = useState(false);
  const [reassignFlatId, setReassignFlatId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  // ── Deactivate ────────────────────────────────────────────
  const [deactivateTarget, setDeactivateTarget] = useState<MgmtResident | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // ── Resend invite ─────────────────────────────────────────
  const [resendingId, setResendingId] = useState<string | null>(null);

  // ── Boot ──────────────────────────────────────────────────

  useEffect(() => {
    if (societyId) {
      void fetchResidents(societyId);
      void fetchBuildings(societyId);
    }
  }, [societyId, fetchResidents, fetchBuildings]);

  // Debounced search
  useEffect(() => {
    if (!societyId) return;
    const t = setTimeout(() => {
      void fetchResidents(societyId, search || undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [search, societyId, fetchResidents]);

  // ── Pull-to-refresh ───────────────────────────────────────

  const onRefresh = useCallback(async () => {
    if (!societyId) return;
    setRefreshing(true);
    await Promise.all([
      fetchResidents(societyId, search || undefined),
      fetchBuildings(societyId),
    ]);
    setRefreshing(false);
  }, [societyId, fetchResidents, fetchBuildings, search]);

  // ── Filtering (client-side by building) ──────────────────

  const displayed: MgmtResident[] = filterBuilding
    ? residents.filter((r) => {
        const b = buildings.find((bld) => bld.id === filterBuilding);
        return b ? r.buildingName === b.name : true;
      })
    : residents;

  // ── Reassign flat ─────────────────────────────────────────

  const openReassign = useCallback(async () => {
    if (!societyId) return;
    setReassignFlatId(selectedResident?.flatId ?? null);
    setAllFlatsLoading(true);
    setShowReassign(true);
    try {
      const res = await api.get<{ flats: MgmtFlat[] }>(
        `/onboarding/societies/${societyId}/flats`
      );
      setAllFlats(res.data.flats ?? []);
    } catch {
      // show empty picker
    } finally {
      setAllFlatsLoading(false);
    }
  }, [societyId, selectedResident]);

  const handleReassignConfirm = async () => {
    if (!selectedResident || !societyId || !reassignFlatId) return;
    setReassigning(true);
    try {
      await updateResident(societyId, selectedResident.id, { flatId: reassignFlatId });
      setShowReassign(false);
      setShowDetail(false);
      await fetchResidents(societyId, search || undefined);
    } catch {
      // error in hook
    } finally {
      setReassigning(false);
    }
  };

  const flatPickerItems: FlatItem[] = allFlats.map((f) => ({
    id: f.id,
    buildingId: f.buildingId,
    buildingName: buildings.find((b) => b.id === f.buildingId)?.name,
    flatNumber: f.flatNumber,
    floor: f.floor,
    isOccupied: f.isOccupied,
  }));

  // ── Resend invite ─────────────────────────────────────────

  const handleResendInvite = async () => {
    if (!selectedResident || !societyId) return;
    setResendingId(selectedResident.id);
    try {
      await resendInvite(societyId, selectedResident.id);
      Alert.alert('Sent', `Invite resent to ${selectedResident.fullName ?? 'resident'}.`);
    } catch {
      Alert.alert('Error', 'Failed to resend invite.');
    } finally {
      setResendingId(null);
    }
  };

  // ── Deactivate ────────────────────────────────────────────

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget || !societyId) return;
    setDeactivating(true);
    try {
      await deactivateResident(societyId, deactivateTarget.id);
      setDeactivateTarget(null);
      setShowDetail(false);
    } catch {
      Alert.alert('Error', 'Failed to deactivate resident.');
    } finally {
      setDeactivating(false);
    }
  };

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtResident }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => { setSelectedResident(item); setShowDetail(true); }}
    >
      <ResidentTableRow resident={item} />
    </TouchableOpacity>
  );

  // ── Building filter chips ─────────────────────────────────

  const renderBuildingChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={[styles.chip, !filterBuilding && styles.chipActive]}
        onPress={() => setFilterBuilding(null)}
        activeOpacity={0.75}
      >
        <Text style={[styles.chipText, !filterBuilding && styles.chipTextActive]}>All</Text>
      </TouchableOpacity>
      {buildings.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={[styles.chip, filterBuilding === b.id && styles.chipActive]}
          onPress={() => setFilterBuilding(b.id)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, filterBuilding === b.id && styles.chipTextActive]}>
            {b.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
          placeholder="Search by name or phone..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>

      {/* Building filter chips */}
      {buildings.length > 0 ? renderBuildingChips() : null}

      {/* List */}
      {residentsLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No residents</Text>
              <Text style={styles.emptyHint}>
                {search
                  ? 'No results for your search.'
                  : filterBuilding
                    ? 'No residents in this building.'
                    : 'Add residents via the onboarding flow.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a73e8" />
          }
        />
      )}

      {/* ── Resident detail bottom sheet ─────────────────────── */}
      <Modal
        visible={showDetail && !!selectedResident}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.sheetBackdrop}>
          <SafeAreaView style={styles.detailSheet} edges={['bottom']}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={[
                styles.detailAvatar,
                !selectedResident?.isActive && styles.detailAvatarInactive,
              ]}>
                <Text style={[
                  styles.detailAvatarText,
                  !selectedResident?.isActive && styles.detailAvatarTextInactive,
                ]}>
                  {selectedResident?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailName}>{selectedResident?.fullName ?? 'Unknown'}</Text>
                <Text style={styles.detailSub}>
                  {selectedResident?.phone ?? 'No phone'}
                  {selectedResident?.flatNumber ? ` · Flat ${selectedResident.flatNumber}` : ''}
                </Text>
              </View>
              {!selectedResident?.isActive ? (
                <View style={styles.deactivatedBadge}>
                  <Text style={styles.deactivatedBadgeText}>Deactivated</Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={() => setShowDetail(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.detailActions}>
              {/* Reassign Flat */}
              <TouchableOpacity
                style={styles.detailAction}
                onPress={openReassign}
                activeOpacity={0.75}
              >
                <Ionicons name="swap-horizontal-outline" size={22} color="#1a73e8" />
                <Text style={styles.detailActionText}>Reassign{'\n'}Flat</Text>
              </TouchableOpacity>

              {/* Resend Invite */}
              <TouchableOpacity
                style={styles.detailAction}
                onPress={handleResendInvite}
                disabled={resendingId === selectedResident?.id}
                activeOpacity={0.75}
              >
                {resendingId === selectedResident?.id ? (
                  <ActivityIndicator size="small" color="#1a73e8" />
                ) : (
                  <Ionicons name="mail-outline" size={22} color="#1a73e8" />
                )}
                <Text style={styles.detailActionText}>Resend{'\n'}Invite</Text>
              </TouchableOpacity>

              {/* Deactivate */}
              {selectedResident?.isActive ? (
                <TouchableOpacity
                  style={[styles.detailAction, styles.detailActionDanger]}
                  onPress={() => {
                    setDeactivateTarget(selectedResident);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-remove-outline" size={22} color="#DC2626" />
                  <Text style={[styles.detailActionText, styles.detailActionTextDanger]}>
                    Deactivate
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.detailAction, styles.detailActionDisabled]}>
                  <Ionicons name="person-remove-outline" size={22} color="#9CA3AF" />
                  <Text style={[styles.detailActionText, { color: '#9CA3AF' }]}>Deactivated</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Reassign flat modal ──────────────────────────────── */}
      <Modal
        visible={showReassign}
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
              <Text style={styles.reassignName}>{selectedResident?.fullName ?? 'resident'}</Text>
              {' '}to a new flat:
            </Text>
            {allFlatsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#1a73e8" />
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <FlatPicker
                  flats={flatPickerItems}
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

      {/* ── Deactivate confirm ───────────────────────────────── */}
      <DeactivateConfirmModal
        visible={!!deactivateTarget}
        name={deactivateTarget?.fullName ?? 'this resident'}
        type="resident"
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivating}
      />
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', margin: 12, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  chips: {
    paddingHorizontal: 12, paddingBottom: 10, gap: 8,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#1a73e8', backgroundColor: '#EFF6FF',
  },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#1a73e8', fontWeight: '700' },

  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  separator: { height: 8 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  // Detail sheet
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
    gap: 12,
  },
  detailAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarInactive: { backgroundColor: '#F3F4F6' },
  detailAvatarText: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },
  detailAvatarTextInactive: { color: '#9CA3AF' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  detailSub: { fontSize: 13, color: '#6B7280' },

  deactivatedBadge: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  deactivatedBadgeText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  detailActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  detailAction: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 16, gap: 6,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  detailActionDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  detailActionDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  detailActionText: { fontSize: 12, fontWeight: '600', color: '#1a73e8', textAlign: 'center' },
  detailActionTextDanger: { color: '#DC2626' },

  // Reassign modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  reassignBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  reassignHint: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  reassignName: { fontWeight: '700', color: '#111827' },
  pickerContainer: { flex: 1, marginBottom: 16 },

  submitBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
