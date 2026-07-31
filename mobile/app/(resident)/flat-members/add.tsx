import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useFlatMembers } from '@/hooks/useFlatMembers';
import AddMemberForm from '@/components/resident/AddMemberForm';
import type { AddMemberData } from '@/hooks/useFlatMembers';

export default function AddMemberScreen() {
  const router = useRouter();
  const { flatId } = useAuthStore((s) => ({ flatId: s.flatId }));
  const { addMember } = useFlatMembers(flatId);
  const [success, setSuccess] = useState(false);
  const [addedPhone, setAddedPhone] = useState('');

  const handleSubmit = async (data: AddMemberData) => {
    await addMember(data);
    setAddedPhone(data.phone);
    setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Invite Sent!</Text>
          <Text style={styles.successBody}>
            An SMS has been sent to +91{addedPhone} with a link to download the app
            and join the flat.
          </Text>
          <View
            style={styles.successBtn}
          >
            <Text
              style={styles.successBtnText}
              onPress={() => router.back()}
            >
              Done
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Add Flat Member</Text>
        <Text style={styles.subtitle}>
          Add a family member or tenant to your flat. They'll receive an SMS
          invite to join.
        </Text>

        <AddMemberForm
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  // Success state
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  successBody: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  successBtn: {
    marginTop: 8,
    backgroundColor: '#1B6B3A',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  successBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
