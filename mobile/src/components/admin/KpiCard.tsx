import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// ============================================================
// Types
// ============================================================

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  loading?: boolean;
}

// ============================================================
// Skeleton
// ============================================================

function SkeletonBox({ style }: { style?: ViewStyle }) {
  return <View style={[styles.skeleton, style]} />;
}

// ============================================================
// Component
// ============================================================

export function KpiCard({ title, value, icon, color, loading = false }: KpiCardProps) {
  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <View style={[styles.iconWrapper, { backgroundColor: '#F3F4F6' }]}>
          <SkeletonBox style={styles.skeletonIcon} />
        </View>
        <SkeletonBox style={styles.skeletonValue} />
        <SkeletonBox style={styles.skeletonTitle} />
        <View style={[styles.accentBar, { backgroundColor: '#E5E7EB' }]} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrapper, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={color} />
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    position: 'relative',
  },
  cardLoading: {
    opacity: 0.85,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 30,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 10,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  // Skeleton
  skeleton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  skeletonIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  skeletonValue: {
    width: '60%',
    height: 26,
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '80%',
    height: 12,
    marginBottom: 10,
  },
});
