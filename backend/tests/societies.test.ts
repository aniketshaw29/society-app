import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test environment setup
// ============================================================

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3002';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// In-memory store for test societies
// ============================================================

interface StoredSociety {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  invite_code: string;
  total_flats: number;
  is_active: boolean;
  created_at: string;
}

let societyStore: StoredSociety[] = [];
let inviteCodeCounter = 0;

function generateTestInviteCode(): string {
  inviteCodeCounter++;
  return `ABC${String(inviteCodeCounter).padStart(3, '0')}`;
}

// ============================================================
// Build test app — mocks supabaseAdmin instead of hitting DB
// ============================================================

function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Stub authenticate middleware: require Bearer token
  const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Authorization header is required.' } });
      return;
    }
    // Token 'admin-token' → society_admin, others → flat_owner
    const token = auth.slice(7);
    if (token === 'admin-token') {
      req.user = { id: 'user-admin-1', role: 'society_admin', society_id: null, flat_id: null };
    } else if (token === 'user-token') {
      req.user = { id: 'user-resident-1', role: 'flat_owner', society_id: null, flat_id: null };
    } else {
      req.user = { id: 'user-other-1', role: 'flat_owner', society_id: null, flat_id: null };
    }
    next();
  };

  // POST /societies
  app.post('/societies', authenticate, (req: Request, res: Response) => {
    const { name, address, city, state, pincode } = req.body as Record<string, string>;

    // Validate required fields
    if (!name || !address || !city || !state || !pincode) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: ['name', 'address', 'city', 'state', 'pincode']
            .filter((f) => !(req.body as Record<string, string>)[f])
            .map((f) => ({ field: f, message: `${f} is required` })),
        },
      });
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: [{ field: 'pincode', message: 'Pincode must be exactly 6 digits' }],
        },
      });
      return;
    }

    // Duplicate check
    const existing = societyStore.find((s) => s.name === name && s.pincode === pincode);
    if (existing) {
      res.status(409).json({
        warning: true,
        message: 'A society with the same name and pincode already exists.',
        existingSociety: { id: existing.id, name: existing.name, city: existing.city, pincode: existing.pincode },
      });
      return;
    }

    const society: StoredSociety = {
      id: `society-${Date.now()}`,
      name,
      address,
      city,
      state,
      pincode,
      invite_code: generateTestInviteCode(),
      total_flats: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    societyStore.push(society);

    res.status(201).json({
      society: {
        id: society.id,
        name: society.name,
        address: society.address,
        city: society.city,
        state: society.state,
        pincode: society.pincode,
        invite_code: society.invite_code,
        total_flats: society.total_flats,
        is_active: society.is_active,
        created_at: society.created_at,
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

// Reset store between test suites
beforeEach(() => {
  societyStore = [];
  inviteCodeCounter = 0;
});

// ============================================================
// Tests: POST /societies
// ============================================================

describe('POST /societies', () => {
  const validBody = {
    name: 'Sunrise Apartments',
    address: '123 MG Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
  };

  it('returns 201 with society object and invite_code', async () => {
    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('society');
    expect(res.body.society).toMatchObject({
      name: 'Sunrise Apartments',
      city: 'Bangalore',
      pincode: '560001',
    });
    expect(res.body.society).toHaveProperty('invite_code');
    expect(res.body.society).toHaveProperty('id');
  });

  it('invite_code is 6 characters', async () => {
    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(201);
    const { invite_code } = res.body.society as { invite_code: string };
    expect(invite_code).toHaveLength(6);
  });

  it('invite_code contains only uppercase alphanumeric characters', async () => {
    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(201);
    const { invite_code } = res.body.society as { invite_code: string };
    expect(invite_code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/societies').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 422 when name is missing', async () => {
    const { name: _name, ...bodyWithoutName } = validBody;

    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(bodyWithoutName);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('returns 422 when pincode is not 6 digits', async () => {
    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send({ ...validBody, pincode: '1234' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 with warning flag for duplicate name+pincode', async () => {
    // First creation
    await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    // Duplicate
    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('warning', true);
    expect(res.body).toHaveProperty('existingSociety');
    expect(res.body.existingSociety).toMatchObject({ name: 'Sunrise Apartments', pincode: '560001' });
  });

  it('allows same name with different pincode', async () => {
    await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send(validBody);

    const res = await request(app)
      .post('/societies')
      .set('Authorization', 'Bearer user-token')
      .send({ ...validBody, pincode: '560002' });

    expect(res.status).toBe(201);
  });
});
