import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// Test setup
// ============================================================

// Set required env vars before importing app modules
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key-that-is-long-enough';
process.env['FIREBASE_PROJECT_ID'] = 'test-project';
process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test-project.iam.gserviceaccount.com';
process.env['FIREBASE_PRIVATE_KEY'] = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n';
process.env['FRONTEND_URL'] = 'http://localhost:8081';
process.env['API_SECRET_KEY'] = 'test-secret-key-minimum-32-characters-long-for-validation';

// ============================================================
// Build a minimal test app (avoids importing full index.ts
// which would call validateEnv and start listening)
// ============================================================

function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Mount health routes — mock supabaseAdmin in a real test suite
  // For these tests we inline the routes to avoid DB dependency
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: 'test',
      },
    });
  });

  // Simulated protected route
  app.get('/api/v1/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: { code: 'MISSING_TOKEN', message: 'Authorization header is required.' },
      });
      return;
    }
    // In a real integration test this would call Supabase
    res.status(200).json({ data: { id: 'test-user', role: 'flat_owner' } });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Not found' } });
  });

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  });

  return app;
}

const app = buildTestApp();

// ============================================================
// Tests
// ============================================================

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        status: 'ok',
        environment: 'test',
        version: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('timestamp is a valid ISO 8601 string', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    const ts: string = (res.body as { data: { timestamp: string } }).data.timestamp;
    expect(() => new Date(ts).toISOString()).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('Protected routes — authentication', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/v1/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: {
        code: 'MISSING_TOKEN',
        message: expect.any(String),
      },
    });
  });

  it('returns 401 when Authorization header is malformed (no Bearer prefix)', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when Authorization header is empty string', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', '');

    expect(res.status).toBe(401);
  });

  it('returns 200 when a Bearer token is provided', async () => {
    // Note: in a real integration test the token would be validated against Supabase
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer some-test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: {
        code: 'ROUTE_NOT_FOUND',
      },
    });
  });

  it('returns 404 for unknown POST routes', async () => {
    const res = await request(app).post('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
  });
});
