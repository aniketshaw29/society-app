import { useCallback } from 'react';
import api from '@/lib/api';
import type { OtpVerifyResult, OtpVerifyError } from '@/types';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// useOtpVerification
// ============================================================

export function useOtpVerification() {
  const societyId = useAuthStore((s) => s.societyId);

  /**
   * Verify a guest's OTP at the gate.
   *
   * On success: returns { visitor, preApproval }.
   * On failure: throws an OtpVerifyError-shaped object.
   */
  const verify = useCallback(
    async (
      guestPhone: string,
      otp: string
    ): Promise<OtpVerifyResult> => {
      if (!societyId) {
        const err: OtpVerifyError = {
          code: 'not_found',
          message: 'Guard is not assigned to a society',
        };
        throw err;
      }

      try {
        const { data } = await api.post<OtpVerifyResult>('/pre-approvals/verify', {
          guestPhone,
          otp,
          societyId,
        });
        return data;
      } catch (raw) {
        // Re-throw as a typed OtpVerifyError
        const shaped = extractOtpError(raw);
        throw shaped;
      }
    },
    [societyId]
  );

  return { verify };
}

// ============================================================
// Error shaping
// ============================================================

function extractOtpError(err: unknown): OtpVerifyError {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const axiosErr = err as {
      response?: {
        data?: {
          error?: {
            code?: string;
            message?: string;
            attemptsRemaining?: number;
          };
        };
      };
    };

    const errorBody = axiosErr.response?.data?.error;
    if (errorBody) {
      return {
        code: (errorBody.code as OtpVerifyError['code']) ?? 'not_found',
        message: errorBody.message ?? 'Verification failed',
        attemptsRemaining: errorBody.attemptsRemaining,
      };
    }
  }

  if (err instanceof Error) {
    return { code: 'not_found', message: err.message };
  }

  return { code: 'not_found', message: 'An unexpected error occurred' };
}
