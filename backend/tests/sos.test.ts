import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3009';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';
process.env['SMS_PROVIDER'] = 'console';

// ============================================================
// Fixtures
// ============================================================

const RESIDENT_USER_ID = 'resident-user-sos-001';
const RESIDENT_FLAT_ID = 'flat-sos-101';
const RESIDENT_SOCIETY_ID = 'society-sos-aaa';

const OTHER_RESIDENT_USER_ID = 'resident-user-sos-002';
const OTHER_FLAT_ID = 'flat-sos-202';

const GUARD_USER_ID = 'guard-user-sos-001';
const ADMIN_USER_ID = 'admin-user-sos-001';

// ============================================================
// In-memory store
// ============================================================

interface StoredSosAlert {
  id: string;
  society_id: string;
  flat_id: string;
  resident_id: string;
  message: string;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

let sosStore: StoredSosAlert[] = [];
let sosIdCounter = 0;
// Track which FCM tokens were sent to
let fcmSentTokens: string[] = [];
let fcmSendCallCount = 0;
let fcmShouldThrow = false;

function nowIso(): string {
  return new Date().toISOString();
}

// ============================================================
// Auth middleware mock — bypass real JWT verification
// ============================================================

jest.mock('../src/middleware/auth', () => ({
  authenticate: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Auth required' } }); return; }
    next();
  },
  requireRole: (...roles: string[]) => (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Auth required' } }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }); return; }
    next();
  },
}));

// ============================================================
// FCM mock
// ============================================================

jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async (tokens: string[]) => {
    if (fcmShouldThrow) {
      throw new Error('FCM simulated failure');
    }
    fcmSentTokens = [...fcmSentTokens, ...tokens];
    fcmSendCallCount += 1;
    return {
      successCount: tokens.length,
      failureCount: 0,
      results: tokens.map(() => ({ success: true })),
      invalidTokens: [],
    };
  }),
  sendPushNotification: jest.fn(async () => ({ success: true })),
}));

// ============================================================
// Supabase mock
// ============================================================

function buildFcmTokensTable(tokens: string[]) {
  return {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    // Allow awaiting: returns token rows
    then: jest.fn((resolve: (v: { data: { token: string }[]; error: null }) => void) => {
      resolve({ data: tokens.map((t) => ({ token: t })), error: null });
    }),
  };
}

function buildMockSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'sos_alerts') {
        return buildSosAlertsTable();
      }
      if (table === 'fcm_tokens') {
        // Return guard tokens for 'guard' role, admin tokens for 'society_admin' role
        return buildFcmTokensTable(['guard-fcm-token-1', 'admin-fcm-token-1']);
      }
      if (table === 'user_profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({
            data: { full_name: 'Test Resident', role: 'flat_owner', is_active: true },
            error: null,
          })),
          // Sub-query for IN — just return ids
          then: jest.fn((resolve: (v: { data: { id: string }[]; error: null }) => void) => {
            resolve({ data: [{ id: RESIDENT_USER_ID }, { id: GUARD_USER_ID }, { id: ADMIN_USER_ID }], error: null });
          }),
        };
      }
      if (table === 'flats') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({
            data: { flat_number: 'A-101' },
            error: null,
          })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
        then: jest.fn((resolve: (v: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null })
        ),
      };
    }),
  };
}

function buildSosAlertsTable() {
  const localFilters: Record<string, unknown> = {};

  return {
    insert: jest.fn((row: Partial<StoredSosAlert>) => {
      const id = `sos-${String(++sosIdCounter).padStart(4, '0')}`;
      const stored: StoredSosAlert = {
        id,
        society_id: row.society_id ?? '',
        flat_id: row.flat_id ?? '',
        resident_id: row.resident_id ?? '',
        message: row.message ?? 'Emergency! Please help.',
        status: row.status ?? 'active',
        resolved_at: null,
        resolved_by: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      sosStore.push(stored);
      return {
        select: jest.fn().mockReturnThis(),
        single: jest.fn(async () => ({
          data: { id: stored.id, status: stored.status, created_at: stored.created_at },
          error: null,
        })),
      };
    }),
    select: jest.fn((_fields?: string) => {
      return buildSosSelectChain(localFilters);
    }),
    update: jest.fn((updates: Partial<StoredSosAlert>) => ({
      eq: jest.fn((col: string, val: unknown) => {
        const idx = sosStore.findIndex((r) => (r as unknown as Record<string, unknown>)[col] === val);
        if (idx >= 0) Object.assign(sosStore[idx] as object, updates);
        return {
          select: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({
            data: idx >= 0 ? { ...sosStore[idx] } : null,
            error: idx >= 0 ? null : { message: 'Not found' },
          })),
        };
      }),
    })),
  };
}

function buildSosSelectChain(outerFilters: Record<string, unknown>) {
  const localFilters: Record<string, unknown> = { ...outerFilters };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hasCount = false; void _hasCount;
  let _rangeStart = 0;
  let _rangeEnd = 19;

  const chain: Record<string, jest.Mock> = {
    eq: jest.fn((col: string, val: unknown) => {
      localFilters[col] = val;
      return chain;
    }),
    in: jest.fn((_col: string, _vals: unknown) => chain),
    order: jest.fn(() => chain),
    range: jest.fn((start: number, end: number) => {
      _rangeStart = start;
      _rangeEnd = end;
      return chain;
    }),
    maybeSingle: jest.fn(async () => {
      const result = sosStore.find((r) =>
        Object.entries(localFilters).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v
        )
      );
      return { data: result ? { ...result } : null, error: null };
    }),
    single: jest.fn(async () => {
      const result = sosStore.find((r) =>
        Object.entries(localFilters).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v
        )
      );
      return { data: result ? { ...result } : null, error: null };
    }),
    then: jest.fn((resolve: (v: { data: StoredSosAlert[]; error: null; count: number }) => void) => {
      const results = sosStore
        .filter((r) =>
          Object.entries(localFilters).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v
          )
        )
        .slice(_rangeStart, _rangeEnd + 1);
      resolve({ data: results.map((r) => ({ ...r })), error: null, count: results.length });
    }),
  };
  return chain;
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
    if (!auth?.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = auth.slice(7);

    switch (token) {
      case 'resident-token':
        req.user = {
          id: RESIDENT_USER_ID,
          role: 'flat_owner',
          society_id: RESIDENT_SOCIETY_ID,
          flat_id: RESIDENT_FLAT_ID,
        };
        break;
      case 'other-resident-token':
        req.user = {
          id: OTHER_RESIDENT_USER_ID,
          role: 'flat_owner',
          society_id: RESIDENT_SOCIETY_ID,
          flat_id: OTHER_FLAT_ID,
        };
        break;
      case 'guard-token':
        req.user = {
          id: GUARD_USER_ID,
          role: 'guard',
          society_id: RESIDENT_SOCIETY_ID,
          flat_id: null,
        };
        break;
      case 'admin-token':
        req.user = {
          id: ADMIN_USER_ID,
          role: 'society_admin',
          society_id: RESIDENT_SOCIETY_ID,
          flat_id: null,
        };
        break;
    }
    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sosRouter = require('../src/routes/sos').default as express.Router;
  app.use('/sos', sosRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Reset between tests
// ============================================================

beforeEach(() => {
  sosStore = [];
  sosIdCounter = 0;
  fcmSentTokens = [];
  fcmSendCallCount = 0;
  fcmShouldThrow = false;
  mockSupabase = buildMockSupabase();
  jest.resetModules();
});

// ============================================================
// POST /sos
// ============================================================

describe('POST /sos', () => {
  it('returns 201 with sos object for a resident', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer resident-token')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.sos).toBeDefined();
    expect(res.body.sos.id).toBeTruthy();
    expect(res.body.sos.status).toBe('active');
    expect(res.body.sos.createdAt).toBeTruthy();
  });

  it('uses custom message when provided', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer resident-token')
      .send({ message: 'Fire in flat!' });

    expect(res.status).toBe(201);
    // Message stored in DB
    const stored = sosStore[0];
    expect(stored?.message).toBe('Fire in flat!');
  });

  it('defaults message to emergency text when no message', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer resident-token')
      .send({});

    expect(res.status).toBe(201);
    const stored = sosStore[0];
    expect(stored?.message).toBe('Emergency! Please help.');
  });

  it('FCM called for guards and admins in society', async () => {
    const app = buildTestApp();
    await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer resident-token')
      .send({});

    // Allow fire-and-forget to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fcmSendCallCount).toBeGreaterThanOrEqual(1);
    expect(fcmSentTokens.length).toBeGreaterThan(0);
  });

  it('FCM failure does NOT prevent 201 response', async () => {
    fcmShouldThrow = true;

    const app = buildTestApp();
    const res = await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer resident-token')
      .send({});

    // 201 must be returned regardless of FCM outcome
    expect(res.status).toBe(201);
    expect(res.body.sos).toBeDefined();
  });

  it('returns 401 when no auth token', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/sos').send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 when guard tries to trigger SOS', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/sos')
      .set('Authorization', 'Bearer guard-token')
      .send({});
    expect(res.status).toBe(403);
  });
});

// ============================================================
// PATCH /sos/:id/resolve
// ============================================================

describe('PATCH /sos/:id/resolve', () => {
  function seedSos(overrides: Partial<StoredSosAlert> = {}): StoredSosAlert {
    const id = `sos-seed-${String(++sosIdCounter).padStart(4, '0')}`;
    const alert: StoredSosAlert = {
      id,
      society_id: RESIDENT_SOCIETY_ID,
      flat_id: RESIDENT_FLAT_ID,
      resident_id: RESIDENT_USER_ID,
      message: 'Emergency! Please help.',
      status: 'active',
      resolved_at: null,
      resolved_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...overrides,
    };
    sosStore.push(alert);
    return alert;
  }

  it('guard can resolve an active SOS — returns 200 with resolved status', async () => {
    const sos = seedSos();
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/sos/${sos.id}/resolve`)
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.sos.status).toBe('resolved');
    expect(res.body.sos.resolvedBy).toBe(GUARD_USER_ID);
    expect(res.body.sos.resolvedAt).toBeTruthy();
  });

  it('society_admin can resolve an active SOS', async () => {
    const sos = seedSos();
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/sos/${sos.id}/resolve`)
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.sos.status).toBe('resolved');
  });

  it('resident cannot resolve SOS — returns 403', async () => {
    const sos = seedSos();
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/sos/${sos.id}/resolve`)
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 if already resolved', async () => {
    const sos = seedSos({ status: 'resolved', resolved_at: nowIso(), resolved_by: GUARD_USER_ID });
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/sos/${sos.id}/resolve`)
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_RESOLVED');
  });

  it('returns 404 for non-existent SOS id', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .patch('/sos/00000000-0000-0000-0000-000000000000/resolve')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(404);
  });
});

// ============================================================
// GET /sos/history
// ============================================================

describe('GET /sos/history', () => {
  function seedSos(flatId: string = RESIDENT_FLAT_ID): StoredSosAlert {
    const id = `sos-hist-${String(++sosIdCounter).padStart(4, '0')}`;
    const alert: StoredSosAlert = {
      id,
      society_id: RESIDENT_SOCIETY_ID,
      flat_id: flatId,
      resident_id: RESIDENT_USER_ID,
      message: 'Emergency! Please help.',
      status: 'active',
      resolved_at: null,
      resolved_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    sosStore.push(alert);
    return alert;
  }

  it('resident sees only own flat alerts', async () => {
    // Seed one for resident flat, one for other flat
    seedSos(RESIDENT_FLAT_ID);
    seedSos(OTHER_FLAT_ID);

    const app = buildTestApp();
    const res = await request(app)
      .get('/sos/history')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(200);
    expect(res.body.alerts).toBeDefined();
    // Only resident's own flat alert
    const alerts = res.body.alerts as Array<{ flatId: string }>;
    expect(alerts.every((a) => a.flatId === RESIDENT_FLAT_ID)).toBe(true);
  });

  it('society_admin sees all alerts for society', async () => {
    seedSos(RESIDENT_FLAT_ID);
    seedSos(OTHER_FLAT_ID);

    const app = buildTestApp();
    const res = await request(app)
      .get('/sos/history')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    // Admin sees all (2 alerts)
    expect(res.body.alerts.length).toBe(2);
  });

  it('supports filtering by status=active', async () => {
    seedSos(RESIDENT_FLAT_ID);
    const resolved = seedSos(RESIDENT_FLAT_ID);
    Object.assign(resolved, { status: 'resolved', resolved_at: nowIso(), resolved_by: GUARD_USER_ID });

    const app = buildTestApp();
    const res = await request(app)
      .get('/sos/history?status=active')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(200);
    const alerts = res.body.alerts as Array<{ status: string }>;
    expect(alerts.every((a) => a.status === 'active')).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/sos/history');
    expect(res.status).toBe(401);
  });
});
