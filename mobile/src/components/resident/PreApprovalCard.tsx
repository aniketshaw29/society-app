import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { PreApproval, PreApprovalStatus } from '@/types';

// ============================================================
// Helpers
// ============================================================

function formatDateWindow(validFrom: string, validUntil: string): string {
  const from = new Date(validFrom);
  const until = new Date(validUntil);
  const today = new Date();

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isTomorrow = (d: Date) => {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    return (
      d.getDate() === tom.getDate() &&
      d.getMonth() === tom.getMonth() &&
      d.getFullYear() === tom.getFullYear()
    );
  };

  const timeStr = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const dayLabel = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const fromDay = dayLabel(from);
  const untilDay = dayLabel(until);

  if (fromDay === untilDay) {
    return `${fromDay} ${timeStr(from)} – ${timeStr(until)}`;
  }
  return `${fromDay} ${timeStr(from)} – ${untilDay} ${timeStr(until)}`;
}

// ============================================================
// Status badge
// ============================================================

interface StatusBadgeProps {
  status: PreApprovalStatus;
}

const STATUS_STYLES: Record<
  PreApprovalStatus,
  { label: string; bg: string; fg: string }
> = {
  active:    { label: 'Active',    bg: '#DCFCE7', fg: '#166534' },
  used:      { label: 'Used',      bg: '#F3F4F6', fg: '#6B7280' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', fg: '#991B1B' },
  locked:    { label: 'Locked',    bg: '#FEF3C7', fg: '#92400E' },
};

// A pre-approval whose valid_until is in the past but status is still 'active'
// should display as "Expired" — we handle that in the card.
function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

// ============================================================
// PreApprovalCard
// ============================================================

interface PreApprovalCardProps {
  preApproval: PreApproval;
  onCancel?: () => void;
  onResendOtp?: () => void;
}

export function PreApprovalCard({
  preApproval,
  onCancel,
  onResendOtp,
}: PreApprovalCardProps) {
  const {
    guestName,
    guestPhone,
    purpose,
    validFrom,
    validUntil,
    status,
  } = preApproval;

  // Treat as expired if valid_until is in the past but status is still 'active'
  const isExpired = status === 'active' && new Date(validUntil) < new Date();
  const displayStatus: PreApprovalStatus = isExpired ? 'cancelled' : status;

  const isActionable = status === 'active' && !isExpired;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.guestName} numberOfLines={1}>
          {guestName}
        </Text>
        <StatusBadge status={displayStatus} />
      </View>

      {/* Phone */}
      <Text style={styles.phone}>{guestPhone}</Text>

      {/* Purpose */}
      {purpose ? (
        <Text style={styles.purpose} numberOfLines={1}>
          {purpose}
        </Text>
      ) : null}

      {/* Validity window */}
      <View style={styles.windowRow}>
        <Text style={styles.windowIcon}>🕐</Text>
        <Text style={styles.windowText}>
          {formatDateWindow(validFrom, validUntil)}
        </Text>
      </View>

      {/* Actions — only for active pre-approvals */}
      {isActionable ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.resendBtn}
            onPress={onResendOtp}
            accessibilityLabel={`Resend OTP to ${guestName}`}
          >
            <Text style={styles.resendBtnText}>Resend OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            accessibilityLabel={`Cancel pre-approval for ${guestName}`}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#1B6B3A';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  phone: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  purpose: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  windowIcon: {
    fontSize: 13,
  },
  windowText: {
    fontSize: 13,
    color: '#4B5563',
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  resendBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BRAND_GREEN,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  resendBtnText: {
    color: BRAND_GREEN,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
