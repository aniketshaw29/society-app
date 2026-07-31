/**
 * Tests for the global error handler middleware and AppError class.
 *
 * Run with: npx jest errorHandler.test.ts
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { AppError, errorHandler, notFoundHandler, Errors } from './errorHandler';
import { AppError as LibAppError } from '../lib/AppError';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
  } as unknown as Response;

  const mockStatus = jest.fn().mockReturnValue(res);
  const mockJson = jest.fn().mockImplementation((body) => {
    (res as { body: unknown }).body = body;
    return res;
  });

  Object.assign(res, { status: mockStatus, json: mockJson });
  return { res, mockStatus, mockJson };
}

function buildMockReq(overrides: Partial<Request> = {}): Request {
  return {
    url: '/test',
    method: 'GET',
    path: '/test',
    ...overrides,
  } as Request;
}

const noop: NextFunction = () => {};

// ── AppError (legacy middleware class) ────────────────────────────────────────

describe('AppError (middleware)', () => {
  it('creates an error with the correct properties', () => {
    const err = new AppError(404, 'not_found', 'Resource not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('AppError');
  });

  it('stores optional details', () => {
    const err = new AppError(400, 'validation_error', 'Bad input', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});

// ── LibAppError (lib/AppError.ts) ─────────────────────────────────────────────

describe('AppError (lib/AppError.ts)', () => {
  it('creates an error with code, message, statusCode', () => {
    const err = LibAppError.notFound('visitor_not_found', 'Visitor not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('visitor_not_found');
  });

  it('defaults statusCode to 400', () => {
    const err = new LibAppError('bad_input', 'Bad input');
    expect(err.statusCode).toBe(400);
  });

  it('static factories set correct status codes', () => {
    expect(LibAppError.forbidden('forbidden', 'No').statusCode).toBe(403);
    expect(LibAppError.conflict('already_exists', 'Exists').statusCode).toBe(409);
    expect(LibAppError.unauthorized().statusCode).toBe(401);
    expect(LibAppError.internal().statusCode).toBe(500);
  });
});

// ── errorHandler middleware ───────────────────────────────────────────────────

describe('errorHandler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('formats AppError (middleware class) correctly', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const err = new AppError(422, 'invalid_input', 'Bad field');

    errorHandler(err, buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(422);
    expect(mockJson).toHaveBeenCalledWith({
      error: { code: 'invalid_input', message: 'Bad field' },
    });
  });

  it('formats AppError (lib/AppError.ts) correctly', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const err = LibAppError.notFound('not_found', 'Record not found');

    errorHandler(err, buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({
      error: { code: 'not_found', message: 'Record not found' },
    });
  });

  it('includes details when present on AppError', () => {
    const { res, mockJson } = buildMockRes();
    const err = new AppError(400, 'validation_error', 'Validation failed', [{ field: 'name' }]);

    errorHandler(err, buildMockReq(), res, noop);

    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'validation_error',
        message: 'Validation failed',
        details: [{ field: 'name' }],
      },
    });
  });

  it('returns 422 with field details for ZodError', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const issue: ZodIssue = {
      code: 'too_small',
      minimum: 1,
      type: 'string',
      inclusive: true,
      exact: false,
      message: 'String must contain at least 1 character(s)',
      path: ['name'],
    };
    const zodErr = new ZodError([issue]);

    errorHandler(zodErr, buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(422);
    const body = mockJson.mock.calls[0][0] as {
      error: { code: string; details: { field: string }[] };
    };
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details[0].field).toBe('name');
  });

  it('returns 500 for a generic Error', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const err = new Error('Unexpected crash');

    errorHandler(err, buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'server_error' }),
      })
    );
  });

  it('returns 500 for unknown non-Error values', () => {
    const { res, mockStatus } = buildMockRes();

    errorHandler('some string error', buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(500);
  });

  it('handles JWT JsonWebTokenError with 401', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const err = Object.assign(new Error('invalid signature'), {
      name: 'JsonWebTokenError',
    });

    errorHandler(err, buildMockReq(), res, noop);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({
      error: { code: 'unauthorized', message: 'Token is invalid' },
    });
  });
});

// ── notFoundHandler ───────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('returns 404 for unknown routes', () => {
    const { res, mockStatus, mockJson } = buildMockRes();
    const req = buildMockReq({ method: 'GET', path: '/unknown/route' });

    notFoundHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'not_found',
        message: 'Route GET /unknown/route not found',
      },
    });
  });
});

// ── Errors convenience constructors ──────────────────────────────────────────

describe('Errors convenience constructors', () => {
  it.each([
    ['badRequest', 400, 'BAD_REQUEST'],
    ['unauthorized', 401, 'UNAUTHORIZED'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['conflict', 409, 'CONFLICT'],
    ['tooManyRequests', 429, 'TOO_MANY_REQUESTS'],
    ['internal', 500, 'INTERNAL_SERVER_ERROR'],
  ])('Errors.%s() produces statusCode %i', (method, expectedStatus, expectedCode) => {
    const fn = Errors[method as keyof typeof Errors] as (msg?: string) => AppError;
    const err = fn('test message');
    expect(err.statusCode).toBe(expectedStatus);
    expect(err.code).toBe(expectedCode);
  });

  it('Errors.notFound() includes the resource in the message', () => {
    const err = Errors.notFound('Visitor');
    expect(err.message).toContain('Visitor');
    expect(err.statusCode).toBe(404);
  });
});
