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
import { useAdminManagement, MgmtResident } from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';
import { ResidentTableRow } from '@/components/admin/ResidentTable';
import { DeactivateConfirmModal } from '@/components/admin/DeactivateConfirmModal';

// ============================================================
// Screen
// ============================================================

export default function ResidentsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    residents, residentsLoading,
    fetchResidents, deactivateResident, resendInvite,
    buildings, fetchBuildings,
    error, clearError,
  } = useAdminManagement();

  const [search, setSearch] = useState('');
  const [filterBuilding, setFilterBuilding] = useState<string | null>(null);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);

  // Detail bottom sheet
  const [selectedResident, setSelectedResident] = useState<MgmtResident | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<MgmtResident | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Resend invite loading
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (societyId) {
      void fetchResidents(societyId);
      void fetchBuildings(societyId);
    }
  }, [societyId, fetchResidents, fetchBuildings]);

  // Debounce search
  useEffect(() => {
    if (!societyId) return;
    const t = setTimeout(() => { void fetchResidents(societyId, search || undefined); }, 300);
    return () => clearTimeout(t);
  }, [search, societyId, fetchResidents]);

  // ── Filtering ─────────────────────────────────────────────

  // If filterBuilding is set, filter client-side by buildingName
  const displayed = filterBuilding
    ? residents.filter((r) => {
        const b = buildings.find((b) => b.id === filterBuilding);
        return b ? r.buildingName === b.name : true;
      })
    : residents;

  // ── Actions ───────────────────────────────────────────────

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

  const handleResendInvite = async (resident: MgmtResident) => {
    if (!societyId) return;
    setResendingId(resident.id);
    try {
      await resendInvite(societyId, resident.id);
      Alert.alert('Sent', `Invite resent to ${resident.fullName ?? 'resident'}.`);
    } catch {
      Alert.alert('Error', 'Failed to resend invite.');
    } finally {
      setResendingId(null);
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
          {filterBuilding ? buildings.find((b) => b.id === filterBuilding)?.name ?? 'Building' : 'All Buildings'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

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
        />
      </View>

      {/* List */}
      {residentsLoading ? (
        <View style={styles.center}><ActivityIndicator color="#1a73e8" /></View>
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
                {search ? 'No results for your search.' : 'Add residents via the onboarding flow.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Building picker */}
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
              style={[styles.pickerOption, !filterBuilding && styles.pickerOptionSelected]}
              onPress={() => { setFilterBuilding(null); setShowBuildingPicker(false); }}
            >
              <Text style={styles.pickerOptionText}>All Buildings</Text>
              {!filterBuilding && <Ionicons name="checkmark" size={18} color="#1a73e8" />}
            </TouchableOpacity>
            {buildings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.pickerOption, filterBuilding === b.id && styles.pickerOptionSelected]}
                onPress={() => { setFilterBuilding(b.id); setShowBuildingPicker(false); }}
              >
                <Text style={styles.pickerOptionText}>{b.name}</Text>
                {filterBuilding === b.id && <Ionicons name="checkmark" size={18} color="#1a73e8" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerClose} onPress={() => setShowBuildingPicker(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Resident detail bottom sheet */}
      <Modal
        visible={showDetail && !!selectedResident}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.detailBackdrop}>
          <View style={styles.detailSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>
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
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.detailActions}>
              {/* Resend invite */}
              <TouchableOpacity
                style={styles.detailAction}
                onPress={() => selectedResident && handleResendInvite(selectedResident)}
                disabled={resendingId === selectedResident?.id}
                activeOpacity={0.75}
              >
                {resendingId === selectedResident?.id ? (
                  <ActivityIndicator size="small" color="#1a73e8" />
                ) : (
                  <Ionicons name="mail-outline" size={22} color="#1a73e8" />
                )}
                <Text style={styles.detailActionText}>Resend Invite</Text>
              </TouchableOpacity>

              {/* Deactivate */}
              {selectedResident?.isActive ? (
                <TouchableOpacity
                  style={[styles.detailAction, styles.detailActionDanger]}
                  onPress={() => { setDeactivateTarget(selectedResident); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-remove-outline" size={22} color="#DC2626" />
                  <Text style={[styles.detailActionText, styles.detailActionTextDanger]}>Deactivate</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.detailAction, styles.detailActionDisabled]}>
                  <Ionicons name="person-remove-outline" size={22} color="#9CA3AF" />
                  <Text style={[styles.detailActionText, { color: '#9CA3AF' }]}>Deactivated</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Deactivate confirm */}
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

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  // Building picker
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, paddingTop: 20,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', paddingHorizontal: 20, marginBottom: 12 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: { backgroundColor: '#EFF6FF' },
  pickerOptionText: { flex: 1, fontSize: 15, color: '#111827' },
  pickerClose: { marginTop: 8, marginHorizontal: 20, paddingVertical: 14, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' },
  pickerCloseText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Detail sheet
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, paddingTop: 10,
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
  detailAvatarText: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  detailSub: { fontSize: 13, color: '#6B7280' },

  detailActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 20,
  },
  detailAction: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 16, gap: 6,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  detailActionDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  detailActionDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  detailActionText: { fontSize: 13, fontWeight: '600', color: '#1a73e8' },
  detailActionTextDanger: { color: '#DC2626' },
});
