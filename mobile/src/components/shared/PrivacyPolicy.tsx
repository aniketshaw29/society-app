import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIVACY_EMAIL = 'privacy@societyapp.in';
const LAST_UPDATED = 'July 2026';
const APP_NAME = 'Society App';

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }): React.ReactElement {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function Para({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={styles.para}>{children}</Text>;
}

function BulletItem({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>{'•'}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * In-app privacy policy screen.
 *
 * Required by the Apple App Store and Google Play when an app collects
 * personal data such as phone numbers, photos, or location.
 */
export function PrivacyPolicy(): React.ReactElement {
  const router = useRouter();

  function handleEmailPress(): void {
    Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=Privacy%20Request%20-%20${APP_NAME}`).catch(
      () => {}
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>{'← Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <Para>
          {APP_NAME} (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is a society
          management platform that helps residential communities manage visitor access, staff
          scheduling, and resident communication. This Privacy Policy explains what personal data
          we collect, how we use it, and your rights.
        </Para>

        {/* ── What we collect ──────────────────────────────────────────────── */}
        <SectionHeading>1. What Data We Collect</SectionHeading>

        <Para>We collect the following categories of personal data:</Para>

        <BulletItem>
          <Text style={styles.bold}>Phone number</Text> — used for account creation, OTP
          authentication, and identifying you within your society.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Profile information</Text> — your name, flat/unit number,
          and role (resident, guard, admin).
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Photos</Text> — profile pictures and visitor entry photos
          captured at the gate.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Location</Text> — approximate location used only to help
          identify your society during onboarding; not stored persistently.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Device token</Text> — a push notification token so we can
          send you visitor alerts and society notices.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Visitor logs</Text> — records of who visited your flat,
          when, and whether you approved or denied their entry.
        </BulletItem>

        {/* ── How we use it ─────────────────────────────────────────────────── */}
        <SectionHeading>2. How We Use Your Data</SectionHeading>

        <BulletItem>Authenticating you via one-time passwords (OTP).</BulletItem>
        <BulletItem>
          Logging visitor and staff entry/exit for the security of your residential society.
        </BulletItem>
        <BulletItem>
          Sending you real-time alerts when a visitor arrives at your gate.
        </BulletItem>
        <BulletItem>Displaying society notices and announcements.</BulletItem>
        <BulletItem>Generating anonymised usage reports for society administrators.</BulletItem>

        {/* ── Who we share it with ──────────────────────────────────────────── */}
        <SectionHeading>3. Who We Share Your Data With</SectionHeading>

        <Para>We do not sell your personal data. We share it only with:</Para>

        <BulletItem>
          <Text style={styles.bold}>Society admins and security guards</Text> — to manage
          visitor access for your flat.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Other residents in your flat</Text> — to jointly manage
          visitor approvals.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Infrastructure providers</Text> — Supabase (database
          hosting) and Firebase (push notifications). Both process data on our behalf under
          data processing agreements.
        </BulletItem>
        <BulletItem>
          <Text style={styles.bold}>Legal obligations</Text> — if required by law or to
          respond to valid legal process.
        </BulletItem>

        {/* ── Data retention ───────────────────────────────────────────────── */}
        <SectionHeading>4. Data Retention</SectionHeading>

        <Para>
          Visitor and staff logs are retained for 90 days by default. Society administrators
          may configure a longer retention period. Profile data is retained while your account
          is active in the society.
        </Para>

        {/* ── How to delete your data ───────────────────────────────────────── */}
        <SectionHeading>5. How to Delete Your Data</SectionHeading>

        <Para>
          To delete your account and associated data, contact your society administrator or
          email us at{' '}
          <Text style={styles.link} onPress={handleEmailPress}>
            {PRIVACY_EMAIL}
          </Text>
          . We will process deletion requests within 30 days.
        </Para>

        <Para>
          Note: visitor entry logs may be retained for security and audit purposes even after
          account deletion, as required by your society&apos;s policies.
        </Para>

        {/* ── Your rights ───────────────────────────────────────────────────── */}
        <SectionHeading>6. Your Rights</SectionHeading>

        <Para>Depending on your jurisdiction, you may have the right to:</Para>

        <BulletItem>Access the personal data we hold about you.</BulletItem>
        <BulletItem>Correct inaccurate data.</BulletItem>
        <BulletItem>Request deletion of your data.</BulletItem>
        <BulletItem>Object to or restrict processing.</BulletItem>
        <BulletItem>Data portability (receive your data in a machine-readable format).</BulletItem>

        <Para>
          To exercise any of these rights, email{' '}
          <Text style={styles.link} onPress={handleEmailPress}>
            {PRIVACY_EMAIL}
          </Text>
          .
        </Para>

        {/* ── Security ─────────────────────────────────────────────────────── */}
        <SectionHeading>7. Security</SectionHeading>

        <Para>
          We use industry-standard security measures including encrypted storage (AES-256),
          HTTPS-only transport, and short-lived access tokens. However, no system is 100%
          secure. If you discover a security issue, please report it responsibly to{' '}
          <Text style={styles.link} onPress={handleEmailPress}>
            {PRIVACY_EMAIL}
          </Text>
          .
        </Para>

        {/* ── Changes to this policy ────────────────────────────────────────── */}
        <SectionHeading>8. Changes to This Policy</SectionHeading>

        <Para>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes via an in-app notice or push notification. Continued use of the app after
          changes are posted constitutes your acceptance of the updated policy.
        </Para>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <SectionHeading>9. Contact Us</SectionHeading>

        <Para>
          For privacy questions or data requests, please email us at{' '}
          <Text style={styles.link} onPress={handleEmailPress}>
            {PRIVACY_EMAIL}
          </Text>
          .
        </Para>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 70,
  },
  backButtonText: {
    color: '#1B6B3A',
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  para: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
  },
  link: {
    color: '#1B6B3A',
    textDecorationLine: 'underline',
  },
  bottomPadding: {
    height: 40,
  },
});
