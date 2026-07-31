import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Building {
  id: string;
  name: string;
}

interface AudiencePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone', icon: 'people-outline' as const, description: 'All residents and guards' },
  { value: 'guards', label: 'Guards Only', icon: 'shield-outline' as const, description: 'All guards in the society' },
  { value: 'building', label: 'Specific Building', icon: 'business-outline' as const, description: 'All residents of a building' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudiencePicker({ value, onChange }: AudiencePickerProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);

  // Determine current mode
  const currentMode = value.startsWith('building:') ? 'building' : value;
  const selectedBuildingId = value.startsWith('building:') ? value.slice('building:'.length) : null;
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  // Load buildings when building mode is selected
  useEffect(() => {
    if (currentMode === 'building' && buildings.length === 0) {
      void loadBuildings();
    }
  }, [currentMode]);

  async function loadBuildings() {
    setLoadingBuildings(true);
    try {
      const { data } = await api.get<{ buildings: Building[] }>('/onboarding/buildings');
      setBuildings(data.buildings ?? []);
    } catch {
      // Silently fail — user can retry by re-selecting
    } finally {
      setLoadingBuildings(false);
    }
  }

  function selectMode(mode: string) {
    if (mode === 'building') {
      // Show building picker
      if (buildings.length === 0) void loadBuildings();
      setShowBuildingModal(true);
      return;
    }
    onChange(mode);
  }

  function selectBuilding(building: Building) {
    onChange(`building:${building.id}`);
    setShowBuildingModal(false);
  }

  return (
    <View style={styles.container}>
      {AUDIENCE_OPTIONS.map((opt) => {
        const isSelected = opt.value === currentMode;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => selectMode(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
              <Ionicons
                name={opt.icon}
                size={18}
                color={isSelected ? '#FFFFFF' : '#6B7280'}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={styles.optionDesc}>
                {opt.value === 'building' && selectedBuilding
                  ? `Selected: ${selectedBuilding.name}`
                  : opt.description}
              </Text>
            </View>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color="#1B6B3A" />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Building selection modal */}
      <Modal
        visible={showBuildingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuildingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Building</Text>
              <TouchableOpacity onPress={() => setShowBuildingModal(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {loadingBuildings ? (
              <ActivityIndicator size="small" color="#1B6B3A" style={styles.loader} />
            ) : buildings.length === 0 ? (
              <Text style={styles.noBuildingsText}>No buildings found.</Text>
            ) : (
              <FlatList
                data={buildings}
                keyExtractor={(b) => b.id}
                contentContainerStyle={styles.buildingList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.buildingRow,
                      item.id === selectedBuildingId && styles.buildingRowSelected,
                    ]}
                    onPress={() => selectBuilding(item)}
                  >
                    <Ionicons name="business-outline" size={18} color="#6B7280" />
                    <Text style={styles.buildingName}>{item.name}</Text>
                    {item.id === selectedBuildingId && (
                      <Ionicons name="checkmark" size={18} color="#1B6B3A" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  optionSelected: { borderColor: '#1B6B3A', backgroundColor: '#F0FDF4' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: { backgroundColor: '#1B6B3A' },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  optionLabelSelected: { color: '#166534' },
  optionDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  loader: { marginTop: 24 },
  noBuildingsText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 24,
  },
  buildingList: { paddingHorizontal: 16, paddingTop: 8 },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  buildingRowSelected: { backgroundColor: '#F0FDF4' },
  buildingName: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
});
