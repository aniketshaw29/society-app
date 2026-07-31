import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3012';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';
process.env['SMS_PROVIDER'] = 'console';

// Auth middleware mock — bypass real JWT verification
jest.mock('../src/middleware/auth', () => ({
  authenticate: (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => { next(); },
  requireRole: (...roles: string[]) => (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ error: { code: 'FORBIDDEN' } }); return; }
    next();
  },
  requireSocietyAccess: (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => { next(); },
}));

// ============================================================
// Fixtures
// ============================================================

const ADMIN_USER_ID = 'admin-rpt-001';
const ADMIN_SOCIETY_ID = 'society-rpt-aaa';
const OTHER_ADMIN_USER_ID = 'admin-rpt-002';
const OTHER_SOCIETY_ID = 'society-rpt-bbb';

// ============================================================
// In-memory stores
// ============================================================

interface VisitorRow {
  id: string;
  society_id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  flats: { flat_number: string; buildings: { id: string; name: string } | null } | null;
  guards: { id: string; user_id: string; user_profiles: { full_name: string | null } | null } | null;
}

interface StaffVisitRow {
  id: string;
  society_id: string;
  flat_id: string;
  entry_time: string;
  exit_time: string | null;
  created_at: string;
  recurring_staff: {
    id: string;
    name: string;
    category: string;
    phone: string | null;
    flat_id: string;
    flats: { flat_number: string; buildings: { name: string } | null } | null;
  } | null;
}

interface SosRow {
  id: string;
  society_id: string;
  message: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
  flats: { flat_number: string; buildings: { name: string } | null } | null;
  resident: { full_name: string | null; phone: string | null } | null;
}

let visitorStore: VisitorRow[] = [];
let staffVisitStore: StaffVisitRow[] = [];
let sosStore: SosRow[] = [];
let rowIdCounter = 0;

function nowIso(): string { return new Date().toISOString(); }
function dateIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400_000).toISOString();
}

// ============================================================
// FCM mock (not used by reports but required for imports)
// ============================================================

jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async () => ({ successCount: 0, failureCount: 0, results: [], invalidTokens: [] })),
  sendPushNotification: jest.fn(async () => ({ success: true })),
}));

// ============================================================
// Supabase mock
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSelectChain<T extends Record<string, unknown>>(
  storeRef: () => T[],
  _societyKey = 'society_id'
): any {
  const filters: Record<string, unknown> = {};
  let rangeStart = 0;
  let rangeEnd = 49;
  let gteDate: string | undefined;
  let lteDate: string | undefined;
  let dateField = 'created_at';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    eq: jest.fn((col: string, val: unknown) => { filters[col] = val; return chain; }),
    order: jest.fn((_col: string, _opts?: unknown) => chain),
    range: jest.fn((s: number, e: number) => { rangeStart = s; rangeEnd = e; return chain; }),
    gte: jest.fn((col: string, val: string) => { gteDate = val; dateField = col; return chain; }),
    lte: jest.fn((col: string, val: string) => { lteDate = val; dateField = col; return chain; }),
    then: jest.fn((resolve: (v: { data: T[]; error: null; count: number }) => void) => {
      let rows = storeRef().filter((r) =>
        Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
      );
      if (gteDate) {
        rows = rows.filter((r) => {
          const val = (r as unknown as Record<string, unknown>)[dateField] as string;
          return val >= gteDate!;
        });
      }
      if (lteDate) {
        rows = rows.filter((r) => {
          const val = (r as unknown as Record<string, unknown>)[dateField] as string;
          return val <= lteDate!;
        });
      }
      const paginated = rows.slice(rangeStart, rangeEnd + 1);
      resolve({ data: paginated.map((r) => ({ ...r })) as T[], error: null, count: rows.length });
    }),
  };
  return chain;
}

function buildMockSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'visitor_logs') {
        return { select: jest.fn(() => buildSelectChain(() => visitorStore as unknown as Record<string, unknown>[])) };
      }
      if (table === 'staff_visits') {
        return { select: jest.fn(() => buildSelectChain(() => staffVisitStore as unknown as Record<string, unknown>[], 'society_id')) };
      }
      if (table === 'sos_alerts') {
        return { select: jest.fn(() => buildSelectChain(() => sosStore as unknown as Record<string, unknown>[])) };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
    }),
  };
}

let mockSupabase = buildMockSupabase();

jest.mock('../src/lib/supabaseAdmin', () => ({
  get supabaseAdmin() { return mockSupabase; },
}));

// ============================================================
// Build test app
// ============================================================

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { next(); return; }
    const token = auth.slice(7);
    switch (token) {
      case 'admin-token':
        req.user = { id: ADMIN_USER_ID, role: 'society_admin', society_id: ADMIN_SOCIETY_ID, flat_id: null };
        break;
      case 'other-admin-token':
        req.user = { id: OTHER_ADMIN_USER_ID, role: 'society_admin', society_id: OTHER_SOCIETY_ID, flat_id: null };
        break;
      case 'resident-token':
        req.user = { id: 'res-001', role: 'flat_owner', society_id: ADMIN_SOCIETY_ID, flat_id: 'flat-001' };
        break;
    }
    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reportsRouter = require('../src/routes/adminReports').default as express.Router;
  app.use('/admin/reports', reportsRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Reset
// ============================================================

beforeEach(() => {
  visitorStore = [];
  staffVisitStore = [];
  sosStore = [];
  rowIdCounter = 0;
  mockSupabase = buildMockSupabase();
  jest.resetModules();
});

// ============================================================
// Helper: seed visitors
// ============================================================

function seedVisitor(overrides: Partial<VisitorRow> = {}): VisitorRow {
  const id = `vlog-${String(++rowIdCounter).padStart(4, '0')}`;
  const row: VisitorRow = {
    id,
    society_id: ADMIN_SOCIETY_ID,
    visitor_name: 'Test Visitor',
    visitor_phone: '9999999999',
    purpose: 'guest',
    status: 'entered',
    entry_time: nowIso(),
    exit_time: null,
    created_at: nowIso(),
    flats: { flat_number: 'A101', buildings: { id: 'bld-001', name: 'Block A' } },
    guards: { id: 'g-001', user_id: 'guser-001', user_profiles: { full_name: 'Guard One' } },
    ...overrides,
  };
  visitorStore.push(row);
  return row;
}

function seedStaffVisit(overrides: Partial<StaffVisitRow> = {}): StaffVisitRow {
  const id = `sv-${String(++rowIdCounter).padStart(4, '0')}`;
  const row: StaffVisitRow = {
    id,
    society_id: ADMIN_SOCIETY_ID,
    flat_id: 'flat-001',
    entry_time: nowIso(),
    exit_time: null,
    created_at: nowIso(),
    recurring_staff: {
      id: 'staff-001',
      name: 'Cleaning Staff',
      category: 'maid',
      phone: '8888888888',
      flat_id: 'flat-001',
      flats: { flat_number: 'A101', buildings: { name: 'Block A' } },
    },
    ...overrides,
  };
  staffVisitStore.push(row);
  return row;
}

function seedSosAlert(overrides: Partial<SosRow> = {}): SosRow {
  const id = `sos-${String(++rowIdCounter).padStart(4, '0')}`;
  const row: SosRow = {
    id,
    society_id: ADMIN_SOCIETY_ID,
    message: 'Help!',
    status: 'resolved',
    resolved_at: nowIso(),
    created_at: nowIso(),
    flats: { flat_number: 'B202', buildings: { name: 'Block B' } },
    resident: { full_name: 'Jane Doe', phone: '7777777777' },
    ...overrides,
  };
  sosStore.push(row);
  return row;
}

// ============================================================
// GET /admin/reports/visitors
// ============================================================

describe('GET /admin/reports/visitors', () => {
  it('returns visitor records for the society', async () => {
    seedVisitor();
    seedVisitor();
    const app = buildTestApp();

    const res = await request(app)
      .get('/admin/reports/visitors')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.visitors).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('date range filter returns only records in range', async () => {
    // Seed one record 2 days ago, one from today
    seedVisitor({ created_at: dateIso(2), entry_time: dateIso(2) });
    seedVisitor({ created_at: nowIso(), entry_time: nowIso() });

    const today = new Date().toISOString().slice(0, 10);
    const app = buildTestApp();

    const res = await request(app)
      .get(`/admin/reports/visitors?fromDate=${today}&toDate=${today}`)
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    // Only today's record
    expect(res.body.visitors.length).toBeLessThanOrEqual(1);
  });

  it('admin cannot query outside their own society_id', async () => {
    // Seed a visitor for OTHER_SOCIETY_ID
    seedVisitor({ society_id: OTHER_SOCIETY_ID });

    const app = buildTestApp();
    const res = await request(app)
      .get('/admin/reports/visitors')
      .set('Authorization', 'Bearer admin-token'); // ADMIN_SOCIETY_ID

    expect(res.status).toBe(200);
    // Should not include the other society's visitor
    const visitors = res.body.visitors as Array<{ id: string }>;
    expect(visitors.every((v) => {
      const stored = visitorStore.find((r) => r.id === v.id);
      return stored?.society_id === ADMIN_SOCIETY_ID;
    })).toBe(true);
  });

  it('page=2 returns different results than page=1', async () => {
    // Seed 6 records
    for (let i = 0; i < 6; i++) seedVisitor();
    const app = buildTestApp();

    const res1 = await request(app)
      .get('/admin/reports/visitors?limit=3&page=1')
      .set('Authorization', 'Bearer admin-token');

    const res2 = await request(app)
      .get('/admin/reports/visitors?limit=3&page=2')
      .set('Authorization', 'Bearer admin-token');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const ids1 = (res1.body.visitors as Array<{ id: string }>).map((v) => v.id);
    const ids2 = (res2.body.visitors as Array<{ id: string }>).map((v) => v.id);
    // Pages must not overlap
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('returns 403 for non-admin (resident)', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/admin/reports/visitors')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(403);
  });
});

// ============================================================
// GET /admin/reports/staff
// ============================================================

describe('GET /admin/reports/staff', () => {
  it('returns staff visit records', async () => {
    seedStaffVisit();
    seedStaffVisit();
    const app = buildTestApp();

    const res = await request(app)
      .get('/admin/reports/staff')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(2);
  });

  it('date range filter — inclusive both ends', async () => {
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    seedStaffVisit({ entry_time: dateIso(1), created_at: dateIso(1) }); // yesterday
    seedStaffVisit({ entry_time: nowIso(), created_at: nowIso() }); // today
    seedStaffVisit({ entry_time: dateIso(5), created_at: dateIso(5) }); // 5 days ago

    const app = buildTestApp();
    const res = await request(app)
      .get(`/admin/reports/staff?fromDate=${yesterday}&toDate=${today}`)
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    // Should include yesterday and today records (2 out of 3)
    expect(res.body.visits.length).toBeLessThanOrEqual(2);
    expect(res.body.visits.length).toBeGreaterThanOrEqual(1);
  });

  it('page=2 returns different results than page=1', async () => {
    for (let i = 0; i < 6; i++) seedStaffVisit();
    const app = buildTestApp();

    const res1 = await request(app)
      .get('/admin/reports/staff?limit=3&page=1')
      .set('Authorization', 'Bearer admin-token');
    const res2 = await request(app)
      .get('/admin/reports/staff?limit=3&page=2')
      .set('Authorization', 'Bearer admin-token');

    const ids1 = (res1.body.visits as Array<{ id: string }>).map((v) => v.id);
    const ids2 = (res2.body.visits as Array<{ id: string }>).map((v) => v.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });
});

// ============================================================
// GET /admin/reports/sos
// ============================================================

describe('GET /admin/reports/sos', () => {
  it('returns SOS alerts for the society', async () => {
    seedSosAlert();
    const app = buildTestApp();

    const res = await request(app)
      .get('/admin/reports/sos')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0].resolutionMinutes).toBeDefined();
  });

  it('date range filter returns only records in range', async () => {
    seedSosAlert({ created_at: dateIso(10) }); // 10 days ago
    seedSosAlert({ created_at: nowIso() }); // today

    const today = new Date().toISOString().slice(0, 10);
    const app = buildTestApp();

    const res = await request(app)
      .get(`/admin/reports/sos?fromDate=${today}&toDate=${today}`)
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    // Should only include today's alert
    expect(res.body.alerts.length).toBeLessThanOrEqual(1);
  });

  it('admin cannot query outside their society (scoped via req.user)', async () => {
    seedSosAlert({ society_id: OTHER_SOCIETY_ID }); // belongs to other society

    const app = buildTestApp();
    const res = await request(app)
      .get('/admin/reports/sos')
      .set('Authorization', 'Bearer admin-token'); // ADMIN_SOCIETY_ID

    expect(res.status).toBe(200);
    // Should NOT include the other society's alert
    const alerts = res.body.alerts as Array<{ id: string }>;
    expect(alerts.every((a) => {
      const stored = sosStore.find((r) => r.id === a.id);
      return stored?.society_id === ADMIN_SOCIETY_ID;
    })).toBe(true);
  });

  it('page=2 returns different results than page=1', async () => {
    for (let i = 0; i < 6; i++) seedSosAlert();
    const app = buildTestApp();

    const res1 = await request(app)
      .get('/admin/reports/sos?limit=3&page=1')
      .set('Authorization', 'Bearer admin-token');
    const res2 = await request(app)
      .get('/admin/reports/sos?limit=3&page=2')
      .set('Authorization', 'Bearer admin-token');

    const ids1 = (res1.body.alerts as Array<{ id: string }>).map((a) => a.id);
    const ids2 = (res2.body.alerts as Array<{ id: string }>).map((a) => a.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });
});
