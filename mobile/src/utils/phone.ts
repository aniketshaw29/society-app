/**
 * Formats a 10-digit Indian phone number to E.164 format with +91 country code.
 * If the number already starts with +91, it is returned as-is.
 * If it starts with 91 (without +), the + is prepended.
 *
 * @param phone - Raw phone string (digits only, 10-digit, or with country code)
 * @returns E.164 formatted phone string, e.g. "+919876543210"
 */
export function formatIndianPhone(phone: string): string {
  const stripped = phone.replace(/\D/g, '');

  if (stripped.startsWith('91') && stripped.length === 12) {
    return `+${stripped}`;
  }

  if (stripped.length === 10) {
    return `+91${stripped}`;
  }

  // Return with + prefix if already has country code
  return `+${stripped}`;
}

/**
 * Validates that a string is a valid Indian mobile number.
 * Accepts 10-digit numbers starting with 6, 7, 8, or 9.
 * Also accepts numbers with +91 or 91 prefix (12 or 13 chars total).
 *
 * @param phone - Phone string to validate
 * @returns true if valid Indian mobile number, false otherwise
 */
export function validateIndianPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;

  const stripped = phone.replace(/\D/g, '');

  // Accept 10-digit format: must start with 6, 7, 8, or 9
  if (stripped.length === 10) {
    return /^[6-9]\d{9}$/.test(stripped);
  }

  // Accept 12-digit format with 91 prefix: 91XXXXXXXXXX
  if (stripped.length === 12 && stripped.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(stripped.slice(2));
  }

  return false;
}

/**
 * Masks a phone number, showing only the country code and last 4 digits.
 * e.g. "+919876543210" → "+91 xxxxxx3210"
 * e.g. "9876543210"    → "xxxxxx3210"
 *
 * @param phone - Phone string to mask
 * @returns Masked phone string
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';

  const stripped = phone.replace(/\s/g, '');

  // Handle E.164 format: +91XXXXXXXXXX
  if (stripped.startsWith('+91') && stripped.length === 13) {
    const last4 = stripped.slice(-4);
    return `+91 xxxxxx${last4}`;
  }

  // Handle 91XXXXXXXXXX
  if (stripped.startsWith('91') && stripped.length === 12) {
    const last4 = stripped.slice(-4);
    return `+91 xxxxxx${last4}`;
  }

  // Handle 10-digit format
  if (stripped.length === 10) {
    const last4 = stripped.slice(-4);
    return `xxxxxx${last4}`;
  }

  // Fallback: mask all but last 4
  if (stripped.length > 4) {
    const last4 = stripped.slice(-4);
    const masked = 'x'.repeat(stripped.length - 4);
    return `${masked}${last4}`;
  }

  return stripped;
}
