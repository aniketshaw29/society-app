import { Request, Response, NextFunction } from 'express';

// ============================================================
// Express Request augmentation — adds req.user
// ============================================================
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthUser {
  id: string;
  role: string;
  society_id: string | null;
  flat_id: string | null;
  email?: string;
}

// ============================================================
// API response shapes
// ============================================================

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    has_more?: boolean;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================
// Pagination
// ============================================================

export interface PaginationQuery {
  page: number;
  per_page: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationQuery {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10) || 1);
  const per_page = Math.min(
    100,
    Math.max(1, parseInt(String(query['per_page'] ?? '20'), 10) || 20)
  );
  return { page, per_page, offset: (page - 1) * per_page };
}

// ============================================================
// Typed request helpers
// ============================================================

export type TypedRequest<
  TBody = Record<string, unknown>,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>
> = Request<TParams, ApiResponse, TBody, TQuery>;

export type TypedResponse<T = unknown> = Response<ApiResponse<T>>;

export type TypedHandler<
  TBody = Record<string, unknown>,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  TData = unknown
> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: TypedResponse<TData>,
  next: NextFunction
) => Promise<void> | void;
