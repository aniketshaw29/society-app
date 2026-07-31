import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

const VERSION = process.env['npm_package_version'] ?? '1.0.0';

/**
 * GET /health
 * Basic health check — always responds 200 if the server is up.
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
      environment: process.env['NODE_ENV'] ?? 'unknown',
    },
  });
});

/**
 * GET /health/db
 * Checks the Supabase database connection.
 * Returns 200 if connected, 503 if not reachable.
 */
router.get('/db', async (_req: Request, res: Response) => {
  const start = Date.now();

  try {
    // Lightweight query — just checks connectivity
    const { error } = await supabaseAdmin
      .from('societies')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      console.error('[HealthCheck] Database query failed:', error.message);
      res.status(503).json({
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database connection failed',
          details: {
            latency_ms: latencyMs,
            error: error.message,
          },
        },
      });
      return;
    }

    res.status(200).json({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        latency_ms: latencyMs,
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';

    console.error('[HealthCheck] Unexpected database error:', message);

    res.status(503).json({
      error: {
        code: 'DB_ERROR',
        message: 'Database health check failed',
        details: {
          latency_ms: latencyMs,
          error: message,
        },
      },
    });
  }
});

export default router;
