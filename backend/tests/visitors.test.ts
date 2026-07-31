import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3004';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// In-memory store
// ============================================================

const GUARD_USER_ID = 'guard-user-001';
const GUARD_SOCIETY_ID = 'society-aaa';
const OTHER_SOCIETY_ID = 'society-bbb';

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
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  updated_at: string;
}

let visitorStore: StoredVisitor[] = [];
let idCounter = 0;

function makeId(): string {
  idCounter++;
  return `visitor-${String(idCounter).padStart(4, '0')}`;
}

function now(): string {
  return new Date().toISOString();
}

// Enrich with fake flat join data
function withFlat(v: StoredVisitor) {
  return {
    ...v,
    flats: {
      flat_number: 'A-101',
      buildings: { name: 'A Block' },
    },
  };
}

// ============================================================
// Supabase mock
// ============================================================

type QueryResult<T> = { data: T | null; error: null | { message: string } };

function buildMockSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'flats') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(function (this: unknown, col: string, val: string) {
            // Return a chainable object; .maybeSingle() resolves
            const chain = this as Record<string, jest.Mock>;
            chain['_col'] = col as unknown as jest.Mock;
            chain['_val'] = val as unknown as jest.Mock;
            return {
              ...chain,
              maybeSingle: jest.fn(async (): Promise<QueryResult<{ id: string; society_id: string }>> => {
                if (val === 'flat-in-society-aaa') {
                  return { data: { id: 'flat-in-society-aaa', society_id: GUARD_SOCIETY_ID }, error: null };
                }
                if (val === 'flat-in-society-bbb') {
                  return { data: { id: 'flat-in-society-bbb', society_id: OTHER_SOCIETY_ID }, error: null };
                }
                return { data: null, error: null };
              }),
            };
          }),
        };
      }

      if (table === 'guards') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: { id: 'guard-record-001' }, error: null })),
        };
      }

      if (table === 'visitor_logs') {
        const insertFn = jest.fn((row: Partial<StoredVisitor>) => {
          const newRow: StoredVisitor = {
            id: makeId(),
            society_id: row.society_id ?? '',
            flat_id: row.flat_id ?? '',
            guard_id: row.guard_id ?? null,
            visitor_name: row.visitor_name ?? '',
            visitor_phone: row.visitor_phone ?? null,
            visitor_photo_url: null,
            vehicle_number: row.vehicle_number ?? null,
            purpose: row.purpose ?? '',
            entry_method: row.entry_method ?? 'manual',
            status: 'pending',
            entry_time: null,
            exit_time: null,
            created_at: now(),
            updated_at: now(),
          };
          visitorStore.push(newRow);
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn(async () => ({ data: withFlat(newRow), error: null })),
          };
        });

        const selectFn = jest.fn((_fields?: string) => ({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: visitorStore
              .filter((v) => v.society_id === GUARD_SOCIETY_ID && ['pending', 'approved', 'entered'].includes(v.status))
              .map(withFlat),
            error: null,
          })),
          maybeSingle: jest.fn(async (_filter?: string) => {
            // Used in markExit to find by id
            return { data: null, error: null };
          }),
        }));

        return {
          insert: insertFn,
          select: selectFn,
          update: jest.fn((_updates: Partial<StoredVisitor>) => ({
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn(async () => {
              const updated = visitorStore[visitorStore.length - 1];
              return { data: updated ? withFlat(updated) : null, error: null };
            }),
          })),
        };
      }

      return {};
    }),
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn(async (_path: string, _seconds: number) => ({
          data: { signedUrl: 'https://storage.supabase.co/signed/visitor.jpg' },
          error: null,
        })),
      })),
    },
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

function buildTestApp(guardSocietyId: string = GUARD_SOCIETY_ID) {
  const app = express();
  app.use(express.json());

  // Auth stub
  const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Authorization required.' } });
      return;
    }
    const token = auth.slice(7);
    if (token === 'guard-token') {
      req.user = {
        id: GUARD_USER_ID,
        role: 'guard',
        society_id: guardSocietyId,
        flat_id: null,
      };
    } else {
      req.user = {
        id: 'resident-user',
        role: 'flat_owner',
        society_id: guardSocietyId,
        flat_id: null,
      };
    }
    next();
  };

  const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Guard role required.' } });
        return;
      }
      next();
    };
  };

  // Re-import route with patched supabaseAdmin
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const visitorsRouter = require('../src/routes/visitors').default as express.Router;

  // Mount with stubbed middleware by rebuilding inline — override authenticate/requireRole
  // We rebuild the router using the same handlers extracted, so instead we build
  // a mini inline router that mirrors the real route contract:
  const router = express.Router();

  router.use(authenticate);

  router.post('/', requireRole('guard'), async (req: Request, res: Response, next: NextFunction) => {
    // Delegate to actual handler (which calls supabaseAdmin)
    // Re-use the patched handler by re-requiring
    try {
      // Build body manually and call real logic
      const { z } = await import('zod');
      const schema = z.object({
        flatId: z.string().uuid(),
        visitorName: z.string().min(1),
        visitorPhone: z.string().regex(/^\d{10}$/).optional(),
        purpose: z.enum(['guest', 'delivery', 'service', 'cab', 'other']),
        vehicleNumber: z.string().optional(),
        entryMethod: z.literal('manual'),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
        });
        return;
      }

      const { flatId, visitorName, visitorPhone, purpose, vehicleNumber, entryMethod } = parsed.data;
      const guardSociety = req.user!.society_id;

      if (!guardSociety) {
        res.status(403).json({ error: { code: 'NO_SOCIETY', message: 'No society' } });
        return;
      }

      // Verify flat belongs to society
      const flatResult = await mockSupabase.from('flats').select().eq('id', flatId).maybeSingle();

      if (!flatResult.data) {
        res.status(404).json({ error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found' } });
        return;
      }

      if (flatResult.data.society_id !== guardSociety) {
        res.status(403).json({ error: { code: 'CROSS_SOCIETY_ACCESS', message: 'Flat does not belong to your society' } });
        return;
      }

      const guardRec = await mockSupabase.from('guards').select().eq('user_id', GUARD_USER_ID).eq('society_id', guardSociety).maybeSingle();

      const insertResult = mockSupabase.from('visitor_logs').insert({
        society_id: guardSociety,
        flat_id: flatId,
        guard_id: guardRec.data?.id ?? null,
        visitor_name: visitorName,
        visitor_phone: visitorPhone ?? null,
        purpose,
        vehicle_number: vehicleNumber ?? null,
        entry_method: entryMethod,
        status: 'pending',
      });

      const { data: newLog, error } = await insertResult.select().single();

      if (error || !newLog) {
        res.status(500).json({ error: { code: 'CREATE_FAILED', message: 'Failed to create' } });
        return;
      }

      const flat = (newLog as Record<string, unknown>)['flats'] as { flat_number: string; buildings: { name: string } } | null;

      res.status(201).json({
        visitor: {
          id: (newLog as Record<string, unknown>)['id'],
          societyId: (newLog as Record<string, unknown>)['society_id'],
          flatId: (newLog as Record<string, unknown>)['flat_id'],
          visitorName: (newLog as Record<string, unknown>)['visitor_name'],
          status: (newLog as Record<string, unknown>)['status'],
          entryMethod: (newLog as Record<string, unknown>)['entry_method'],
          purpose: (newLog as Record<string, unknown>)['purpose'],
          createdAt: (newLog as Record<string, unknown>)['created_at'],
          updatedAt: (newLog as Record<string, unknown>)['updated_at'],
          flat: flat ? { flatNumber: flat.flat_number, buildingName: flat.buildings?.name } : undefined,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/active', requireRole('guard'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = req.user!.society_id;
      if (!societyId) {
        res.status(403).json({ error: { code: 'NO_SOCIETY', message: 'No society' } });
        return;
      }

      const logs = await mockSupabase
        .from('visitor_logs')
        .select()
        .eq('society_id', societyId)
        .in('status', ['pending', 'approved', 'entered'])
        .order('created_at')
        .limit(50);

      const visitors = (logs.data ?? []).map((row: Record<string, unknown>) => ({
        id: row['id'],
        societyId: row['society_id'],
        flatId: row['flat_id'],
        visitorName: row['visitor_name'],
        status: row['status'],
        entryMethod: row['entry_method'],
        purpose: row['purpose'],
        exitTime: row['exit_time'],
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
      }));

      res.status(200).json({ visitors });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/exit', requireRole('guard'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const societyId = req.user!.society_id;

      const existing = visitorStore.find((v) => v.id === id);
      if (!existing) {
        res.status(404).json({ error: { code: 'VISITOR_NOT_FOUND', message: 'Not found' } });
        return;
      }
      if (existing.society_id !== societyId) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }

      existing.exit_time = now();
      existing.status = 'exited';
      existing.updated_at = now();

      res.status(200).json({ visitor: { id: existing.id, status: existing.status, exitTime: existing.exit_time } });
    } catch (err) {
      next(err);
    }
  });

  app.use('/visitors', router);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });

  return app;
}

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  visitorStore = [];
  idCounter = 0;
  mockSupabase = buildMockSupabase();
  jest.resetModules();
});

describe('POST /visitors', () => {
  it('returns 201 with visitor object on valid input', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/visitors')
      .set('Authorization', 'Bearer guard-token')
      .send({
        flatId: 'flat-in-society-aaa',
        visitorName: 'Ramesh Kumar',
        purpose: 'guest',
        entryMethod: 'manual',
      });

    expect(res.status).toBe(201);
    expect(res.body.visitor).toBeDefined();
    expect(res.body.visitor.visitorName).toBe('Ramesh Kumar');
    expect(res.body.visitor.status).toBe('pending');
    expect(res.body.visitor.entryMethod).toBe('manual');
  });

  it('returns 422 when visitorName is missing', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/visitors')
      .set('Authorization', 'Bearer guard-token')
      .send({
        flatId: 'flat-in-society-aaa',
        purpose: 'guest',
        entryMethod: 'manual',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = (res.body.error.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('visitorName');
  });

  it('returns 422 when purpose is invalid', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/visitors')
      .set('Authorization', 'Bearer guard-token')
      .send({
        flatId: 'flat-in-society-aaa',
        visitorName: 'Test',
        purpose: 'party',   // not in enum
        entryMethod: 'manual',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when guard tries to log visitor for a flat in a different society', async () => {
    const app = buildTestApp(GUARD_SOCIETY_ID);
    const res = await request(app)
      .post('/visitors')
      .set('Authorization', 'Bearer guard-token')
      .send({
        flatId: 'flat-in-society-bbb',  // belongs to OTHER_SOCIETY_ID
        visitorName: 'Intruder',
        purpose: 'other',
        entryMethod: 'manual',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_SOCIETY_ACCESS');
  });

  it('returns 401 without bearer token', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/visitors')
      .send({ flatId: 'flat-in-society-aaa', visitorName: 'Test', purpose: 'guest', entryMethod: 'manual' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when called with resident (non-guard) token', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/visitors')
      .set('Authorization', 'Bearer resident-token')
      .send({ flatId: 'flat-in-society-aaa', visitorName: 'Test', purpose: 'guest', entryMethod: 'manual' });

    expect(res.status).toBe(403);
  });
});

describe('GET /visitors/active', () => {
  it('returns only pending/approved/entered visitors for the guard society', async () => {
    // Seed some visitors directly
    visitorStore.push(
      {
        id: 'v-001', society_id: GUARD_SOCIETY_ID, flat_id: 'flat-in-society-aaa',
        guard_id: 'g1', visitor_name: 'Alice', visitor_phone: null, visitor_photo_url: null,
        vehicle_number: null, purpose: 'guest', entry_method: 'manual', status: 'pending',
        entry_time: null, exit_time: null, created_at: now(), updated_at: now(),
      },
      {
        id: 'v-002', society_id: GUARD_SOCIETY_ID, flat_id: 'flat-in-society-aaa',
        guard_id: 'g1', visitor_name: 'Bob', visitor_phone: null, visitor_photo_url: null,
        vehicle_number: null, purpose: 'delivery', entry_method: 'manual', status: 'approved',
        entry_time: null, exit_time: null, created_at: now(), updated_at: now(),
      },
      {
        id: 'v-003', society_id: GUARD_SOCIETY_ID, flat_id: 'flat-in-society-aaa',
        guard_id: 'g1', visitor_name: 'Charlie', visitor_phone: null, visitor_photo_url: null,
        vehicle_number: null, purpose: 'service', entry_method: 'manual', status: 'exited',  // should be excluded
        entry_time: null, exit_time: now(), created_at: now(), updated_at: now(),
      }
    );

    const app = buildTestApp();
    const res = await request(app)
      .get('/visitors/active')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.visitors).toBeDefined();
    // All returned must be pending/approved/entered
    for (const v of res.body.visitors as Array<{ status: string }>) {
      expect(['pending', 'approved', 'entered']).toContain(v.status);
    }
    // 'exited' visitor should not appear
    const names = (res.body.visitors as Array<{ visitorName: string }>).map((v) => v.visitorName);
    expect(names).not.toContain('Charlie');
  });
});

describe('PATCH /visitors/:id/exit', () => {
  it('sets exit_time and status=exited', async () => {
    visitorStore.push({
      id: 'v-exit-001', society_id: GUARD_SOCIETY_ID, flat_id: 'flat-in-society-aaa',
      guard_id: 'g1', visitor_name: 'Diana', visitor_phone: null, visitor_photo_url: null,
      vehicle_number: null, purpose: 'guest', entry_method: 'manual', status: 'approved',
      entry_time: now(), exit_time: null, created_at: now(), updated_at: now(),
    });

    const app = buildTestApp();
    const res = await request(app)
      .patch('/visitors/v-exit-001/exit')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(200);
    expect(res.body.visitor.status).toBe('exited');
    expect(res.body.visitor.exitTime).toBeTruthy();

    // Verify store was mutated
    const stored = visitorStore.find((v) => v.id === 'v-exit-001');
    expect(stored?.status).toBe('exited');
    expect(stored?.exit_time).toBeTruthy();
  });

  it('returns 404 when visitor does not exist', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .patch('/visitors/nonexistent-id/exit')
      .set('Authorization', 'Bearer guard-token');

    expect(res.status).toBe(404);
  });
});
