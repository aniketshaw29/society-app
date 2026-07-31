import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useRoleRouter } from '@/hooks/useRoleRouter';
import { setupNotifications } from '@/lib/notifications';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ErrorFallback } from '@/components/shared/ErrorFallback';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

SplashScreen.preventAutoHideAsync();

// ── Loading splash ─────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1B6B3A" />
    </View>
  );
}

// ── Auth Guard ─────────────────────────────────────────────────────────────
function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, role, setSession, setRole, setSocietyId, setFlatId } = useAuthStore();
  const { getRootPath } = useRoleRouter();

  // true while we're waiting for getSession() to resolve the first time
  const [initialising, setInitialising] = useState(true);
  // cleanup ref for notification subscriptions
  const notifCleanupRef = useRef<(() => void) | null>(null);

  // ── Bootstrap: get initial session once on mount ───────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setInitialising(false);
      SplashScreen.hideAsync();
    });
  }, [setSession]);

  // ── Subscribe to auth state changes ───────────────────────────────────
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: string, s: Session | null) => {
        setSession(s);

        if (event === 'SIGNED_IN' && s) {
          // Fetch user_profiles to get role
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, society_id, flat_id')
            .eq('id', s.user.id)
            .maybeSingle();

          if (profile) {
            const p = profile as {
              role: UserRole;
              society_id: string | null;
              flat_id: string | null;
            };
            setRole(p.role);
            setSocietyId(p.society_id);
            setFlatId(p.flat_id);
          } else {
            // No profile row yet — new user, clear any stale role
            setRole(null);
            setSocietyId(null);
            setFlatId(null);
          }

          // Setup notifications after auth is confirmed
          setupNotifications(router).then((cleanup) => {
            // Replace any prior subscription cleanup
            notifCleanupRef.current?.();
            notifCleanupRef.current = cleanup;
          });
        }

        if (event === 'SIGNED_OUT') {
          setRole(null);
          setSocietyId(null);
          setFlatId(null);
          // Teardown notification listeners on logout
          notifCleanupRef.current?.();
          notifCleanupRef.current = null;
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      notifCleanupRef.current?.();
    };
  }, [setSession, setRole, setSocietyId, setFlatId]);

  // ── Route guard ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialising) return;

    const currentGroup = segments[0] as string | undefined;
    const inAuthGroup = currentGroup === '(auth)';
    const inOnboardingGroup = currentGroup === '(onboarding)';

    if (!session) {
      // Not signed in → must be in auth group
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Signed in but session is present
    if (inAuthGroup) {
      // Determine where to send the user
      if (role === null) {
        // Profile not yet loaded or doesn't exist
        router.replace('/(onboarding)/choose');
      } else {
        const rootPath = getRootPath(role);
        router.replace(rootPath as never);
      }
      return;
    }

    // If session exists and no profile, ensure they stay in onboarding
    if (role === null && !inOnboardingGroup && !inAuthGroup) {
      router.replace('/(onboarding)/choose');
    }
  }, [session, role, segments, router, initialising, getRootPath]);

  if (initialising) {
    return <LoadingScreen />;
  }

  return <Slot />;
}

// ── Root layout ────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ErrorBoundary fallback={<ErrorFallback />}>
        <AuthGuard />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
