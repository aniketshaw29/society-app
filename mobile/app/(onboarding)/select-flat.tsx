import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatPicker, FlatItem } from '@/components/FlatPicker';
import { useJoinSociety } from '@/hooks/useJoinSociety';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

type ResidentType = 'owner' | 'tenant';

export default function SelectFlatScreen() {
  const router = useRouter();
  const { societyId, societyName, inviteCode } = useLocalSearchParams<{
    societyId: string;
    societyName: string;
    inviteCode: string;
  }>();

  const { loading: joining, error: joinError, joinSociety, clearError } = useJoinSociety();

  const [flats, setFlats] = useState<FlatItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [residentType, setResidentType] = useState<ResidentType>('owner');
  const [fullName, setFullName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Fetch flats on mount
  useEffect(() => {
    if (!societyId) return;

    setFetchLoading(true);
    api
      .get<{
        flats: Array<{
          id: string;
          building_id: string;
          flat_number: string;
          floor: number;
          is_occupied: boolean;
          buildings?: { id: string; name: string } | null;
        }>;
      }>(`/societies/${societyId}/flats`)
      .then((res) => {
        const mapped: FlatItem[] = (res.data.flats ?? []).map((f) => ({
          id: f.id,
          buildingId: f.building_id,
          buildingName: f.buildings?.name,
          flatNumber: f.flat_number,
          floor: f.floor,
          isOccupied: f.is_occupied,
        }));
        setFlats(mapped);
      })
      .catch(() => {
        setFetchError('Failed to load flats. Please go back and try again.');
      })
      .finally(() => setFetchLoading(false));
  }, [societyId]);

  const selectedFlat = flats.find((f) => f.id === selectedFlatId) ?? null;

  const handleJoin = async () => {
    if (!fullName.trim()) {
      setNameError('Please enter your full name.');
      return;
    }
    if (!selectedFlatId) {
      Alert.alert('Select Flat', 'Please select your flat before joining.');
      return;
    }

    clearError();
    try {
      await joinSociety(societyId, selectedFlatId, residentType, fullName.trim(), inviteCode);
      // On success, navigate to resident dashboard
      router.replace('/(resident)');
    } catch {
      // Error is stored in hook state — displayed below
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Select Your Flat</Text>
          <Text style={styles.subheading}>
            Joining <Text style={styles.bold}>{societyName}</Text>
          </Text>

          {/* Full name input */}
          <Input
            label="Your Full Name"
            placeholder="e.g. Priya Sharma"
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError ?? undefined}
            autoCapitalize="words"
            returnKeyType="next"
            containerStyle={styles.nameInput}
          />

          {/* Resident type toggle */}
          <View style={styles.typeGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.typeRow}>
              {(['owner', 'tenant'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    residentType === type && styles.typeChipSelected,
                  ]}
                  onPress={() => setResidentType(type)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeText,
                      residentType === type && styles.typeTextSelected,
                    ]}
                  >
                    {type === 'owner' ? 'Flat Owner' : 'Tenant'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Flat picker */}
          <View style={styles.pickerGroup}>
            <Text style={styles.label}>Select Flat</Text>
            {fetchLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#1a73e8" />
                <Text style={styles.loadingText}>Loading flats...</Text>
              </View>
            ) : fetchError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{fetchError}</Text>
              </View>
            ) : (
              <FlatPicker
                flats={flats}
                selectedId={selectedFlatId}
                onSelect={(flat) => setSelectedFlatId(flat.id)}
                disabled={joining}
              />
            )}
          </View>

          {selectedFlat && (
            <View style={styles.selectedSummary}>
              <Text style={styles.selectedLabel}>Selected:</Text>
              <Text style={styles.selectedValue}>
                {selectedFlat.buildingName ? `${selectedFlat.buildingName} — ` : ''}
                {selectedFlat.flatNumber}, Floor {selectedFlat.floor}
              </Text>
            </View>
          )}

          {joinError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{joinError}</Text>
            </View>
          )}

          {/* Join button */}
          <TouchableOpacity
            style={[
              styles.joinButton,
              (!selectedFlatId || joining) && styles.joinButtonDisabled,
            ]}
            onPress={handleJoin}
            disabled={!selectedFlatId || joining}
            activeOpacity={0.85}
          >
            <Text style={styles.joinButtonText}>
              {joining ? 'Joining...' : `Join ${societyName ?? 'Society'}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>← Change Invite Code</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    flexGrow: 1,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  bold: { fontWeight: '700', color: '#374151' },
  nameInput: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeGroup: {
    marginBottom: 20,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  typeChipSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#EFF6FF',
  },
  typeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeTextSelected: {
    color: '#1a73e8',
  },
  pickerGroup: {
    marginBottom: 16,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  selectedLabel: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  selectedValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  joinButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 15,
    color: '#6B7280',
  },
});
