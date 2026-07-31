import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorFallbackProps {
  /** The error that was caught. Used to display a debug code. */
  error?: Error | null;
  /** Called when the user taps "Try Again". Should reset the error boundary. */
  onReset?: () => void;
}

// ── Support email ─────────────────────────────────────────────────────────────
const SUPPORT_EMAIL = 'support@societyapp.in';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * User-friendly error screen shown when the ErrorBoundary catches an exception.
 * Designed to be calm and reassuring — not alarming.
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps): React.ReactElement {
  const errorCode = error?.message ?? 'Unknown error';

  function handleContactSupport(): void {
    const subject = encodeURIComponent('Society App — Unexpected Error Report');
    const body = encodeURIComponent(
      `Hi Support,\n\nI encountered an unexpected error in the Society App.\n\nError: ${errorCode}\n\nDevice: ${Platform.OS} ${Platform.Version}\n\nPlease look into this.\n\nThank you.`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(
      () => {
        // Linking failure is acceptable — mailto: not always available
      }
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* App identity */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>SA</Text>
          </View>
          <Text style={styles.appName}>Society App</Text>
        </View>

        {/* Error message */}
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We hit an unexpected error. Don&apos;t worry — your data is safe.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {onReset && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onReset}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Try Again"
              testID="try-again-button"
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContactSupport}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Contact Support"
          >
            <Text style={styles.secondaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        {/* Debug code — small, unobtrusive */}
        {__DEV__ && errorCode ? (
          <Text style={styles.debugCode} selectable>
            Error: {errorCode}
          </Text>
        ) : null}
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
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1B6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0.3,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1B6B3A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1B6B3A',
    fontSize: 15,
    fontWeight: '500',
  },
  debugCode: {
    marginTop: 32,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: '100%',
  },
});
