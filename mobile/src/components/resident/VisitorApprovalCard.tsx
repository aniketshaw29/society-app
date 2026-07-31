import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { VisitorLog } from '@/hooks/useVisitorApproval';

// ============================================================
// Helpers
// ============================================================

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================
// Props
// ============================================================

interface VisitorApprovalCardProps {
  visitor: VisitorLog;
  onApprove: (visitorId: string) => Promise<void>;
  onDeny: (visitorId: string) => Promise<void>;
  /** Show the flat label — useful on multi-flat admin views */
  showFlat?: boolean;
}

// ============================================================
// Component
// ============================================================

export default function VisitorApprovalCard({
  visitor,
  onApprove,
  onDeny,
  showFlat = false,
}: VisitorApprovalCardProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<'approve' | 'deny' | null>(null);

  const handleApprove = useCallback(async () => {
    if (busy) return;
    setBusy('approve');
    try {
      await onApprove(visitor.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onApprove, visitor.id]);

  const handleDeny = useCallback(async () => {
    if (busy) return;
    setBusy('deny');
    try {
      await onDeny(visitor.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onDeny, visitor.id]);

  const handleCardPress = useCallback(() => {
    router.push(`/(resident)/approve/${visitor.id}` as never);
  }, [router, visitor.id]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleCardPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Visitor ${visitor.visitorName}, tap to view details`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {visitor.visitorPhotoUrl ? (
          <Image
            source={{ uri: visitor.visitorPhotoUrl }}
            style={styles.avatar}
            accessibilityLabel={`Photo of ${visitor.visitorName}`}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{getInitials(visitor.visitorName)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {visitor.visitorName}
        </Text>
        <Text style={styles.purpose} numberOfLines={1}>
          {visitor.purpose}
        </Text>
        {showFlat && visitor.flat && (
          <Text style={styles.flat} numberOfLines={1}>
            {visitor.flat.buildingName
              ? `${visitor.flat.buildingName} • `
              : ''}
            Flat {visitor.flat.flatNumber}
          </Text>
        )}
        <Text style={styles.time}>{timeAgo(visitor.createdAt)}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.approveBtn, busy === 'approve' && styles.btnDisabled]}
          onPress={handleApprove}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Approve visitor"
        >
          <Text style={styles.approveBtnText}>
            {busy === 'approve' ? '...' : 'Allow'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.denyBtn, busy === 'deny' && styles.btnDisabled]}
          onPress={handleDeny}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Deny visitor"
        >
          <Text style={styles.denyBtnText}>
            {busy === 'deny' ? '...' : 'Deny'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B6B3A',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  purpose: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  flat: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'column',
    gap: 6,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 56,
  },
  approveBtn: {
    backgroundColor: '#1B6B3A',
  },
  denyBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  denyBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
});
