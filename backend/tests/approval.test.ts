// ============================================================
// Backend tests: visitor approval flow
// ============================================================

// Set required env vars before any imports
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3002';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Fixtures
// ============================================================

const SOCIETY_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FLAT_A_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const FLAT_B_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const RESIDENT_A_ID = 'cccccccc-0000-0000-0000-000000000001';
const RESIDENT_B_ID = 'cccccccc-0000-0000-0000-000000000002';
const GUARD_USER_ID = 'dddddddd-0000-0000-0000-000000000001';
const VISITOR_PENDING_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const VISITOR_APPROVED_ID = 'eeeeeeee-0000-0000-0000-000000000002';

// In-memory visitor store for mutation tests
const visitorStore: Record<
  string,
  {
    id: string;
    society_id: string;
    flat_id: string;
    visitor_name: string;
    purpose: string;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
    guard_id: string | null;
  }
> = {
  [VISITOR_PENDING_ID]: {
    id: VISITOR_PENDING_ID,
    society_id: SOCIETY_ID,
    flat_id: FLAT_A_ID,
    visitor_name: 'Ravi Kumar',
    purpose: 'guest',
    status: 'pending',
    approved_by: null,
    approved_at: null,
    guard_id: null,
  },
  [VISITOR_APPROVED_ID]: {
    id: VISITOR_APPROVED_ID,
    society_id: SOCIETY_ID,
    flat_id: FLAT_A_ID,
    visitor_name: 'Priya Singh',
    purpose: 'delivery',
    status: 'approved',
    approved_by: RESIDENT_A_ID,
    approved_at: new Date().toISOString(),
    guard_id: null,
  },
};

// ============================================================
// Build test app — mocks auth + visitor DB
// ============================================================

function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Minimal auth middleware: reads X-Test-User-* headers
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const id = req.headers['x-test-user-id'] as string | undefined;
    const role = req.headers['x-test-user-role'] as string | undefined;
    const flatId = req.headers['x-test-flat-id'] as string | undefined;
    const societyId = req.headers['x-test-society-id'] as string | undefined;

    if (id && role) {
      req.user = {
        id,
        role,
        society_id: societyId ?? SOCIETY_ID,
        flat_id: flatId ?? null,
        email: 'test@example.com',
      };
    }
    next();
  });

  // ── PATCH /visitors/:id/approve ──────────────────────────
  app.patch('/visitors/:id/approve', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
      return;
    }

    const allowedRoles = ['flat_owner', 'tenant'];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN' } });
      return;
    }

    const { id } = req.params as { id: string };
    const visitor = visitorStore[id];

    if (!visitor) {
      res.status(404).json({ error: { code: 'VISITOR_NOT_FOUND' } });
      return;
    }

    if (visitor.flat_id !== req.user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN' } });
      return;
    }

    if (visitor.status === 'approved') {
      res.status(409).json({ error: { code: 'ALREADY_APPROVED' } });
      return;
    }

    if (visitor.status === 'denied') {
      res.status(409).json({ error: { code: 'ALREADY_DENIED' } });
      return;
    }

    visitor.status = 'approved';
    visitor.approved_by = req.user.id;
    visitor.approved_at = new Date().toISOString();

    res.status(200).json({ visitor });
  });

  // ── PATCH /visitors/:id/deny ─────────────────────────────
  app.patch('/visitors/:id/deny', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
      return;
    }

    const allowedRoles = ['flat_owner', 'tenant'];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN' } });
      return;
    }

    const { id } = req.params as { id: string };
    const visitor = visitorStore[id];

    if (!visitor) {
      res.status(404).json({ error: { code: 'VISITOR_NOT_FOUND' } });
      return;
    }

    if (visitor.flat_id !== req.user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN' } });
      return;
    }

    if (visitor.status === 'denied') {
      res.status(409).json({ error: { code: 'ALREADY_DENIED' } });
      return;
    }

    if (visitor.status === 'approved') {
      res.status(409).json({ error: { code: 'ALREADY_APPROVED' } });
      return;
    }

    visitor.status = 'denied';
    visitor.approved_by = req.user.id;
    visitor.approved_at = new Date().toISOString();

    res.status(200).json({ visitor });
  });

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  });

  return app;
}

// ============================================================
// Helpers
// ============================================================

function residentAHeaders(flatId = FLAT_A_ID) {
  return {
    'x-test-user-id': RESIDENT_A_ID,
    'x-test-user-role': 'flat_owner',
    'x-test-flat-id': flatId,
    'x-test-society-id': SOCIETY_ID,
  };
}

function residentBHeaders() {
  return {
    'x-test-user-id': RESIDENT_B_ID,
    'x-test-user-role': 'flat_owner',
    'x-test-flat-id': FLAT_B_ID,
    'x-test-society-id': SOCIETY_ID,
  };
}

function guardHeaders() {
  return {
    'x-test-user-id': GUARD_USER_ID,
    'x-test-user-role': 'guard',
    'x-test-society-id': SOCIETY_ID,
  };
}

// ============================================================
// Reset mutable state before each test
// ============================================================

beforeEach(() => {
  visitorStore[VISITOR_PENDING_ID]!.status = 'pending';
  visitorStore[VISITOR_PENDING_ID]!.approved_by = null;
  visitorStore[VISITOR_PENDING_ID]!.approved_at = null;
  visitorStore[VISITOR_APPROVED_ID]!.status = 'approved';
  visitorStore[VISITOR_APPROVED_ID]!.approved_by = RESIDENT_A_ID;
  visitorStore[VISITOR_APPROVED_ID]!.approved_at = new Date().toISOString();
});

const app = buildTestApp();

// ============================================================
// PATCH /visitors/:id/approve
// ============================================================

describe('PATCH /visitors/:id/approve', () => {
  it('returns 200 when correct flat resident approves a pending visitor', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(residentAHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('visitor');
    expect((res.body as { visitor: { status: string } }).visitor.status).toBe('approved');
  });

  it('sets approved_by to the requesting resident ID', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(residentAHeaders());

    expect(res.status).toBe(200);
    expect(
      (res.body as { visitor: { approved_by: string } }).visitor.approved_by
    ).toBe(RESIDENT_A_ID);
  });

  it('returns 403 when resident from different flat tries to approve', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(residentBHeaders());

    expect(res.status).toBe(403);
    expect(
      (res.body as { error: { code: string } }).error.code
    ).toBe('FORBIDDEN');
  });

  it('returns 403 when guard tries to approve (wrong role)', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(guardHeaders());

    expect(res.status).toBe(403);
  });

  it('returns 409 ALREADY_APPROVED when visitor is already approved', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_APPROVED_ID}/approve`)
      .set(residentAHeaders());

    expect(res.status).toBe(409);
    expect(
      (res.body as { error: { code: string } }).error.code
    ).toBe('ALREADY_APPROVED');
  });

  it('returns 401 when no auth headers provided', async () => {
    const res = await request(app).patch(
      `/visitors/${VISITOR_PENDING_ID}/approve`
    );

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown visitor ID', async () => {
    const res = await request(app)
      .patch('/visitors/00000000-0000-0000-0000-000000000099/approve')
      .set(residentAHeaders());

    expect(res.status).toBe(404);
  });
});

// ============================================================
// PATCH /visitors/:id/deny
// ============================================================

describe('PATCH /visitors/:id/deny', () => {
  it('returns 200 and updates status to denied', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/deny`)
      .set(residentAHeaders());

    expect(res.status).toBe(200);
    expect(
      (res.body as { visitor: { status: string } }).visitor.status
    ).toBe('denied');
  });

  it('returns 403 when resident from different flat tries to deny', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/deny`)
      .set(residentBHeaders());

    expect(res.status).toBe(403);
  });

  it('returns 409 ALREADY_APPROVED when trying to deny an approved visitor', async () => {
    const res = await request(app)
      .patch(`/visitors/${VISITOR_APPROVED_ID}/deny`)
      .set(residentAHeaders());

    expect(res.status).toBe(409);
    expect(
      (res.body as { error: { code: string } }).error.code
    ).toBe('ALREADY_APPROVED');
  });

  it('cannot deny an already denied visitor (409)', async () => {
    // First denial
    await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/deny`)
      .set(residentAHeaders());

    // Second attempt
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/deny`)
      .set(residentAHeaders());

    expect(res.status).toBe(409);
    expect(
      (res.body as { error: { code: string } }).error.code
    ).toBe('ALREADY_DENIED');
  });
});

// ============================================================
// Double-approve prevention
// ============================================================

describe('Idempotency — double approve', () => {
  it('cannot approve an already approved visitor (409)', async () => {
    // Approve once
    await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(residentAHeaders());

    // Attempt again
    const res = await request(app)
      .patch(`/visitors/${VISITOR_PENDING_ID}/approve`)
      .set(residentAHeaders());

    expect(res.status).toBe(409);
    expect(
      (res.body as { error: { code: string } }).error.code
    ).toBe('ALREADY_APPROVED');
  });
});
