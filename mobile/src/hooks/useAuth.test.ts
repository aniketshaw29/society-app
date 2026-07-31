/**
 * Tests for useAuth hook.
 *
 * Strategy: we mock the supabase client, expo-secure-store, and the zustand
 * authStore so that the hook's logic can be exercised in pure Node/Jest
 * without any native modules or a live Supabase project.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock supabase
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockRefreshSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock expo-secure-store
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

// Mock authStore — track calls
const mockSetSession = jest.fn();
const mockSetRole = jest.fn();
const mockSetSocietyId = jest.fn();
const mockSetFlatId = jest.fn();
const mockClearAuth = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    setSession: mockSetSession,
    setRole: mockSetRole,
    setSocietyId: mockSetSocietyId,
    setFlatId: mockSetFlatId,
    clearAuth: mockClearAuth,
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import { useAuth } from './useAuth';

// renderHook isn't needed — useAuth only calls other hooks via store selectors
// which we've mocked; we can call it directly as a plain function.
function getHook() {
  return useAuth();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function makeFakeSession() {
  return {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'user-uuid-1' },
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItemAsync.mockResolvedValue(undefined);
  mockDeleteItemAsync.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue({ error: null });
  mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
});

// ── signInWithPhone ────────────────────────────────────────────────────────

describe('signInWithPhone', () => {
  it('calls supabase.auth.signInWithOtp with +91-prefixed number', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { signInWithPhone } = getHook();
    await signInWithPhone('9876543210');

    expect(mockSignInWithOtp).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
    });
  });

  it('throws when phone number is not 10 digits', async () => {
    const { signInWithPhone } = getHook();

    await expect(signInWithPhone('12345')).rejects.toThrow(
      'valid 10-digit Indian mobile number'
    );
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('throws when phone number starts with an invalid prefix (e.g. 5)', async () => {
    const { signInWithPhone } = getHook();

    await expect(signInWithPhone('5123456789')).rejects.toThrow(
      'valid 10-digit Indian mobile number'
    );
  });

  it('throws when Supabase returns an error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Rate limited' } });

    const { signInWithPhone } = getHook();
    await expect(signInWithPhone('9876543210')).rejects.toThrow('Rate limited');
  });
});

// ── verifyOtp ──────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  it('calls supabase.auth.verifyOtp with correct params', async () => {
    const fakeSession = makeFakeSession();
    mockVerifyOtp.mockResolvedValue({ data: { session: fakeSession }, error: null });

    // Mock profile found
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 'user-uuid-1',
                role: 'flat_owner',
                society_id: 'soc-1',
                flat_id: 'flat-1',
              },
              error: null,
            }),
        }),
      }),
    });

    const { verifyOtp } = getHook();
    await verifyOtp('+919876543210', '123456');

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      token: '123456',
      type: 'sms',
    });
  });

  it('saves session to SecureStore on success', async () => {
    const fakeSession = makeFakeSession();
    mockVerifyOtp.mockResolvedValue({ data: { session: fakeSession }, error: null });

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 'user-uuid-1',
                role: 'flat_owner',
                society_id: 'soc-1',
                flat_id: 'flat-1',
              },
              error: null,
            }),
        }),
      }),
    });

    const { verifyOtp } = getHook();
    await verifyOtp('+919876543210', '123456');

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'supabase_session',
      JSON.stringify(fakeSession)
    );
  });

  it('sets isNewUser=true when no user_profiles row found', async () => {
    const fakeSession = makeFakeSession();
    mockVerifyOtp.mockResolvedValue({ data: { session: fakeSession }, error: null });

    // No profile row
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const { verifyOtp } = getHook();
    const result = await verifyOtp('+919876543210', '123456');

    expect(result.isNewUser).toBe(true);
    expect(result.role).toBeNull();
    expect(mockSetRole).not.toHaveBeenCalled();
  });

  it('sets isNewUser=false and returns role when profile exists', async () => {
    const fakeSession = makeFakeSession();
    mockVerifyOtp.mockResolvedValue({ data: { session: fakeSession }, error: null });

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 'user-uuid-1',
                role: 'society_admin',
                society_id: 'soc-1',
                flat_id: null,
              },
              error: null,
            }),
        }),
      }),
    });

    const { verifyOtp } = getHook();
    const result = await verifyOtp('+919876543210', '654321');

    expect(result.isNewUser).toBe(false);
    expect(result.role).toBe('society_admin');
    expect(mockSetRole).toHaveBeenCalledWith('society_admin');
    expect(mockSetSocietyId).toHaveBeenCalledWith('soc-1');
    expect(mockSetFlatId).toHaveBeenCalledWith(null);
  });

  it('throws when Supabase verifyOtp returns an error', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid OTP' },
    });

    const { verifyOtp } = getHook();
    await expect(verifyOtp('+919876543210', '000000')).rejects.toThrow('Invalid OTP');
  });

  it('throws when Supabase returns success but no session', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: null });

    const { verifyOtp } = getHook();
    await expect(verifyOtp('+919876543210', '123456')).rejects.toThrow(
      'no session was returned'
    );
  });
});

// ── signOut ────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('clears Supabase session, SecureStore, and authStore', async () => {
    const { signOut } = getHook();
    await signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('supabase_session');
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
  });

  it('still clears local state even if Supabase signOut throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'));

    const { signOut } = getHook();
    // Should not throw
    await expect(signOut()).resolves.toBeUndefined();

    expect(mockDeleteItemAsync).toHaveBeenCalled();
    expect(mockClearAuth).toHaveBeenCalled();
  });
});
