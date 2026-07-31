import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// ============================================================
// Application-level error class
// ============================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Maintain proper stack trace (V8)
    Error.captureStackTrace(this, AppError);
  }
}

// Convenience constructors
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

  // 1. Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formatZodError(err),
      },
    });
    return;
  }

  // 3. Supabase/PostgREST errors
  if (isSupabaseError(err)) {
    // Common Supabase error codes
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
        code: 'INVALID_TOKEN',
        message: 'Token is invalid',
      },
    });
    return;
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
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
        code: 'INTERNAL_SERVER_ERROR',
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
      code: 'INTERNAL_SERVER_ERROR',
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
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
