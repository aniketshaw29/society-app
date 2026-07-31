import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3010';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ── constants ────────────────────────────────────────────────────────────────
const VALID_USER_ID = 'user-auth-test-001';
const SOCIETY_ID    = 'society-auth-aaa';
const FLAT_ID       = 'flat-auth-001';

// ── mutable mock state ───────────────────────────────────────────────────────
const mockState = {
  getUserResult: {
    data: { user: { id: VALID_USER_ID, email: 'test@example.com' } as { id: string; email: string } | null },
    error: null as { message: string } | null,
  },
  profileRow: null as null | {
    id: string; role: string; society_id: string | null;
    flat_id: string | null; is_active: boolean;
  },
};

// Reset before every test
beforeEach(() => {
  mockState.getUserResult = {
    data: { user: { id: VALID_USER_ID, email: 'test@example.com' } },
    error: null,
  };
  mockState.profileRow = {
    id: VALID_USER_ID, role: 'flat_owner',
    society_id: SOCIETY_ID, flat_id: FLAT_ID, is_active: true,
  };
});

// ── mocks ────────────────────────────────────────────────────────────────────
jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async () => ({ successCount: 0, failureCount: 0, invalidTokens: [] })),
  sendPushNotification: jest.fn(async () => ({ success: true })),
}));

jest.mock('../src/lib/supabaseAdmin', () => ({
  // Use a getter so reads happen at call-time, not module-load-time
  get supabaseAdmin() {
    const singleFn = jest.fn(async () => {
      if (!mockState.profileRow) {
        return { data: null, error: { message: 'not found' } };
      }
      return { data: mockState.profileRow, error: null };
    });
    return {
      auth: {
        getUser: jest.fn(async () => mockState.getUserResult),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: singleFn,
      })),
    };
  },
}));

// ── helpers ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticate, requireRole } = require('../src/middleware/auth') as typeof import('../src/middleware/auth');

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected',
    (req: Request, res: Response, next: NextFunction) => { void authenticate(req, res, next); },
    (_req: Request, res: Response) => { res.json({ user: _req.user }); }
  );

  app.get('/admin-only',
    (req: Request, res: Response, next: NextFunction) => { void authenticate(req, res, next); },
    requireRole('society_admin'),
    (_req: Request, res: Response) => { res.json({ message: 'Welcome, admin' }); }
  );

  app.get('/guard-or-admin',
    (req: Request, res: Response, next: NextFunction) => { void authenticate(req, res, next); },
    requireRole('guard', 'society_admin'),
    (_req: Request, res: Response) => { res.json({ message: 'Welcome, guard or admin' }); }
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'internal' } });
  });

  return app;
}

const app = buildApp();

// ── authenticate middleware ───────────────────────────────────────────────────
describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when Bearer token is invalid', async () => {
    mockState.getUserResult = { data: { user: null }, error: { message: 'JWT invalid' } };
    const res = await request(app).get('/protected').set('Authorization', 'Bearer bad');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when Supabase returns no error but user is null', async () => {
    mockState.getUserResult = { data: { user: null }, error: null };
    const res = await request(app).get('/protected').set('Authorization', 'Bearer expired');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('populates req.user correctly for a valid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(VALID_USER_ID);
    expect(res.body.user.role).toBe('flat_owner');
    expect(res.body.user.society_id).toBe(SOCIETY_ID);
  });

  it('allows through with minimal context when no profile row', async () => {
    mockState.profileRow = null;
    const res = await request(app).get('/protected').set('Authorization', 'Bearer new-user');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(VALID_USER_ID);
  });

  it('returns 403 when account is deactivated', async () => {
    mockState.profileRow = {
      id: VALID_USER_ID, role: 'flat_owner',
      society_id: SOCIETY_ID, flat_id: FLAT_ID, is_active: false,
    };
    const res = await request(app).get('/protected').set('Authorization', 'Bearer disabled');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

// ── requireRole middleware ────────────────────────────────────────────────────
describe('requireRole middleware', () => {
  it('allows access when user has the correct role', async () => {
    mockState.profileRow = { id: VALID_USER_ID, role: 'society_admin', society_id: SOCIETY_ID, flat_id: null, is_active: true };
    const res = await request(app).get('/admin-only').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });

  it('returns 403 when user role does not match', async () => {
    const res = await request(app).get('/admin-only').set('Authorization', 'Bearer resident');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows access for one of multiple accepted roles (guard)', async () => {
    mockState.profileRow = { id: VALID_USER_ID, role: 'guard', society_id: SOCIETY_ID, flat_id: null, is_active: true };
    const res = await request(app).get('/guard-or-admin').set('Authorization', 'Bearer guard');
    expect(res.status).toBe(200);
  });

  it('allows access for one of multiple accepted roles (society_admin)', async () => {
    mockState.profileRow = { id: VALID_USER_ID, role: 'society_admin', society_id: SOCIETY_ID, flat_id: null, is_active: true };
    const res = await request(app).get('/guard-or-admin').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });

  it('returns 403 when role is flat_owner but route requires guard or admin', async () => {
    const res = await request(app).get('/guard-or-admin').set('Authorization', 'Bearer resident');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('guard');
  });

  it('returns 401 when requireRole called without prior authentication', async () => {
    const bareApp = express();
    bareApp.use(express.json());
    bareApp.get('/no-auth', requireRole('society_admin'), (_req: Request, res: Response) => {
      res.json({ message: 'ok' });
    });
    const res = await request(bareApp).get('/no-auth');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
