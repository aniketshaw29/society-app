import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, role, setSession } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      SplashScreen.hideAsync();
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: string, s: Session | null) => {
        setSession(s);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [setSession]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Redirect based on role
      switch (role) {
        case 'guard':
          router.replace('/(guard)');
          break;
        case 'society_admin':
        case 'super_admin':
          router.replace('/(admin)');
          break;
        case 'resident':
        case 'flat_owner':
        default:
          router.replace('/(resident)');
          break;
      }
    }
  }, [session, segments, router, role]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthGuard />
    </SafeAreaProvider>
  );
}
