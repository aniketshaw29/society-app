/**
 * Typed application error class.
 *
 * Throw this anywhere in route handlers or services; the global errorHandler
 * middleware will pick it up and format the response as:
 *
 *   { error: { code, message, details? } }
 *
 * The constructor argument order deliberately matches the T7-3 spec:
 *   new AppError(code, message, statusCode?, details?)
 *
 * Note: the existing errorHandler.ts already defines an AppError with a
 * different constructor order (statusCode, code, message). This file provides
 * the new canonical version for forward-looking code. The errorHandler has
 * been updated to accept both shapes (instanceof check is shared).
 */
export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: unknown

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    // Maintain proper V8 stack trace
    Error.captureStackTrace(this, AppError)
  }

  // ── Static factory helpers ─────────────────────────────────────────────────

  static notFound(code: string, message: string): AppError {
    return new AppError(code, message, 404)
  }

  static forbidden(code: string, message: string): AppError {
    return new AppError(code, message, 403)
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(code, message, 409)
  }

  static badRequest(code: string, message: string, details?: unknown): AppError {
    return new AppError(code, message, 400, details)
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError('unauthorized', message, 401)
  }

  static internal(message = 'An unexpected error occurred'): AppError {
    return new AppError('server_error', message, 500)
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.'): AppError {
    return new AppError('too_many_requests', message, 429)
  }
}
