import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthUser } from '../types';

/**
 * Extract the Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Middleware: Verify Supabase JWT and populate req.user.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify with Supabase admin (validates signature + expiry)
 * 3. Fetch the user's profile (role, society_id, flat_id) from user_profiles
 * 4. Attach to req.user
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization header is required. Use: Bearer <token>',
      },
    });
    return;
  }

  // Verify the JWT with Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or has expired. Please sign in again.',
      },
    });
    return;
  }

  const supabaseUser = authData.user;

  // Fetch user profile for role and society context
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role, society_id, flat_id')
    .eq('id', supabaseUser.id)
    .single();

  if (profileError || !profile) {
    // User authenticated but has no profile yet (e.g., mid-onboarding)
    // Allow through with minimal context so onboarding endpoints can proceed
    const user: AuthUser = {
      id: supabaseUser.id,
      role: 'flat_owner',
      society_id: null,
      flat_id: null,
      email: supabaseUser.email,
    };
    req.user = user;
    next();
    return;
  }

  // Check if user is active
  const { data: activeCheck } = await supabaseAdmin
    .from('user_profiles')
    .select('is_active')
    .eq('id', supabaseUser.id)
    .single();

  if (activeCheck && !activeCheck.is_active) {
    res.status(403).json({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact the society admin.',
      },
    });
    return;
  }

  const user: AuthUser = {
    id: supabaseUser.id,
    role: profile.role,
    society_id: profile.society_id ?? null,
    flat_id: profile.flat_id ?? null,
    email: supabaseUser.email,
  };

  req.user = user;
  next();
}

/**
 * Middleware: Require user to have one of the given roles.
 * Must be used AFTER authenticate().
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Require user to belong to a specific society.
 * Reads society_id from req.params.societyId or req.body.society_id.
 * Must be used AFTER authenticate().
 */
export function requireSocietyAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  // Super admins bypass society checks
  if (req.user.role === 'super_admin') {
    next();
    return;
  }

  const requestedSocietyId =
    (req.params['societyId'] as string | undefined) ||
    (req.body as Record<string, string>)['society_id'];

  if (requestedSocietyId && req.user.society_id !== requestedSocietyId) {
    res.status(403).json({
      error: {
        code: 'CROSS_SOCIETY_ACCESS',
        message: 'You do not have access to this society.',
      },
    });
    return;
  }

  next();
}
