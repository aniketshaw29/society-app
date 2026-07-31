// ---------------------------------------------------------------------------
// Unit tests: mobile/src/lib/db/visitors.ts
// ---------------------------------------------------------------------------
// All SQLite calls are mocked so tests run without a device.
// ---------------------------------------------------------------------------

import {
  insertLocalVisitor,
  updateLocalVisitor,
  getLocalVisitorByLocalId,
  getActiveLocalVisitors,
  upsertFromServer,
} from '../visitors';
import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Mock getDb
// ---------------------------------------------------------------------------

const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
};

jest.mock('../localDb', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LOCAL_ID = 'local-uuid-001';

const baseVisitor: LocalVisitor = {
  id: '',
  localId: LOCAL_ID,
  societyId: 'society-1',
  flatId: 'flat-1',
  visitorName: 'John Doe',
  visitorPhone: '9999999999',
  purpose: 'guest',
  vehicleNumber: 'MH01AB1234',
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

const serverVisitor: VisitorLog = {
  id: 'server-uuid-001',
  societyId: 'society-1',
  flatId: 'flat-1',
  guardId: null,
  visitorName: 'John Doe',
  visitorPhone: '9999999999',
  visitorPhotoUrl: null,
  vehicleNumber: 'MH01AB1234',
  purpose: 'guest',
  entryMethod: 'manual',
  status: 'approved',
  approvedBy: 'resident-1',
  approvedAt: '2026-07-31T05:10:00.000Z',
  entryTime: '2026-07-31T05:00:00.000Z',
  exitTime: null,
  createdAt: '2026-07-31T05:00:00.000Z',
  updatedAt: '2026-07-31T05:10:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('insertLocalVisitor', () => {
  it('calls runAsync with all 17 fields in the correct order', async () => {
    await insertLocalVisitor(baseVisitor);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];

    // SQL should target local_visitors
    expect(sql).toContain('insert into local_visitors');

    // params length
    expect(params).toHaveLength(17);

    // Key fields
    expect(params[0]).toBe('');               // id (empty before sync)
    expect(params[1]).toBe(LOCAL_ID);         // local_id
    expect(params[4]).toBe('John Doe');       // visitor_name
    expect(params[8]).toBe('pending');        // status
    expect(params[13]).toBe('pending');       // sync_status
  });
});

describe('getActiveLocalVisitors', () => {
  it('filters by status pending/approved/entered and today since midnight IST', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    await getActiveLocalVisitors('society-1');

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status in ('pending', 'approved', 'entered')");
    expect(sql).toContain('created_at >=');
  });

  it('returns mapped LocalVisitor objects for each row', async () => {
    const fakeRow = {
      id: 'server-id',
      local_id: LOCAL_ID,
      society_id: 'society-1',
      flat_id: 'flat-1',
      visitor_name: 'Jane',
      visitor_phone: null,
      purpose: 'delivery',
      vehicle_number: null,
      status: 'pending',
      photo_local_path: null,
      photo_url: null,
      entry_time: '2026-07-31T05:00:00.000Z',
      exit_time: null,
      sync_status: 'pending',
      sync_error: null,
      created_at: '2026-07-31T05:00:00.000Z',
      updated_at: '2026-07-31T05:00:00.000Z',
    };
    mockDb.getAllAsync.mockResolvedValueOnce([fakeRow]);

    const result = await getActiveLocalVisitors('society-1');
    expect(result).toHaveLength(1);
    expect(result[0].visitorName).toBe('Jane');
    expect(result[0].localId).toBe(LOCAL_ID);
  });
});

describe('upsertFromServer', () => {
  it('updates sync_status to synced when record already exists by server id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ local_id: LOCAL_ID });

    await upsertFromServer(serverVisitor);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sync_status = 'synced'");
  });

  it('inserts a new row when record does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    await upsertFromServer(serverVisitor);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert or ignore into local_visitors');
  });
});

describe('updateLocalVisitor', () => {
  it('updates only specified fields plus updated_at', async () => {
    await updateLocalVisitor(LOCAL_ID, { status: 'approved' });

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('updated_at = ?');
    expect(sql).toContain('status = ?');
    expect(params).toContain('approved');
    expect(params[params.length - 1]).toBe(LOCAL_ID); // WHERE clause
  });

  it('does not include unspecified fields in SET clause', async () => {
    await updateLocalVisitor(LOCAL_ID, { syncStatus: 'synced' });

    const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('visitor_name');
    expect(sql).toContain('sync_status');
  });
});
