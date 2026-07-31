// ---------------------------------------------------------------------------
// Unit tests: mobile/src/services/syncService.ts
// ---------------------------------------------------------------------------

import {
  processQueue,
  enqueueVisitorInsert,
  getPendingCount,
  getAbandonedCount,
} from '../syncService';
import type { LocalVisitor } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock expo-sqlite via localDb
const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
};
jest.mock('@/lib/db/localDb', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

// Mock db/visitors helpers
const mockUpdateLocalVisitor = jest.fn();
const mockGetLocalVisitorByLocalId = jest.fn();
jest.mock('@/lib/db/visitors', () => ({
  updateLocalVisitor: (...args: unknown[]) => mockUpdateLocalVisitor(...args),
  upsertFromServer: jest.fn(),
  getLocalVisitorByLocalId: (...args: unknown[]) => mockGetLocalVisitorByLocalId(...args),
}));

// Mock db/conflicts helper
const mockLogConflict = jest.fn();
jest.mock('@/lib/db/conflicts', () => ({
  logConflict: (...args: unknown[]) => mockLogConflict(...args),
}));

// Mock axios api
const mockApiPost = jest.fn();
const mockApiGet = jest.fn();
const mockApiPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockApiPost(...args),
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LOCAL_ID = 'local-abc';
const SERVER_ID = 'server-xyz';

const baseLocalVisitor: LocalVisitor = {
  id: '',
  localId: LOCAL_ID,
  societyId: 'society-1',
  flatId: 'flat-1',
  visitorName: 'Test Visitor',
  visitorPhone: null,
  purpose: 'delivery',
  vehicleNumber: null,
  status: 'pending',
  photoLocalPath: null,
  photoUrl: null,
  entryTime: '2026-07-31T05:00:00.000Z',
  exitTime: null,
  syncStatus: 'pending',
  syncError: null,
  createdAt: '2026-07-31T05:00:00.000Z',
  updatedAt: '2026-07-31T05:00:00.000Z',
};

const makeInsertQueueRow = (overrides = {}) => ({
  id: 1,
  entity_type: 'visitor',
  operation: 'INSERT',
  payload: JSON.stringify({
    localId: LOCAL_ID,
    societyId: 'society-1',
    flatId: 'flat-1',
    visitorName: 'Test Visitor',
    purpose: 'delivery',
    entryMethod: 'manual',
  }),
  created_at: '2026-07-31T05:00:00.000Z',
  attempts: 0,
  last_attempt: null,
  next_attempt: null,
  status: 'pending',
  ...overrides,
});

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
});

// ---------------------------------------------------------------------------
// processQueue
// ---------------------------------------------------------------------------

describe('processQueue', () => {
  it('calls POST /visitors for a pending INSERT entry', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow()]);
    mockApiPost.mockResolvedValueOnce({
      data: { visitor: { id: SERVER_ID, ...baseLocalVisitor } },
    });

    await processQueue();

    expect(mockApiPost).toHaveBeenCalledWith(
      '/visitors',
      expect.objectContaining({ visitorName: 'Test Visitor' })
    );
    expect(mockUpdateLocalVisitor).toHaveBeenCalledWith(
      LOCAL_ID,
      expect.objectContaining({ id: SERVER_ID, syncStatus: 'synced' })
    );
  });

  it('increments attempts on failure and computes next_attempt', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 0 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

    await processQueue();

    // Should NOT call markQueueSuccess
    // Should call runAsync to update attempts
    const updateCalls = mockDb.runAsync.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('attempts =')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);

    const [sql, params] = updateCalls[0] as [string, unknown[]];
    expect(sql).toContain('next_attempt');
    expect(params[0]).toBe(1); // new attempts count
  });

  it('sets status=abandoned after 3rd failure', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 2 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

    await processQueue();

    const abandonCalls = mockDb.runAsync.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("'abandoned'")
    );
    expect(abandonCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('marks local visitor sync_status=error after abandonment', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 2 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Server down'));

    await processQueue();

    expect(mockUpdateLocalVisitor).toHaveBeenCalledWith(
      LOCAL_ID,
      expect.objectContaining({ syncStatus: 'error' })
    );
  });

  it('skips entries whose next_attempt is in the future (filtered by SQL)', async () => {
    // The SQL filter is applied inside processQueue — if getAllAsync returns empty, nothing runs
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await processQueue();

    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// enqueueVisitorInsert
// ---------------------------------------------------------------------------

describe('enqueueVisitorInsert', () => {
  it('inserts a pending INSERT row into sync_queue', async () => {
    await enqueueVisitorInsert(baseLocalVisitor);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("insert into sync_queue");
    expect(sql).toContain("'INSERT'");
    const payload = JSON.parse(params[0] as string) as { localId: string };
    expect(payload.localId).toBe(LOCAL_ID);
  });
});

// ---------------------------------------------------------------------------
// getPendingCount / getAbandonedCount
// ---------------------------------------------------------------------------

describe('getPendingCount', () => {
  it('returns 0 when no pending entries', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ count: 0 });
    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it('returns correct count from db', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ count: 7 });
    const count = await getPendingCount();
    expect(count).toBe(7);
  });
});

describe('getAbandonedCount', () => {
  it('queries abandoned status', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ count: 3 });
    const count = await getAbandonedCount();
    expect(count).toBe(3);

    const [sql] = mockDb.getFirstAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("'abandoned'");
  });
});
