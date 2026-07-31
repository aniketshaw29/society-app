import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InviteCodeInput } from '@/components/InviteCodeInput';
import { Button } from '@/components/ui/Button';
import { useJoinSociety } from '@/hooks/useJoinSociety';

const CODE_LENGTH = 6;

export default function JoinSocietyScreen() {
  const router = useRouter();
  const { loading, error, foundSociety, lookupInviteCode, clearError, clearFoundSociety } =
    useJoinSociety();

  const [codeChars, setCodeChars] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeError, setCodeError] = useState<string | null>(null);

  const code = codeChars.join('');
  const isComplete = code.length === CODE_LENGTH && codeChars.every(Boolean);

  const handleCodeChange = (chars: string[]) => {
    setCodeChars(chars);
    setCodeError(null);
    clearError();
    if (foundSociety) clearFoundSociety();
  };

  const handleFind = async () => {
    if (!isComplete) {
      setCodeError('Please enter all 6 characters of your invite code.');
      return;
    }
    await lookupInviteCode(code);
  };

  const handleJoin = () => {
    if (!foundSociety) return;
    router.push({
      pathname: '/(onboarding)/select-flat',
      params: {
        societyId: foundSociety.id,
        societyName: foundSociety.name,
        inviteCode: code,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Join a Society</Text>
          <Text style={styles.subheading}>
            Ask your society admin for a 6-character invite code.
          </Text>

          {/* Invite code input */}
          <View style={styles.codeSection}>
            <InviteCodeInput
              value={codeChars}
              onChange={handleCodeChange}
              error={codeError ?? error ?? undefined}
              disabled={loading}
            />
          </View>

          {/* Find button */}
          <Button
            title="Find Society"
            onPress={handleFind}
            loading={loading}
            disabled={!isComplete || loading}
            style={styles.findButton}
          />

          {/* Society card */}
          {foundSociety && (
            <View style={styles.societyCard}>
              <View style={styles.societyCardHeader}>
                <Text style={styles.societyCardTitle}>{foundSociety.name}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Found</Text>
                </View>
              </View>
              <Text style={styles.societyMeta}>
                {foundSociety.city}, {foundSociety.state}
              </Text>
              <Text style={styles.societyMeta}>{foundSociety.address}</Text>
              {foundSociety.totalFlats > 0 && (
                <Text style={styles.societyFlats}>{foundSociety.totalFlats} Flats</Text>
              )}

              <TouchableOpacity
                style={styles.joinButton}
                onPress={handleJoin}
                activeOpacity={0.85}
              >
                <Text style={styles.joinButtonText}>
                  Join {foundSociety.name} →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Back link */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
          >
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    flexGrow: 1,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  codeSection: {
    marginBottom: 24,
  },
  findButton: {
    marginBottom: 24,
  },
  societyCard: {
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#F0F9FF',
    marginBottom: 24,
  },
  societyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  societyCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  societyMeta: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  societyFlats: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  backLinkText: {
    fontSize: 15,
    color: '#6B7280',
  },
});
