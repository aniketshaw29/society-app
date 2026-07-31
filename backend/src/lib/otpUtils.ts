import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// ============================================================
// OTP generation
// ============================================================

/**
 * Generates a cryptographically random 6-digit numeric OTP string.
 * Padded with leading zeros if needed (e.g. "007823").
 */
export function generateOtp(): string {
  // Math.random is fine here — OTP is short-lived (hours) and bcrypt-hashed
  const num = Math.floor(Math.random() * 1_000_000);
  return String(num).padStart(6, '0');
}

// ============================================================
// OTP hashing
// ============================================================

/**
 * bcrypt-hash an OTP string.
 * saltRounds = 10 (OWASP recommended minimum for 2024).
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

/**
 * Constant-time comparison of a plain OTP against its bcrypt hash.
 */
export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

// ============================================================
// Pre-approval validity check
// ============================================================

export type PreApprovalInvalidReason = 'expired' | 'used' | 'cancelled' | 'locked';

export interface PreApprovalValidityResult {
  valid: boolean;
  reason?: PreApprovalInvalidReason;
}

interface PreApprovalRecord {
  status: string;
  valid_from: string;
  valid_until: string;
}

/**
 * Returns whether a pre-approval is currently usable.
 *
 * Rules (in priority order):
 *   1. status = 'cancelled' → cancelled
 *   2. status = 'locked'    → locked (too many wrong OTP attempts)
 *   3. status = 'used'      → used
 *   4. now < valid_from     → expired (not yet active; treat as expired for guard UX)
 *   5. now > valid_until    → expired
 *   6. Otherwise            → valid
 */
export function isPreApprovalValid(
  preApproval: PreApprovalRecord
): PreApprovalValidityResult {
  const { status, valid_from, valid_until } = preApproval;

  if (status === 'cancelled') return { valid: false, reason: 'cancelled' };
  if (status === 'locked')    return { valid: false, reason: 'locked' };
  if (status === 'used')      return { valid: false, reason: 'used' };

  const now = Date.now();
  const from = new Date(valid_from).getTime();
  const until = new Date(valid_until).getTime();

  if (now < from || now > until) return { valid: false, reason: 'expired' };

  return { valid: true };
}
