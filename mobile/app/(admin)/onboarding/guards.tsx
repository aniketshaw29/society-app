import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingProgress } from '@/components/admin/OnboardingProgress';
import { GuardForm, GuardFormData, GuardFormErrors } from '@/components/admin/GuardForm';
import { useAdminOnboarding, Guard } from '@/hooks/useAdminOnboarding';
import { useAuthStore } from '@/stores/authStore';

function validateGuard(data: GuardFormData): GuardFormErrors {
  const errors: GuardFormErrors = {};
  if (!data.fullName.trim()) errors.fullName = 'Full name is required';
  if (!data.phone.trim()) errors.phone = 'Phone number is required';
  else if (data.phone.replace(/\D/g, '').length !== 10)
    errors.phone = 'Enter a valid 10-digit number';
  return errors;
}

const EMPTY_GUARD: GuardFormData = {
  fullName: '',
  phone: '',
  gateName: '',
  shift: 'morning',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
};

export default function GuardsScreen() {
  const router = useRouter();
  const societyId = useAuthStore((s) => s.societyId);
  const { loading, error, addGuard } = useAdminOnboarding();

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<GuardFormData>(EMPTY_GUARD);
  const [formErrors, setFormErrors] = useState<GuardFormErrors>({});
  const [guards, setGuards] = useState<Guard[]>([]);

  const handleChange = (field: keyof GuardFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof GuardFormErrors])
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAdd = async () => {
    const errors = validateGuard(formData);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    if (!societyId) { Alert.alert('Error', 'No society found.'); return; }

    const result = await addGuard(societyId, {
      phone: `+91${formData.phone.replace(/\D/g, '')}`,
      fullName: formData.fullName.trim(),
      gateName: formData.gateName?.trim() || undefined,
      shift: formData.shift,
    });

    if (result) {
      setGuards((prev) => [...prev, result]);
      setShowModal(false);
      setFormData(EMPTY_GUARD);
      setFormErrors({});
    }
  };

  const handleFinish = () => {
    router.replace('/(admin)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <OnboardingProgress currentStep={3} />

      <View style={styles.content}>
        <Text style={styles.heading}>Guards</Text>
        <Text style={styles.subheading}>
          Register security guards. They will use the guard app to manage visitor entry.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={guards}
          keyExtractor={(g) => g.id}
          style={styles.list}
          contentContainerStyle={guards.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No guards added yet.</Text>
              <Text style={styles.emptyHint}>
                Guards are optional — you can add them later from the dashboard.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.guardRow}>
              <View style={styles.guardIcon}>
                <Text style={styles.guardIconText}>G</Text>
              </View>
              <View style={styles.guardInfo}>
                <Text style={styles.guardName}>{item.fullName}</Text>
                <Text style={styles.guardMeta}>
                  {item.gateName} · {SHIFT_LABELS[item.shift] ?? item.shift} shift
                </Text>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>+ Add Guard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.finishButtonText}>Finish Setup →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Guard Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Guard</Text>
              <TouchableOpacity
                onPress={() => { setShowModal(false); setFormData(EMPTY_GUARD); setFormErrors({}); }}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <GuardForm
                data={formData}
                errors={formErrors}
                onChange={handleChange}
                onSubmit={handleAdd}
                loading={loading}
              />
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  heading: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  list: { flex: 1, marginBottom: 16 },
  emptyList: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#374151', fontWeight: '600', marginBottom: 6 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  guardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardIconText: { fontSize: 18, fontWeight: '700', color: '#059669' },
  guardInfo: { flex: 1 },
  guardName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  guardMeta: { fontSize: 13, color: '#6B7280' },
  errorBanner: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#DC2626', fontSize: 14 },
  addButton: {
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: { color: '#059669', fontSize: 16, fontWeight: '700' },
  finishButton: { backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  finishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
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
  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
});
