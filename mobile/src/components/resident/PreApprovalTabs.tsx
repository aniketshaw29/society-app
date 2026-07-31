import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ============================================================
// Types
// ============================================================

export type PreApprovalTab = 'active' | 'used' | 'expired';

export interface PreApprovalTabCounts {
  active: number;
  used: number;
  expired: number;
}

interface PreApprovalTabsProps {
  activeTab: PreApprovalTab;
  onChange: (tab: PreApprovalTab) => void;
  counts: PreApprovalTabCounts;
}

// ============================================================
// Tab definitions
// ============================================================

const TABS: { key: PreApprovalTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'used', label: 'Used' },
  { key: 'expired', label: 'Expired' },
];

// ============================================================
// Component
// ============================================================

export function PreApprovalTabs({
  activeTab,
  onChange,
  counts,
}: PreApprovalTabsProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key];
        const showBadge = tab.key === 'active' && count > 0;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab, ${count} items`}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </View>
            {isActive && <View style={styles.activeBar} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabActive: {
    // active indicator handled by activeBar
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: BRAND_GREEN,
  },
  badge: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: BRAND_GREEN,
    borderRadius: 1,
  },
});
