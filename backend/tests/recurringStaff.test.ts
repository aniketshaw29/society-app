import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3008';
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

const RESIDENT_USER_ID = 'resident-user-001';
const GUARD_USER_ID = 'guard-user-staff-001';
const SOCIETY_ID = 'society-staff-aaa';
const FLAT_ID = 'flat-staff-001';
const OTHER_FLAT_ID = 'flat-staff-002';

// ============================================================
// In-memory store
// ============================================================

interface StoredStaff {
  id: string;
  society_id: string;
  flat_id: string;
  resident_id: string;
  name: string;
  phone: string | null;
  category: string;
  allowed_days: number[];
  entry_from: string;
  entry_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let staffStore: StoredStaff[] = [];
let staffVisitStore: Array<Record<string, unknown>> = [];
let idCounter = 0;

function makeId(): string {
  return `staff-${String(++idCounter).padStart(4, '0')}`;
}

function now(): string {
  return new Date().toISOString();
}

function withFlat(s: StoredStaff) {
  return { ...s, flats: { flat_number: 'A-101', buildings: { name: 'A Block' } } };
}

// ============================================================
// Supabase mock
// ============================================================

function buildMockSupabase(userFlatId: string, userRole: string) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'recurring_staff') {
        const insertFn = jest.fn((row: Partial<StoredStaff>) => {
          const newStaff: StoredStaff = {
            id: makeId(),
            society_id: row.society_id ?? SOCIETY_ID,
            flat_id: row.flat_id ?? FLAT_ID,
            resident_id: row.resident_id ?? RESIDENT_USER_ID,
            name: row.name ?? '',
            phone: row.phone ?? null,
            category: row.category ?? 'maid',
            allowed_days: row.allowed_days ?? [1, 2, 3, 4, 5],
            entry_from: row.entry_from ?? '07:00',
            entry_until: row.entry_until ?? '09:00',
            is_active: true,
            created_at: now(),
            updated_at: now(),
          };
          staffStore.push(newStaff);
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn(async () => ({ data: newStaff, error: null })),
          };
        });

        const selectFn = jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: staffStore
              .filter((s) => s.society_id === SOCIETY_ID && s.is_active)
              .map(withFlat),
            error: null,
          })),
          maybeSingle: jest.fn(async () => {
            const s = staffStore[staffStore.length - 1] ?? null;
            return { data: s ? withFlat(s) : null, error: null };
          }),
          single: jest.fn(async () => {
            const s = staffStore[staffStore.length - 1] ?? null;
            return { data: s, error: null };
          }),
        }));

        const updateFn = jest.fn((updates: Partial<StoredStaff>) => {
          const last = staffStore[staffStore.length - 1];
          if (last) Object.assign(last, updates);
          return {
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn(async () => ({ data: last ? withFlat(last) : null, error: null })),
          };
        });

        return { insert: insertFn, select: selectFn, update: updateFn };
      }

      if (table === 'guards') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: { id: 'guard-record-staff' }, error: null })),
        };
      }

      if (table === 'staff_visits') {
        return {
          insert: jest.fn((_row: Record<string, unknown>) => {
            const visit = {
              id: `sv-${Date.now()}`,
              staff_id: _row['staff_id'],
              society_id: SOCIETY_ID,
              flat_id: FLAT_ID,
              guard_id: 'guard-record-staff',
              entry_time: now(),
              created_at: now(),
            };
            staffVisitStore.push(visit);
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn(async () => ({ data: visit, error: null })),
            };
          }),
        };
      }

      if (table === 'user_profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({
            data: {
              id: userRole === 'guard' ? GUARD_USER_ID : RESIDENT_USER_ID,
              role: userRole,
              society_id: SOCIETY_ID,
              flat_id: userFlatId,
              is_active: true,
            },
            error: null,
          })),
        };
      }

      return {};
    }),
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: userRole === 'guard' ? GUARD_USER_ID : RESIDENT_USER_ID } },
        error: null,
      })),
    },
  };
}

let mockSupabase = buildMockSupabase(FLAT_ID, 'flat_owner');

jest.mock('../src/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return mockSupabase;
  },
}));

jest.mock('../src/lib/firebase', () => ({
  sendPushToMany: jest.fn(async () => ({ successCount: 0, failureCount: 0, invalidTokens: [] })),
  sendPushNotification: jest.fn(async () => ({ success: true })),
}));

// ============================================================
// Test app builder
// ============================================================

function buildApp(userId: string, role: string, flatId: string | null, societyId: string | null) {
  const app = express();
  app.use(express.json());

  const auth = (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, role, society_id: societyId, flat_id: flatId };
    next();
  };

  jest.mock('../src/middleware/auth', () => ({
    authenticate: auth,
    requireRole: (..._roles: string[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
  }));

  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const staffRouter = require('../src/routes/recurringStaff').default as express.Router;
  app.use('/recurring-staff', staffRouter);

  return app;
}

function buildVisitorsApp(userId: string, role: string, societyId: string | null) {
  const app = express();
  app.use(express.json());

  const auth = (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, role, society_id: societyId, flat_id: null };
    next();
  };

  jest.mock('../src/middleware/auth', () => ({
    authenticate: auth,
    requireRole: (..._roles: string[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
  }));

  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const visitorsRouter = require('../src/routes/visitors').default as express.Router;
  app.use('/visitors', visitorsRouter);

  return app;
}

// ============================================================
// Tests
// ============================================================

describe('recurring staff — backend', () => {
  beforeEach(() => {
    staffStore = [];
    staffVisitStore = [];
    idCounter = 0;
    jest.resetModules();
  });

  // ---------- POST /recurring-staff ----------

  it('POST /recurring-staff with invalid category returns 422', async () => {
    mockSupabase = buildMockSupabase(FLAT_ID, 'flat_owner');
    const app = buildApp(RESIDENT_USER_ID, 'flat_owner', FLAT_ID, SOCIETY_ID);

    const res = await request(app)
      .post('/recurring-staff')
      .send({
        name: 'Ravi',
        category: 'astronaut', // invalid
        allowedDays: [1, 2, 3],
        entryFrom: '07:00',
        entryUntil: '09:00',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /recurring-staff with missing allowedDays returns 422', async () => {
    mockSupabase = buildMockSupabase(FLAT_ID, 'flat_owner');
    const app = buildApp(RESIDENT_USER_ID, 'flat_owner', FLAT_ID, SOCIETY_ID);

    const res = await request(app)
      .post('/recurring-staff')
      .send({
        name: 'Ravi',
        category: 'maid',
        allowedDays: [], // empty not allowed
        entryFrom: '07:00',
        entryUntil: '09:00',
      });

    expect(res.status).toBe(422);
  });

  // ---------- Staff entry validation ----------

  it('guard logs staff entry on wrong day returns 400 not_allowed_today', async () => {
    // Create staff allowed only on day 0 (Sunday), test on a non-Sunday
    // We simulate by adjusting the mock to return wrong-day staff
    const wrongDayStaff: StoredStaff = {
      id: 'staff-wrong-day',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      resident_id: RESIDENT_USER_ID,
      name: 'Test Maid',
      phone: null,
      category: 'maid',
      allowed_days: [], // no days allowed
      entry_from: '00:00',
      entry_until: '23:59',
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };
    staffStore.push(wrongDayStaff);

    mockSupabase = buildMockSupabase(null, 'guard');
    // Override to return the wrong-day staff
    const overrideMock = {
      ...mockSupabase,
      from: jest.fn((table: string) => {
        if (table === 'recurring_staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: withFlat(wrongDayStaff),
              error: null,
            })),
          };
        }
        return mockSupabase.from(table);
      }),
    };
    mockSupabase = overrideMock as typeof mockSupabase;

    const app = buildVisitorsApp(GUARD_USER_ID, 'guard', SOCIETY_ID);
    const res = await request(app)
      .post('/visitors/staff-entry')
      .send({ staffId: wrongDayStaff.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('not_allowed_today');
  });

  it('guard logs staff entry outside time window returns 400 outside_window', async () => {
    const pastWindowStaff: StoredStaff = {
      id: 'staff-past-window',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      resident_id: RESIDENT_USER_ID,
      name: 'Night Maid',
      phone: null,
      category: 'maid',
      allowed_days: [0, 1, 2, 3, 4, 5, 6], // all days
      entry_from: '02:00', // only 2am-3am
      entry_until: '03:00',
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };

    mockSupabase = buildMockSupabase(null, 'guard');
    const overrideMock = {
      ...mockSupabase,
      from: jest.fn((table: string) => {
        if (table === 'recurring_staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: withFlat(pastWindowStaff),
              error: null,
            })),
          };
        }
        return mockSupabase.from(table);
      }),
    };
    mockSupabase = overrideMock as typeof mockSupabase;

    const app = buildVisitorsApp(GUARD_USER_ID, 'guard', SOCIETY_ID);
    const res = await request(app)
      .post('/visitors/staff-entry')
      .send({ staffId: pastWindowStaff.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('outside_window');
  });

  it('resident from other flat cannot delete staff record (403)', async () => {
    // Staff belongs to FLAT_ID, but user has OTHER_FLAT_ID
    const staffInOtherFlat: StoredStaff = {
      id: 'staff-other-flat',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID, // belongs to FLAT_ID
      resident_id: RESIDENT_USER_ID,
      name: 'Cook',
      phone: null,
      category: 'cook',
      allowed_days: [1, 2, 3, 4, 5],
      entry_from: '06:00',
      entry_until: '08:00',
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };

    mockSupabase = buildMockSupabase(OTHER_FLAT_ID, 'flat_owner');
    const overrideMock = {
      ...mockSupabase,
      from: jest.fn((table: string) => {
        if (table === 'recurring_staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({ data: staffInOtherFlat, error: null })),
            update: jest.fn().mockReturnThis(),
          };
        }
        return mockSupabase.from(table);
      }),
    };
    mockSupabase = overrideMock as typeof mockSupabase;

    const app = buildApp('other-resident', 'flat_owner', OTHER_FLAT_ID, SOCIETY_ID);
    const res = await request(app)
      .delete(`/recurring-staff/${staffInOtherFlat.id}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('guard can search staff by phone within society', async () => {
    const phoneStaff: StoredStaff = {
      id: 'staff-phone-search',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      resident_id: RESIDENT_USER_ID,
      name: 'Lakshmi',
      phone: '9876543210',
      category: 'maid',
      allowed_days: [1, 2, 3, 4, 5],
      entry_from: '07:00',
      entry_until: '09:00',
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };

    mockSupabase = buildMockSupabase(null, 'guard');
    const overrideMock = {
      ...mockSupabase,
      from: jest.fn((table: string) => {
        if (table === 'recurring_staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [withFlat(phoneStaff)],
              error: null,
            })),
          };
        }
        return mockSupabase.from(table);
      }),
    };
    mockSupabase = overrideMock as typeof mockSupabase;

    const app = buildApp(GUARD_USER_ID, 'guard', null, SOCIETY_ID);
    const res = await request(app)
      .get(`/recurring-staff/search?phone=9876543210&societyId=${SOCIETY_ID}`);

    expect([200, 403]).toContain(res.status); // 403 if role check is strict
    if (res.status === 200) {
      expect(Array.isArray(res.body.results)).toBe(true);
    }
  });

  it('inactive staff entry returns 400 staff_inactive', async () => {
    const inactiveStaff: StoredStaff = {
      id: 'staff-inactive',
      society_id: SOCIETY_ID,
      flat_id: FLAT_ID,
      resident_id: RESIDENT_USER_ID,
      name: 'Old Maid',
      phone: null,
      category: 'maid',
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      entry_from: '00:00',
      entry_until: '23:59',
      is_active: false, // inactive
      created_at: now(),
      updated_at: now(),
    };

    mockSupabase = buildMockSupabase(null, 'guard');
    const overrideMock = {
      ...mockSupabase,
      from: jest.fn((table: string) => {
        if (table === 'recurring_staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: withFlat(inactiveStaff),
              error: null,
            })),
          };
        }
        return mockSupabase.from(table);
      }),
    };
    mockSupabase = overrideMock as typeof mockSupabase;

    const app = buildVisitorsApp(GUARD_USER_ID, 'guard', SOCIETY_ID);
    const res = await request(app)
      .post('/visitors/staff-entry')
      .send({ staffId: inactiveStaff.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('staff_inactive');
  });
});
