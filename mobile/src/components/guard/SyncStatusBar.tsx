// ---------------------------------------------------------------------------
// SyncStatusBar — persistent banner at the bottom of the gate screen
// ---------------------------------------------------------------------------
// States:
//   Online, 0 pending        → thin green bar "Synced"
//   Online, pending > 0      → yellow bar "Syncing… N entries pending" + spinner
//   Offline                  → red bar "Offline — N entries saved locally"
//   Abandoned > 0            → orange bar "⚠ N entries failed to sync" + Retry
// Tapping the bar (except the Retry button) opens a sync detail sheet.
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSyncStatus } from '@/hooks/useSyncStatus';

// ---------------------------------------------------------------------------
// Sub-component: detail sheet
// ---------------------------------------------------------------------------

interface SyncDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  isOnline: boolean;
  pendingCount: number;
  abandonedCount: number;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  onRetry: () => void;
}

function SyncDetailSheet({
  visible,
  onClose,
  isOnline,
  pendingCount,
  abandonedCount,
  lastSyncAt,
  isSyncing,
  onRetry,
}: SyncDetailSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Sync Status</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Network</Text>
            <Text style={[styles.sheetValue, isOnline ? styles.green : styles.red]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Pending entries</Text>
            <Text style={styles.sheetValue}>{pendingCount}</Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Failed entries</Text>
            <Text style={[styles.sheetValue, abandonedCount > 0 ? styles.orange : undefined]}>
              {abandonedCount}
            </Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Last synced</Text>
            <Text style={styles.sheetValue}>
              {lastSyncAt ? lastSyncAt.toLocaleTimeString() : 'Never'}
            </Text>
          </View>

          {abandonedCount > 0 && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                onRetry();
                onClose();
              }}
              disabled={isSyncing}
            >
              <Text style={styles.retryBtnText}>
                {isSyncing ? 'Retrying…' : 'Retry Failed Entries'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SyncStatusBar() {
  const { isOnline, pendingCount, abandonedCount, lastSyncAt, isSyncing, triggerSync } =
    useSyncStatus();
  const [sheetVisible, setSheetVisible] = useState(false);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  const handleRetry = useCallback(() => {
    void triggerSync();
  }, [triggerSync]);

  // ── Determine bar state ──────────────────────────────────────────────────

  let barStyle = styles.barGreen;
  let label: string;
  let showSpinner = false;
  let showRetry = false;

  if (!isOnline) {
    barStyle = styles.barRed;
    label = `Offline — ${pendingCount} entr${pendingCount === 1 ? 'y' : 'ies'} saved locally`;
  } else if (abandonedCount > 0) {
    barStyle = styles.barOrange;
    label = `${abandonedCount} entr${abandonedCount === 1 ? 'y' : 'ies'} failed to sync`;
    showRetry = true;
  } else if (pendingCount > 0 || isSyncing) {
    barStyle = styles.barYellow;
    label = `Syncing… ${pendingCount} entr${pendingCount === 1 ? 'y' : 'ies'} pending`;
    showSpinner = true;
  } else {
    label = 'Synced';
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.bar, barStyle]}
        onPress={openSheet}
        activeOpacity={0.85}
        testID="sync-status-bar"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.barContent}>
          {!isOnline && (
            <Text style={styles.icon}>📵</Text>
          )}
          {abandonedCount > 0 && isOnline && (
            <Text style={styles.icon}>⚠</Text>
          )}
          <Text style={[styles.barText, barStyle === styles.barGreen && styles.barTextGreen]}>
            {label}
          </Text>
          {showSpinner && (
            <ActivityIndicator
              size="small"
              color={barStyle === styles.barYellow ? '#92400E' : '#FFFFFF'}
              style={styles.spinner}
            />
          )}
        </View>

        {showRetry && (
          <TouchableOpacity
            style={styles.retryInline}
            onPress={handleRetry}
            disabled={isSyncing}
            testID="sync-retry-btn"
          >
            <Text style={styles.retryInlineText}>{isSyncing ? '…' : 'Retry'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <SyncDetailSheet
        visible={sheetVisible}
        onClose={closeSheet}
        isOnline={isOnline}
        pendingCount={pendingCount}
        abandonedCount={abandonedCount}
        lastSyncAt={lastSyncAt}
        isSyncing={isSyncing}
        onRetry={handleRetry}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  barContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barGreen: {
    backgroundColor: '#D1FAE5',
  },
  barYellow: {
    backgroundColor: '#FEF3C7',
  },
  barRed: {
    backgroundColor: '#FEE2E2',
  },
  barOrange: {
    backgroundColor: '#FED7AA',
  },
  barText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  barTextGreen: {
    color: '#065F46',
  },
  icon: {
    fontSize: 12,
  },
  spinner: {
    marginLeft: 4,
  },
  retryInline: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '55%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  sheetLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  sheetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  green: { color: '#059669' },
  red: { color: '#DC2626' },
  orange: { color: '#EA580C' },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#1a73e8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
