import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { useAdminManagement, MgmtGuard } from '@/hooks/useAdminManagement';
import { useAuthStore } from '@/stores/authStore';
import { GuardTableRow } from '@/components/admin/GuardTable';
import { DeactivateConfirmModal } from '@/components/admin/DeactivateConfirmModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// ============================================================
// Edit form types
// ============================================================

interface EditForm {
  gateName: string;
  shift: 'morning' | 'afternoon' | 'night';
}

const SHIFTS: Array<{ value: 'morning' | 'afternoon' | 'night'; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
];

// ============================================================
// Screen
// ============================================================

export default function GuardsScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const {
    guards, guardsLoading, fetchGuards, updateGuard, toggleGuardActive,
    error, clearError,
  } = useAdminManagement();

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit sheet
  const [editTarget, setEditTarget] = useState<MgmtGuard | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ gateName: '', shift: 'morning' });
  const [editErrors, setEditErrors] = useState<{ gateName?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<MgmtGuard | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (societyId) {
      void fetchGuards(societyId);
    }
  }, [societyId, fetchGuards]);

  // ── Toggle active ─────────────────────────────────────────

  const handleToggle = useCallback(async (guardId: string, isActive: boolean) => {
    if (!societyId) return;
    if (!isActive) {
      // Show confirm before deactivating
      const guard = guards.find((g) => g.id === guardId);
      if (guard) { setDeactivateTarget(guard); return; }
    }
    setTogglingId(guardId);
    try {
      await toggleGuardActive(societyId, guardId, isActive);
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

  // ── Edit sheet ────────────────────────────────────────────

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
    setSubmitting(true);
    try {
      await updateGuard(societyId, editTarget.id, {
        gateName: editForm.gateName.trim(),
        shift: editForm.shift,
      });
      setEditTarget(null);
    } catch {
      Alert.alert('Error', 'Failed to update guard.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: MgmtGuard }) => (
    <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.85}>
      <GuardTableRow
        guard={item}
        onToggleActive={handleToggle}
        toggling={togglingId === item.id}
      />
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

      {/* List */}
      {guardsLoading ? (
        <View style={styles.center}><ActivityIndicator color="#1a73e8" /></View>
      ) : (
        <FlatList
          data={guards}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No guards</Text>
              <Text style={styles.emptyHint}>Add guards via the onboarding flow.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Guard Sheet */}
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
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Guard info (read-only) */}
              <View style={styles.guardInfo}>
                <View style={styles.guardAvatar}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#1a73e8" />
                </View>
                <View>
                  <Text style={styles.guardName}>{editTarget?.fullName ?? 'Guard'}</Text>
                  <Text style={styles.guardPhone}>{editTarget?.phone ?? ''}</Text>
                </View>
              </View>

              {/* Gate name */}
              <Input
                label="Gate Name"
                placeholder="e.g. Main Gate, North Gate"
                value={editForm.gateName}
                onChangeText={(v) => { setEditForm((p) => ({ ...p, gateName: v })); setEditErrors({}); }}
                error={editErrors.gateName}
                autoCapitalize="words"
                returnKeyType="done"
              />

              {/* Shift picker */}
              <Text style={styles.fieldLabel}>Shift</Text>
              <View style={styles.shiftRow}>
                {SHIFTS.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.shiftChip, editForm.shift === value && styles.shiftChipSelected]}
                    onPress={() => setEditForm((p) => ({ ...p, shift: value }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.shiftText, editForm.shift === value && styles.shiftTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title="Save Changes"
                onPress={handleEditSubmit}
                loading={submitting}
                disabled={submitting}
                style={{ marginTop: 24 }}
              />

              {/* Deactivate from edit sheet */}
              {editTarget?.isActive ? (
                <TouchableOpacity
                  style={styles.deactivateBtn}
                  onPress={() => { setDeactivateTarget(editTarget); setEditTarget(null); }}
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

      {/* Deactivate confirm */}
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

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

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

  guardInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  guardAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  guardName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  guardPhone: { fontSize: 13, color: '#6B7280' },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  shiftRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  shiftChip: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', alignItems: 'center',
  },
  shiftChipSelected: { borderColor: '#1a73e8', backgroundColor: '#EFF6FF' },
  shiftText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  shiftTextSelected: { color: '#1a73e8' },

  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  deactivateBtnText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
