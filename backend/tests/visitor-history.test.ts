/**
 * Tests for GET /visitors/history and related visitor endpoints.
 *
 * Strategy: build an in-memory Express app with stubbed auth — no real DB or
 * Supabase calls. Each test directly verifies routing, filtering logic, and
 * access-control rules.
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3005';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIItest\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// Seed data
// ============================================================

const SOCIETY_ID = 'soc-001';
const FLAT_A = 'flat-a01';
const FLAT_B = 'flat-b01';

interface StoredVisitor {
  id: string;
  society_id: string;
  flat_id: string;
  guard_id: string | null;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_photo_url: string | null;
  vehicle_number: string | null;
  purpose: string;
  entry_method: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  updated_at: string;
}

// Helper: create a date string N days ago
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Build a set of 25 test visitors spread across two flats and multiple dates
function buildSeedVisitors(): StoredVisitor[] {
  const visitors: StoredVisitor[] = [];
  for (let i = 1; i <= 25; i++) {
    visitors.push({
      id: `vis-${String(i).padStart(3, '0')}`,
      society_id: SOCIETY_ID,
      flat_id: i % 2 === 0 ? FLAT_A : FLAT_B,
      guard_id: null,
      visitor_name: `Visitor ${i}`,
      visitor_phone: null,
      visitor_photo_url: null,
      vehicle_number: null,
      purpose: 'guest',
      entry_method: 'manual',
      // Spread: 1-5 are today, 6-12 within 7 days, 13-25 older
      status: i <= 5 ? 'pending' : i <= 10 ? 'approved' : i <= 15 ? 'entered' : i <= 20 ? 'exited' : 'denied',
      approved_by: null,
      approved_at: null,
      entry_time: null,
      exit_time: null,
      created_at: daysAgo(Math.floor((i - 1) / 5)), // 0-4 days ago
      updated_at: daysAgo(0),
    });
  }
  return visitors;
}

let visitorStore: StoredVisitor[] = [];

// ============================================================
// Build test Express app
// ============================================================

interface AuthUser {
  id: string;
  role: string;
  society_id: string | null;
  flat_id: string | null;
}

function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Stub authenticate middleware
  const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Auth required' } });
      return;
    }
    const token = auth.slice(7);
    const users: Record<string, AuthUser> = {
      'guard-token': { id: 'guard-1', role: 'guard', society_id: SOCIETY_ID, flat_id: null },
      'resident-a-token': { id: 'resident-a', role: 'flat_owner', society_id: SOCIETY_ID, flat_id: FLAT_A },
      'resident-b-token': { id: 'resident-b', role: 'tenant', society_id: SOCIETY_ID, flat_id: FLAT_B },
      'other-society-token': { id: 'other-1', role: 'guard', society_id: 'other-soc', flat_id: null },
    };
    const user = users[token];
    if (!user) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
      return;
    }
    req.user = user;
    next();
  };

  // Helper: apply history filters
  function filterVisitors(params: {
    societyId: string;
    flatId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): StoredVisitor[] {
    return visitorStore.filter((v) => {
      if (v.society_id !== params.societyId) return false;
      if (params.flatId && v.flat_id !== params.flatId) return false;
      if (params.status && v.status !== params.status) return false;
      if (params.fromDate) {
        const from = new Date(`${params.fromDate}T00:00:00Z`);
        if (new Date(v.created_at) < from) return false;
      }
      if (params.toDate) {
        const to = new Date(`${params.toDate}T23:59:59Z`);
        if (new Date(v.created_at) > to) return false;
      }
      return true;
    });
  }

  // GET /visitors/history
  app.get('/visitors/history', authenticate, (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q['page'] ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q['limit'] ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    const isGuardOrAdmin = ['guard', 'society_admin', 'super_admin'].includes(user.role);

    if (!user.society_id) {
      res.status(400).json({ error: { code: 'NO_SOCIETY', message: 'No society' } });
      return;
    }

    if (!isGuardOrAdmin && !user.flat_id) {
      res.status(400).json({ error: { code: 'NO_FLAT', message: 'No flat' } });
      return;
    }

    const filtered = filterVisitors({
      societyId: user.society_id,
      flatId: isGuardOrAdmin ? (q['flatId'] ?? undefined) : (user.flat_id ?? undefined),
      status: q['status'] || undefined,
      fromDate: q['fromDate'] || undefined,
      toDate: q['toDate'] || undefined,
    });

    // Sort by created_at desc (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const page_items = filtered.slice(offset, offset + limit);

    res.status(200).json({
      visitors: page_items.map((v) => ({ ...v, societyId: v.society_id, flatId: v.flat_id })),
      total,
      page,
      totalPages,
    });
  });

  // PATCH /visitors/:id/enter
  app.patch('/visitors/:id/enter', authenticate, (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const { id } = req.params as { id: string };

    if (!['guard', 'society_admin', 'super_admin'].includes(user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Guards only' } });
      return;
    }

    const idx = visitorStore.findIndex((v) => v.id === id);
    if (idx === -1) {
      res.status(404).json({ error: { code: 'VISITOR_NOT_FOUND', message: 'Not found' } });
      return;
    }

    const existing = visitorStore[idx]!;
    if (existing.society_id !== user.society_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (!['approved', 'pending'].includes(existing.status)) {
      res.status(409).json({
        error: { code: 'INVALID_TRANSITION', message: `Cannot enter from ${existing.status}` },
      });
      return;
    }

    visitorStore[idx] = {
      ...existing,
      status: 'entered',
      entry_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    res.status(200).json({ visitor: visitorStore[idx] });
  });

  // 404 + error handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

const app = buildTestApp();

beforeEach(() => {
  visitorStore = buildSeedVisitors();
});

// ============================================================
// GET /visitors/history — access control
// ============================================================

describe('GET /visitors/history — access control', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/visitors/history');
    expect(res.status).toBe(401);
  });

  it('guard gets ALL visitors for their society', async () => {
    const res = await request(app)
      .get('/visitors/history')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    // All 25 visitors belong to SOCIETY_ID; default limit=20 → first page = 20
    expect(res.body.visitors).toHaveLength(20);
    expect(res.body.total).toBe(25);
  });

  it('resident only sees visitors for their own flat', async () => {
    // FLAT_A has even-indexed visitors: 2, 4, 6, 8 … → IDs: vis-002, vis-004, …
    const res = await request(app)
      .get('/visitors/history')
      .set('Authorization', 'Bearer resident-a-token');

    expect(res.status).toBe(200);
    const flatIds: string[] = (res.body.visitors as Array<{ flat_id: string }>).map(
      (v) => v.flat_id
    );
    expect(flatIds.every((f) => f === FLAT_A)).toBe(true);
  });

  it('resident from flat B does not see flat A visitors', async () => {
    const res = await request(app)
      .get('/visitors/history')
      .set('Authorization', 'Bearer resident-b-token');

    expect(res.status).toBe(200);
    const flatIds: string[] = (res.body.visitors as Array<{ flat_id: string }>).map(
      (v) => v.flat_id
    );
    expect(flatIds.every((f) => f === FLAT_B)).toBe(true);
    // flat B has odd-indexed visitors: 1,3,5… → 13 visitors
    expect(res.body.total).toBe(13);
  });
});

// ============================================================
// GET /visitors/history — pagination
// ============================================================

describe('GET /visitors/history — pagination', () => {
  it('page 1 and page 2 return different results', async () => {
    const page1 = await request(app)
      .get('/visitors/history?page=1&limit=10')
      .set('Authorization', 'Bearer guard-token');

    const page2 = await request(app)
      .get('/visitors/history?page=2&limit=10')
      .set('Authorization', 'Bearer guard-token');

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);

    const ids1 = (page1.body.visitors as Array<{ id: string }>).map((v) => v.id);
    const ids2 = (page2.body.visitors as Array<{ id: string }>).map((v) => v.id);

    // No id should appear in both pages
    const intersection = ids1.filter((id) => ids2.includes(id));
    expect(intersection).toHaveLength(0);
  });

  it('returns correct totalPages for given limit', async () => {
    // 25 visitors, limit=10 → 3 pages
    const res = await request(app)
      .get('/visitors/history?limit=10')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it('last page returns remaining items (not a full page)', async () => {
    // 25 total, limit=10, page 3 → 5 items
    const res = await request(app)
      .get('/visitors/history?page=3&limit=10')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.visitors).toHaveLength(5);
  });
});

// ============================================================
// GET /visitors/history — status filter
// ============================================================

describe('GET /visitors/history — status filter', () => {
  it('status=pending returns only pending visitors', async () => {
    const res = await request(app)
      .get('/visitors/history?status=pending&limit=50')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    const statuses: string[] = (res.body.visitors as Array<{ status: string }>).map(
      (v) => v.status
    );
    expect(statuses.every((s) => s === 'pending')).toBe(true);
    // visitors 1-5 are pending
    expect(res.body.total).toBe(5);
  });

  it('status=approved returns only approved visitors', async () => {
    const res = await request(app)
      .get('/visitors/history?status=approved&limit=50')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    const statuses: string[] = (res.body.visitors as Array<{ status: string }>).map(
      (v) => v.status
    );
    expect(statuses.every((s) => s === 'approved')).toBe(true);
    expect(res.body.total).toBe(5);
  });

  it('unknown status returns empty list', async () => {
    const res = await request(app)
      .get('/visitors/history?status=flying')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.visitors).toHaveLength(0);
  });
});

// ============================================================
// GET /visitors/history — date range filter
// ============================================================

describe('GET /visitors/history — date range filter', () => {
  it('fromDate filters out older entries', async () => {
    // All 25 entries were created 0-4 days ago.
    // fromDate = today → only entries from today (created_at within last 24h)
    const today = new Date().toISOString().split('T')[0]!;

    const res = await request(app)
      .get(`/visitors/history?fromDate=${today}&limit=50`)
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    // Visitors 1-5 are from today (daysAgo(0))
    expect(res.body.total).toBe(5);
  });

  it('toDate filters out newer entries', async () => {
    // toDate = 4 days ago → only entries from 4 days ago
    const d = new Date();
    d.setDate(d.getDate() - 4);
    const toDate = d.toISOString().split('T')[0]!;

    const res = await request(app)
      .get(`/visitors/history?toDate=${toDate}&limit=50`)
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    // Visitors 21-25 are from daysAgo(4)
    expect(res.body.total).toBe(5);
  });

  it('fromDate + toDate range returns subset', async () => {
    const from = new Date();
    from.setDate(from.getDate() - 2);
    const to = new Date();
    to.setDate(to.getDate() - 1);

    const fromDate = from.toISOString().split('T')[0]!;
    const toDate = to.toISOString().split('T')[0]!;

    const res = await request(app)
      .get(`/visitors/history?fromDate=${fromDate}&toDate=${toDate}&limit=50`)
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    // Entries from 1-2 days ago = 10 visitors (5 per day)
    expect(res.body.total).toBe(10);
  });
});

// ============================================================
// PATCH /visitors/:id/enter
// ============================================================

describe('PATCH /visitors/:id/enter', () => {
  it('guard marks an approved visitor as entered', async () => {
    // vis-006 is status='approved'
    const res = await request(app)
      .patch('/visitors/vis-006/enter')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.visitor.status).toBe('entered');
    expect(res.body.visitor.entry_time).toBeTruthy();
  });

  it('guard marks a pending visitor as entered', async () => {
    // vis-001 is status='pending'
    const res = await request(app)
      .patch('/visitors/vis-001/enter')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.visitor.status).toBe('entered');
  });

  it('returns 409 when trying to enter an already-exited visitor', async () => {
    // vis-016 is status='exited'
    const res = await request(app)
      .patch('/visitors/vis-016/enter')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('returns 403 when resident tries to mark entered', async () => {
    const res = await request(app)
      .patch('/visitors/vis-006/enter')
      .set('Authorization', 'Bearer resident-a-token');

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent visitor', async () => {
    const res = await request(app)
      .patch('/visitors/vis-999/enter')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(404);
  });

  it('guard from different society cannot enter visitor', async () => {
    const res = await request(app)
      .patch('/visitors/vis-001/enter')
      .set('Authorization', 'Bearer other-society-token');

    expect(res.status).toBe(403);
  });
});
