import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
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
import { useAdminManagement, type MgmtGuard } from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';
import { DeactivateConfirmModal } from '@/components/admin/DeactivateConfirmModal';
import { GuardForm, type GuardFormData, type GuardFormErrors } from '@/components/admin/GuardForm';
import api from '@/lib/api';

// ============================================================
// Constants & helpers
// ============================================================

const SHIFTS = ['morning', 'afternoon', 'night'] as const;
type Shift = typeof SHIFTS[number];

const SHIFT_LABELS: Record<Shift, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
};

const SHIFT_STYLE: Record<Shift, { bg: string; text: string }> = {
  morning: { bg: '#FEF3C7', text: '#92400E' },
  afternoon: { bg: '#FFF7ED', text: '#C2410C' },
  night: { bg: '#EDE9FE', text: '#5B21B6' },
};

/** Show only last 4 digits: ••••••6789 */
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return '•'.repeat(digits.length - 4) + digits.slice(-4);
}

interface EditForm {
  gateName: string;
  shift: Shift;
}

const EMPTY_ADD_FORM: GuardFormData = { fullName: '', phone: '', gateName: '', shift: 'morning' };

// ============================================================
// Screen
// ============================================================

export default function GuardsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    guards, guardsLoading, fetchGuards, updateGuard, toggleGuardActive,
    error, clearError,
  } = useAdminManagement();

  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit sheet
  const [editTarget, setEditTarget] = useState<MgmtGuard | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ gateName: '', shift: 'morning' });
  const [editErrors, setEditErrors] = useState<{ gateName?: string }>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<GuardFormData>(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState<GuardFormErrors>({});
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<MgmtGuard | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // ── Boot ──────────────────────────────────────────────────

  useEffect(() => {
    if (societyId) void fetchGuards(societyId);
  }, [societyId, fetchGuards]);

  // ── Refresh ───────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    if (!societyId) return;
    setRefreshing(true);
    await fetchGuards(societyId);
    setRefreshing(false);
  }, [societyId, fetchGuards]);

  // ── Active first, inactive at bottom ─────────────────────

  const sortedGuards = [...guards].sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? -1 : 1;
  });

  // ── Toggle ────────────────────────────────────────────────

  const handleToggle = useCallback(async (guardId: string, isActive: boolean) => {
    if (!societyId) return;
    if (!isActive) {
      const guard = guards.find((g) => g.id === guardId);
      if (guard) { setDeactivateTarget(guard); return; }
    }
    setTogglingId(guardId);
    try {
      await toggleGuardActive(societyId, guardId, true);
    } catch {
      Alert.alert('Error', 'Failed to update guard status.');
    } finally {
      setTogglingId(null);
    }
  }, [societyId, guards, toggleGuardActive]);

  // ── Deactivate confirm ────────────────────────────────────

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget || !societyId) return;
    setDeactivating(true);
    try {
      await toggleGuardActive(societyId, deactivateTarget.id, false);
      setDeactivateTarget(null);
    } catch {
      Alert.alert('Error', 'Failed to deactivate guard.');
    } finally {
      setDeactivating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────

  const openEdit = (guard: MgmtGuard) => {
    setEditTarget(guard);
    setEditForm({ gateName: guard.gateName, shift: guard.shift });
    setEditErrors({});
  };

  const handleEditSubmit = async () => {
    if (!editTarget || !societyId) return;
    if (!editForm.gateName.trim()) {
      setEditErrors({ gateName: 'Gate name is required' });
      return;
    }
    setEditSubmitting(true);
    try {
      await updateGuard(societyId, editTarget.id, {
        gateName: editForm.gateName.trim(),
        shift: editForm.shift,
      });
      setEditTarget(null);
    } catch {
      Alert.alert('Error', 'Failed to update guard.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Add guard ─────────────────────────────────────────────

  function validateAdd(): boolean {
    const errs: GuardFormErrors = {};
    if (!addForm.fullName.trim()) errs.fullName = 'Full name is required';
    const digits = addForm.phone.replace(/\D/g, '');
    if (!digits || digits.length !== 10) errs.phone = 'Enter a valid 10-digit mobile number';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleAddSubmit = async () => {
    if (!validateAdd() || !societyId) return;
    setAddSubmitting(true);
    try {
      await api.post(`/onboarding/societies/${societyId}/guards`, {
        fullName: addForm.fullName.trim(),
        phone: `+91${addForm.phone.replace(/\D/g, '')}`,
        gateName: addForm.gateName.trim() || 'Main Gate',
        shift: addForm.shift,
      });
      setShowAddModal(false);
      setAddForm(EMPTY_ADD_FORM);
      await fetchGuards(societyId);
    } catch {
      Alert.alert('Error', 'Failed to add guard. Please try again.');
    } finally {
      setAddSubmitting(false);
    }
  };

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtGuard }) => {
    const shift = item.shift as Shift;
    const shiftConf = SHIFT_STYLE[shift] ?? { bg: '#F3F4F6', text: '#374151' };
    const shiftLabel = SHIFT_LABELS[shift] ?? item.shift;
    const toggling = togglingId === item.id;

    return (
      <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.85}>
        <View style={[styles.guardRow, !item.isActive && styles.guardRowInactive]}>
          {/* Active / inactive indicator */}
          <View style={[styles.activeDot, item.isActive ? styles.activeDotGreen : styles.activeDotGrey]} />

          {/* Shield icon */}
          <View style={[styles.iconCircle, !item.isActive && styles.iconCircleInactive]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={item.isActive ? '#1a73e8' : '#9CA3AF'}
            />
          </View>

          {/* Name + masked phone + gate */}
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, !item.isActive && styles.rowNameInactive]} numberOfLines={1}>
              {item.fullName ?? 'Guard'}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {maskPhone(item.phone)} · {item.gateName}
            </Text>
          </View>

          {/* Shift badge */}
          <View style={[styles.shiftBadge, { backgroundColor: shiftConf.bg }]}>
            <Text style={[styles.shiftBadgeText, { color: shiftConf.text }]}>{shiftLabel}</Text>
          </View>

          {/* Active toggle */}
          {toggling ? (
            <ActivityIndicator size="small" color="#1a73e8" style={styles.toggleLoader} />
          ) : (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); void handleToggle(item.id, !item.isActive); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <View style={[styles.toggleTrack, item.isActive && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, item.isActive && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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

      {/* List */}
      {guardsLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={sortedGuards}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No guards</Text>
              <Text style={styles.emptyHint}>Tap + to add a guard.</Text>
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
          setAddForm(EMPTY_ADD_FORM);
          setAddErrors({});
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ── Edit guard sheet ─────────────────────────────────── */}
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
              <Text style={styles.modalTitle}>Edit Guard</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              {/* Guard info card (read-only) */}
              <View style={styles.guardInfoCard}>
                <View style={styles.guardAvatar}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#1a73e8" />
                </View>
                <View style={styles.guardCardInfo}>
                  <Text style={styles.guardCardName}>{editTarget?.fullName ?? 'Guard'}</Text>
                  <Text style={styles.guardCardPhone}>{maskPhone(editTarget?.phone)}</Text>
                </View>
              </View>

              {/* Gate name */}
              <Text style={styles.fieldLabel}>Gate Name</Text>
              <TextInput
                style={[styles.fieldInput, editErrors.gateName ? styles.fieldInputError : null]}
                placeholder="e.g. Main Gate, North Gate"
                placeholderTextColor="#9CA3AF"
                value={editForm.gateName}
                onChangeText={(v) => {
                  setEditForm((p) => ({ ...p, gateName: v }));
                  setEditErrors({});
                }}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {editErrors.gateName ? (
                <Text style={styles.fieldError}>{editErrors.gateName}</Text>
              ) : null}

              {/* Shift picker */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Shift</Text>
              <View style={styles.shiftRow}>
                {SHIFTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.shiftChip, editForm.shift === s && styles.shiftChipSelected]}
                    onPress={() => setEditForm((p) => ({ ...p, shift: s }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.shiftText, editForm.shift === s && styles.shiftTextSelected]}>
                      {SHIFT_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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

              {/* Deactivate from edit sheet */}
              {editTarget?.isActive ? (
                <TouchableOpacity
                  style={styles.deactivateBtn}
                  onPress={() => {
                    setDeactivateTarget(editTarget);
                    setEditTarget(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-remove-outline" size={18} color="#DC2626" />
                  <Text style={styles.deactivateBtnText}>Deactivate Guard</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add guard modal ──────────────────────────────────── */}
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
              <Text style={styles.modalTitle}>Add Guard</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <GuardForm
                data={addForm}
                errors={addErrors}
                onChange={(field, value) => {
                  setAddForm((p) => ({ ...p, [field]: value }));
                  setAddErrors((p) => ({ ...p, [field]: undefined }));
                }}
                onSubmit={handleAddSubmit}
                loading={addSubmitting}
                submitLabel="Add Guard"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Deactivate confirm ───────────────────────────────── */}
      <DeactivateConfirmModal
        visible={!!deactivateTarget}
        name={deactivateTarget?.fullName ?? 'this guard'}
        type="guard"
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
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },

  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100 },
  separator: { height: 8 },

  guardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
  },
  guardRowInactive: { backgroundColor: '#F9FAFB', opacity: 0.75 },

  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activeDotGreen: { backgroundColor: '#10B981' },
  activeDotGrey: { backgroundColor: '#9CA3AF' },

  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconCircleInactive: { backgroundColor: '#F3F4F6' },

  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowNameInactive: { color: '#9CA3AF' },
  rowMeta: { fontSize: 12, color: '#6B7280' },

  shiftBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  shiftBadgeText: { fontSize: 11, fontWeight: '600' },

  // Custom toggle (avoids importing Switch for this standalone design)
  toggleLoader: { marginHorizontal: 4 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12,
    backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: '#BFDBFE' },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#9CA3AF', alignSelf: 'flex-start',
  },
  toggleThumbOn: { backgroundColor: '#1a73e8', alignSelf: 'flex-end' },

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

  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  modalBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  guardInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  guardAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  guardCardInfo: { flex: 1 },
  guardCardName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  guardCardPhone: { fontSize: 13, color: '#6B7280' },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB',
  },
  fieldInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldError: { fontSize: 12, color: '#EF4444', marginTop: 4 },

  shiftRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  shiftChip: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', alignItems: 'center',
  },
  shiftChipSelected: { borderColor: '#1a73e8', backgroundColor: '#EFF6FF' },
  shiftText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  shiftTextSelected: { color: '#1a73e8' },

  submitBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  deactivateBtnText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
