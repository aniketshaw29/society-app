import { useRouter } from 'expo-router';
import type { UserRole } from '@/types';

/**
 * Maps a UserRole (or null) to the correct root navigation path.
 *
 * | Role                           | Path                    |
 * |--------------------------------|-------------------------|
 * | super_admin                    | /(admin)                |
 * | society_admin                  | /(admin)                |
 * | guard                          | /(guard)                |
 * | flat_owner                     | /(resident)             |
 * | tenant                         | /(resident)             |
 * | resident (legacy)              | /(resident)             |
 * | null (no profile row yet)      | /(onboarding)/choose    |
 */
export function getRootPath(role: UserRole | null): string {
  switch (role) {
    case 'super_admin':
    case 'society_admin':
      return '/(admin)';
    case 'guard':
      return '/(guard)';
    case 'flat_owner':
    case 'tenant':
    case 'resident':
      return '/(resident)';
    default:
      return '/(onboarding)/choose';
  }
}

/**
 * Hook that exposes both the path resolver and an imperative navigator.
 * Using the hook version lets screens call `navigateToRole` without
 * needing to import `useRouter` themselves.
 */
export function useRoleRouter() {
  const router = useRouter();

  const navigateToRole = (role: UserRole | null) => {
    const path = getRootPath(role);
    router.replace(path as never);
  };

  return {
    getRootPath,
    navigateToRole,
  };
}
