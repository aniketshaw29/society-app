import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3011';
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
  authenticate: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Auth required' } }); return; }
    next();
  },
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

const ADMIN_USER_ID = 'admin-user-notices-001';
const ADMIN_SOCIETY_ID = 'society-notices-aaa';

const OTHER_ADMIN_USER_ID = 'admin-user-notices-002';
const OTHER_SOCIETY_ID = 'society-notices-bbb';

const RESIDENT_USER_ID = 'resident-user-notices-001';

// ============================================================
// In-memory store
// ============================================================

interface StoredNotice {
  id: string;
  society_id: string;
  created_by: string;
  title: string;
  body: string;
  audience: string;
  notice_type: string;
  is_pinned: boolean;
  status: 'draft' | 'published' | 'archived';
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

let noticesStore: StoredNotice[] = [];
let noticeIdCounter = 0;
let fcmCallCount = 0;
let fcmSentTokens: string[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(minutes = 60): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// ============================================================
// FCM mock
// ============================================================

jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async (tokens: string[]) => {
    fcmCallCount += 1;
    fcmSentTokens = [...fcmSentTokens, ...tokens];
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

function buildUserProfilesSubquery(_societyId: string) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: { data: { id: string }[]; error: null }) => void) => {
      resolve({
        data: [{ id: ADMIN_USER_ID }, { id: RESIDENT_USER_ID }],
        error: null,
      });
    }),
  };
}

function buildFcmTokensTable() {
  return {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: { data: { token: string }[]; error: null }) => void) => {
      resolve({ data: [{ token: 'test-fcm-token-1' }, { token: 'test-fcm-token-2' }], error: null });
    }),
  };
}

function buildNoticesTable() {
  const applyFilters = (store: StoredNotice[], filters: Record<string, unknown>): StoredNotice[] =>
    store.filter((r) =>
      Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
    );

  return {
    insert: jest.fn((row: Partial<StoredNotice>) => {
      const id = `notice-${String(++noticeIdCounter).padStart(4, '0')}`;
      const stored: StoredNotice = {
        id,
        society_id: row.society_id ?? '',
        created_by: row.created_by ?? '',
        title: row.title ?? '',
        body: row.body ?? '',
        audience: row.audience ?? 'all',
        notice_type: row.notice_type ?? 'general',
        is_pinned: row.is_pinned ?? false,
        status: (row.status ?? 'published') as StoredNotice['status'],
        scheduled_at: row.scheduled_at ?? null,
        published_at: row.published_at ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      noticesStore.push(stored);
      return {
        select: jest.fn().mockReturnThis(),
        single: jest.fn(async () => ({ data: { ...stored }, error: null })),
      };
    }),

    select: jest.fn((_fields?: string, _opts?: unknown) => {
      const filters: Record<string, unknown> = {};
      let rangeStart = 0;
      let rangeEnd = 19;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        eq: jest.fn((col: string, val: unknown) => { filters[col] = val; return chain; }),
        order: jest.fn(() => chain),
        range: jest.fn((s: number, e: number) => { rangeStart = s; rangeEnd = e; return chain; }),
        lte: jest.fn((_col: string, _val: unknown) => chain),
        gte: jest.fn((_col: string, _val: unknown) => chain),
        maybeSingle: jest.fn(async () => {
          const r = applyFilters(noticesStore, filters)[0] ?? null;
          return { data: r ? { ...r } : null, error: null };
        }),
        single: jest.fn(async () => {
          const r = applyFilters(noticesStore, filters)[0] ?? null;
          return { data: r ? { ...r } : null, error: null };
        }),
        then: jest.fn((resolve: (v: { data: StoredNotice[]; error: null; count: number }) => void) => {
          const results = applyFilters(noticesStore, filters).slice(rangeStart, rangeEnd + 1);
          resolve({ data: results.map((r) => ({ ...r })), error: null, count: results.length });
        }),
      };
      return chain;
    }),

    update: jest.fn((updates: Partial<StoredNotice>) => {
      const filters: Record<string, unknown> = {};
      return {
        eq: jest.fn((col: string, val: unknown) => {
          filters[col] = val;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn(async () => {
              const idx = noticesStore.findIndex((r) =>
                Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
              );
              if (idx >= 0) Object.assign(noticesStore[idx] as object, updates);
              return { data: idx >= 0 ? { ...noticesStore[idx] } : null, error: null };
            }),
            // For archive (no select/single chained)
            then: jest.fn((resolve: (v: { error: null }) => void) => {
              const idx = noticesStore.findIndex((r) =>
                Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
              );
              if (idx >= 0) Object.assign(noticesStore[idx] as object, updates);
              resolve({ error: null });
            }),
          };
        }),
      };
    }),
  };
}

function buildMockSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'notices') return buildNoticesTable();
      if (table === 'fcm_tokens') return buildFcmTokensTable();
      if (table === 'user_profiles') return buildUserProfilesSubquery(ADMIN_SOCIETY_ID);
      if (table === 'flats') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: jest.fn((resolve: (v: { data: { id: string }[]; error: null }) => void) => {
            resolve({ data: [{ id: 'flat-001' }], error: null });
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
        then: jest.fn((resolve: (v: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null })
        ),
      };
    }),
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

  // Auth stub — maps token → user
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
        req.user = { id: RESIDENT_USER_ID, role: 'flat_owner', society_id: ADMIN_SOCIETY_ID, flat_id: 'flat-001' };
        break;
    }
    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const noticesRouter = require('../src/routes/notices').default as express.Router;
  app.use('/notices', noticesRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Reset between tests
// ============================================================

beforeEach(() => {
  noticesStore = [];
  noticeIdCounter = 0;
  fcmCallCount = 0;
  fcmSentTokens = [];
  mockSupabase = buildMockSupabase();
  jest.resetModules();
});

// ============================================================
// POST /notices
// ============================================================

describe('POST /notices', () => {
  it('creates a published notice and calls FCM for audience=all', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/notices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'Community Meeting',
        body: 'Monthly meeting on Saturday',
        audience: 'all',
        noticeType: 'general',
      });

    expect(res.status).toBe(201);
    expect(res.body.notice).toBeDefined();
    expect(res.body.notice.status).toBe('published');
    expect(res.body.notice.publishedAt).toBeTruthy();

    // Allow fire-and-forget to settle
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fcmCallCount).toBeGreaterThanOrEqual(1);
    expect(fcmSentTokens.length).toBeGreaterThan(0);
  });

  it('creates a draft notice when scheduledAt is in the future — no FCM', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/notices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'Maintenance Notice',
        body: 'Water supply off tomorrow',
        audience: 'all',
        noticeType: 'maintenance',
        scheduledAt: futureIso(120),
      });

    expect(res.status).toBe(201);
    expect(res.body.notice.status).toBe('draft');
    expect(res.body.notice.publishedAt).toBeNull();

    // Give fire-and-forget a moment — must NOT have fired FCM
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fcmCallCount).toBe(0);
  });

  it('returns 403 for non-admin role', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/notices')
      .set('Authorization', 'Bearer resident-token')
      .send({
        title: 'Test',
        body: 'Test body',
        audience: 'all',
        noticeType: 'general',
      });

    expect(res.status).toBe(403);
    expect(fcmCallCount).toBe(0);
  });

  it('returns 422 for missing required fields', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/notices')
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Only title' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates notice with isPinned=true', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/notices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'Pinned Notice',
        body: 'Important update',
        audience: 'all',
        noticeType: 'urgent',
        isPinned: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.notice.isPinned).toBe(true);
  });
});

// ============================================================
// PATCH /notices/:id
// ============================================================

describe('PATCH /notices/:id', () => {
  function seedNotice(overrides: Partial<StoredNotice> = {}): StoredNotice {
    const id = `notice-seed-${String(++noticeIdCounter).padStart(4, '0')}`;
    const n: StoredNotice = {
      id,
      society_id: ADMIN_SOCIETY_ID,
      created_by: ADMIN_USER_ID,
      title: 'Original Title',
      body: 'Original body',
      audience: 'all',
      notice_type: 'general',
      is_pinned: false,
      status: 'published',
      scheduled_at: null,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...overrides,
    };
    noticesStore.push(n);
    return n;
  }

  it('admin can update title and body', async () => {
    const notice = seedNotice();
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/notices/${notice.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Updated Title', body: 'Updated body' });

    expect(res.status).toBe(200);
    expect(res.body.notice.title).toBe('Updated Title');
  });

  it('admin from different society gets 403', async () => {
    const notice = seedNotice(); // belongs to ADMIN_SOCIETY_ID
    const app = buildTestApp();

    // other-admin-token has OTHER_SOCIETY_ID
    const res = await request(app)
      .patch(`/notices/${notice.id}`)
      .set('Authorization', 'Bearer other-admin-token')
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when trying to edit an archived notice', async () => {
    const notice = seedNotice({ status: 'archived' });
    const app = buildTestApp();

    const res = await request(app)
      .patch(`/notices/${notice.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Should not work' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOTICE_ARCHIVED');
  });

  it('returns 404 for non-existent notice', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .patch('/notices/00000000-0000-0000-0000-000000000000')
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ============================================================
// DELETE /notices/:id (archive)
// ============================================================

describe('DELETE /notices/:id', () => {
  function seedNotice(overrides: Partial<StoredNotice> = {}): StoredNotice {
    const id = `notice-del-${String(++noticeIdCounter).padStart(4, '0')}`;
    const n: StoredNotice = {
      id,
      society_id: ADMIN_SOCIETY_ID,
      created_by: ADMIN_USER_ID,
      title: 'To Archive',
      body: 'body',
      audience: 'all',
      notice_type: 'general',
      is_pinned: false,
      status: 'published',
      scheduled_at: null,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...overrides,
    };
    noticesStore.push(n);
    return n;
  }

  it('soft-deletes notice returning 204', async () => {
    const notice = seedNotice();
    const app = buildTestApp();

    const res = await request(app)
      .delete(`/notices/${notice.id}`)
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(204);
    expect(noticesStore.find((n) => n.id === notice.id)?.status).toBe('archived');
  });

  it('non-admin cannot archive — returns 403', async () => {
    const notice = seedNotice();
    const app = buildTestApp();

    const res = await request(app)
      .delete(`/notices/${notice.id}`)
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(403);
  });
});

// ============================================================
// GET /notices
// ============================================================

describe('GET /notices', () => {
  it('returns published notices for the society', async () => {
    noticesStore.push({
      id: 'n-pub-1',
      society_id: ADMIN_SOCIETY_ID,
      created_by: ADMIN_USER_ID,
      title: 'Published',
      body: 'body',
      audience: 'all',
      notice_type: 'general',
      is_pinned: false,
      status: 'published',
      scheduled_at: null,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    const app = buildTestApp();
    const res = await request(app)
      .get('/notices')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(200);
    expect(res.body.notices).toBeDefined();
    expect(Array.isArray(res.body.notices)).toBe(true);
  });

  it('returns 403 without auth', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/notices');
    expect(res.status).toBe(401);
  });
});
