// ---------------------------------------------------------------------------
// Conflict log operations (SQLite)
// ---------------------------------------------------------------------------

import { getDb } from './localDb';
import type { SyncConflict, SyncConflictType } from '@/types';

interface DbConflictRow {
  id: number;
  visitor_local_id: string | null;
  conflict_type: string;
  local_value: string | null;
  server_value: string | null;
  resolved_value: string | null;
  resolved_at: string;
}

function rowToSyncConflict(row: DbConflictRow): SyncConflict {
  return {
    id: row.id,
    visitorLocalId: row.visitor_local_id,
    conflictType: row.conflict_type as SyncConflictType,
    localValue: row.local_value,
    serverValue: row.server_value,
    resolvedValue: row.resolved_value,
    resolvedAt: row.resolved_at,
  };
}

/**
 * Inserts a new conflict record into sync_conflict_log.
 */
export async function logConflict(conflict: {
  visitorLocalId: string;
  conflictType: SyncConflictType;
  localValue: string;
  serverValue: string;
  resolvedValue: string;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `insert into sync_conflict_log (
      visitor_local_id, conflict_type, local_value, server_value, resolved_value, resolved_at
    ) values (?, ?, ?, ?, ?, ?)`,
    [
      conflict.visitorLocalId,
      conflict.conflictType,
      conflict.localValue,
      conflict.serverValue,
      conflict.resolvedValue,
      new Date().toISOString(),
    ]
  );
}

/**
 * Returns the most recent conflict records.
 * @param limit Defaults to 50.
 */
export async function getRecentConflicts(limit = 50): Promise<SyncConflict[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbConflictRow>(
    'select * from sync_conflict_log order by id desc limit ?',
    [limit]
  );
  return rows.map(rowToSyncConflict);
}
