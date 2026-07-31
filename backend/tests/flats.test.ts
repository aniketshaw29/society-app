import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3010';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] =
  'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] =
  'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

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
// In-memory store
// ============================================================

const SOCIETY_ID = 'society-001';
const FLAT_A_ID = 'flat-a-101';
const FLAT_B_ID = 'flat-b-202';

const OWNER_USER_ID = 'user-owner-001';
const TENANT_USER_ID = 'user-tenant-001';
const OTHER_USER_ID = 'user-other-001'; // not in flat
const NEW_USER_PHONE = '+919876543210';
const EXISTING_IN_FLAT_PHONE = '+919000000001';
const EXISTING_OTHER_FLAT_PHONE = '+919000000002';

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  flat_id: string | null;
  society_id: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
}

const profileStore: ProfileRow[] = [
  {
    id: OWNER_USER_ID,
    full_name: 'Aniket Sharma',
    phone: '+919111111111',
    role: 'flat_owner',
    flat_id: FLAT_A_ID,
    society_id: SOCIETY_ID,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar_url: null,
  },
  {
    id: TENANT_USER_ID,
    full_name: 'Priya Singh',
    phone: EXISTING_IN_FLAT_PHONE,
    role: 'tenant',
    flat_id: FLAT_A_ID,
    society_id: SOCIETY_ID,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar_url: null,
  },
  {
    id: 'user-other-flat',
    full_name: 'Rahul Gupta',
    phone: EXISTING_OTHER_FLAT_PHONE,
    role: 'tenant',
    flat_id: FLAT_B_ID,
    society_id: SOCIETY_ID,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar_url: null,
  },
];

// ============================================================
// Supabase Admin mock
// ============================================================

jest.mock('../src/lib/supabaseAdmin', () => {
  const buildChain = (resultFn: () => unknown) => {
    const chain: Record<string, jest.Mock> = {};
    const methods = [
      'select', 'eq', 'order', 'limit', 'maybeSingle', 'single',
      'insert', 'update', 'upsert',
    ];
    methods.forEach((m) => {
      chain[m] = jest.fn((..._args: unknown[]) => {
        // Terminal methods
        if (m === 'maybeSingle' || m === 'single') {
          return Promise.resolve(resultFn());
        }
        return chain;
      });
    });
    return chain;
  };

  // Track calls to figure out which table/operation
  let lastTable = '';
  let _insertData: unknown = null;
  void _insertData;
  let _updateData: unknown = null;
  void _updateData;

  const supabaseAdmin = {
    from: jest.fn((table: string) => {
      lastTable = table;

      const selectFn = jest.fn((_fields?: string, _opts?: unknown) => {
        const chain: Record<string, jest.Mock> = {};

        const eqFilters: Record<string, unknown> = {};
        const eqFn = jest.fn((col: string, val: unknown) => {
          eqFilters[col] = val;
          return chain;
        });

        chain['eq'] = eqFn;
        chain['order'] = jest.fn(() => chain);
        chain['limit'] = jest.fn(() => chain);
        chain['gte'] = jest.fn(() => chain);
        chain['lte'] = jest.fn(() => chain);
        chain['neq'] = jest.fn(() => chain);
        chain['in'] = jest.fn(() => chain);
        chain['not'] = jest.fn(() => chain);
        chain['ilike'] = jest.fn(() => chain);
        chain['range'] = jest.fn(() => chain);

        chain['maybeSingle'] = jest.fn(async () => {
          if (lastTable === 'user_profiles') {
            // Find by id + flat_id (assertFlatMember / assertFlatOwner)
            if ('id' in eqFilters && 'flat_id' in eqFilters) {
              const match = profileStore.find(
                (p) => p.id === eqFilters['id'] && p.flat_id === eqFilters['flat_id']
              );
              return { data: match ?? null, error: null };
            }
            // Find by id only
            if ('id' in eqFilters && !('flat_id' in eqFilters) && !('phone' in eqFilters)) {
              const match = profileStore.find((p) => p.id === eqFilters['id']);
              return { data: match ?? null, error: null };
            }
            // Find by phone + society_id (duplicate check)
            if ('phone' in eqFilters && 'society_id' in eqFilters) {
              const match = profileStore.find(
                (p) =>
                  p.phone === eqFilters['phone'] &&
                  p.society_id === eqFilters['society_id']
              );
              return { data: match ?? null, error: null };
            }
          }
          if (lastTable === 'flats') {
            if (eqFilters['id'] === FLAT_A_ID) {
              return {
                data: {
                  id: FLAT_A_ID,
                  society_id: SOCIETY_ID,
                  flat_number: 'A-101',
                  buildings: { name: 'A Block' },
                },
                error: null,
              };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        });

        chain['single'] = jest.fn(async () => {
          if (lastTable === 'user_profiles' && 'id' in eqFilters) {
            // Return the newly inserted profile
            const match = profileStore.find((p) => p.id === eqFilters['id']);
            return {
              data: match ?? {
                id: 'new-user-id',
                full_name: 'New User',
                phone: NEW_USER_PHONE,
                role: 'tenant',
                flat_id: FLAT_A_ID,
                society_id: SOCIETY_ID,
                is_active: true,
                created_at: new Date().toISOString(),
                avatar_url: null,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        });

        // Awaitable chain for list queries
        chain['then'] = jest.fn((resolve: (v: unknown) => void) => {
          if (lastTable === 'user_profiles') {
            const flatId = eqFilters['flat_id'];
            const rows = profileStore.filter((p) => p.flat_id === flatId);
            resolve({ data: rows, error: null, count: null });
          } else {
            resolve({ data: [], error: null, count: 0 });
          }
          return chain;
        });

        return chain;
      });

      const insertFn = jest.fn((row: unknown) => {
        (_insertData) = row;
        return {
          ...buildChain(() => ({ data: row, error: null })),
          select: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({ data: row, error: null })),
        };
      });

      const updateFn = jest.fn((patch: unknown) => {
        (_updateData) = patch;
        return {
          ...buildChain(() => ({ data: null, error: null })),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({ data: null, error: null })),
        };
      });

      return {
        select: selectFn,
        insert: insertFn,
        update: updateFn,
      };
    }),

    auth: {
      admin: {
        listUsers: jest.fn(async () => ({
          data: {
            users: [
              { id: TENANT_USER_ID, phone: EXISTING_IN_FLAT_PHONE, user_metadata: {} },
              { id: 'user-other-flat', phone: EXISTING_OTHER_FLAT_PHONE, user_metadata: {} },
            ],
          },
          error: null,
        })),
        createUser: jest.fn(async (_opts: unknown) => ({
          data: {
            user: {
              id: 'new-user-id',
              phone: NEW_USER_PHONE,
            },
          },
          error: null,
        })),
      },
      getUser: jest.fn(async (token: string) => {
        // Map token to user
        const tokenMap: Record<string, string> = {
          'owner-token': OWNER_USER_ID,
          'tenant-token': TENANT_USER_ID,
          'other-token': OTHER_USER_ID,
        };
        const userId = tokenMap[token];
        if (!userId)
          return { data: { user: null }, error: { message: 'Invalid token' } };
        return { data: { user: { id: userId } }, error: null };
      }),
    },
  };

  return { supabaseAdmin };
});

// Mock SMS service
jest.mock('../src/services/smsService', () => ({
  sendOtpSms: jest.fn(async () => undefined),
}));

// ============================================================
// App setup
// ============================================================

import flatsRouter from '../src/routes/flats';

function buildApp() {
  const app = express();
  app.use(express.json());

  // Inject auth via mock middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
    const userMap: Record<
      string,
      { id: string; role: string; society_id: string | null; flat_id: string | null }
    > = {
      'owner-token': {
        id: OWNER_USER_ID,
        role: 'flat_owner',
        society_id: SOCIETY_ID,
        flat_id: FLAT_A_ID,
      },
      'tenant-token': {
        id: TENANT_USER_ID,
        role: 'tenant',
        society_id: SOCIETY_ID,
        flat_id: FLAT_A_ID,
      },
      'other-token': {
        id: OTHER_USER_ID,
        role: 'tenant',
        society_id: SOCIETY_ID,
        flat_id: null,
      },
    };

    const user = userMap[token];
    if (user) {
      req.user = user as Request['user'];
    }
    next();
  });

  app.use('/flats', flatsRouter);

  // Error handler — serializes AppError to JSON
  app.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode ?? 500;
    const code = err.code ?? 'INTERNAL';
    res.status(status).json({ error: { code, message: err.message } });
  });

  return app;
}

const app = buildApp();

// ============================================================
// Tests
// ============================================================

describe('GET /flats/:id/members', () => {
  it('returns members for flat owner', async () => {
    const res = await request(app)
      .get(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer owner-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('members');
    expect(Array.isArray(res.body.members)).toBe(true);
  });

  it('returns 403 when user is not a member of the flat', async () => {
    const res = await request(app)
      .get(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer other-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get(`/flats/${FLAT_A_ID}/members`);
    // No token → req.user is undefined → route should reject
    expect([401, 403]).toContain(res.status);
  });
});

describe('POST /flats/:id/members', () => {
  it('returns 403 when tenant tries to add a member', async () => {
    const res = await request(app)
      .post(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer tenant-token')
      .send({
        phone: '9123456789',
        fullName: 'Test User',
        residentType: 'tenant',
      });

    // tenant role → requireRole('flat_owner') rejects
    expect(res.status).toBe(403);
  });

  it('returns 409 when phone is already in another flat of same society', async () => {
    const res = await request(app)
      .post(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        phone: EXISTING_OTHER_FLAT_PHONE.replace('+91', ''),
        fullName: 'Rahul Gupta',
        residentType: 'tenant',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_IN_ANOTHER_FLAT');
  });

  it('returns 409 when phone is already in this flat', async () => {
    const res = await request(app)
      .post(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        phone: EXISTING_IN_FLAT_PHONE.replace('+91', ''),
        fullName: 'Priya Singh',
        residentType: 'tenant',
      });

    expect(res.status).toBe(409);
  });

  it('returns 201 when owner adds a new member', async () => {
    const res = await request(app)
      .post(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        phone: '9876543210',
        fullName: 'New Member',
        residentType: 'tenant',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('member');
  });

  it('returns 422 on invalid body', async () => {
    const res = await request(app)
      .post(`/flats/${FLAT_A_ID}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ phone: 'bad', fullName: 'X', residentType: 'unknown' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /flats/:id/members/:memberId', () => {
  it('returns 403 when tenant tries to remove a member', async () => {
    const res = await request(app)
      .delete(`/flats/${FLAT_A_ID}/members/${TENANT_USER_ID}`)
      .set('Authorization', 'Bearer tenant-token');

    expect(res.status).toBe(403);
  });

  it('returns 400 when owner tries to remove themselves', async () => {
    const res = await request(app)
      .delete(`/flats/${FLAT_A_ID}/members/${OWNER_USER_ID}`)
      .set('Authorization', 'Bearer owner-token');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_REMOVE_SELF');
  });

  it('returns 204 when owner removes a tenant', async () => {
    const res = await request(app)
      .delete(`/flats/${FLAT_A_ID}/members/${TENANT_USER_ID}`)
      .set('Authorization', 'Bearer owner-token');

    expect(res.status).toBe(204);
  });
});
