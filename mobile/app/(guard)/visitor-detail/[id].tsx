import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import api from '@/lib/api';
import type { VisitorLog, VisitorLogStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status timeline step labels
// ---------------------------------------------------------------------------

type TimelineStepKey = 'logged' | 'notified' | 'decided' | 'entered' | 'exited';

interface TimelineStep {
  key: TimelineStepKey;
  label: string;
  completedStatuses: VisitorLogStatus[];
  time?: string | null;
}

function buildTimeline(visitor: VisitorLog): TimelineStep[] {
  return [
    {
      key: 'logged',
      label: 'Logged',
      completedStatuses: ['pending', 'approved', 'denied', 'entered', 'exited', 'expired'],
      time: visitor.createdAt,
    },
    {
      key: 'notified',
      label: 'Resident Notified',
      completedStatuses: ['approved', 'denied', 'entered', 'exited', 'expired'],
      time: visitor.createdAt, // notification sent when log created
    },
    {
      key: 'decided',
      label: visitor.status === 'denied' ? 'Denied' : 'Approved',
      completedStatuses: ['approved', 'denied', 'entered', 'exited'],
      time: visitor.approvedAt,
    },
    {
      key: 'entered',
      label: 'Entered',
      completedStatuses: ['entered', 'exited'],
      time: visitor.entryTime,
    },
    {
      key: 'exited',
      label: 'Exited',
      completedStatuses: ['exited'],
      time: visitor.exitTime,
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VisitorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visitor, setVisitor] = useState<VisitorLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ visitor: VisitorLog }>(`/visitors/${id}`)
      .then((res) => {
        setVisitor(res.data.visitor);
      })
      .catch(() => {
        Alert.alert('Error', 'Could not load visitor details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const runAction = async (
    call: () => Promise<unknown>,
    successMsg?: string
  ) => {
    setActionLoading(true);
    try {
      await call();
      if (successMsg) Alert.alert('Done', successMsg);
      // Re-fetch updated visitor
      const res = await api.get<{ visitor: VisitorLog }>(`/visitors/${id}`);
      setVisitor(res.data.visitor);
    } catch {
      Alert.alert('Error', 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkEntered = () =>
    runAction(
      () => api.patch(`/visitors/${id}/enter`),
      'Visitor marked as entered.'
    );

  const handleMarkExited = () =>
    runAction(
      () => api.patch(`/visitors/${id}/exit`),
      'Visitor marked as exited.'
    );

  const handleDenyEntry = () => {
    Alert.alert(
      'Deny Entry',
      'Prevent this approved visitor from entering?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: () =>
            runAction(
              () => api.patch(`/visitors/${id}/deny`),
              'Entry denied.'
            ),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </SafeAreaView>
    );
  }

  if (!visitor) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Visitor not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const timeline = buildTimeline(visitor);
  const flatLabel = visitor.flat
    ? [visitor.flat.buildingName, visitor.flat.flatNumber].filter(Boolean).join(' - ')
    : visitor.flatId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo */}
        {visitor.visitorPhotoUrl ? (
          <Image
            source={{ uri: visitor.visitorPhotoUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>No Photo</Text>
          </View>
        )}

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow label="Name" value={visitor.visitorName} />
          <InfoRow label="Phone" value={visitor.visitorPhone ?? '—'} />
          <InfoRow label="Purpose" value={visitor.purpose ?? '—'} />
          <InfoRow label="Vehicle" value={visitor.vehicleNumber ?? '—'} />
          <InfoRow label="Flat" value={flatLabel} />
          {visitor.approver && (
            <InfoRow
              label="Approved by"
              value={visitor.approver.fullName ?? visitor.approver.phone ?? '—'}
            />
          )}
        </View>

        {/* Status timeline */}
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        <View style={styles.card}>
          {timeline.map((step, index) => {
            const isComplete = step.completedStatuses.includes(visitor.status);
            return (
              <View key={step.key} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      isComplete ? styles.dotComplete : styles.dotPending,
                    ]}
                  />
                  {index < timeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        isComplete ? styles.lineComplete : styles.linePending,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isComplete ? styles.stepLabelDone : styles.stepLabelPending,
                    ]}
                  >
                    {step.label}
                  </Text>
                  {isComplete && step.time ? (
                    <Text style={styles.stepTime}>{formatDateTime(step.time)}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Guard action buttons */}
        {actionLoading ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color="#1a73e8" />
        ) : (
          <View style={styles.actions}>
            {visitor.status === 'approved' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.enterBtn]}
                  onPress={handleMarkEntered}
                  testID="mark-entered-btn"
                >
                  <Text style={styles.actionBtnText}>Mark as Entered</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.denyBtn]}
                  onPress={handleDenyEntry}
                  testID="deny-entry-btn"
                >
                  <Text style={styles.actionBtnText}>Deny Entry</Text>
                </TouchableOpacity>
              </>
            )}
            {visitor.status === 'entered' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.exitBtn]}
                onPress={handleMarkExited}
                testID="mark-exited-btn"
              >
                <Text style={styles.actionBtnText}>Mark as Exited</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  photo: {
    width: '100%',
    height: 280,
    backgroundColor: '#E5E7EB',
  },
  photoPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 0,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineLeft: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  dotComplete: {
    backgroundColor: '#10B981',
  },
  dotPending: {
    backgroundColor: '#D1D5DB',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  lineComplete: {
    backgroundColor: '#10B981',
  },
  linePending: {
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
    paddingLeft: 8,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepLabelDone: {
    color: '#111827',
  },
  stepLabelPending: {
    color: '#9CA3AF',
  },
  stepTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  actions: {
    marginHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  enterBtn: {
    backgroundColor: '#10B981',
  },
  exitBtn: {
    backgroundColor: '#3B82F6',
  },
  denyBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
