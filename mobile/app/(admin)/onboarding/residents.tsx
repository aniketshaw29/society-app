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
import { ResidentForm, ResidentFormData, ResidentFormErrors } from '@/components/admin/ResidentForm';
import { FlatPicker, FlatItem } from '@/components/FlatPicker';
import { useAdminOnboarding, Resident } from '@/hooks/useAdminOnboarding';
import { useAuthStore } from '@/stores/authStore';

function validateResident(data: ResidentFormData): ResidentFormErrors {
  const errors: ResidentFormErrors = {};
  if (!data.fullName.trim()) errors.fullName = 'Full name is required';
  if (!data.phone.trim()) errors.phone = 'Phone number is required';
  else if (data.phone.replace(/\D/g, '').length !== 10)
    errors.phone = 'Enter a valid 10-digit number';
  return errors;
}

const EMPTY_RESIDENT: ResidentFormData = { fullName: '', phone: '', residentType: 'owner' };

export default function ResidentsScreen() {
  const router = useRouter();
  const societyId = useAuthStore((s) => s.societyId);
  const { loading, error, buildings, flats, fetchBuildings, fetchFlats, addResident } =
    useAdminOnboarding();

  const [showModal, setShowModal] = useState(false);
  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ResidentFormData>(EMPTY_RESIDENT);
  const [formErrors, setFormErrors] = useState<ResidentFormErrors>({});
  const [addedResidents, setAddedResidents] = useState<(Resident & { flatLabel: string })[]>([]);

  useEffect(() => {
    if (societyId) {
      fetchBuildings(societyId);
      fetchFlats(societyId);
    }
  }, [societyId, fetchBuildings, fetchFlats]);

  const flatItems: FlatItem[] = flats.map((f) => {
    const building = buildings.find((b) => b.id === f.buildingId);
    return {
      id: f.id,
      buildingId: f.buildingId,
      buildingName: building?.name,
      flatNumber: f.flatNumber,
      floor: f.floor,
      isOccupied: f.isOccupied,
    };
  });

  const handleChange = (field: keyof ResidentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof ResidentFormErrors])
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAdd = async () => {
    const errors = validateResident(formData);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    if (!selectedFlatId) { Alert.alert('Select Flat', 'Please select a flat first.'); return; }
    if (!societyId) { Alert.alert('Error', 'No society found.'); return; }

    const result = await addResident(societyId, {
      phone: formData.phone,
      fullName: formData.fullName.trim(),
      flatId: selectedFlatId,
      residentType: formData.residentType,
    });

    if (result) {
      const flatItem = flatItems.find((f) => f.id === selectedFlatId);
      const flatLabel = flatItem
        ? `${flatItem.buildingName ? flatItem.buildingName + ' — ' : ''}${flatItem.flatNumber}`
        : 'Unknown flat';
      setAddedResidents((prev) => [...prev, { ...result, flatLabel }]);
      setShowModal(false);
      setFormData(EMPTY_RESIDENT);
      setFormErrors({});
      setSelectedFlatId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <OnboardingProgress currentStep={3} />

      <View style={styles.content}>
        <Text style={styles.heading}>Residents</Text>
        <Text style={styles.subheading}>
          Add residents to flats. They will be notified when they first log in.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={addedResidents}
          keyExtractor={(r) => r.id}
          style={styles.list}
          contentContainerStyle={addedResidents.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No residents added yet.</Text>
              <Text style={styles.emptyHint}>Tap "Add Resident" to invite someone.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.residentRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.residentInfo}>
                <Text style={styles.residentName}>{item.fullName}</Text>
                <Text style={styles.residentMeta}>
                  {item.flatLabel} · {item.residentType === 'flat_owner' ? 'Owner' : 'Tenant'}
                </Text>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={[styles.addButton, flats.length === 0 && styles.addButtonDisabled]}
          onPress={() => {
            if (flats.length === 0) { Alert.alert('No Flats', 'Please add flats first.'); return; }
            setShowModal(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>+ Add Resident</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => router.push('/(admin)/onboarding/guards')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>Next: Add Guards →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Resident Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Resident</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setFormData(EMPTY_RESIDENT); setFormErrors({}); setSelectedFlatId(null); }}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <ResidentForm
                data={formData}
                errors={formErrors}
                onChange={handleChange}
                onSubmit={handleAdd}
                loading={loading}
              />

              <Text style={styles.flatPickerLabel}>Select Flat</Text>
              <FlatPicker
                flats={flatItems}
                selectedId={selectedFlatId}
                onSelect={(f) => setSelectedFlatId(f.id)}
                disabled={loading}
              />
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
  residentRow: {
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },
  residentInfo: { flex: 1 },
  residentName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  residentMeta: { fontSize: 13, color: '#6B7280' },
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
  addButtonDisabled: { borderColor: '#D1D5DB' },
  addButtonText: { color: '#1a73e8', fontSize: 16, fontWeight: '700' },
  nextButton: { backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
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
  flatPickerLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
});
