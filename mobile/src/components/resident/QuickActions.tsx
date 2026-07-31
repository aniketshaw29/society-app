import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickActionsProps {
  onPreApprove: () => void;
  onStaff: () => void;
  onMembers: () => void;
  onSOS: () => void;
}

interface ActionConfig {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bg: string;
  iconColor: string;
  onPress: () => void;
  isSOS?: boolean;
}

export default function QuickActions({
  onPreApprove,
  onStaff,
  onMembers,
  onSOS,
}: QuickActionsProps) {
  const actions: ActionConfig[] = [
    {
      icon: 'person-add-outline',
      label: 'Pre-approve Guest',
      bg: '#EFF6FF',
      iconColor: '#1D4ED8',
      onPress: onPreApprove,
    },
    {
      icon: 'people-outline',
      label: 'My Staff',
      bg: '#F0FDF4',
      iconColor: '#16A34A',
      onPress: onStaff,
    },
    {
      icon: 'home-outline',
      label: 'Members',
      bg: '#FFF7ED',
      iconColor: '#C2410C',
      onPress: onMembers,
    },
    {
      icon: 'warning-outline',
      label: 'SOS',
      bg: '#FEF2F2',
      iconColor: '#DC2626',
      onPress: onSOS,
      isSOS: true,
    },
  ];

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={[
            styles.card,
            action.isSOS && styles.cardSOS,
          ]}
          onPress={action.onPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: action.bg }]}>
            <Ionicons name={action.icon} size={22} color={action.iconColor} />
          </View>
          <Text
            style={[
              styles.label,
              action.isSOS && styles.labelSOS,
            ]}
            numberOfLines={2}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardSOS: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 18,
  },
  labelSOS: {
    color: '#DC2626',
    fontWeight: '700',
  },
});
