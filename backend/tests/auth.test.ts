import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

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

// ============================================================
// Constants
// ============================================================

const VALID_USER_ID = 'user-auth-test-001';
const SOCIETY_ID = 'society-auth-aaa';
const FLAT_ID = 'flat-auth-001';

// ============================================================
// Supabase mock state
// ============================================================

interface MockUserProfileRow {
  id: string;
  role: string;
  society_id: string | null;
  flat_id: string | null;
  is_active: boolean;
}

// Control what supabaseAdmin returns for each test
let mockGetUserResult: { data: { user: { id: string; email?: string } | null }; error: { message: string } | null } = {
  data: { user: { id: VALID_USER_ID, email: 'test@example.com' } },
  error: null,
};

let mockProfileRow: MockUserProfileRow | null = {
  id: VALID_USER_ID,
  role: 'flat_owner',
  society_id: SOCIETY_ID,
  flat_id: FLAT_ID,
  is_active: true,
};

jest.mock('../src/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return {
      auth: {
        getUser: jest.fn(async () => mockGetUserResult),
      },
      from: jest.fn((_table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(async () => {
          if (!mockProfileRow) {
            return { data: null, error: { message: 'No profile found' } };
          }
          return { data: mockProfileRow, error: null };
        }),
      })),
    };
  },
}));

jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async () => ({ successCount: 0, failureCount: 0, invalidTokens: [] })),
  sendPushNotification: jest.fn(async () => ({ success: true })),
}));

// ============================================================
// Build test app using real authenticate + requireRole middleware
// ============================================================

function buildAuthApp() {
  // Reset modules so each test gets fresh middleware with the current mock state
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authenticate, requireRole } = require('../src/middleware/auth') as typeof import('../src/middleware/auth');

  const app = express();
  app.use(express.json());

  // Protected route: just needs authentication
  app.get(
    '/protected',
    (req: Request, res: Response, next: NextFunction) => {
      void authenticate(req, res, next);
    },
    (req: Request, res: Response) => {
      res.status(200).json({ user: req.user });
    },
  );

  // Role-gated route: only society_admin allowed
  app.get(
    '/admin-only',
    (req: Request, res: Response, next: NextFunction) => {
      void authenticate(req, res, next);
    },
    requireRole('society_admin'),
    (_req: Request, res: Response) => {
      res.status(200).json({ message: 'Welcome, admin' });
    },
  );

  // Multi-role route: guard or society_admin allowed
  app.get(
    '/guard-or-admin',
    (req: Request, res: Response, next: NextFunction) => {
      void authenticate(req, res, next);
    },
    requireRole('guard', 'society_admin'),
    (_req: Request, res: Response) => {
      res.status(200).json({ message: 'Welcome, guard or admin' });
    },
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Reset mock state before each test
// ============================================================

beforeEach(() => {
  jest.resetModules();
  mockGetUserResult = {
    data: { user: { id: VALID_USER_ID, email: 'test@example.com' } },
    error: null,
  };
  mockProfileRow = {
    id: VALID_USER_ID,
    role: 'flat_owner',
    society_id: SOCIETY_ID,
    flat_id: FLAT_ID,
    is_active: true,
  };
});

// ============================================================
// authenticate middleware
// ============================================================

describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const app = buildAuthApp();
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic sometoken');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when Bearer token is invalid (Supabase rejects it)', async () => {
    mockGetUserResult = {
      data: { user: null },
      error: { message: 'JWT is invalid' },
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer bad-token-xyz');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when Supabase returns no error but user is null', async () => {
    mockGetUserResult = {
      data: { user: null },
      error: null,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('populates req.user correctly for a valid token with profile', async () => {
    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token-abc');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(VALID_USER_ID);
    expect(res.body.user.role).toBe('flat_owner');
    expect(res.body.user.society_id).toBe(SOCIETY_ID);
    expect(res.body.user.flat_id).toBe(FLAT_ID);
  });

  it('allows through with minimal context when user has no profile row yet', async () => {
    // User exists in auth but has no user_profiles row (mid-onboarding)
    mockProfileRow = null;

    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token-new-user');

    // Should succeed — onboarding endpoints need to work pre-profile
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(VALID_USER_ID);
    // Role defaults to flat_owner for unprovisioned users
    expect(res.body.user.role).toBe('flat_owner');
  });

  it('returns 403 when user account is deactivated (is_active=false)', async () => {
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'flat_owner',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      is_active: false, // deactivated
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token-disabled');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

// ============================================================
// requireRole middleware
// ============================================================

describe('requireRole middleware', () => {
  it('allows access when user has the correct role', async () => {
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'society_admin',
      society_id: SOCIETY_ID,
      flat_id: null,
      is_active: true,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', 'Bearer valid-admin-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Welcome, admin');
  });

  it('returns 403 when user role does not match required role', async () => {
    // flat_owner trying to access admin-only route
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'flat_owner',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      is_active: true,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', 'Bearer valid-resident-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows access when user has one of multiple accepted roles (guard)', async () => {
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'guard',
      society_id: SOCIETY_ID,
      flat_id: null,
      is_active: true,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/guard-or-admin')
      .set('Authorization', 'Bearer valid-guard-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Welcome, guard or admin');
  });

  it('allows access when user has one of multiple accepted roles (society_admin)', async () => {
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'society_admin',
      society_id: SOCIETY_ID,
      flat_id: null,
      is_active: true,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/guard-or-admin')
      .set('Authorization', 'Bearer valid-admin-token');

    expect(res.status).toBe(200);
  });

  it('returns 403 when user role is flat_owner but route requires guard or admin', async () => {
    mockProfileRow = {
      id: VALID_USER_ID,
      role: 'flat_owner',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      is_active: true,
    };

    const app = buildAuthApp();
    const res = await request(app)
      .get('/guard-or-admin')
      .set('Authorization', 'Bearer valid-resident-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    // Error message should mention the required roles
    expect(res.body.error.message).toContain('guard');
    expect(res.body.error.message).toContain('society_admin');
  });

  it('returns 401 when requireRole is called without prior authentication', async () => {
    // Build an app where requireRole runs without authenticate first
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireRole } = require('../src/middleware/auth') as typeof import('../src/middleware/auth');

    const bareApp = express();
    bareApp.use(express.json());
    bareApp.get('/no-auth', requireRole('society_admin'), (_req: Request, res: Response) => {
      res.status(200).json({ message: 'ok' });
    });

    const res = await request(bareApp).get('/no-auth');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
