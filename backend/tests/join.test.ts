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
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// In-memory data
// ============================================================

const SOCIETY_ID = 'society-test-001';
const FLAT_ID = 'flat-test-001';
const VALID_INVITE = 'ABCD23';
const INVALID_INVITE = 'XXXXXX';

interface JoinedProfile {
  userId: string;
  societyId: string;
  flatId: string;
}

let joinedProfiles: JoinedProfile[] = [];

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
    req.user = { id: 'user-resident-1', role: 'flat_owner', society_id: null, flat_id: null };
    next();
  };

  // GET /societies/by-invite/:code
  app.get('/societies/by-invite/:code', authenticate, (req: Request, res: Response) => {
    const { code } = req.params as { code: string };
    const upper = code.toUpperCase();

    if (upper === VALID_INVITE) {
      res.status(200).json({
        society: {
          id: SOCIETY_ID,
          name: 'Sunrise Apartments',
          city: 'Bangalore',
          state: 'Karnataka',
          address: '123 MG Road',
          totalFlats: 50,
        },
      });
      return;
    }

    res.status(404).json({
      error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found for this invite code' },
    });
  });

  // POST /societies/:societyId/join
  app.post('/societies/:societyId/join', authenticate, (req: Request, res: Response) => {
    const { societyId } = req.params as { societyId: string };
    const { inviteCode, flatId, residentType, fullName } = req.body as {
      inviteCode?: string;
      flatId?: string;
      residentType?: string;
      fullName?: string;
    };

    // Validation
    if (!inviteCode || !flatId || !residentType || !fullName) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: [
            ...(!inviteCode ? [{ field: 'inviteCode', message: 'inviteCode is required' }] : []),
            ...(!flatId ? [{ field: 'flatId', message: 'flatId is required' }] : []),
            ...(!residentType ? [{ field: 'residentType', message: 'residentType is required' }] : []),
            ...(!fullName ? [{ field: 'fullName', message: 'fullName is required' }] : []),
          ],
        },
      });
      return;
    }

    // Verify invite code matches society
    if (inviteCode.toUpperCase() !== VALID_INVITE || societyId !== SOCIETY_ID) {
      res.status(404).json({
        error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found or invite code is invalid' },
      });
      return;
    }

    const userId = req.user!.id;

    // Check duplicate join
    const existing = joinedProfiles.find(
      (p) => p.userId === userId && p.societyId === societyId && p.flatId === flatId
    );
    if (existing) {
      res.status(409).json({
        error: { code: 'ALREADY_JOINED', message: 'You have already joined this society and flat' },
      });
      return;
    }

    joinedProfiles.push({ userId, societyId, flatId });

    const role = residentType === 'owner' ? 'flat_owner' : 'tenant';

    res.status(201).json({
      profile: {
        id: userId,
        phone: '+919876543210',
        fullName,
        role,
        societyId,
        flatId,
      },
      society: {
        id: SOCIETY_ID,
        name: 'Sunrise Apartments',
      },
    });
  });

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
  joinedProfiles = [];
});

// ============================================================
// Tests: GET /societies/by-invite/:code
// ============================================================

describe('GET /societies/by-invite/:code', () => {
  it('returns 404 for an invalid invite code', async () => {
    const res = await request(app)
      .get(`/societies/by-invite/${INVALID_INVITE}`)
      .set('Authorization', 'Bearer user-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SOCIETY_NOT_FOUND');
  });

  it('returns 200 with society info for a valid invite code', async () => {
    const res = await request(app)
      .get(`/societies/by-invite/${VALID_INVITE}`)
      .set('Authorization', 'Bearer user-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('society');
    expect(res.body.society).toMatchObject({
      id: SOCIETY_ID,
      name: 'Sunrise Apartments',
    });
  });

  it('is case-insensitive for invite code lookup', async () => {
    const res = await request(app)
      .get(`/societies/by-invite/${VALID_INVITE.toLowerCase()}`)
      .set('Authorization', 'Bearer user-token');

    expect(res.status).toBe(200);
    expect(res.body.society.name).toBe('Sunrise Apartments');
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get(`/societies/by-invite/${VALID_INVITE}`);

    expect(res.status).toBe(401);
  });
});

// ============================================================
// Tests: POST /societies/:societyId/join
// ============================================================

describe('POST /societies/:societyId/join', () => {
  const validBody = {
    inviteCode: VALID_INVITE,
    flatId: FLAT_ID,
    residentType: 'owner',
    fullName: 'Priya Sharma',
  };

  it('returns 201 with profile and society on valid join', async () => {
    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('profile');
    expect(res.body).toHaveProperty('society');
    expect(res.body.profile).toMatchObject({
      fullName: 'Priya Sharma',
      role: 'flat_owner',
      societyId: SOCIETY_ID,
      flatId: FLAT_ID,
    });
  });

  it('returns 409 when same user tries to join same flat twice', async () => {
    await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_JOINED');
  });

  it('returns 404 for wrong invite code', async () => {
    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send({ ...validBody, inviteCode: INVALID_INVITE });

    expect(res.status).toBe(404);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send({ inviteCode: VALID_INVITE });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('assigns tenant role for residentType=tenant', async () => {
    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .set('Authorization', 'Bearer user-token')
      .send({ ...validBody, residentType: 'tenant' });

    expect(res.status).toBe(201);
    expect(res.body.profile.role).toBe('tenant');
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post(`/societies/${SOCIETY_ID}/join`)
      .send(validBody);

    expect(res.status).toBe(401);
  });
});
