// ---------------------------------------------------------------------------
// Core sync engine
// ---------------------------------------------------------------------------
// Processes sync_queue entries, retries with exponential backoff,
// pulls server state, and resolves conflicts.
// ---------------------------------------------------------------------------

import api from '@/lib/api';
import { getDb } from '@/lib/db/localDb';
import {
  updateLocalVisitor,
  upsertFromServer,
  getLocalVisitorByLocalId,
} from '@/lib/db/visitors';
import { logConflict } from '@/lib/db/conflicts';
import {
  resolveStatusConflict,
  resolveExitTime,
} from './conflictResolver';
import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncQueueRow {
  id: number;
  entity_type: string;
  operation: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_attempt: string | null;
  next_attempt: string | null;
  status: string;
}

interface VisitorInsertPayload {
  localId: string;
  societyId: string;
  flatId: string;
  visitorName: string;
  visitorPhone?: string | null;
  purpose: string;
  vehicleNumber?: string | null;
  entryMethod: string;
  photoLocalPath?: string | null;
}

interface VisitorUpdatePayload {
  localId: string;
  serverId: string;
  updates: Partial<LocalVisitor>;
}

// ---------------------------------------------------------------------------
// Backoff helper
// ---------------------------------------------------------------------------

/** 30s × 2^attempts, capped at 1 hour */
function computeNextAttempt(attempts: number): string {
  const backoffMs = Math.min(30_000 * Math.pow(2, attempts), 3_600_000);
  return new Date(Date.now() + backoffMs).toISOString();
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

async function markQueueSuccess(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "update sync_queue set status = 'success', last_attempt = ? where id = ?",
    [new Date().toISOString(), id]
  );
}

async function markQueueFailure(row: SyncQueueRow): Promise<void> {
  const db = await getDb();
  const newAttempts = row.attempts + 1;
  const now = new Date().toISOString();

  if (newAttempts >= 3) {
    await db.runAsync(
      "update sync_queue set status = 'abandoned', attempts = ?, last_attempt = ? where id = ?",
      [newAttempts, now, row.id]
    );
  } else {
    const nextAttempt = computeNextAttempt(newAttempts);
    await db.runAsync(
      `update sync_queue
       set attempts = ?, last_attempt = ?, next_attempt = ?
       where id = ?`,
      [newAttempts, now, nextAttempt, row.id]
    );
  }
}

// ---------------------------------------------------------------------------
// Photo upload helper
// ---------------------------------------------------------------------------

async function maybeUploadPhoto(
  payload: VisitorInsertPayload,
  serverId: string
): Promise<string | null> {
  if (!payload.photoLocalPath) return null;

  try {
    const { usePhotoCapture } = await import('@/hooks/usePhotoCapture');
    const photoHook = usePhotoCapture();
    const compressed = await photoHook.compressImage(payload.photoLocalPath);
    const url = await photoHook.uploadVisitorPhoto(
      compressed,
      payload.societyId,
      serverId
    );
    return url;
  } catch (err) {
    console.warn('[syncService] Photo upload failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Process a single INSERT entry
// ---------------------------------------------------------------------------

async function processInsert(row: SyncQueueRow): Promise<void> {
  const payload = JSON.parse(row.payload) as VisitorInsertPayload;

  // Upload photo first if present, use placeholder URL initially
  let photoUrl: string | null = null;

  const response = await api.post<{ visitor: VisitorLog }>('/visitors', {
    flatId: payload.flatId,
    visitorName: payload.visitorName,
    visitorPhone: payload.visitorPhone ?? undefined,
    purpose: payload.purpose,
    vehicleNumber: payload.vehicleNumber ?? undefined,
    entryMethod: payload.entryMethod,
  });

  const serverVisitor = response.data.visitor;

  // Upload photo now that we have the server id
  if (payload.photoLocalPath) {
    photoUrl = await maybeUploadPhoto(payload, serverVisitor.id);
  }

  // Update local record: assign server id and mark synced
  await updateLocalVisitor(payload.localId, {
    id: serverVisitor.id,
    syncStatus: 'synced',
    syncError: null,
    ...(photoUrl ? { photoUrl } : {}),
  });

  await markQueueSuccess(row.id);
}

// ---------------------------------------------------------------------------
// Process a single UPDATE entry (PATCH + conflict resolution)
// ---------------------------------------------------------------------------

async function processUpdate(row: SyncQueueRow): Promise<void> {
  const payload = JSON.parse(row.payload) as VisitorUpdatePayload;

  if (!payload.serverId) {
    // Server id not yet known — this entry should not have been queued
    throw new Error('Missing serverId in UPDATE payload');
  }

  // 1. Fetch current server state to detect conflicts
  const serverRes = await api.get<{ visitor: VisitorLog }>(
    `/visitors/${payload.serverId}`
  );
  const serverVisitor = serverRes.data.visitor;

  const localRecord = await getLocalVisitorByLocalId(payload.localId);

  if (!localRecord) {
    // Local record gone — nothing to resolve
    await markQueueSuccess(row.id);
    return;
  }

  // 2. Resolve status conflict
  const { resolvedStatus, hadConflict: statusConflict } = resolveStatusConflict(
    localRecord,
    serverVisitor
  );

  if (statusConflict) {
    await logConflict({
      visitorLocalId: payload.localId,
      conflictType: 'status_conflict',
      localValue: localRecord.status,
      serverValue: serverVisitor.status,
      resolvedValue: resolvedStatus,
    });
    // Apply resolved status locally
    await updateLocalVisitor(payload.localId, { status: resolvedStatus as LocalVisitor['status'] });
  }

  // 3. Resolve exit_time conflict
  const { resolvedExitTime, hadConflict: exitConflict } = resolveExitTime(
    localRecord,
    serverVisitor
  );

  if (exitConflict) {
    await logConflict({
      visitorLocalId: payload.localId,
      conflictType: 'exit_time_conflict',
      localValue: localRecord.exitTime ?? '',
      serverValue: serverVisitor.exitTime ?? '',
      resolvedValue: resolvedExitTime ?? '',
    });
    if (resolvedExitTime !== localRecord.exitTime) {
      await updateLocalVisitor(payload.localId, { exitTime: resolvedExitTime });
    }
  }

  // 4. PATCH server with resolved values
  await api.patch(`/visitors/${payload.serverId}`, {
    status: resolvedStatus,
    ...(resolvedExitTime ? { exitTime: resolvedExitTime } : {}),
    ...payload.updates,
  });

  await updateLocalVisitor(payload.localId, { syncStatus: 'synced', syncError: null });
  await markQueueSuccess(row.id);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Processes all pending sync_queue entries.
 * Skips entries whose next_attempt is in the future.
 */
export async function processQueue(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const rows = await db.getAllAsync<SyncQueueRow>(
    `select * from sync_queue
     where status = 'pending'
       and (next_attempt is null or next_attempt <= ?)
     order by id asc`,
    [now]
  );

  for (const row of rows) {
    try {
      if (row.entity_type === 'visitor' && row.operation === 'INSERT') {
        await processInsert(row);
      } else if (row.entity_type === 'visitor' && row.operation === 'UPDATE') {
        await processUpdate(row);
      } else {
        console.warn('[syncService] Unknown queue entry:', row.entity_type, row.operation);
        await markQueueSuccess(row.id); // don't block the queue
      }
    } catch (err) {
      console.warn(`[syncService] Queue item ${row.id} failed:`, err);

      // Update local visitor sync_error if we can identify it
      try {
        const rawPayload = JSON.parse(row.payload) as { localId?: string };
        if (rawPayload.localId) {
          const newAttempts = row.attempts + 1;
          if (newAttempts >= 3) {
            await updateLocalVisitor(rawPayload.localId, {
              syncStatus: 'error',
              syncError: err instanceof Error ? err.message : 'Sync failed',
            });
          }
        }
      } catch {
        // Ignore parse error — we still want to update the queue row
      }

      await markQueueFailure(row);
    }
  }
}

/**
 * Adds an INSERT operation for a new local visitor to the sync queue.
 */
export async function enqueueVisitorInsert(localVisitor: LocalVisitor): Promise<void> {
  const db = await getDb();
  const payload: VisitorInsertPayload = {
    localId: localVisitor.localId,
    societyId: localVisitor.societyId,
    flatId: localVisitor.flatId,
    visitorName: localVisitor.visitorName,
    visitorPhone: localVisitor.visitorPhone,
    purpose: localVisitor.purpose,
    vehicleNumber: localVisitor.vehicleNumber,
    entryMethod: 'manual',
    photoLocalPath: localVisitor.photoLocalPath,
  };

  await db.runAsync(
    `insert into sync_queue (entity_type, operation, payload, created_at, status)
     values ('visitor', 'INSERT', ?, ?, 'pending')`,
    [JSON.stringify(payload), new Date().toISOString()]
  );
}

/**
 * Adds an UPDATE operation for an existing local visitor to the sync queue.
 * `serverId` must be known (i.e., the INSERT has already been synced).
 */
export async function enqueueVisitorUpdate(
  localId: string,
  serverId: string,
  updates: Partial<LocalVisitor>
): Promise<void> {
  const db = await getDb();
  const payload: VisitorUpdatePayload = {
    localId,
    serverId,
    updates,
  };

  await db.runAsync(
    `insert into sync_queue (entity_type, operation, payload, created_at, status)
     values ('visitor', 'UPDATE', ?, ?, 'pending')`,
    [JSON.stringify(payload), new Date().toISOString()]
  );
}

/**
 * Pulls the last 24 h of visitors from the server and upserts them locally.
 */
export async function syncFromServer(societyId: string): Promise<void> {
  const response = await api.get<{ visitors: VisitorLog[] }>(
    `/visitors/active?societyId=${societyId}`
  );
  const visitors = response.data.visitors ?? [];

  for (const v of visitors) {
    await upsertFromServer(v);
  }
}

// ---------------------------------------------------------------------------
// Pending / abandoned counts (used by useSyncStatus)
// ---------------------------------------------------------------------------

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from sync_queue where status = 'pending'"
  );
  return row?.count ?? 0;
}

export async function getAbandonedCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from sync_queue where status = 'abandoned'"
  );
  return row?.count ?? 0;
}
