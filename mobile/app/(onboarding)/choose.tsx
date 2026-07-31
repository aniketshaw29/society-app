import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  accentColor: string;
  testID?: string;
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
  accentColor,
  testID,
}: OptionCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderTopColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.85}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconBadge, { backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: accentColor }]}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <Text style={[styles.chevron, { color: accentColor }]}>›</Text>
    </TouchableOpacity>
  );
}

/**
 * Shown to first-time users who authenticated successfully but have no
 * user_profiles row yet. They pick one of two paths:
 *   1. Register my Society  → society admin onboarding
 *   2. Join my Society      → resident/guard onboarding via invite code
 */
export default function ChooseScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleRegisterSociety = () => {
    // Route to society registration onboarding flow
    // Replace with actual route once that screen is built
    router.push('/(onboarding)/register-society' as never);
  };

  const handleJoinSociety = () => {
    // Route to join-with-invite-code screen
    router.push('/(onboarding)/join-society' as never);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>SG</Text>
        </View>
        <Text style={styles.greeting}>Welcome to SocietyGate</Text>
        <Text style={styles.subtitle}>
          Let's get you set up. What would you like to do?
        </Text>
      </View>

      {/* Option cards */}
      <View style={styles.cardsContainer}>
        <OptionCard
          icon="🏢"
          title="Register my Society"
          description="I'm a society admin and want to set up my society on SocietyGate for the first time."
          onPress={handleRegisterSociety}
          accentColor="#1B6B3A"
          testID="register-society-card"
        />

        <OptionCard
          icon="🔑"
          title="Join my Society"
          description="I'm a resident or guard. I have an invite code from my society admin."
          onPress={handleJoinSociety}
          accentColor="#1D4ED8"
          testID="join-society-card"
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Signed in with wrong number?</Text>
        <TouchableOpacity
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutLink}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    backgroundColor: '#F3F4F6',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1B6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#1B6B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 16,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 26,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  signOutLink: {
    fontSize: 13,
    color: '#1B6B3A',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
