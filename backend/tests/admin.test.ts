import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3007';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// Constants
// ============================================================

const SOCIETY_A = 'society-aaa-001';
const SOCIETY_B = 'society-bbb-002';

// ============================================================
// In-memory data stores
// ============================================================

interface StoredFlat {
  id: string;
  society_id: string;
  is_occupied: boolean;
}

interface StoredGuard {
  id: string;
  society_id: string;
  is_active: boolean;
}

interface StoredVisitorLog {
  id: string;
  society_id: string;
  visitor_name: string;
  status: string;
  created_at: string; // ISO string
}

interface StoredSosAlert {
  id: string;
  society_id: string;
  message: string;
  status: string;
  created_at: string;
}

let flats: StoredFlat[] = [];
let guards: StoredGuard[] = [];
let visitorLogs: StoredVisitorLog[] = [];
let sosAlerts: StoredSosAlert[] = [];

// ============================================================
// Helpers
// ============================================================

/** Returns current date as YYYY-MM-DD in IST */
function istToday(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** IST midnight for today as UTC ISO */
function istTodayStartUtc(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + IST_OFFSET_MS);
  const istMidnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );
  return new Date(istMidnight.getTime() - IST_OFFSET_MS).toISOString();
}

// ============================================================
// Build test app (self-contained, no Supabase)
// ============================================================

function buildApp() {
  const app = express();
  app.use(express.json());

  // ── Auth stubs ──────────────────────────────────────────────
  const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Auth required' } });
      return;
    }
    const token = auth.slice(7);
    switch (token) {
      case 'admin-a-token':
        req.user = { id: 'admin-a', role: 'society_admin', society_id: SOCIETY_A, flat_id: null };
        break;
      case 'admin-b-token':
        req.user = { id: 'admin-b', role: 'society_admin', society_id: SOCIETY_B, flat_id: null };
        break;
      case 'resident-token':
        req.user = { id: 'resident-1', role: 'flat_owner', society_id: SOCIETY_A, flat_id: 'flat-1' };
        break;
      default:
        res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Bad token' } });
        return;
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !['society_admin', 'super_admin'].includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin required' } });
      return;
    }
    next();
  };

  // ── GET /admin/stats ─────────────────────────────────────────
  app.get('/admin/stats', authenticate, requireAdmin, (req: Request, res: Response) => {
    const societyId = req.user!.society_id!;
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const todayStart = new Date(
      new Date(istTodayStartUtc()).getTime()
    ).toISOString();
    const todayEnd = new Date(
      new Date(istTodayStartUtc()).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const societyFlats = flats.filter((f) => f.society_id === societyId);
    const occupiedFlats = societyFlats.filter((f) => f.is_occupied);
    const activeGuards = guards.filter((g) => g.society_id === societyId && g.is_active);
    const todayVisitors = visitorLogs.filter((v) => {
      if (v.society_id !== societyId) return false;
      const t = v.created_at;
      return t >= todayStart && t < todayEnd;
    });
    const activeSos = sosAlerts.filter((s) => s.society_id === societyId && s.status === 'active');

    // 7-day trend
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + IST_OFFSET_MS - i * 24 * 60 * 60 * 1000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }

    const visitorTrend = days.map((date) => ({
      date,
      count: visitorLogs.filter((v) => {
        if (v.society_id !== societyId) return false;
        const vDate = new Date(new Date(v.created_at).getTime() + IST_OFFSET_MS);
        const vDay = `${vDate.getUTCFullYear()}-${String(vDate.getUTCMonth() + 1).padStart(2, '0')}-${String(vDate.getUTCDate()).padStart(2, '0')}`;
        return vDay === date;
      }).length,
    }));

    res.status(200).json({
      totalFlats: societyFlats.length,
      occupiedFlats: occupiedFlats.length,
      guardsOnDuty: activeGuards.length,
      visitorsToday: todayVisitors.length,
      activeSos: activeSos.length,
      visitorTrend,
    });
  });

  // ── GET /admin/activity ────────────────────────────────────────
  app.get('/admin/activity', authenticate, requireAdmin, (req: Request, res: Response) => {
    const societyId = req.user!.society_id!;

    const items: Array<{
      type: 'visitor' | 'sos';
      id: string;
      summary: string;
      createdAt: string;
      status: string;
    }> = [];

    visitorLogs
      .filter((v) => v.society_id === societyId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .forEach((v) => {
        items.push({ type: 'visitor', id: v.id, summary: `Visitor: ${v.visitor_name}`, createdAt: v.created_at, status: v.status });
      });

    sosAlerts
      .filter((s) => s.society_id === societyId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .forEach((s) => {
        items.push({ type: 'sos', id: s.id, summary: `SOS: ${s.message}`, createdAt: s.created_at, status: s.status });
      });

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({ activity: items.slice(0, 10) });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  });

  return app;
}

const app = buildApp();

// ============================================================
// Setup & teardown
// ============================================================

beforeEach(() => {
  const todayStart = istTodayStartUtc();
  const todayMid = new Date(new Date(todayStart).getTime() + 6 * 60 * 60 * 1000).toISOString(); // +6h
  const yesterday = new Date(new Date(todayStart).getTime() - 12 * 60 * 60 * 1000).toISOString();

  flats = [
    { id: 'flat-1', society_id: SOCIETY_A, is_occupied: true },
    { id: 'flat-2', society_id: SOCIETY_A, is_occupied: false },
    { id: 'flat-3', society_id: SOCIETY_A, is_occupied: true },
    { id: 'flat-b1', society_id: SOCIETY_B, is_occupied: true },
  ];

  guards = [
    { id: 'guard-1', society_id: SOCIETY_A, is_active: true },
    { id: 'guard-2', society_id: SOCIETY_A, is_active: false },
    { id: 'guard-b1', society_id: SOCIETY_B, is_active: true },
  ];

  visitorLogs = [
    { id: 'vl-1', society_id: SOCIETY_A, visitor_name: 'John', status: 'entered', created_at: todayMid },
    { id: 'vl-2', society_id: SOCIETY_A, visitor_name: 'Jane', status: 'pending', created_at: todayMid },
    { id: 'vl-3', society_id: SOCIETY_A, visitor_name: 'Bob', status: 'approved', created_at: yesterday },
    { id: 'vl-b1', society_id: SOCIETY_B, visitor_name: 'Alice', status: 'entered', created_at: todayMid },
  ];

  sosAlerts = [
    { id: 'sos-1', society_id: SOCIETY_A, message: 'Help!', status: 'active', created_at: todayMid },
    { id: 'sos-2', society_id: SOCIETY_A, message: 'Fire!', status: 'resolved', created_at: yesterday },
    { id: 'sos-b1', society_id: SOCIETY_B, message: 'B-SOS', status: 'active', created_at: todayMid },
  ];
});

// ============================================================
// Tests: GET /admin/stats
// ============================================================

describe('GET /admin/stats', () => {
  it('returns correct shape with numeric KPIs', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalFlats: expect.any(Number),
      occupiedFlats: expect.any(Number),
      guardsOnDuty: expect.any(Number),
      visitorsToday: expect.any(Number),
      activeSos: expect.any(Number),
      visitorTrend: expect.any(Array),
    });
  });

  it('scopes flats, guards, visitors, SOS to the admin society', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    // SOCIETY_A has 3 flats, 2 occupied, 1 active guard, 1 active SOS
    expect(res.body.totalFlats).toBe(3);
    expect(res.body.occupiedFlats).toBe(2);
    expect(res.body.guardsOnDuty).toBe(1);
    expect(res.body.activeSos).toBe(1);
    // 2 visitor logs today for SOCIETY_A
    expect(res.body.visitorsToday).toBe(2);
  });

  it('visitor count is scoped to today (IST) — yesterday does not count', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    // Only 2 of 3 SOCIETY_A visitors are from today
    expect(res.body.visitorsToday).toBe(2);
  });

  it('admin from different society gets their own data, not Society A data', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-b-token');

    expect(res.status).toBe(200);
    expect(res.body.totalFlats).toBe(1);
    expect(res.body.guardsOnDuty).toBe(1);
    expect(res.body.activeSos).toBe(1);
    expect(res.body.visitorsToday).toBe(1);
  });

  it('returns 403 when non-admin role is used', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/admin/stats');
    expect(res.status).toBe(401);
  });

  it('visitorTrend is an array of 7 items with date and count keys', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    const trend = res.body.visitorTrend as Array<{ date: string; count: number }>;
    expect(trend).toHaveLength(7);
    for (const entry of trend) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('count');
      expect(typeof entry.count).toBe('number');
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('visitorTrend today entry matches visitorsToday count', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    const today = istToday();
    const trend = res.body.visitorTrend as Array<{ date: string; count: number }>;
    const todayEntry = trend.find((t) => t.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.count).toBe(res.body.visitorsToday);
  });
});

// ============================================================
// Tests: GET /admin/activity
// ============================================================

describe('GET /admin/activity', () => {
  it('returns activity array with at most 10 items', async () => {
    const res = await request(app)
      .get('/admin/activity')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activity');
    expect(Array.isArray(res.body.activity)).toBe(true);
    expect(res.body.activity.length).toBeLessThanOrEqual(10);
  });

  it('each activity item has required shape', async () => {
    const res = await request(app)
      .get('/admin/activity')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    for (const item of res.body.activity as Array<{
      type: string; id: string; summary: string; createdAt: string; status: string;
    }>) {
      expect(['visitor', 'sos']).toContain(item.type);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('summary');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('status');
    }
  });

  it('activity items are scoped to admin society only', async () => {
    const res = await request(app)
      .get('/admin/activity')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    // All summaries should NOT contain SOCIETY_B names
    const summaries = (res.body.activity as Array<{ summary: string }>).map((i) => i.summary);
    expect(summaries).not.toContain(expect.stringContaining('Alice'));
    expect(summaries).not.toContain(expect.stringContaining('B-SOS'));
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/admin/activity')
      .set('Authorization', 'Bearer resident-token');

    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/admin/activity');
    expect(res.status).toBe(401);
  });

  it('activity is sorted by createdAt descending', async () => {
    const res = await request(app)
      .get('/admin/activity')
      .set('Authorization', 'Bearer admin-a-token');

    expect(res.status).toBe(200);
    const items = res.body.activity as Array<{ createdAt: string }>;
    for (let i = 0; i < items.length - 1; i++) {
      const curr = new Date(items[i].createdAt).getTime();
      const next = new Date(items[i + 1].createdAt).getTime();
      expect(curr).toBeGreaterThanOrEqual(next);
    }
  });
});
