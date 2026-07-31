import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MgmtResident } from '@/hooks/useAdminManagement';

// ============================================================
// Types
// ============================================================

interface ResidentTableRowProps {
  resident: MgmtResident;
}

// ============================================================
// Helpers
// ============================================================

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase() || '?';
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  flat_owner: { label: 'Owner', bg: '#EFF6FF', text: '#1E40AF' },
  tenant: { label: 'Tenant', bg: '#F0FDF4', text: '#166534' },
  society_admin: { label: 'Admin', bg: '#FEF3C7', text: '#92400E' },
  guard: { label: 'Guard', bg: '#F3F4F6', text: '#374151' },
};

// ============================================================
// Component
// ============================================================

export function ResidentTableRow({ resident }: ResidentTableRowProps) {
  const isDeactivated = !resident.isActive;
  const roleConf = ROLE_CONFIG[resident.role] ?? { label: resident.role, bg: '#F3F4F6', text: '#374151' };
  const avatarInitials = initials(resident.fullName);

  return (
    <View style={[styles.row, isDeactivated && styles.rowDeactivated]}>
      {/* Avatar */}
      <View style={[styles.avatar, isDeactivated && styles.avatarDeactivated]}>
        <Text style={[styles.avatarText, isDeactivated && styles.avatarTextDeactivated]}>
          {avatarInitials}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isDeactivated && styles.nameDeactivated]} numberOfLines={1}>
            {resident.fullName ?? 'Unknown'}
          </Text>
          {isDeactivated && (
            <View style={styles.deactivatedBadge}>
              <Text style={styles.deactivatedBadgeText}>Deactivated</Text>
            </View>
          )}
        </View>
        <Text style={styles.flatText} numberOfLines={1}>
          {resident.flatNumber
            ? `${resident.buildingName ? resident.buildingName + ' · ' : ''}Flat ${resident.flatNumber}`
            : resident.flatId ? `Flat ID: ${resident.flatId.slice(0, 8)}` : 'No flat assigned'}
        </Text>
      </View>

      {/* Role badge */}
      <View style={[styles.badge, { backgroundColor: roleConf.bg }]}>
        <Text style={[styles.badgeText, { color: roleConf.text }]}>{roleConf.label}</Text>
      </View>

      {/* Status indicator */}
      <View style={[styles.statusDot, { backgroundColor: isDeactivated ? '#9CA3AF' : '#10B981' }]} />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  rowDeactivated: {
    backgroundColor: '#F9FAFB',
    opacity: 0.75,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarDeactivated: {
    backgroundColor: '#F3F4F6',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a73e8',
  },
  avatarTextDeactivated: {
    color: '#9CA3AF',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  nameDeactivated: {
    color: '#9CA3AF',
  },
  flatText: {
    fontSize: 12,
    color: '#6B7280',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deactivatedBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deactivatedBadgeText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});
