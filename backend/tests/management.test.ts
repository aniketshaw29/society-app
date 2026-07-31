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
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// Constants
// ============================================================

const SOCIETY_ID = 'society-mgmt-001';

// ============================================================
// In-memory data stores
// ============================================================

interface StoredBuilding {
  id: string;
  society_id: string;
  name: string;
  total_floors: number;
}

interface StoredFlat {
  id: string;
  society_id: string;
  building_id: string;
  flat_number: string;
  floor: number;
  is_occupied: boolean;
}

interface StoredUserProfile {
  id: string;
  society_id: string;
  flat_id: string | null;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
}

interface StoredGuard {
  id: string;
  society_id: string;
  user_id: string;
  gate_name: string;
  shift: string;
  is_active: boolean;
}

let buildings: StoredBuilding[] = [];
let flats: StoredFlat[] = [];
let userProfiles: StoredUserProfile[] = [];
let guards: StoredGuard[] = [];

// ============================================================
// Build test app
// ============================================================

function buildApp() {
  const app = express();
  app.use(express.json());

  // Auth stub
  const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Auth required' } });
      return;
    }
    const token = auth.slice(7);
    if (token === 'admin-token') {
      req.user = { id: 'admin-user', role: 'society_admin', society_id: SOCIETY_ID, flat_id: null };
    } else if (token === 'resident-token') {
      req.user = { id: 'resident-user', role: 'flat_owner', society_id: SOCIETY_ID, flat_id: 'flat-1' };
    } else {
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

  const requireSocietyAccess = (req: Request, res: Response, next: NextFunction): void => {
    const { societyId } = req.params as { societyId: string };
    if (req.user?.role !== 'super_admin' && req.user?.society_id !== societyId) {
      res.status(403).json({ error: { code: 'CROSS_SOCIETY_ACCESS', message: 'Access denied.' } });
      return;
    }
    next();
  };

  // ── PATCH buildings ──────────────────────────────────────────
  app.patch(
    '/onboarding/societies/:societyId/buildings/:id',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, id } = req.params as { societyId: string; id: string };
      const building = buildings.find((b) => b.id === id && b.society_id === societyId);
      if (!building) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      const { name, totalFloors } = req.body as { name?: string; totalFloors?: number };
      if (name !== undefined) building.name = name;
      if (totalFloors !== undefined) building.total_floors = totalFloors;
      res.status(200).json({ building: { id: building.id, name: building.name, totalFloors: building.total_floors } });
    }
  );

  // ── DELETE buildings ─────────────────────────────────────────
  app.delete(
    '/onboarding/societies/:societyId/buildings/:id',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, id } = req.params as { societyId: string; id: string };
      const idx = buildings.findIndex((b) => b.id === id && b.society_id === societyId);
      if (idx === -1) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      // 409 if active flats
      const hasFlats = flats.some((f) => f.building_id === id);
      if (hasFlats) {
        res.status(409).json({ error: { code: 'HAS_ACTIVE_FLATS', message: 'Building has flats' } });
        return;
      }
      buildings.splice(idx, 1);
      res.status(204).end();
    }
  );

  // ── PATCH flats ───────────────────────────────────────────────
  app.patch(
    '/onboarding/societies/:societyId/flats/:id',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, id } = req.params as { societyId: string; id: string };
      const flat = flats.find((f) => f.id === id && f.society_id === societyId);
      if (!flat) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      const { flatNumber, floor } = req.body as { flatNumber?: string; floor?: number };
      if (flatNumber !== undefined) flat.flat_number = flatNumber;
      if (floor !== undefined) flat.floor = floor;
      res.status(200).json({ flat: { id: flat.id, flatNumber: flat.flat_number, floor: flat.floor } });
    }
  );

  // ── DELETE flats ──────────────────────────────────────────────
  app.delete(
    '/onboarding/societies/:societyId/flats/:id',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, id } = req.params as { societyId: string; id: string };
      const idx = flats.findIndex((f) => f.id === id && f.society_id === societyId);
      if (idx === -1) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      // 409 if active residents
      const hasResidents = userProfiles.some((p) => p.flat_id === id && p.is_active);
      if (hasResidents) {
        res.status(409).json({ error: { code: 'HAS_ACTIVE_RESIDENTS', message: 'Flat has residents' } });
        return;
      }
      flats.splice(idx, 1);
      res.status(204).end();
    }
  );

  // ── PATCH residents ───────────────────────────────────────────
  app.patch(
    '/onboarding/societies/:societyId/residents/:userId',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, userId } = req.params as { societyId: string; userId: string };
      const profile = userProfiles.find((p) => p.id === userId && p.society_id === societyId);
      if (!profile) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      const { fullName, flatId, residentType } = req.body as { fullName?: string; flatId?: string; residentType?: 'owner' | 'tenant' };
      if (fullName !== undefined) profile.full_name = fullName;
      if (flatId !== undefined) {
        const targetFlat = flats.find((f) => f.id === flatId && f.society_id === societyId);
        if (!targetFlat) {
          res.status(404).json({ error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found' } });
          return;
        }
        profile.flat_id = flatId;
        targetFlat.is_occupied = true;
      }
      if (residentType !== undefined) profile.role = residentType === 'owner' ? 'flat_owner' : 'tenant';
      res.status(200).json({ resident: { id: profile.id, fullName: profile.full_name, flatId: profile.flat_id, role: profile.role } });
    }
  );

  // ── DELETE residents (soft) ───────────────────────────────────
  app.delete(
    '/onboarding/societies/:societyId/residents/:userId',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, userId } = req.params as { societyId: string; userId: string };
      const profile = userProfiles.find((p) => p.id === userId && p.society_id === societyId);
      if (!profile) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      profile.is_active = false;
      res.status(204).end();
    }
  );

  // ── PATCH guards ──────────────────────────────────────────────
  app.patch(
    '/onboarding/societies/:societyId/guards/:guardId',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, guardId } = req.params as { societyId: string; guardId: string };
      const guard = guards.find((g) => g.id === guardId && g.society_id === societyId);
      if (!guard) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      const { gateName, shift, isActive } = req.body as { gateName?: string; shift?: string; isActive?: boolean };
      if (gateName !== undefined) guard.gate_name = gateName;
      if (shift !== undefined) guard.shift = shift;
      if (isActive !== undefined) {
        guard.is_active = isActive;
        // sync user_profiles
        const profile = userProfiles.find((p) => p.id === guard.user_id);
        if (profile) profile.is_active = isActive;
      }
      res.status(200).json({ guard: { id: guard.id, gateName: guard.gate_name, shift: guard.shift, isActive: guard.is_active } });
    }
  );

  // ── DELETE guards (soft) ──────────────────────────────────────
  app.delete(
    '/onboarding/societies/:societyId/guards/:guardId',
    authenticate, requireAdmin, requireSocietyAccess,
    (req: Request, res: Response) => {
      const { societyId, guardId } = req.params as { societyId: string; guardId: string };
      const guard = guards.find((g) => g.id === guardId && g.society_id === societyId);
      if (!guard) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
      guard.is_active = false;
      const profile = userProfiles.find((p) => p.id === guard.user_id);
      if (profile) profile.is_active = false;
      res.status(204).end();
    }
  );

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  });

  return app;
}

const app = buildApp();

// ============================================================
// Setup: seed test data
// ============================================================

beforeEach(() => {
  buildings = [
    { id: 'bld-1', society_id: SOCIETY_ID, name: 'Tower A', total_floors: 10 },
    { id: 'bld-2', society_id: SOCIETY_ID, name: 'Tower B', total_floors: 5 },
  ];

  flats = [
    { id: 'flat-1', society_id: SOCIETY_ID, building_id: 'bld-1', flat_number: '101', floor: 1, is_occupied: true },
    { id: 'flat-2', society_id: SOCIETY_ID, building_id: 'bld-1', flat_number: '102', floor: 1, is_occupied: false },
    { id: 'flat-3', society_id: SOCIETY_ID, building_id: 'bld-2', flat_number: '201', floor: 2, is_occupied: false },
  ];

  userProfiles = [
    { id: 'user-1', society_id: SOCIETY_ID, flat_id: 'flat-1', full_name: 'Rajan Kumar', phone: '+919000000001', role: 'flat_owner', is_active: true },
    { id: 'user-2', society_id: SOCIETY_ID, flat_id: 'flat-1', full_name: 'Priya Kumari', phone: '+919000000002', role: 'tenant', is_active: true },
    { id: 'user-3', society_id: SOCIETY_ID, flat_id: 'flat-2', full_name: 'Inactive User', phone: '+919000000003', role: 'flat_owner', is_active: false },
  ];

  guards = [
    { id: 'guard-1', society_id: SOCIETY_ID, user_id: 'guard-user-1', gate_name: 'Main Gate', shift: 'morning', is_active: true },
    { id: 'guard-2', society_id: SOCIETY_ID, user_id: 'guard-user-2', gate_name: 'North Gate', shift: 'night', is_active: true },
  ];
  // Corresponding guard user profiles
  userProfiles.push(
    { id: 'guard-user-1', society_id: SOCIETY_ID, flat_id: null, full_name: 'Ramesh Guard', phone: '+919001000001', role: 'guard', is_active: true },
    { id: 'guard-user-2', society_id: SOCIETY_ID, flat_id: null, full_name: 'Suresh Guard', phone: '+919001000002', role: 'guard', is_active: true },
  );
});

// ============================================================
// Tests: PATCH buildings
// ============================================================

describe('PATCH /onboarding/societies/:societyId/buildings/:id', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/buildings/bld-1`)
      .set('Authorization', 'Bearer resident-token')
      .send({ name: 'Tower X' });
    expect(res.status).toBe(403);
  });

  it('returns 200 and updated building', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/buildings/bld-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Tower Alpha', totalFloors: 15 });
    expect(res.status).toBe(200);
    expect(res.body.building).toMatchObject({ name: 'Tower Alpha', totalFloors: 15 });
  });

  it('returns 404 for unknown building', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/buildings/nonexistent`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Whatever' });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Tests: DELETE buildings
// ============================================================

describe('DELETE /onboarding/societies/:societyId/buildings/:id', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/buildings/bld-1`)
      .set('Authorization', 'Bearer resident-token');
    expect(res.status).toBe(403);
  });

  it('returns 409 when building has active flats', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/buildings/bld-1`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ACTIVE_FLATS');
  });

  it('returns 204 when building has no flats', async () => {
    // Remove flats from bld-2
    flats = flats.filter((f) => f.building_id !== 'bld-2');
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/buildings/bld-2`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(204);
    expect(buildings.find((b) => b.id === 'bld-2')).toBeUndefined();
  });
});

// ============================================================
// Tests: PATCH flats
// ============================================================

describe('PATCH /onboarding/societies/:societyId/flats/:id', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/flats/flat-1`)
      .set('Authorization', 'Bearer resident-token')
      .send({ flatNumber: '999' });
    expect(res.status).toBe(403);
  });

  it('returns 200 and updates flat number and floor', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/flats/flat-2`)
      .set('Authorization', 'Bearer admin-token')
      .send({ flatNumber: '102-A', floor: 2 });
    expect(res.status).toBe(200);
    expect(res.body.flat).toMatchObject({ flatNumber: '102-A', floor: 2 });
  });
});

// ============================================================
// Tests: DELETE flats
// ============================================================

describe('DELETE /onboarding/societies/:societyId/flats/:id', () => {
  it('returns 409 when flat has active residents', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/flats/flat-1`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ACTIVE_RESIDENTS');
  });

  it('returns 204 for a vacant flat', async () => {
    // flat-3 has no residents
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/flats/flat-3`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(204);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/flats/flat-3`)
      .set('Authorization', 'Bearer resident-token');
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Tests: PATCH residents (reassign flat)
// ============================================================

describe('PATCH /onboarding/societies/:societyId/residents/:userId', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer resident-token')
      .send({ fullName: 'Hacker' });
    expect(res.status).toBe(403);
  });

  it('reassigns resident to new flat — updates flat_id', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ flatId: 'flat-2' });
    expect(res.status).toBe(200);
    expect(res.body.resident.flatId).toBe('flat-2');
    // Verify in-memory
    const updatedProfile = userProfiles.find((p) => p.id === 'user-1');
    expect(updatedProfile?.flat_id).toBe('flat-2');
    // New flat should be marked occupied
    const targetFlat = flats.find((f) => f.id === 'flat-2');
    expect(targetFlat?.is_occupied).toBe(true);
  });

  it('returns 404 when target flat not found', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ flatId: 'nonexistent-flat' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FLAT_NOT_FOUND');
  });

  it('updates fullName', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ fullName: 'Rajan Kumar Updated' });
    expect(res.status).toBe(200);
    expect(res.body.resident.fullName).toBe('Rajan Kumar Updated');
  });
});

// ============================================================
// Tests: DELETE residents
// ============================================================

describe('DELETE /onboarding/societies/:societyId/residents/:userId', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer resident-token');
    expect(res.status).toBe(403);
  });

  it('soft-deletes resident (is_active = false)', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/residents/user-1`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(204);
    const profile = userProfiles.find((p) => p.id === 'user-1');
    expect(profile?.is_active).toBe(false);
  });
});

// ============================================================
// Tests: PATCH guards (toggle active)
// ============================================================

describe('PATCH /onboarding/societies/:societyId/guards/:guardId', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/guards/guard-1`)
      .set('Authorization', 'Bearer resident-token')
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('deactivating guard → guard.is_active becomes false', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/guards/guard-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.guard.isActive).toBe(false);
    const g = guards.find((g) => g.id === 'guard-1');
    expect(g?.is_active).toBe(false);
  });

  it('deactivated guard has is_active=false on user_profiles', async () => {
    await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/guards/guard-1`)
      .set('Authorization', 'Bearer admin-token')
      .send({ isActive: false });

    // Simulate what the auth middleware checks: user_profiles.is_active
    const guardProfile = userProfiles.find((p) => p.id === 'guard-user-1');
    expect(guardProfile?.is_active).toBe(false);
  });

  it('updates gate name and shift', async () => {
    const res = await request(app)
      .patch(`/onboarding/societies/${SOCIETY_ID}/guards/guard-2`)
      .set('Authorization', 'Bearer admin-token')
      .send({ gateName: 'South Gate', shift: 'afternoon' });
    expect(res.status).toBe(200);
    expect(res.body.guard).toMatchObject({ gateName: 'South Gate', shift: 'afternoon' });
  });
});

// ============================================================
// Tests: DELETE guards (soft delete)
// ============================================================

describe('DELETE /onboarding/societies/:societyId/guards/:guardId', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/guards/guard-1`)
      .set('Authorization', 'Bearer resident-token');
    expect(res.status).toBe(403);
  });

  it('soft-deletes guard', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/guards/guard-1`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(204);
    const g = guards.find((g) => g.id === 'guard-1');
    expect(g?.is_active).toBe(false);
  });

  it('returns 404 for unknown guard', async () => {
    const res = await request(app)
      .delete(`/onboarding/societies/${SOCIETY_ID}/guards/nonexistent`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(404);
  });
});
