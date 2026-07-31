/**
 * Centralised map of API error codes → user-friendly messages.
 * Codes match the `error.code` field returned by the backend.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  invalid_otp: 'Incorrect OTP. Please try again.',
  otp_expired: 'OTP has expired. Please request a new one.',
  user_not_found: 'Phone number not registered.',
  account_deactivated:
    'Your account has been deactivated. Contact your society admin.',

  // ── Visitors ──────────────────────────────────────────────────────────────
  visitor_not_found: 'Visitor entry not found.',
  already_decided: 'This visitor has already been approved or denied.',
  not_your_flat: 'You are not authorized to approve visitors for this flat.',

  // ── Pre-approvals ─────────────────────────────────────────────────────────
  expired: 'This pre-approval has expired.',
  wrong_otp: 'Incorrect OTP.',
  already_used: 'This entry pass has already been used.',
  locked: 'Too many wrong attempts. This pass is now locked.',
  not_found: 'No active pre-approval found for this phone number.',

  // ── QR ────────────────────────────────────────────────────────────────────
  invalid_qr: 'Invalid QR code. Please ask the resident to share a new one.',
  expired_qr: 'This QR code has expired.',

  // ── Staff ─────────────────────────────────────────────────────────────────
  not_allowed_today: 'This staff member is not scheduled for today.',
  outside_window: 'Entry not allowed at this time.',
  staff_inactive: 'This staff record has been deactivated.',

  // ── Society / Onboarding ─────────────────────────────────────────────────
  invite_code_invalid: 'Invalid invite code. Please check and try again.',
  already_joined: 'You have already joined this flat.',

  // ── Generic ───────────────────────────────────────────────────────────────
  network_error: 'No internet connection. Please try again.',
  server_error: 'Something went wrong. Please try again.',
  unauthorized: 'Please log in to continue.',
  forbidden: 'You do not have permission to do this.',
  validation_error: 'Please check your inputs and try again.',
}

/**
 * Resolve an API error code to a human-readable string.
 *
 * @param code     - The error code from `error.response.data.error.code`
 * @param fallback - Optional caller-supplied fallback (defaults to generic server error)
 */
export function getErrorMessage(code: string, fallback?: string): string {
  return (
    ERROR_MESSAGES[code] ??
    ERROR_MESSAGES[code.toLowerCase()] ??
    fallback ??
    (ERROR_MESSAGES['server_error'] as string)
  )
}
