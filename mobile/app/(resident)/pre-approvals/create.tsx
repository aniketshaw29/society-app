import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { usePreApprovals } from '@/hooks/usePreApprovals';
import { PreApprovalForm } from '@/components/resident/PreApprovalForm';
import type { CreatePreApprovalInput, PreApproval } from '@/types';

// ============================================================
// Create Pre-Approval Screen
// ============================================================

type ScreenState = 'form' | 'success';

export default function CreatePreApprovalScreen() {
  const { create } = usePreApprovals();
  const [loading, setLoading] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [createdApproval, setCreatedApproval] = useState<PreApproval | null>(null);

  // ── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: CreatePreApprovalInput) => {
      setLoading(true);
      try {
        const result = await create(data);
        setCreatedApproval(result);
        setScreenState('success');
      } catch (raw: unknown) {
        const err = raw as {
          response?: { data?: { error?: { message?: string; details?: Array<{ field: string; message: string }> } } };
        };
        const apiError = err?.response?.data?.error;

        if (apiError?.details && apiError.details.length > 0) {
          const details = apiError.details
            .map((d) => `• ${d.field}: ${d.message}`)
            .join('\n');
          Alert.alert('Validation Error', details);
        } else {
          Alert.alert(
            'Error',
            apiError?.message ?? 'Failed to create pre-approval. Please try again.'
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [create]
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (screenState === 'success' && createdApproval) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Pre-Approval Created!</Text>

          <Text style={styles.successBody}>
            OTP sent to{' '}
            <Text style={styles.successPhone}>{createdApproval.guestPhone}</Text>
          </Text>

          <Text style={styles.successHint}>
            Your guest{' '}
            <Text style={styles.bold}>{createdApproval.guestName}</Text> can
            show this OTP to the guard for entry.
          </Text>

          <View style={styles.successActions}>
            <Text
              style={styles.successLink}
              onPress={() => router.push('/(resident)/pre-approvals')}
              accessibilityRole="button"
            >
              View All Pre-Approvals
            </Text>
            <Text
              style={[styles.successLink, styles.successLinkSecondary]}
              onPress={() => {
                setScreenState('form');
                setCreatedApproval(null);
              }}
              accessibilityRole="button"
            >
              Create Another
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form screen ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>New Pre-Approval</Text>
          <Text style={styles.subheading}>
            Generate a one-time OTP for your guest. They can use it at the gate
            without waiting for your approval.
          </Text>

          <PreApprovalForm onSubmit={handleSubmit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  // ── Success ───────────────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 36,
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  successBody: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 10,
    textAlign: 'center',
  },
  successPhone: {
    fontWeight: '700',
    color: BRAND_GREEN,
  },
  successHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  bold: {
    fontWeight: '700',
    color: '#374151',
  },
  successActions: {
    gap: 12,
    alignItems: 'center',
  },
  successLink: {
    fontSize: 15,
    color: BRAND_GREEN,
    fontWeight: '700',
    paddingVertical: 6,
  },
  successLinkSecondary: {
    color: '#6B7280',
    fontWeight: '500',
  },
});
