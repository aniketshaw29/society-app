import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PendingApprovalBannerProps {
  count: number;
  onPress: () => void;
}

export default function PendingApprovalBanner({
  count,
  onPress,
}: PendingApprovalBannerProps) {
  const hasPending = count > 0;

  return (
    <TouchableOpacity
      style={[styles.banner, hasPending ? styles.bannerActive : styles.bannerInactive]}
      onPress={onPress}
      activeOpacity={hasPending ? 0.75 : 1}
      accessibilityRole="button"
      accessibilityLabel={
        hasPending
          ? `${count} visitor${count !== 1 ? 's' : ''} waiting for approval`
          : 'No pending approvals'
      }
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={hasPending ? 'alert-circle' : 'checkmark-circle'}
          size={24}
          color={hasPending ? '#D97706' : '#9CA3AF'}
        />
      </View>
      <View style={styles.textWrap}>
        {hasPending ? (
          <>
            <Text style={styles.activeTitle}>
              {count} visitor{count !== 1 ? 's' : ''} waiting for your approval
            </Text>
            <Text style={styles.activeSub}>Tap to review and respond</Text>
          </>
        ) : (
          <Text style={styles.inactiveText}>No pending approvals</Text>
        )}
      </View>
      {hasPending ? (
        <Ionicons name="chevron-forward" size={18} color="#D97706" />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 4,
  },
  bannerActive: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  bannerInactive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconWrap: {
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 20,
  },
  activeSub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  inactiveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
});
