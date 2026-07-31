import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3003';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// In-memory stores
// ============================================================

const SOCIETY_ID = 'society-test-001';

interface StoredBuilding {
  id: string;
  society_id: string;
  name: string;
  total_floors: number;
  created_at: string;
}

interface StoredFlat {
  id: string;
  society_id: string;
  building_id: string;
  flat_number: string;
  floor: number;
  is_occupied: boolean;
}

interface StoredGuard {
  phone: string;
  society_id: string;
}

let buildings: StoredBuilding[] = [];
let flats: StoredFlat[] = [];
let guards: StoredGuard[] = [];

// ============================================================
// Build test app
// ============================================================

function buildTestApp() {
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
    if (token === 'admin-token') {
      req.user = { id: 'admin-user', role: 'society_admin', society_id: SOCIETY_ID, flat_id: null };
    } else {
      // Non-admin role
      req.user = { id: 'resident-user', role: 'flat_owner', society_id: SOCIETY_ID, flat_id: null };
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !['society_admin', 'super_admin'].includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required.' } });
      return;
    }
    next();
  };

  // POST /onboarding/societies/:societyId/buildings
  app.post(
    '/onboarding/societies/:societyId/buildings',
    authenticate,
    requireAdmin,
    (req: Request, res: Response) => {
      const { societyId } = req.params as { societyId: string };
      const { name, totalFloors } = req.body as { name?: string; totalFloors?: number };

      if (!name || totalFloors === undefined) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: [
              ...(!name ? [{ field: 'name', message: 'Building name is required' }] : []),
              ...(totalFloors === undefined ? [{ field: 'totalFloors', message: 'totalFloors is required' }] : []),
            ],
          },
        });
        return;
      }

      const building: StoredBuilding = {
        id: `building-${Date.now()}`,
        society_id: societyId,
        name,
        total_floors: totalFloors,
        created_at: new Date().toISOString(),
      };
      buildings.push(building);

      res.status(201).json({
        building: {
          id: building.id,
          societyId: building.society_id,
          name: building.name,
          totalFloors: building.total_floors,
          createdAt: building.created_at,
        },
      });
    }
  );

  // POST /onboarding/societies/:societyId/flats
  app.post(
    '/onboarding/societies/:societyId/flats',
    authenticate,
    requireAdmin,
    (req: Request, res: Response) => {
      const { societyId } = req.params as { societyId: string };
      const { buildingId, flatNumber, floor } = req.body as {
        buildingId?: string;
        flatNumber?: string;
        floor?: number;
      };

      if (!buildingId) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: [{ field: 'buildingId', message: 'buildingId is required' }],
          },
        });
        return;
      }

      if (!flatNumber || floor === undefined) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: [
              ...(!flatNumber ? [{ field: 'flatNumber', message: 'Flat number is required' }] : []),
              ...(floor === undefined ? [{ field: 'floor', message: 'Floor is required' }] : []),
            ],
          },
        });
        return;
      }

      const flat: StoredFlat = {
        id: `flat-${Date.now()}`,
        society_id: societyId,
        building_id: buildingId,
        flat_number: flatNumber,
        floor,
        is_occupied: false,
      };
      flats.push(flat);

      res.status(201).json({
        flat: {
          id: flat.id,
          societyId: flat.society_id,
          buildingId: flat.building_id,
          flatNumber: flat.flat_number,
          floor: flat.floor,
          isOccupied: flat.is_occupied,
        },
      });
    }
  );

  // POST /onboarding/societies/:societyId/guards
  app.post(
    '/onboarding/societies/:societyId/guards',
    authenticate,
    requireAdmin,
    (req: Request, res: Response) => {
      const { societyId } = req.params as { societyId: string };
      const { phone, fullName, gateName, shift } = req.body as {
        phone?: string;
        fullName?: string;
        gateName?: string;
        shift?: string;
      };

      if (!phone || !fullName) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: [
              ...(!phone ? [{ field: 'phone', message: 'Phone is required' }] : []),
              ...(!fullName ? [{ field: 'fullName', message: 'Full name is required' }] : []),
            ],
          },
        });
        return;
      }

      // Duplicate check
      const existing = guards.find((g) => g.phone === phone && g.society_id === societyId);
      if (existing) {
        res.status(409).json({
          error: { code: 'GUARD_EXISTS', message: 'Guard with this phone already exists in this society' },
        });
        return;
      }

      guards.push({ phone, society_id: societyId });

      res.status(201).json({
        guard: {
          id: `guard-${Date.now()}`,
          societyId,
          phone,
          fullName,
          gateName: gateName ?? 'Main Gate',
          shift: shift ?? 'morning',
          isActive: true,
        },
      });
    }
  );

  // 404 + error handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Not found' } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  });

  return app;
}

const app = buildTestApp();

beforeEach(() => {
  buildings = [];
  flats = [];
  guards = [];
});

// ============================================================
// Tests: POST /onboarding/societies/:id/buildings
// ============================================================

describe('POST /onboarding/societies/:id/buildings', () => {
  it('returns 403 when non-admin JWT is used', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/buildings`)
      .set('Authorization', 'Bearer resident-token')
      .send({ name: 'Tower A', totalFloors: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/buildings`)
      .send({ name: 'Tower A', totalFloors: 10 });

    expect(res.status).toBe(401);
  });

  it('returns 201 with building object', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/buildings`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Tower A', totalFloors: 10 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('building');
    expect(res.body.building).toMatchObject({
      name: 'Tower A',
      totalFloors: 10,
      societyId: SOCIETY_ID,
    });
    expect(res.body.building).toHaveProperty('id');
    expect(res.body.building).toHaveProperty('createdAt');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/buildings`)
      .set('Authorization', 'Bearer admin-token')
      .send({ totalFloors: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when totalFloors is missing', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/buildings`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Block B' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// Tests: POST /onboarding/societies/:id/flats
// ============================================================

describe('POST /onboarding/societies/:id/flats', () => {
  it('returns 403 when non-admin JWT is used', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/flats`)
      .set('Authorization', 'Bearer resident-token')
      .send({ buildingId: 'building-1', flatNumber: '101', floor: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 422 when buildingId is missing', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/flats`)
      .set('Authorization', 'Bearer admin-token')
      .send({ flatNumber: '101', floor: 1 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'buildingId' })])
    );
  });

  it('returns 201 with flat object', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/flats`)
      .set('Authorization', 'Bearer admin-token')
      .send({ buildingId: 'building-1', flatNumber: 'A-101', floor: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('flat');
    expect(res.body.flat).toMatchObject({
      buildingId: 'building-1',
      flatNumber: 'A-101',
      floor: 1,
      isOccupied: false,
    });
  });
});

// ============================================================
// Tests: POST /onboarding/societies/:id/guards
// ============================================================

describe('POST /onboarding/societies/:id/guards', () => {
  it('returns 403 when non-admin JWT is used', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/guards`)
      .set('Authorization', 'Bearer resident-token')
      .send({ phone: '+919876543210', fullName: 'Ramesh' });

    expect(res.status).toBe(403);
  });

  it('returns 201 with guard object', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/guards`)
      .set('Authorization', 'Bearer admin-token')
      .send({ phone: '+919876543210', fullName: 'Ramesh Singh', gateName: 'Gate 1', shift: 'morning' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('guard');
    expect(res.body.guard).toMatchObject({
      phone: '+919876543210',
      fullName: 'Ramesh Singh',
      gateName: 'Gate 1',
      shift: 'morning',
    });
  });

  it('returns 409 when guard with duplicate phone is added', async () => {
    await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/guards`)
      .set('Authorization', 'Bearer admin-token')
      .send({ phone: '+919876543210', fullName: 'Ramesh Singh' });

    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/guards`)
      .set('Authorization', 'Bearer admin-token')
      .send({ phone: '+919876543210', fullName: 'Ramesh Duplicate' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GUARD_EXISTS');
  });

  it('returns 422 when phone is missing', async () => {
    const res = await request(app)
      .post(`/onboarding/societies/${SOCIETY_ID}/guards`)
      .set('Authorization', 'Bearer admin-token')
      .send({ fullName: 'No Phone Guard' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
