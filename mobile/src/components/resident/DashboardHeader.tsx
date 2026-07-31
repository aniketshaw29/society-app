import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DashboardHeaderProps {
  name: string;
  flatNumber: string;
  societyName: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader({
  name,
  flatNumber,
  societyName,
}: DashboardHeaderProps) {
  const greeting = getGreeting();
  const firstName = name.trim().split(' ')[0] ?? name;

  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        <Text style={styles.greeting}>
          {greeting}, {firstName}
        </Text>
        <Text style={styles.society} numberOfLines={1}>
          {societyName}
        </Text>
      </View>
      {flatNumber ? (
        <View style={styles.flatBadge}>
          <Text style={styles.flatLabel}>FLAT</Text>
          <Text style={styles.flatNumber}>{flatNumber}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  textGroup: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
  },
  society: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  flatBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  flatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1B6B3A',
    letterSpacing: 1,
  },
  flatNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B6B3A',
    marginTop: 1,
  },
});
