// ---------------------------------------------------------------------------
// Conflict resolver — pure functions, no side effects
// ---------------------------------------------------------------------------
// Server wins on timestamp ties for status; additive-only for exit_time.
// ---------------------------------------------------------------------------

import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Status conflict
// ---------------------------------------------------------------------------

export interface StatusConflictResult {
  resolvedStatus: string;
  hadConflict: boolean;
}

/**
 * Resolves a status conflict between a local and server visitor record.
 *
 * Resolution rules:
 * - If server.updatedAt > local.updatedAt  → server wins.
 * - If local.updatedAt >= server.updatedAt → local wins.
 * - hadConflict = true when values differ AND server won.
 */
export function resolveStatusConflict(
  local: LocalVisitor,
  server: VisitorLog
): StatusConflictResult {
  const localTs = new Date(local.updatedAt).getTime();
  const serverTs = new Date(server.updatedAt).getTime();

  const valuesMatch = local.status === server.status;

  if (valuesMatch) {
    return { resolvedStatus: local.status, hadConflict: false };
  }

  if (serverTs > localTs) {
    // Server is newer — server wins
    return { resolvedStatus: server.status, hadConflict: true };
  }

  // Local is same age or newer — local wins (no conflict logged)
  return { resolvedStatus: local.status, hadConflict: false };
}

// ---------------------------------------------------------------------------
// Exit-time conflict
// ---------------------------------------------------------------------------

export interface ExitTimeConflictResult {
  resolvedExitTime: string | null;
  hadConflict: boolean;
}

/**
 * Resolves an exit_time conflict.
 *
 * Resolution rules (additive-only — exit_time should never regress to null):
 * - If server has an exit_time and local does not → keep server exit_time.
 * - If both have exit_time → server wins.
 * - If only local has exit_time → keep local exit_time.
 * - If neither has exit_time → null.
 * - hadConflict = true when both had different non-null values.
 */
export function resolveExitTime(
  local: LocalVisitor,
  server: VisitorLog
): ExitTimeConflictResult {
  const localExit = local.exitTime ?? null;
  const serverExit = server.exitTime ?? null;

  if (!localExit && !serverExit) {
    return { resolvedExitTime: null, hadConflict: false };
  }

  if (serverExit && !localExit) {
    // Server has exit, local doesn't — adopt server value
    return { resolvedExitTime: serverExit, hadConflict: false };
  }

  if (!serverExit && localExit) {
    // Only local has exit — keep it
    return { resolvedExitTime: localExit, hadConflict: false };
  }

  // Both have exit_time
  if (localExit === serverExit) {
    return { resolvedExitTime: serverExit, hadConflict: false };
  }

  // Values differ — server wins
  return { resolvedExitTime: serverExit, hadConflict: true };
}
