import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useLocalVisitors } from '@/hooks/useLocalVisitors';
import { VisitorCard } from '@/components/guard/VisitorCard';
import { SyncStatusBar } from '@/components/guard/SyncStatusBar';
import { isOnline } from '@/services/networkMonitor';
import {
  enqueueVisitorInsert,
  processQueue,
} from '@/services/syncService';
import { insertLocalVisitor } from '@/lib/db/visitors';
import api from '@/lib/api';
import type { LocalVisitor, VisitorLog, StaffSearchResult } from '@/types';
import 'react-native-get-random-values'; // required for crypto.randomUUID in RN

// ---------------------------------------------------------------------------
// Gate screen — guards see live visitor feed + entry action buttons
// ---------------------------------------------------------------------------

export default function GateScreen() {
  const societyId = useAuthStore((s) => s.societyId) ?? '';
  const { visitors, loading, refresh, subscribeToStatusUpdates } = useLocalVisitors(societyId);
  const [refreshing, setRefreshing] = useState(false);

  // Track which visitor localIds were just updated for flash animation
  const [justUpdatedIds, setJustUpdatedIds] = useState<Set<string>>(new Set());
  const prevVisitorsRef = useRef<LocalVisitor[]>([]);

  // Approved banner: first approved visitor that hasn't been dismissed
  const [approvedBannerVisitor, setApprovedBannerVisitor] = useState<LocalVisitor | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  // Staff search state
  const [staffQuery, setStaffQuery] = useState('');
  const [staffResults, setStaffResults] = useState<StaffSearchResult[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [staffEntryLoading, setStaffEntryLoading] = useState<string | null>(null);
  const staffSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to Supabase Realtime for status updates (resident approvals)
  useEffect(() => {
    const unsubscribe = subscribeToStatusUpdates();
    return unsubscribe;
  }, [subscribeToStatusUpdates]);

  // -------------------------------------------------------------------------
  // Detect status changes to trigger haptics + flash
  // -------------------------------------------------------------------------

  useEffect(() => {
    const prev = prevVisitorsRef.current;
    if (prev.length === 0) {
      prevVisitorsRef.current = visitors;
      return;
    }

    const updatedIds = new Set<string>();
    let hasApprovedChange = false;
    let hasDeniedChange = false;
    let newlyApproved: LocalVisitor | null = null;

    for (const current of visitors) {
      const previous = prev.find((v) => v.localId === current.localId);
      if (previous && previous.status !== current.status) {
        updatedIds.add(current.localId);
        if (current.status === 'approved') {
          hasApprovedChange = true;
          newlyApproved = current;
        } else if (current.status === 'denied') {
          hasDeniedChange = true;
        }
      }
    }

    if (updatedIds.size > 0) {
      setJustUpdatedIds(updatedIds);
      const timer = setTimeout(() => setJustUpdatedIds(new Set()), 1000);

      if (hasApprovedChange) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (newlyApproved) showApprovedBanner(newlyApproved);
      }
      if (hasDeniedChange) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      return () => clearTimeout(timer);
    }

    prevVisitorsRef.current = visitors;
    return undefined;
  }, [visitors]);

  // -------------------------------------------------------------------------
  // Approved banner animation
  // -------------------------------------------------------------------------

  const showApprovedBanner = (visitor: LocalVisitor) => {
    setApprovedBannerVisitor(visitor);
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  const dismissBanner = () => {
    Animated.timing(bannerAnim, {
      toValue: -100,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setApprovedBannerVisitor(null));
  };

  // -------------------------------------------------------------------------
  // Pull-to-refresh
  // -------------------------------------------------------------------------

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // -------------------------------------------------------------------------
  // Guard actions — visitor (offline-safe)
  // -------------------------------------------------------------------------

  const handleMarkEntered = useCallback(async (visitor: LocalVisitor) => {
    try {
      if (visitor.id) {
        await api.patch(`/visitors/${visitor.id}/enter`);
      }
      // Realtime will update local state; for offline case, update will queue on reconnect
    } catch {
      Alert.alert('Error', 'Could not mark as entered. Please try again.');
    }
  }, []);

  const handleMarkExited = useCallback(async (visitor: LocalVisitor) => {
    try {
      if (visitor.id) {
        await api.patch(`/visitors/${visitor.id}/exit`);
      }
    } catch {
      Alert.alert('Error', 'Could not mark as exited. Please try again.');
    }
  }, []);

  // -------------------------------------------------------------------------
  // Staff search + inline entry
  // -------------------------------------------------------------------------

  const searchStaff = useCallback(
    async (query: string) => {
      if (!query.trim() || !societyId) {
        setStaffResults([]);
        return;
      }
      setStaffSearching(true);
      try {
        const isPhone = /^\d+$/.test(query.trim());
        const params = new URLSearchParams({ societyId });
        if (isPhone) {
          params.set('phone', query.trim());
        } else {
          params.set('name', query.trim());
        }
        const res = await api.get<{ results: StaffSearchResult[] }>(
          `/recurring-staff/search?${params.toString()}`
        );
        setStaffResults(res.data.results ?? []);
      } catch {
        setStaffResults([]);
      } finally {
        setStaffSearching(false);
      }
    },
    [societyId]
  );

  const handleStaffQueryChange = (text: string) => {
    setStaffQuery(text);
    if (staffSearchTimer.current) clearTimeout(staffSearchTimer.current);
    staffSearchTimer.current = setTimeout(() => void searchStaff(text), 400);
  };

  const handleStaffEntry = useCallback(async (staffId: string, staffName: string) => {
    Alert.alert('Confirm Staff Entry', `Log entry for ${staffName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Entry',
        onPress: async () => {
          setStaffEntryLoading(staffId);
          try {
            await api.post('/visitors/staff-entry', { staffId });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Entry Logged', `${staffName} has been logged in.`);
            setStaffQuery('');
            setStaffResults([]);
          } catch (err: unknown) {
            const code =
              (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
                ?.error?.code;
            const msg =
              code === 'not_allowed_today'
                ? 'Staff is not allowed today.'
                : code === 'outside_window'
                ? 'Outside allowed time window.'
                : code === 'staff_inactive'
                ? 'Staff member is inactive.'
                : 'Could not log staff entry. Please try again.';
            Alert.alert('Entry Failed', msg);
          } finally {
            setStaffEntryLoading(null);
          }
        },
      },
    ]);
  }, []);

  // -------------------------------------------------------------------------
  // Adapter: LocalVisitor → VisitorLog for VisitorCard
  // -------------------------------------------------------------------------

  const toVisitorLog = (v: LocalVisitor): VisitorLog => ({
    id: v.id || v.localId,
    societyId: v.societyId,
    flatId: v.flatId,
    guardId: null,
    visitorName: v.visitorName,
    visitorPhone: v.visitorPhone,
    visitorPhotoUrl: v.photoUrl,
    vehicleNumber: v.vehicleNumber,
    purpose: v.purpose,
    entryMethod: 'manual',
    status: v.status,
    approvedBy: null,
    approvedAt: null,
    entryTime: v.entryTime,
    exitTime: v.exitTime,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Approved banner */}
      {approvedBannerVisitor && (
        <Animated.View
          style={[styles.approvedBanner, { transform: [{ translateY: bannerAnim }] }]}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>APPROVED — Let them in</Text>
            <Text style={styles.bannerSub} numberOfLines={1}>
              {approvedBannerVisitor.visitorName}
            </Text>
          </View>
          <TouchableOpacity onPress={dismissBanner} style={styles.bannerDismiss}>
            <Text style={styles.bannerDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Action buttons row: Log Visitor | Scan QR | OTP Entry */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.logBtn]}
          onPress={() => router.push('/(guard)/log-visitor')}
          testID="log-visitor-btn"
        >
          <Text style={styles.actionBtnText}>+ Log Visitor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.scanQrBtn]}
          onPress={() => router.push('/(guard)/qr-scan')}
          testID="scan-qr-btn"
        >
          <Text style={styles.actionBtnText}>Scan QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.otpBtn]}
          onPress={() => router.push('/(guard)/otp-verify')}
          testID="otp-entry-btn"
          accessibilityLabel="OTP Entry"
        >
          <Text style={styles.otpBtnText}>OTP Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Staff Entry section */}
      <View style={styles.staffSection}>
        <View style={styles.staffHeader}>
          <Text style={styles.staffSectionTitle}>Staff Entry</Text>
          <TouchableOpacity onPress={() => router.push('/(guard)/staff-search')}>
            <Text style={styles.staffSearchLink}>Full Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.staffSearchRow}>
          <TextInput
            style={styles.staffSearchInput}
            placeholder="Search staff by name or phone…"
            placeholderTextColor="#9CA3AF"
            value={staffQuery}
            onChangeText={handleStaffQueryChange}
            returnKeyType="search"
            testID="staff-search-input"
          />
          {staffSearching && (
            <ActivityIndicator size="small" color="#1a73e8" style={styles.staffSearchSpinner} />
          )}
          {staffQuery.length > 0 && !staffSearching && (
            <TouchableOpacity
              onPress={() => {
                setStaffQuery('');
                setStaffResults([]);
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {staffResults.length > 0 && (
          <View style={styles.staffResultList}>
            {staffResults.slice(0, 5).map((item) => (
              <View key={item.staff.id} style={styles.staffResultCard}>
                <View style={styles.staffResultInfo}>
                  <Text style={styles.staffResultName}>{item.staff.name}</Text>
                  <Text style={styles.staffResultMeta}>
                    {item.staff.category.charAt(0).toUpperCase() + item.staff.category.slice(1)}
                    {item.flat ? ` · Flat ${item.flat.flatNumber}` : ''}
                  </Text>
                  <Text style={styles.staffResultTime}>
                    {item.staff.entryFrom} – {item.staff.entryUntil}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.logEntryBtn,
                    staffEntryLoading === item.staff.id && styles.logEntryBtnLoading,
                  ]}
                  onPress={() => void handleStaffEntry(item.staff.id, item.staff.name)}
                  disabled={staffEntryLoading === item.staff.id}
                >
                  {staffEntryLoading === item.staff.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.logEntryBtnText}>Log In</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {staffQuery.length > 0 && !staffSearching && staffResults.length === 0 && (
          <Text style={styles.staffNoResults}>No staff found. Try a different name or phone.</Text>
        )}
      </View>

      {/* Visitor list */}
      <FlatList
        data={visitors}
        keyExtractor={(v) => v.localId}
        renderItem={({ item }) => (
          <VisitorCard
            visitor={toVisitorLog(item)}
            justUpdated={justUpdatedIds.has(item.localId)}
            onPress={() =>
              item.id
                ? router.push(`/(guard)/visitor-detail/${item.id}`)
                : undefined
            }
            onMarkEntered={
              item.status === 'approved' ? () => handleMarkEntered(item) : undefined
            }
            onMarkExited={
              item.status === 'entered' ? () => handleMarkExited(item) : undefined
            }
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No visitors yet today</Text>
          </View>
        }
      />

      {/* Sync status bar — pinned at the very bottom */}
      <SyncStatusBar />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  approvedBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bannerContent: { flex: 1 },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bannerSub: {
    fontSize: 12,
    color: '#D1FAE5',
    marginTop: 2,
  },
  bannerDismiss: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  bannerDismissText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Action buttons row
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  logBtn: { backgroundColor: '#1a73e8' },
  scanQrBtn: { backgroundColor: '#1B6B3A' },
  otpBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1a73e8',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  otpBtnText: {
    color: '#1a73e8',
    fontSize: 14,
    fontWeight: '700',
  },

  // Staff entry section
  staffSection: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  staffSearchLink: {
    fontSize: 12,
    color: '#1a73e8',
    fontWeight: '600',
  },
  staffSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  staffSearchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#111827',
  },
  staffSearchSpinner: { marginLeft: 8 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearBtnText: { color: '#9CA3AF', fontSize: 14 },
  staffResultList: { marginTop: 6, gap: 4 },
  staffResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  staffResultInfo: { flex: 1 },
  staffResultName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  staffResultMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  staffResultTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  logEntryBtn: {
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  logEntryBtnLoading: { backgroundColor: '#9CA3AF' },
  logEntryBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  staffNoResults: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 6,
  },

  list: { paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});
