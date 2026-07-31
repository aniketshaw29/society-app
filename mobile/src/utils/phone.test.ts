import {
  formatIndianPhone,
  validateIndianPhone,
  maskPhone,
} from './phone';

// ---------------------------------------------------------------------------
// formatIndianPhone
// ---------------------------------------------------------------------------
describe('formatIndianPhone', () => {
  it('adds +91 prefix to a 10-digit number', () => {
    expect(formatIndianPhone('9876543210')).toBe('+919876543210');
  });

  it('adds +91 prefix to a number starting with 6', () => {
    expect(formatIndianPhone('6000000001')).toBe('+916000000001');
  });

  it('adds + when number already has 91 prefix (12 digits)', () => {
    expect(formatIndianPhone('919876543210')).toBe('+919876543210');
  });

  it('returns as-is when number already has +91 prefix', () => {
    // Strips non-digits then reapplies — result is same
    expect(formatIndianPhone('+919876543210')).toBe('+919876543210');
  });

  it('strips spaces and formats correctly', () => {
    // formatIndianPhone works on stripped digits
    expect(formatIndianPhone('98765 43210'.replace(/\D/g, ''))).toBe(
      '+919876543210'
    );
  });
});

// ---------------------------------------------------------------------------
// validateIndianPhone
// ---------------------------------------------------------------------------
describe('validateIndianPhone', () => {
  it('returns true for valid 10-digit number starting with 9', () => {
    expect(validateIndianPhone('9876543210')).toBe(true);
  });

  it('returns true for valid 10-digit number starting with 8', () => {
    expect(validateIndianPhone('8123456789')).toBe(true);
  });

  it('returns true for valid 10-digit number starting with 7', () => {
    expect(validateIndianPhone('7000000000')).toBe(true);
  });

  it('returns true for valid 10-digit number starting with 6', () => {
    expect(validateIndianPhone('6000000001')).toBe(true);
  });

  it('returns true for valid number with 91 prefix', () => {
    expect(validateIndianPhone('919876543210')).toBe(true);
  });

  it('returns false for number starting with 5', () => {
    expect(validateIndianPhone('5876543210')).toBe(false);
  });

  it('returns false for number starting with 1', () => {
    expect(validateIndianPhone('1234567890')).toBe(false);
  });

  it('returns false for 9-digit number', () => {
    expect(validateIndianPhone('987654321')).toBe(false);
  });

  it('returns false for 11-digit number (no country code prefix)', () => {
    expect(validateIndianPhone('98765432101')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateIndianPhone('')).toBe(false);
  });

  it('returns false for non-numeric string', () => {
    expect(validateIndianPhone('abcdefghij')).toBe(false);
  });

  it('returns false for number with letters mixed in', () => {
    expect(validateIndianPhone('98765abc10')).toBe(false);
  });

  it('handles undefined gracefully by returning false', () => {
    // @ts-expect-error Testing runtime safety
    expect(validateIndianPhone(undefined)).toBe(false);
  });

  it('handles null gracefully by returning false', () => {
    // @ts-expect-error Testing runtime safety
    expect(validateIndianPhone(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// maskPhone
// ---------------------------------------------------------------------------
describe('maskPhone', () => {
  it('masks a +91 E.164 number showing last 4 digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 xxxxxx3210');
  });

  it('masks a 91-prefixed 12-digit number', () => {
    expect(maskPhone('919876543210')).toBe('+91 xxxxxx3210');
  });

  it('masks a 10-digit number', () => {
    expect(maskPhone('9876543210')).toBe('xxxxxx3210');
  });

  it('masks any string of more than 4 chars', () => {
    expect(maskPhone('123456789')).toBe('xxxxx6789');
  });

  it('returns the string unchanged when 4 or fewer digits', () => {
    expect(maskPhone('1234')).toBe('1234');
  });

  it('returns empty string for empty input', () => {
    expect(maskPhone('')).toBe('');
  });

  it('handles undefined gracefully', () => {
    // @ts-expect-error Testing runtime safety
    expect(maskPhone(undefined)).toBe('');
  });

  it('shows correct last 4 for different number', () => {
    expect(maskPhone('+916001234567')).toBe('+91 xxxxxx4567');
  });
});
