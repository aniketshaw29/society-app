// ---------------------------------------------------------------------------
// Local CRUD for visitor entries (SQLite)
// ---------------------------------------------------------------------------
// Uses expo-sqlite v14 async API (getAllAsync / runAsync / execAsync).
// All timestamps are ISO-8601 strings in UTC.
// IST offset = +05:30 = 330 minutes.
// ---------------------------------------------------------------------------

import { getDb } from './localDb';
import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// IST midnight helper
// ---------------------------------------------------------------------------

/** Returns ISO-8601 string for midnight IST of the current day (in UTC). */
function todayMidnightIST(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
  const nowUtcMs = Date.now();
  const nowIstMs = nowUtcMs + IST_OFFSET_MS;
  // Truncate to day boundary in IST
  const dayMs = 24 * 60 * 60 * 1000;
  const midnightIstMs = Math.floor(nowIstMs / dayMs) * dayMs;
  // Convert back to UTC
  const midnightUtcMs = midnightIstMs - IST_OFFSET_MS;
  return new Date(midnightUtcMs).toISOString();
}

// ---------------------------------------------------------------------------
// Row mapper: DB row → LocalVisitor
// ---------------------------------------------------------------------------

interface DbLocalVisitorRow {
  id: string;
  local_id: string;
  society_id: string;
  flat_id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string;
  vehicle_number: string | null;
  status: string;
  photo_local_path: string | null;
  photo_url: string | null;
  entry_time: string;
  exit_time: string | null;
  sync_status: string;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToLocalVisitor(row: DbLocalVisitorRow): LocalVisitor {
  return {
    id: row.id,
    localId: row.local_id,
    societyId: row.society_id,
    flatId: row.flat_id,
    visitorName: row.visitor_name,
    visitorPhone: row.visitor_phone,
    purpose: row.purpose,
    vehicleNumber: row.vehicle_number,
    status: row.status as LocalVisitor['status'],
    photoLocalPath: row.photo_local_path,
    photoUrl: row.photo_url,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    syncStatus: row.sync_status as LocalVisitor['syncStatus'],
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Inserts a new local visitor record.
 * The record's `id` field can be an empty string until synced.
 */
export async function insertLocalVisitor(visitor: LocalVisitor): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `insert into local_visitors (
      id, local_id, society_id, flat_id, visitor_name, visitor_phone,
      purpose, vehicle_number, status, photo_local_path, photo_url,
      entry_time, exit_time, sync_status, sync_error, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visitor.id,
      visitor.localId,
      visitor.societyId,
      visitor.flatId,
      visitor.visitorName,
      visitor.visitorPhone ?? null,
      visitor.purpose,
      visitor.vehicleNumber ?? null,
      visitor.status,
      visitor.photoLocalPath ?? null,
      visitor.photoUrl ?? null,
      visitor.entryTime,
      visitor.exitTime ?? null,
      visitor.syncStatus,
      visitor.syncError ?? null,
      visitor.createdAt,
      visitor.updatedAt,
    ]
  );
}

/**
 * Updates only the provided fields for the record identified by localId.
 * Always refreshes updatedAt to now().
 */
export async function updateLocalVisitor(
  localId: string,
  updates: Partial<Omit<LocalVisitor, 'localId' | 'createdAt'>>
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Build dynamic SET clause from provided keys
  const columnMap: Record<string, string> = {
    id: 'id',
    societyId: 'society_id',
    flatId: 'flat_id',
    visitorName: 'visitor_name',
    visitorPhone: 'visitor_phone',
    purpose: 'purpose',
    vehicleNumber: 'vehicle_number',
    status: 'status',
    photoLocalPath: 'photo_local_path',
    photoUrl: 'photo_url',
    entryTime: 'entry_time',
    exitTime: 'exit_time',
    syncStatus: 'sync_status',
    syncError: 'sync_error',
    updatedAt: 'updated_at',
  };

  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | null | number)[] = [now];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'updatedAt') continue; // handled above
    const col = columnMap[key];
    if (col) {
      setClauses.push(`${col} = ?`);
      values.push(value as string | null | number);
    }
  }

  values.push(localId); // for WHERE clause

  await db.runAsync(
    `update local_visitors set ${setClauses.join(', ')} where local_id = ?`,
    values
  );
}

/**
 * Returns the local visitor record for the given localId, or null if not found.
 */
export async function getLocalVisitorByLocalId(localId: string): Promise<LocalVisitor | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DbLocalVisitorRow>(
    'select * from local_visitors where local_id = ?',
    [localId]
  );
  return row ? rowToLocalVisitor(row) : null;
}

/**
 * Returns visitors with status IN ('pending', 'approved', 'entered')
 * created today (since midnight IST), ordered newest first.
 */
export async function getActiveLocalVisitors(societyId: string): Promise<LocalVisitor[]> {
  const db = await getDb();
  const since = todayMidnightIST();
  const rows = await db.getAllAsync<DbLocalVisitorRow>(
    `select * from local_visitors
     where society_id = ?
       and status in ('pending', 'approved', 'entered')
       and created_at >= ?
     order by created_at desc`,
    [societyId, since]
  );
  return rows.map(rowToLocalVisitor);
}

/**
 * Returns all visitors for today (IST), regardless of status.
 */
export async function getTodayLocalVisitors(societyId: string): Promise<LocalVisitor[]> {
  const db = await getDb();
  const since = todayMidnightIST();
  const rows = await db.getAllAsync<DbLocalVisitorRow>(
    `select * from local_visitors
     where society_id = ?
       and created_at >= ?
     order by created_at desc`,
    [societyId, since]
  );
  return rows.map(rowToLocalVisitor);
}

/**
 * Upserts a visitor record received from the server.
 * - If no local record with that server id exists, inserts it with sync_status='synced'.
 * - If a record already exists (matched by id or local_id via photo), updates sync_status='synced'.
 */
export async function upsertFromServer(serverVisitor: VisitorLog): Promise<void> {
  const db = await getDb();

  // Check if a local record exists by server id
  const existing = await db.getFirstAsync<{ local_id: string }>(
    'select local_id from local_visitors where id = ?',
    [serverVisitor.id]
  );

  const now = new Date().toISOString();

  if (existing) {
    // Update sync status on the existing row
    await db.runAsync(
      `update local_visitors
       set sync_status = 'synced',
           status      = ?,
           exit_time   = ?,
           photo_url   = ?,
           updated_at  = ?
       where id = ?`,
      [
        serverVisitor.status,
        serverVisitor.exitTime ?? null,
        serverVisitor.visitorPhotoUrl ?? null,
        now,
        serverVisitor.id,
      ]
    );
  } else {
    // Insert a fresh record from the server — local_id mirrors server id
    await db.runAsync(
      `insert or ignore into local_visitors (
        id, local_id, society_id, flat_id, visitor_name, visitor_phone,
        purpose, vehicle_number, status, photo_local_path, photo_url,
        entry_time, exit_time, sync_status, sync_error, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', null, ?, ?)`,
      [
        serverVisitor.id,
        serverVisitor.id, // local_id = server id for server-origin rows
        serverVisitor.societyId,
        serverVisitor.flatId,
        serverVisitor.visitorName,
        serverVisitor.visitorPhone ?? null,
        serverVisitor.purpose ?? '',
        serverVisitor.vehicleNumber ?? null,
        serverVisitor.status,
        null, // no local photo path
        serverVisitor.visitorPhotoUrl ?? null,
        serverVisitor.entryTime ?? now,
        serverVisitor.exitTime ?? null,
        serverVisitor.createdAt,
        now,
      ]
    );
  }
}
