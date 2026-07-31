import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UserProfile } from '@/types';

interface MemberCardProps {
  member: UserProfile;
  isSelf?: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  flat_owner: { label: 'Owner',  bg: '#DCFCE7', text: '#166534' },
  tenant:     { label: 'Tenant', bg: '#EFF6FF', text: '#1D4ED8' },
  resident:   { label: 'Resident', bg: '#F3F4F6', text: '#374151' },
};

const AVATAR_COLORS = [
  '#1D4ED8', '#7C3AED', '#0891B2', '#059669', '#D97706',
  '#DC2626', '#DB2777', '#65A30D',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'No phone';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 6) return phone;
  return `+91 ••••••${digits.slice(-4)}`;
}

function formatJoinDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MemberCard({ member, isSelf = false }: MemberCardProps) {
  const initials = getInitials(member.fullName);
  const avatarColor = getAvatarColor(member.id);
  const roleCfg =
    ROLE_CONFIG[member.role] ?? ROLE_CONFIG['resident']!;

  return (
    <View style={styles.card}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {member.fullName ?? 'Unknown'}
            {isSelf ? ' (You)' : ''}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: roleCfg.bg }]}>
            <Text style={[styles.roleText, { color: roleCfg.text }]}>
              {roleCfg.label}
            </Text>
          </View>
        </View>
        <Text style={styles.phone}>{maskPhone(member.phone)}</Text>
        <Text style={styles.joined}>
          Since {formatJoinDate(member.joinedAt)}
        </Text>
      </View>

      {/* Active indicator */}
      <View
        style={[
          styles.statusDot,
          { backgroundColor: member.isActive ? '#10B981' : '#9CA3AF' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  phone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  joined: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
