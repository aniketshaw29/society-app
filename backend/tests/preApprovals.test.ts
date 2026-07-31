import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3005';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';
process.env['SMS_PROVIDER'] = 'console'; // Suppress real SMS in tests

// ============================================================
// In-memory store
// ============================================================

const RESIDENT_USER_ID = 'resident-user-001';
const RESIDENT_FLAT_ID = 'flat-aaa-101';
const RESIDENT_SOCIETY_ID = 'society-aaa';

const OTHER_RESIDENT_USER_ID = 'resident-user-002';
const OTHER_FLAT_ID = 'flat-aaa-202';

const GUARD_USER_ID = 'guard-user-001';
const GUARD_SOCIETY_ID = 'society-aaa';

interface StoredPreApproval {
  id: string;
  flat_id: string;
  society_id: string;
  created_by: string;
  guest_name: string;
  guest_phone: string;
  purpose: string | null;
  valid_from: string;
  valid_until: string;
  otp_hash: string;
  otp_attempts: number;
  status: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredVisitorLog {
  id: string;
  society_id: string;
  flat_id: string;
  visitor_name: string;
  visitor_phone: string;
  purpose: string;
  entry_method: string;
  status: string;
  entry_time: string;
  created_at: string;
}

let preApprovalStore: StoredPreApproval[] = [];
let visitorLogStore: StoredVisitorLog[] = [];
let paIdCounter = 0;
let vlIdCounter = 0;

// The last OTP generated — captured via bcryptjs mock so tests can verify
let lastGeneratedOtp = '';

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(hoursFromNow: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

function pastIso(hoursAgo: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

// ============================================================
// Mock: bcryptjs
// We intercept hash/compare so tests can inject a known OTP hash.
// ============================================================

const REAL_BCRYPT = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (data: string, _saltOrRounds: unknown) => {
    // Store the "hashed" value as a simple prefix so compare works deterministically
    return `hashed::${data}`;
  }),
  compare: jest.fn(async (data: string, hash: string) => {
    return hash === `hashed::${data}`;
  }),
}));

// ============================================================
// Mock: otpUtils — capture the generated OTP
// ============================================================

jest.mock('../src/lib/otpUtils', () => {
  const actual = jest.requireActual<typeof import('../src/lib/otpUtils')>('../src/lib/otpUtils');
  return {
    ...actual,
    generateOtp: jest.fn(() => {
      // Generate a numeric OTP, store it for test assertions
      const otp = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      lastGeneratedOtp = otp;
      return otp;
    }),
    hashOtp: jest.fn(async (otp: string) => `hashed::${otp}`),
    verifyOtp: jest.fn(async (otp: string, hash: string) => hash === `hashed::${otp}`),
  };
});

// ============================================================
// Mock: smsService — no-op in tests
// ============================================================

jest.mock('../src/services/smsService', () => ({
  sendOtpSms: jest.fn(async () => undefined),
}));

// ============================================================
// Mock: notificationService — no-op
// ============================================================

jest.mock('../src/services/notificationService', () => ({
  notifyFlatResidents: jest.fn(async () => undefined),
  notifyGuard: jest.fn(async () => undefined),
}));

// ============================================================
// Supabase mock
// ============================================================

type QueryResult<T> = { data: T | null; error: null | { message: string } };

function buildMockSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'visitor_pre_approvals') {
        return buildPreApprovalTable();
      }
      if (table === 'visitor_logs') {
        return buildVisitorLogTable();
      }
      if (table === 'guards') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: { id: 'guard-record-001' }, error: null })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
    }),
  };
}

function buildPreApprovalTable() {
  // Tracks chainable filters applied
  const filters: Record<string, unknown> = {};
  let _order: string | null = null;

  const chain: Record<string, jest.Mock> = {};

  chain['insert'] = jest.fn((row: Partial<StoredPreApproval>) => {
    const id = `pa-${String(++paIdCounter).padStart(4, '0')}`;
    const stored: StoredPreApproval = {
      id,
      flat_id: row.flat_id ?? '',
      society_id: row.society_id ?? '',
      created_by: row.created_by ?? '',
      guest_name: row.guest_name ?? '',
      guest_phone: row.guest_phone ?? '',
      purpose: row.purpose ?? null,
      valid_from: row.valid_from ?? '',
      valid_until: row.valid_until ?? '',
      otp_hash: row.otp_hash ?? '',
      otp_attempts: row.otp_attempts ?? 0,
      status: row.status ?? 'active',
      used_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    preApprovalStore.push(stored);

    return {
      select: jest.fn().mockReturnThis(),
      single: jest.fn(async (): Promise<QueryResult<StoredPreApproval>> => ({
        data: { ...stored },
        error: null,
      })),
    };
  });

  chain['select'] = jest.fn((_fields?: string) => {
    // Build a chainable query builder
    return buildSelectChain(preApprovalStore, filters);
  });

  chain['update'] = jest.fn((updates: Partial<StoredPreApproval>) => ({
    eq: jest.fn((col: string, val: unknown) => {
      // Apply update immediately in-memory
      const idx = preApprovalStore.findIndex((r) => (r as Record<string, unknown>)[col] === val);
      if (idx >= 0) {
        Object.assign(preApprovalStore[idx] as object, updates);
      }
      return {
        eq: jest.fn().mockReturnThis(), // for chained .eq()
        data: null,
        error: null,
        // allow awaiting
        then: (resolve: (v: QueryResult<null>) => void) =>
          resolve({ data: null, error: null }),
      };
    }),
  }));

  return chain;
}

function buildSelectChain(
  store: StoredPreApproval[],
  _filters: Record<string, unknown>
): Record<string, jest.Mock> {
  const localFilters: Record<string, unknown> = {};

  const chain: Record<string, jest.Mock> = {
    eq: jest.fn((col: string, val: unknown) => {
      localFilters[col] = val;
      return chain;
    }),
    gte: jest.fn((_col: string, _val: unknown) => chain),
    order: jest.fn((_col: string) => chain),
    maybeSingle: jest.fn(async (): Promise<QueryResult<StoredPreApproval>> => {
      const result = store.find((r) => {
        return Object.entries(localFilters).every(
          ([k, v]) => (r as Record<string, unknown>)[k] === v
        );
      });
      return { data: result ? { ...result } : null, error: null };
    }),
    single: jest.fn(async (): Promise<QueryResult<StoredPreApproval>> => {
      const result = store.find((r) => {
        return Object.entries(localFilters).every(
          ([k, v]) => (r as Record<string, unknown>)[k] === v
        );
      });
      return { data: result ? { ...result } : null, error: null };
    }),
    // For listing (returns array) — called when no .single()/.maybeSingle()
    then: jest.fn((resolve: (v: QueryResult<StoredPreApproval[]>) => void) => {
      const results = store.filter((r) => {
        return Object.entries(localFilters).every(
          ([k, v]) => (r as Record<string, unknown>)[k] === v
        );
      });
      resolve({ data: results.map((r) => ({ ...r })), error: null });
    }),
  };

  // Make select chain itself awaitable for array results
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'then') {
        return (resolve: (v: QueryResult<StoredPreApproval[]>) => void) => {
          const results = store.filter((r) =>
            Object.entries(localFilters).every(
              ([k, v]) => (r as Record<string, unknown>)[k] === v
            )
          );
          resolve({ data: results.map((r) => ({ ...r })), error: null });
        };
      }
      return target[prop as string];
    },
  });
}

function buildVisitorLogTable() {
  return {
    insert: jest.fn((row: Partial<StoredVisitorLog>) => {
      const id = `vl-${String(++vlIdCounter).padStart(4, '0')}`;
      const stored: StoredVisitorLog = {
        id,
        society_id: row.society_id ?? '',
        flat_id: row.flat_id ?? '',
        visitor_name: row.visitor_name ?? '',
        visitor_phone: row.visitor_phone ?? '',
        purpose: row.purpose ?? 'guest',
        entry_method: row.entry_method ?? 'otp',
        status: row.status ?? 'approved',
        entry_time: row.entry_time ?? nowIso(),
        created_at: nowIso(),
      };
      visitorLogStore.push(stored);

      return {
        select: jest.fn().mockReturnThis(),
        single: jest.fn(async () => ({
          data: {
            ...stored,
            flats: { flat_number: 'A-101', buildings: { name: 'A Block' } },
          },
          error: null,
        })),
      };
    }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
  };
}

let mockSupabase = buildMockSupabase();

jest.mock('../src/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return mockSupabase;
  },
}));

// ============================================================
// Build test app
// ============================================================

function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Auth stub
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = auth.slice(7);

    if (token === 'resident-token') {
      req.user = {
        id: RESIDENT_USER_ID,
        role: 'flat_owner',
        society_id: RESIDENT_SOCIETY_ID,
        flat_id: RESIDENT_FLAT_ID,
      };
    } else if (token === 'other-resident-token') {
      req.user = {
        id: OTHER_RESIDENT_USER_ID,
        role: 'flat_owner',
        society_id: RESIDENT_SOCIETY_ID,
        flat_id: OTHER_FLAT_ID,
      };
    } else if (token === 'guard-token') {
      req.user = {
        id: GUARD_USER_ID,
        role: 'guard',
        society_id: GUARD_SOCIETY_ID,
        flat_id: null,
      };
    }
    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const preApprovalsRouter = require('../src/routes/preApprovals').default as express.Router;
  app.use('/pre-approvals', preApprovalsRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Helpers
// ============================================================

async function seedActivePreApproval(overrides: Partial<StoredPreApproval> = {}): Promise<StoredPreApproval> {
  const otp = '123456';
  const id = `pa-seed-${String(++paIdCounter).padStart(4, '0')}`;
  const pa: StoredPreApproval = {
    id,
    flat_id: RESIDENT_FLAT_ID,
    society_id: RESIDENT_SOCIETY_ID,
    created_by: RESIDENT_USER_ID,
    guest_name: 'Test Guest',
    guest_phone: '9876543210',
    purpose: 'guest',
    valid_from: pastIso(1),
    valid_until: futureIso(3),
    otp_hash: `hashed::${otp}`,
    otp_attempts: 0,
    status: 'active',
    used_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...overrides,
  };
  preApprovalStore.push(pa);
  return pa;
}

// ============================================================
// Reset
// ============================================================

beforeEach(() => {
  preApprovalStore = [];
  visitorLogStore = [];
  paIdCounter = 0;
  vlIdCounter = 0;
  lastGeneratedOtp = '';
  mockSupabase = buildMockSupabase();
  jest.resetModules();
});

// ============================================================
// POST /pre-approvals — T3-1 Create
// ============================================================

describe('POST /pre-approvals', () => {
  it('returns 201 with preApproval; no otp_hash or plain OTP in response', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals')
      .set('Authorization', 'Bearer resident-token')
      .send({
        guestName: 'Ramesh Kumar',
        guestPhone: '9876543210',
        purpose: 'Birthday party',
        validFrom: futureIso(0),
        validUntil: futureIso(4),
      });

    expect(res.status).toBe(201);
    expect(res.body.preApproval).toBeDefined();
    expect(res.body.preApproval.guestName).toBe('Ramesh Kumar');
    expect(res.body.preApproval.status).toBe('active');

    // Must never leak otp_hash or plain OTP
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('otp_hash');
    expect(body).not.toContain('otpHash');
  });

  it('generates a 6-digit numeric OTP', async () => {
    const app = buildTestApp();
    await request(app)
      .post('/pre-approvals')
      .set('Authorization', 'Bearer resident-token')
      .send({
        guestName: 'Sita Devi',
        guestPhone: '9123456780',
        validFrom: futureIso(0),
        validUntil: futureIso(2),
      });

    // OTP captured by mock
    expect(lastGeneratedOtp).toMatch(/^\d{6}$/);
  });

  it('returns 422 when validUntil is in the past', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals')
      .set('Authorization', 'Bearer resident-token')
      .send({
        guestName: 'Past Guest',
        guestPhone: '9000000001',
        validFrom: pastIso(3),
        validUntil: pastIso(1),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when validFrom >= validUntil', async () => {
    const app = buildTestApp();
    const later = futureIso(6);
    const earlier = futureIso(2);

    const res = await request(app)
      .post('/pre-approvals')
      .set('Authorization', 'Bearer resident-token')
      .send({
        guestName: 'Order Guest',
        guestPhone: '9000000002',
        validFrom: later,     // from is AFTER until
        validUntil: earlier,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when no token', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals')
      .send({
        guestName: 'No Auth',
        guestPhone: '9000000003',
        validFrom: futureIso(0),
        validUntil: futureIso(4),
      });

    expect(res.status).toBe(401);
  });
});

// ============================================================
// DELETE /pre-approvals/:id — Cancel
// ============================================================

describe('DELETE /pre-approvals/:id', () => {
  it('sets status=cancelled when owner cancels their own pre-approval', async () => {
    await seedActivePreApproval();
    const pa = preApprovalStore[0]!;

    const app = buildTestApp();
    const res = await request(app)
      .delete(`/pre-approvals/${pa.id}`)
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(200);

    // Verify store was mutated
    const updated = preApprovalStore.find((p) => p.id === pa.id);
    expect(updated?.status).toBe('cancelled');
  });

  it('returns 403 when a different flat resident tries to cancel', async () => {
    await seedActivePreApproval({ flat_id: RESIDENT_FLAT_ID });
    const pa = preApprovalStore[0]!;

    const app = buildTestApp();
    const res = await request(app)
      .delete(`/pre-approvals/${pa.id}`)
      .set('Authorization', 'Bearer other-resident-token');  // other flat

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for non-existent pre-approval', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .delete('/pre-approvals/00000000-0000-0000-0000-000000000000')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(404);
  });
});

// ============================================================
// POST /pre-approvals/verify — T3-2 Guard OTP Verification
// ============================================================

describe('POST /pre-approvals/verify', () => {
  it('returns 200, creates visitor log, marks pre-approval used on correct OTP', async () => {
    await seedActivePreApproval();

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '123456',
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(200);
    expect(res.body.visitor).toBeDefined();
    expect(res.body.visitor.entryMethod).toBe('otp');
    expect(res.body.visitor.status).toBe('approved');
    expect(res.body.preApproval.guestName).toBe('Test Guest');

    // Pre-approval must be marked used
    const pa = preApprovalStore[0]!;
    expect(pa.status).toBe('used');

    // Visitor log must be created
    expect(visitorLogStore.length).toBe(1);
    expect(visitorLogStore[0]!.entry_method).toBe('otp');
  });

  it('returns 401 with attempts_remaining on wrong OTP', async () => {
    await seedActivePreApproval();

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '999999',  // wrong
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('wrong_otp');
    expect(res.body.error.attemptsRemaining).toBe(2);
  });

  it('locks pre-approval on 3rd wrong attempt', async () => {
    await seedActivePreApproval({ otp_attempts: 2 });  // already 2 wrong

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '000000',  // wrong again = 3rd attempt
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('locked');
    expect(res.body.error.attemptsRemaining).toBe(0);

    const pa = preApprovalStore[0]!;
    expect(pa.status).toBe('locked');
  });

  it('returns 400 with code=expired for expired pre-approval', async () => {
    await seedActivePreApproval({
      valid_from: pastIso(6),
      valid_until: pastIso(2),  // already past
    });

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '123456',
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('expired');
  });

  it('returns 409 with code=already_used for a used pre-approval', async () => {
    await seedActivePreApproval({ status: 'used', used_at: pastIso(1) });

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '123456',
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_used');
  });

  it('returns 404 when no pre-approval exists for the phone', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9000000099',  // nobody
        otp: '123456',
        societyId: RESIDENT_SOCIETY_ID,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('returns 403 when guard tries to verify for a different society', async () => {
    await seedActivePreApproval();

    const app = buildTestApp();
    const res = await request(app)
      .post('/pre-approvals/verify')
      .set('Authorization', 'Bearer guard-token')
      .send({
        guestPhone: '9876543210',
        otp: '123456',
        societyId: 'different-society-uuid-0000',
      });

    expect(res.status).toBe(403);
  });
});
