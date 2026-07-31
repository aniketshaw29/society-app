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
import { BuildingForm, BuildingFormData, BuildingFormErrors } from '@/components/admin/BuildingForm';
import { useAdminOnboarding, Building } from '@/hooks/useAdminOnboarding';
import { useAuthStore } from '@/stores/authStore';

function validateBuilding(data: BuildingFormData): BuildingFormErrors {
  const errors: BuildingFormErrors = {};
  if (!data.name.trim()) errors.name = 'Building name is required';
  if (!data.totalFloors.trim()) errors.totalFloors = 'Number of floors is required';
  else if (Number(data.totalFloors) < 1) errors.totalFloors = 'Must be at least 1 floor';
  return errors;
}

const EMPTY_BUILDING: BuildingFormData = { name: '', totalFloors: '' };

export default function BuildingsScreen() {
  const router = useRouter();
  const societyId = useAuthStore((s) => s.societyId);
  const { loading, error, buildings, fetchBuildings, addBuilding } = useAdminOnboarding();

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<BuildingFormData>(EMPTY_BUILDING);
  const [formErrors, setFormErrors] = useState<BuildingFormErrors>({});

  useEffect(() => {
    if (societyId) fetchBuildings(societyId);
  }, [societyId, fetchBuildings]);

  const handleChange = (field: keyof BuildingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAdd = async () => {
    const errors = validateBuilding(formData);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    if (!societyId) { Alert.alert('Error', 'No society found. Please restart setup.'); return; }

    const result = await addBuilding(societyId, {
      name: formData.name.trim(),
      totalFloors: Number(formData.totalFloors),
    });

    if (result) {
      setShowModal(false);
      setFormData(EMPTY_BUILDING);
      setFormErrors({});
    }
  };

  const renderBuilding = ({ item }: { item: Building }) => (
    <View style={styles.buildingRow}>
      <View style={styles.buildingIcon}>
        <Text style={styles.buildingIconText}>B</Text>
      </View>
      <View style={styles.buildingInfo}>
        <Text style={styles.buildingName}>{item.name}</Text>
        <Text style={styles.buildingMeta}>
          {item.totalFloors} floors · {item.flatCount} flats
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <OnboardingProgress currentStep={1} />

      <View style={styles.content}>
        <Text style={styles.heading}>Buildings</Text>
        <Text style={styles.subheading}>
          Add all the buildings in your society. You can add flats in the next step.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={buildings}
          keyExtractor={(b) => b.id}
          renderItem={renderBuilding}
          style={styles.list}
          contentContainerStyle={buildings.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No buildings added yet.</Text>
              <Text style={styles.emptyHint}>Tap "Add Building" to get started.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>+ Add Building</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, buildings.length === 0 && styles.nextButtonDisabled]}
          onPress={() => router.push('/(admin)/onboarding/flats')}
          disabled={buildings.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>Next: Add Flats →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Building Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Building</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setFormData(EMPTY_BUILDING); setFormErrors({}); }}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <BuildingForm
                data={formData}
                errors={formErrors}
                onChange={handleChange}
                onSubmit={handleAdd}
                loading={loading}
                submitLabel="Add Building"
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
  emptyHint: { fontSize: 14, color: '#9CA3AF' },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  buildingIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingIconText: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },
  buildingInfo: { flex: 1 },
  buildingName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 3 },
  buildingMeta: { fontSize: 13, color: '#6B7280' },
  errorBanner: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#DC2626', fontSize: 14 },
  addButton: {
    borderWidth: 1.5,
    borderColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: { color: '#1a73e8', fontSize: 16, fontWeight: '700' },
  nextButton: { backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  nextButtonDisabled: { backgroundColor: '#93C5FD' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // Modal
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
