import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError as LibAppError } from '../lib/AppError';

// ============================================================
// Application-level error class
// Re-exported for backwards compatibility — routes may import
// AppError from either location; both share the same instanceof
// check via a common interface.
// ============================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  /**
   * Supports both call signatures:
   *   Legacy:  new AppError(statusCode, code, message, details?)
   *   New lib: handled by ../lib/AppError — import from there for new code
   */
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, AppError);
  }
}

// Convenience constructors (legacy API — prefer lib/AppError in new code)
export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),

  unauthorized: (message = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),

  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),

  conflict: (message: string) =>
    new AppError(409, 'CONFLICT', message),

  tooManyRequests: (message = 'Too many requests. Please try again later.') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),

  internal: (message = 'An unexpected error occurred') =>
    new AppError(500, 'INTERNAL_SERVER_ERROR', message),
};

// ============================================================
// Error detection helpers
// ============================================================

function isSupabaseError(err: unknown): err is { code: string; message: string; details?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err
  );
}

function formatZodError(err: ZodError): unknown {
  return err.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

// ============================================================
// Global error handler middleware
// ============================================================

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env['NODE_ENV'] === 'development';

  // 1. Known application errors — handles both AppError from this file
  //    AND AppError from lib/AppError.ts (both have code + statusCode)
  if (err instanceof AppError || err instanceof LibAppError) {
    const appErr = err as { code: string; statusCode: number; message: string; details?: unknown };
    res.status(appErr.statusCode).json({
      error: {
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      },
    });
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: formatZodError(err),
      },
    });
    return;
  }

  // 3. Supabase/PostgREST errors
  if (isSupabaseError(err)) {
    const supabaseCodeMap: Record<string, number> = {
      PGRST116: 404,  // No rows returned
      PGRST301: 409,  // Conflict
      '23505': 409,   // Unique violation
      '23503': 400,   // FK violation
      '42501': 403,   // Insufficient privilege
    };

    const statusCode = supabaseCodeMap[err.code] ?? 500;

    res.status(statusCode).json({
      error: {
        code: `DB_${err.code}`,
        message: isDev ? err.message : 'A database error occurred',
        ...(isDev && err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 4. JWT / Auth errors
  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Token is invalid',
      },
    });
    return;
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Token has expired. Please sign in again.',
      },
    });
    return;
  }

  // 5. Generic JavaScript errors
  if (err instanceof Error) {
    console.error('[ErrorHandler] Unhandled error:', {
      name: err.name,
      message: err.message,
      stack: isDev ? err.stack : undefined,
      url: req.url,
      method: req.method,
    });

    res.status(500).json({
      error: {
        code: 'server_error',
        message: isDev ? err.message : 'An unexpected error occurred',
        ...(isDev ? { stack: err.stack } : {}),
      },
    });
    return;
  }

  // 6. Unknown error shape
  console.error('[ErrorHandler] Unknown error type:', err);
  res.status(500).json({
    error: {
      code: 'server_error',
      message: 'An unexpected error occurred',
    },
  });
}

// ============================================================
// 404 handler (for unmatched routes)
// ============================================================

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
