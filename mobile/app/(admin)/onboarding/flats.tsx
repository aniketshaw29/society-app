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
import { FlatForm, FlatFormData, FlatFormErrors } from '@/components/admin/FlatForm';
import { useAdminOnboarding, Flat } from '@/hooks/useAdminOnboarding';
import { useAuthStore } from '@/stores/authStore';

function validateFlat(data: FlatFormData): FlatFormErrors {
  const errors: FlatFormErrors = {};
  if (!data.buildingId) errors.buildingId = 'Please select a building';
  if (!data.flatNumber.trim()) errors.flatNumber = 'Flat number is required';
  if (data.floor === '') errors.floor = 'Floor is required';
  else if (Number(data.floor) < 0) errors.floor = 'Floor must be 0 or higher';
  return errors;
}

const EMPTY_FLAT: FlatFormData = { flatNumber: '', floor: '', buildingId: '' };

export default function FlatsScreen() {
  const router = useRouter();
  const societyId = useAuthStore((s) => s.societyId);
  const { loading, error, buildings, flats, fetchBuildings, fetchFlats, addFlat } =
    useAdminOnboarding();

  const [showModal, setShowModal] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FlatFormData>(EMPTY_FLAT);
  const [formErrors, setFormErrors] = useState<FlatFormErrors>({});

  useEffect(() => {
    if (societyId) {
      fetchBuildings(societyId);
      fetchFlats(societyId);
    }
  }, [societyId, fetchBuildings, fetchFlats]);

  const handleChange = (field: keyof FlatFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof FlatFormErrors])
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAdd = async () => {
    const errors = validateFlat(formData);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    if (!societyId) { Alert.alert('Error', 'No society found.'); return; }

    const result = await addFlat(societyId, {
      buildingId: formData.buildingId,
      flatNumber: formData.flatNumber.trim(),
      floor: Number(formData.floor),
    });

    if (result) {
      setShowModal(false);
      setFormData(EMPTY_FLAT);
      setFormErrors({});
    }
  };

  // Filter displayed flats by building selector
  const displayedFlats = selectedBuildingId
    ? flats.filter((f) => f.buildingId === selectedBuildingId)
    : flats;

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  const renderFlat = ({ item }: { item: Flat }) => {
    const building = buildings.find((b) => b.id === item.buildingId);
    return (
      <View style={styles.flatRow}>
        <View style={styles.flatInfo}>
          <Text style={styles.flatNumber}>{item.flatNumber}</Text>
          <Text style={styles.flatMeta}>
            {building ? `${building.name} · ` : ''}Floor {item.floor}
          </Text>
        </View>
        {item.isOccupied && (
          <View style={styles.occupiedBadge}>
            <Text style={styles.occupiedText}>Occupied</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <OnboardingProgress currentStep={2} />

      <View style={styles.content}>
        <Text style={styles.heading}>Flats</Text>
        <Text style={styles.subheading}>
          Add flats to each building. Select a building to filter.
        </Text>

        {/* Building filter tabs */}
        {buildings.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, !selectedBuildingId && styles.filterChipActive]}
              onPress={() => setSelectedBuildingId(null)}
            >
              <Text style={[styles.filterText, !selectedBuildingId && styles.filterTextActive]}>
                All ({flats.length})
              </Text>
            </TouchableOpacity>
            {buildings.map((b) => {
              const count = flats.filter((f) => f.buildingId === b.id).length;
              const isActive = selectedBuildingId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedBuildingId(b.id)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {b.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={displayedFlats}
          keyExtractor={(f) => f.id}
          renderItem={renderFlat}
          style={styles.list}
          contentContainerStyle={displayedFlats.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No flats added yet.</Text>
              <Text style={styles.emptyHint}>
                {buildings.length === 0
                  ? 'Go back and add buildings first.'
                  : 'Tap "Add Flat" to get started.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={[styles.addButton, buildings.length === 0 && styles.addButtonDisabled]}
          onPress={() => {
            if (buildings.length === 0) {
              Alert.alert('No Buildings', 'Please add buildings first.');
              return;
            }
            // Pre-select the currently filtered building
            if (selectedBuildingId) setFormData((p) => ({ ...p, buildingId: selectedBuildingId }));
            setShowModal(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>+ Add Flat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => router.push('/(admin)/onboarding/residents')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>Next: Add Residents →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Flat Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Flat</Text>
              <TouchableOpacity
                onPress={() => { setShowModal(false); setFormData(EMPTY_FLAT); setFormErrors({}); }}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <FlatForm
                data={formData}
                errors={formErrors}
                onChange={handleChange}
                buildings={buildings.map((b) => ({ id: b.id, name: b.name }))}
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
  subheading: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  filterScroll: { maxHeight: 44, marginBottom: 16 },
  filterContent: { gap: 8, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  filterChipActive: { borderColor: '#1a73e8', backgroundColor: '#EFF6FF' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#1a73e8' },
  list: { flex: 1, marginBottom: 16 },
  emptyList: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#374151', fontWeight: '600', marginBottom: 6 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flatInfo: { flex: 1 },
  flatNumber: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 3 },
  flatMeta: { fontSize: 13, color: '#6B7280' },
  occupiedBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  occupiedText: { fontSize: 11, color: '#DC2626', fontWeight: '600' },
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
});
