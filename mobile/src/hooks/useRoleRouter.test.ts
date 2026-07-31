/**
 * Tests for the getRootPath function (pure logic, no React hooks involved).
 *
 * useRoleRouter is a thin React hook wrapper around getRootPath; the routing
 * logic is entirely in the pure function, so we test that directly and skip
 * mocking expo-router.
 */

import { getRootPath } from './useRoleRouter';
import type { UserRole } from '@/types';

describe('getRootPath', () => {
  it('returns /(guard) for guard role', () => {
    expect(getRootPath('guard')).toBe('/(guard)');
  });

  it('returns /(resident) for flat_owner role', () => {
    expect(getRootPath('flat_owner')).toBe('/(resident)');
  });

  it('returns /(resident) for tenant role', () => {
    expect(getRootPath('tenant')).toBe('/(resident)');
  });

  it('returns /(resident) for legacy resident role', () => {
    expect(getRootPath('resident')).toBe('/(resident)');
  });

  it('returns /(admin) for society_admin role', () => {
    expect(getRootPath('society_admin')).toBe('/(admin)');
  });

  it('returns /(admin) for super_admin role', () => {
    expect(getRootPath('super_admin')).toBe('/(admin)');
  });

  it('returns /(onboarding)/choose when role is null', () => {
    expect(getRootPath(null)).toBe('/(onboarding)/choose');
  });

  it('returns /(onboarding)/choose for an unknown/unrecognised role', () => {
    // Cast to UserRole to test the default branch — real TS will prevent this
    expect(getRootPath('unknown_role' as UserRole)).toBe('/(onboarding)/choose');
  });

  // Type safety check: ensure all known roles return non-null strings
  const knownRoles: UserRole[] = [
    'guard',
    'flat_owner',
    'tenant',
    'resident',
    'society_admin',
    'super_admin',
  ];

  knownRoles.forEach((r) => {
    it(`returns a non-empty string for role "${r}"`, () => {
      const path = getRootPath(r);
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });
  });
});
