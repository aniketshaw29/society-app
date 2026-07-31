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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeVisitors } from '@/hooks/useRealtimeVisitors';
import { VisitorCard } from '@/components/guard/VisitorCard';
import api from '@/lib/api';
import type { VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Gate screen
// ---------------------------------------------------------------------------

export default function GateScreen() {
  const societyId = useAuthStore((s) => s.societyId) ?? '';
  const { visitors, isConnected, error, refresh } = useRealtimeVisitors(societyId);
  const [refreshing, setRefreshing] = useState(false);

  // Track which visitor ids were just updated for flash animation
  const [justUpdatedIds, setJustUpdatedIds] = useState<Set<string>>(new Set());
  const prevVisitorsRef = useRef<VisitorLog[]>([]);

  // Approved banner: first approved visitor that hasn't been dismissed
  const [approvedBannerVisitor, setApprovedBannerVisitor] = useState<VisitorLog | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  // -------------------------------------------------------------------------
  // Detect status changes on UPDATE to trigger haptics + flash
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
    let newlyApproved: VisitorLog | null = null;

    for (const current of visitors) {
      const previous = prev.find((v) => v.id === current.id);
      if (previous && previous.status !== current.status) {
        updatedIds.add(current.id);
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
      // Clear flash indicators after animation completes
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

  const showApprovedBanner = (visitor: VisitorLog) => {
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
  // Guard actions
  // -------------------------------------------------------------------------

  const handleMarkEntered = useCallback(async (visitor: VisitorLog) => {
    try {
      await api.patch(`/visitors/${visitor.id}/enter`);
      // Real-time subscription will reflect the change; no manual state update needed
    } catch {
      Alert.alert('Error', 'Could not mark as entered. Please try again.');
    }
  }, []);

  const handleMarkExited = useCallback(async (visitor: VisitorLog) => {
    try {
      await api.patch(`/visitors/${visitor.id}/exit`);
    } catch {
      Alert.alert('Error', 'Could not mark as exited. Please try again.');
    }
  }, []);

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

      {/* Connection indicator */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {error ?? 'Reconnecting to live updates…'}
          </Text>
        </View>
      )}

      {/* Log Visitor button */}
      <TouchableOpacity
        style={styles.logBtn}
        onPress={() => router.push('/(guard)/log-visitor')}
        testID="log-visitor-btn"
      >
        <Text style={styles.logBtnText}>+ Log Visitor</Text>
      </TouchableOpacity>

      {/* Visitor list */}
      <FlatList
        data={visitors}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VisitorCard
            visitor={item}
            justUpdated={justUpdatedIds.has(item.id)}
            onPress={() => router.push(`/(guard)/visitor-detail/${item.id}`)}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No visitors yet today</Text>
          </View>
        }
      />
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
  bannerContent: {
    flex: 1,
  },
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
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineText: {
    color: '#92400E',
    fontSize: 13,
    textAlign: 'center',
  },
  logBtn: {
    margin: 16,
    backgroundColor: '#1a73e8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
