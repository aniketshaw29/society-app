import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import type { RecurringStaff, StaffCategory } from '@/types';
import { DayOfWeekPicker } from './DayOfWeekPicker';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<StaffCategory, { icon: string; color: string; label: string }> = {
  maid: { icon: '🧹', color: '#8B5CF6', label: 'Maid' },
  cook: { icon: '🍳', color: '#F59E0B', label: 'Cook' },
  driver: { icon: '🚗', color: '#3B82F6', label: 'Driver' },
  security: { icon: '🛡️', color: '#EF4444', label: 'Security' },
  delivery: { icon: '📦', color: '#10B981', label: 'Delivery' },
  other: { icon: '👤', color: '#6B7280', label: 'Other' },
};

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return phone;
  return phone.slice(0, 2) + '••••' + phone.slice(-2);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StaffCardProps {
  staff: RecurringStaff;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit?: (staff: RecurringStaff) => void;
  onDelete?: (staff: RecurringStaff) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffCard({ staff, onToggleActive, onEdit, onDelete }: StaffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[staff.category];

  return (
    <TouchableOpacity
      style={[styles.card, !staff.isActive && styles.cardInactive]}
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.8}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        {/* Category icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${cat.color}20` }]}>
          <Text style={styles.iconText}>{cat.icon}</Text>
        </View>

        {/* Name + meta */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{staff.name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { backgroundColor: `${cat.color}20` }]}>
              <Text style={[styles.categoryPillText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={styles.phone}>{maskPhone(staff.phone)}</Text>
          </View>
        </View>

        {/* Active toggle */}
        <Switch
          value={staff.isActive}
          onValueChange={(val) => onToggleActive(staff.id, val)}
          trackColor={{ false: '#E5E7EB', true: '#D1FAE5' }}
          thumbColor={staff.isActive ? '#10B981' : '#9CA3AF'}
          ios_backgroundColor="#E5E7EB"
        />
      </View>

      {/* Day pills + time window */}
      <View style={styles.detailRow}>
        <View style={styles.dayPills}>
          {DAY_SHORT.map((label, idx) => {
            const isAllowed = staff.allowedDays.includes(idx);
            return (
              <View
                key={idx}
                style={[styles.dayPill, isAllowed && styles.dayPillActive]}
              >
                <Text style={[styles.dayPillText, isAllowed && styles.dayPillTextActive]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>
            {staff.entryFrom} – {staff.entryUntil}
          </Text>
        </View>
      </View>

      {/* Expanded actions */}
      {expanded && (onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => onEdit(staff)}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(staff)}
            >
              <Text style={styles.deleteBtnText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardInactive: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  phone: {
    fontSize: 13,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayPills: {
    flexDirection: 'row',
    gap: 3,
  },
  dayPill: {
    width: 26,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  dayPillActive: {
    backgroundColor: '#DCFCE7',
  },
  dayPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayPillTextActive: {
    color: '#166534',
  },
  timeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
  },
  editBtnText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});
