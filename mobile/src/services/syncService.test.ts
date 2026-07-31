// ---------------------------------------------------------------------------
// Unit tests: mobile/src/services/syncService.ts
// ---------------------------------------------------------------------------

import {
  processQueue,
  enqueueVisitorInsert,
  getPendingCount,
  getAbandonedCount,
} from './syncService';
import type { LocalVisitor } from '@/types';
import { getDb } from '@/lib/db/localDb';

// Cast for type-safe mock configuration
const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock expo-sqlite via localDb
// NOTE: jest.mock is hoisted before variable declarations, so we cannot
// reference `mockDb` inside the factory. Instead we expose a plain jest.fn()
// for getDb and configure its resolved value in beforeEach.
jest.mock('@/lib/db/localDb', () => ({
  getDb: jest.fn(),
}));

// Mock db/visitors helpers — use jest.fn() directly in factory, reference via requireMock
jest.mock('@/lib/db/visitors', () => ({
  updateLocalVisitor: jest.fn(),
  upsertFromServer: jest.fn(),
  getLocalVisitorByLocalId: jest.fn(),
}));

// Mock db/conflicts helper — use jest.fn() directly in factory, reference via requireMock
jest.mock('@/lib/db/conflicts', () => ({
  logConflict: jest.fn(),
}));

// Mock axios api — use jest.fn() directly in factory, reference via requireMock
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
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

// Shared mockDb reference — recreated per test so mock calls are isolated
let mockDb: {
  runAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
};

// Lazily-resolved mock references (avoids hoisting issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMocks = () => {
  const apiMock = jest.requireMock('@/lib/api').default;
  const visitorsMock = jest.requireMock('@/lib/db/visitors');
  const conflictsMock = jest.requireMock('@/lib/db/conflicts');
  return {
    mockApiPost: apiMock.post as jest.Mock,
    mockApiGet: apiMock.get as jest.Mock,
    mockApiPatch: apiMock.patch as jest.Mock,
    mockUpdateLocalVisitor: visitorsMock.updateLocalVisitor as jest.Mock,
    mockGetLocalVisitorByLocalId: visitorsMock.getLocalVisitorByLocalId as jest.Mock,
    mockLogConflict: conflictsMock.logConflict as jest.Mock,
  };
};

beforeEach(() => {
  mockDb = {
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  };
  mockGetDb.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  // Reset all mock functions
  const { mockApiPost, mockApiGet, mockApiPatch, mockUpdateLocalVisitor, mockGetLocalVisitorByLocalId, mockLogConflict } = getMocks();
  mockApiPost.mockReset();
  mockApiGet.mockReset();
  mockApiPatch.mockReset();
  mockUpdateLocalVisitor.mockReset();
  mockGetLocalVisitorByLocalId.mockReset();
  mockLogConflict.mockReset();
});

// ---------------------------------------------------------------------------
// processQueue
// ---------------------------------------------------------------------------

describe('processQueue', () => {
  it('calls POST /visitors for a pending INSERT entry', async () => {
    const { mockApiPost, mockUpdateLocalVisitor } = getMocks();
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow()]);
    mockApiPost.mockResolvedValueOnce({
      data: { visitor: { ...baseLocalVisitor, id: SERVER_ID } },
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
    const { mockApiPost } = getMocks();
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 0 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

    await processQueue();

    const updateCalls = mockDb.runAsync.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('attempts =')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);

    const [sql, params] = updateCalls[0] as [string, unknown[]];
    expect(sql).toContain('next_attempt');
    expect(params[0]).toBe(1);
  });

  it('sets status=abandoned after 3rd failure', async () => {
    const { mockApiPost } = getMocks();
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 2 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

    await processQueue();

    const abandonCalls = mockDb.runAsync.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("'abandoned'")
    );
    expect(abandonCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('marks local visitor sync_status=error after abandonment', async () => {
    const { mockApiPost, mockUpdateLocalVisitor } = getMocks();
    mockDb.getAllAsync.mockResolvedValueOnce([makeInsertQueueRow({ attempts: 2 })]);
    mockApiPost.mockRejectedValueOnce(new Error('Server down'));

    await processQueue();

    expect(mockUpdateLocalVisitor).toHaveBeenCalledWith(
      LOCAL_ID,
      expect.objectContaining({ syncStatus: 'error' })
    );
  });

  it('skips entries whose next_attempt is in the future (filtered by SQL)', async () => {
    const { mockApiPost } = getMocks();
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
