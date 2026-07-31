import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// @ts-expect-error react-native-gesture-handler types not installed
import { Swipeable } from 'react-native-gesture-handler';
import { useAuthStore } from '@/stores/authStore';
import { useFlatMembers } from '@/hooks/useFlatMembers';
import MemberCard from '@/components/resident/MemberCard';
import type { UserProfile } from '@/types';

export default function FlatMembersScreen() {
  const router = useRouter();
  const { flatId, role, user } = useAuthStore((s) => ({
    flatId: s.flatId,
    role: s.role,
    user: s.user,
  }));

  const { members, loading, removeMember, refresh } = useFlatMembers(flatId);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = role === 'flat_owner';
  const currentUserId = user?.id;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleRemove = useCallback(
    (member: UserProfile) => {
      if (member.id === currentUserId) {
        Alert.alert('Cannot Remove', 'You cannot remove yourself from the flat.');
        return;
      }
      Alert.alert(
        'Remove Member',
        `Remove ${member.fullName ?? 'this member'} from the flat?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMember(member.id);
              } catch (err) {
                const msg =
                  err instanceof Error ? err.message : 'Failed to remove member';
                Alert.alert('Error', msg);
              }
            },
          },
        ]
      );
    },
    [currentUserId, removeMember]
  );

  const renderRightActions = useCallback(
    (member: UserProfile) => {
      if (!isOwner || member.id === currentUserId) return null;
      return (
        <TouchableOpacity
          style={styles.swipeDelete}
          onPress={() => handleRemove(member)}
        >
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Remove</Text>
        </TouchableOpacity>
      );
    },
    [isOwner, currentUserId, handleRemove]
  );

  if (loading && members.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color="#1B6B3A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) =>
          isOwner && item.id !== currentUserId ? (
            <Swipeable
              renderRightActions={() => renderRightActions(item)}
              overshootRight={false}
            >
              <MemberCard member={item} isSelf={item.id === currentUserId} />
            </Swipeable>
          ) : (
            <MemberCard member={item} isSelf={item.id === currentUserId} />
          )
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B6B3A"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
            {isOwner ? (
              <Text style={styles.hint}>
                Swipe left on a member to remove them
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No members yet</Text>
            {isOwner ? (
              <Text style={styles.emptyHint}>
                Tap the + button to add your family members or tenants.
              </Text>
            ) : null}
          </View>
        }
      />

      {/* Add Member FAB — only for flat_owner */}
      {isOwner ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(resident)/flat-members/add' as never)}
          accessibilityRole="button"
          accessibilityLabel="Add member"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  listHeader: {
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  swipeDelete: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
    marginLeft: 8,
    gap: 4,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  emptyHint: {
    fontSize: 13,
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});
