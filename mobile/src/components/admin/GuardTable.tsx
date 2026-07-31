import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MgmtGuard } from '@/hooks/useAdminManagement';

// ============================================================
// Types
// ============================================================

interface GuardTableRowProps {
  guard: MgmtGuard;
  onToggleActive(guardId: string, isActive: boolean): void;
  toggling?: boolean;
}

// ============================================================
// Config
// ============================================================

const SHIFT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  morning: { label: 'Morning', bg: '#FEF3C7', text: '#92400E' },
  afternoon: { label: 'Afternoon', bg: '#FFF7ED', text: '#C2410C' },
  night: { label: 'Night', bg: '#EDE9FE', text: '#5B21B6' },
};

// ============================================================
// Component
// ============================================================

export function GuardTableRow({ guard, onToggleActive, toggling = false }: GuardTableRowProps) {
  const shiftConf = SHIFT_CONFIG[guard.shift] ?? { label: guard.shift, bg: '#F3F4F6', text: '#374151' };

  return (
    <View style={[styles.row, !guard.isActive && styles.rowInactive]}>
      {/* Guard icon */}
      <View style={[styles.iconCircle, !guard.isActive && styles.iconCircleInactive]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={guard.isActive ? '#1a73e8' : '#9CA3AF'} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.name, !guard.isActive && styles.nameInactive]} numberOfLines={1}>
          {guard.fullName ?? 'Guard'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {guard.gateName}
          {guard.phone ? ` · ${guard.phone}` : ''}
        </Text>
      </View>

      {/* Shift badge */}
      <View style={[styles.badge, { backgroundColor: shiftConf.bg }]}>
        <Text style={[styles.badgeText, { color: shiftConf.text }]}>{shiftConf.label}</Text>
      </View>

      {/* Active toggle */}
      <Switch
        value={guard.isActive}
        onValueChange={(val) => onToggleActive(guard.id, val)}
        disabled={toggling}
        trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
        thumbColor={guard.isActive ? '#1a73e8' : '#9CA3AF'}
      />
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
  rowInactive: {
    backgroundColor: '#F9FAFB',
    opacity: 0.75,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconCircleInactive: {
    backgroundColor: '#F3F4F6',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  nameInactive: {
    color: '#9CA3AF',
  },
  meta: {
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
});
