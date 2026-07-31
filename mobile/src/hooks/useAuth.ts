import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { validateIndianPhone, formatIndianPhone } from '@/utils/phone';
import type { UserRole } from '@/types';

const SESSION_KEY = 'supabase_session';

export interface VerifyOtpResult {
  role: UserRole | null;
  isNewUser: boolean;
}

export interface UserProfileRow {
  id: string;
  role: UserRole;
  society_id: string | null;
  flat_id: string | null;
}

/**
 * Central auth hook for phone OTP flow.
 * Wraps Supabase auth calls and syncs results into authStore + SecureStore.
 */
export function useAuth() {
  const { setSession, setRole, setSocietyId, setFlatId, clearAuth } = useAuthStore();

  // ── Send OTP ──────────────────────────────────────────────────────────────
  /**
   * Sends an SMS OTP to the given 10-digit Indian mobile number.
   * Throws if the number is not a valid 10-digit Indian mobile number.
   */
  const signInWithPhone = async (phone: string): Promise<void> => {
    const digits = phone.replace(/\D/g, '');

    if (!validateIndianPhone(digits)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }

    const e164 = formatIndianPhone(digits);

    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });

    if (error) {
      throw new Error(error.message);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  /**
   * Verifies the SMS OTP for the given phone number.
   * On success:
   *   - Saves the Supabase session to SecureStore
   *   - Fetches the user_profiles row
   *   - Populates authStore with role, societyId, flatId
   *   - Returns { role, isNewUser }
   * Throws on Supabase error.
   */
  const verifyOtp = async (
    phone: string,
    token: string
  ): Promise<VerifyOtpResult> => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      throw new Error(error.message);
    }

    const session = data.session;

    if (!session) {
      throw new Error('Verification succeeded but no session was returned.');
    }

    // Persist session token to SecureStore (separate from AsyncStorage-persisted store)
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));

    // Sync session into zustand store
    setSession(session);

    // Fetch user profile to determine role
    const { data: profileRows, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, society_id, flat_id')
      .eq('id', session.user.id)
      .maybeSingle();

    // Profile fetch failure is not fatal — treat as new user
    if (profileError) {
      console.warn('[useAuth] user_profiles fetch error:', profileError.message);
    }

    if (!profileRows) {
      // No profile row — brand new user
      return { role: null, isNewUser: true };
    }

    const profile = profileRows as UserProfileRow;

    // Persist role data to store
    setRole(profile.role);
    setSocietyId(profile.society_id);
    setFlatId(profile.flat_id);

    return { role: profile.role, isNewUser: false };
  };

  // ── Sign Out ──────────────────────────────────────────────────────────────
  /**
   * Signs the user out:
   *   - Calls Supabase signOut
   *   - Deletes session from SecureStore
   *   - Clears all auth state from zustand
   */
  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Proceed with local cleanup even if remote signOut fails
    }

    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // Ignore SecureStore errors
    }

    clearAuth();
  };

  // ── Refresh Session ───────────────────────────────────────────────────────
  /**
   * Refreshes the Supabase session and updates SecureStore + authStore.
   * Throws if refresh fails.
   */
  const refreshSession = async (): Promise<void> => {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.session));
      setSession(data.session);
    }
  };

  return {
    signInWithPhone,
    verifyOtp,
    signOut,
    refreshSession,
  };
}
