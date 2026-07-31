import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendPushToMany } from '../lib/firebase';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const triggerSosSchema = z.object({
  message: z.string().trim().max(500).optional(),
});

const resolveQuerySchema = z.object({
  status: z.enum(['active', 'resolved']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

// ---------------------------------------------------------------------------
// Shape returned to clients
// ---------------------------------------------------------------------------

interface SosAlert {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  message: string;
  status: 'active' | 'resolved';
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapSosAlert(row: Record<string, unknown>): SosAlert {
  return {
    id: row['id'] as string,
    societyId: row['society_id'] as string,
    flatId: row['flat_id'] as string,
    residentId: row['resident_id'] as string,
    message: row['message'] as string,
    status: row['status'] as 'active' | 'resolved',
    resolvedAt: (row['resolved_at'] as string | null) ?? null,
    resolvedBy: (row['resolved_by'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function getTokensByRole(
  societyId: string,
  roles: string[]
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .in(
      'user_id',
      supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('society_id', societyId)
        .in('role', roles)
        .eq('is_active', true)
    );

  if (error || !data) {
    console.error('[sos] getTokensByRole error:', error?.message);
    return [];
  }
  return data.map((row: { token: string }) => row.token);
}

// ---------------------------------------------------------------------------
// POST /sos
// Auth: resident (flat_owner or tenant)
// Body: { message?: string }
// ---------------------------------------------------------------------------

const triggerSos: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!['flat_owner', 'tenant'].includes(user.role)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only residents can trigger SOS alerts.' },
      });
      return;
    }

    if (!user.flat_id || !user.society_id) {
      throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat to trigger SOS.');
    }

    const parsed = triggerSosSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
      return;
    }

    const message =
      parsed.data.message?.trim() || 'Emergency! Please help.';

    // Fetch resident profile for display name + flat number
    const [profileResult, flatResult] = await Promise.all([
      supabaseAdmin
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('flats')
        .select('flat_number')
        .eq('id', user.flat_id)
        .maybeSingle(),
    ]);

    const residentName =
      (profileResult.data as Record<string, unknown> | null)?.['full_name'] as string | null ??
      'A resident';
    const flatNumber =
      (flatResult.data as Record<string, unknown> | null)?.['flat_number'] as string | null ??
      'Unknown';

    // Insert SOS alert row
    const { data: sosRow, error: insertError } = await supabaseAdmin
      .from('sos_alerts')
      .insert({
        society_id: user.society_id,
        flat_id: user.flat_id,
        resident_id: user.id,
        message,
        status: 'active',
      })
      .select('id, status, created_at')
      .single();

    if (insertError || !sosRow) {
      throw new AppError(500, 'SOS_CREATE_FAILED', insertError?.message ?? 'Failed to create SOS alert');
    }

    const sos = sosRow as Record<string, unknown>;

    res.status(201).json({
      sos: {
        id: sos['id'] as string,
        status: sos['status'] as string,
        createdAt: sos['created_at'] as string,
      },
    });

    // ── Fire-and-forget FCM to guards + admins ─────────────────────────
    void (async () => {
      try {
        const [guardTokens, adminTokens] = await Promise.all([
          getTokensByRole(user.society_id!, ['guard']),
          getTokensByRole(user.society_id!, ['society_admin']),
        ]);

        const allTokens = [...new Set([...guardTokens, ...adminTokens])];

        if (allTokens.length === 0) {
          console.log(`[sos] No FCM tokens found for society ${user.society_id}`);
          return;
        }

        const notifTitle = 'SOS Alert';
        const notifBody = `${residentName} at Flat ${flatNumber} needs help!`;

        const { sendPushToMany: sendMany } = await import('../lib/firebase');
        await sendMany(allTokens, notifTitle, notifBody, {
          type: 'sos_alert',
          sosId: sos['id'] as string,
          societyId: user.society_id!,
          flatId: user.flat_id!,
          residentName,
          flatNumber,
          message,
          // Android high priority
          android_priority: 'high',
        });
      } catch (fcmErr) {
        console.error('[sos] FCM dispatch error (non-fatal):', fcmErr);
      }
    })();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /sos/history
// Auth: resident (own flat) or society_admin (all alerts for society)
// Query: ?status=active|resolved&limit=20&page=1
// ---------------------------------------------------------------------------

const getSosHistory: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society to view SOS history.');
    }

    const parsed = resolveQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
        },
      });
      return;
    }

    const { status, limit, page } = parsed.data;
    const offset = (page - 1) * limit;

    const isAdmin = ['society_admin', 'super_admin'].includes(user.role);

    let query = supabaseAdmin
      .from('sos_alerts')
      .select('*', { count: 'exact' })
      .eq('society_id', user.society_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Residents see only their flat's alerts
    if (!isAdmin) {
      if (!user.flat_id) {
        throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat.');
      }
      query = query.eq('flat_id', user.flat_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      alerts: (data ?? []).map((row) => mapSosAlert(row as Record<string, unknown>)),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /sos/:id/resolve
// Auth: guard or society_admin
// ---------------------------------------------------------------------------

const resolveSos: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params as { id: string };

    const isPrivileged = ['guard', 'society_admin', 'super_admin'].includes(user.role);
    if (!isPrivileged) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only guards or society admins can resolve SOS alerts.' },
      });
      return;
    }

    // Fetch the alert to validate society ownership
    const { data: existing, error: findError } = await supabaseAdmin
      .from('sos_alerts')
      .select('id, society_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SOS alert not found.' } });
      return;
    }

    const row = existing as Record<string, unknown>;

    if (row['society_id'] !== user.society_id && user.role !== 'super_admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    if (row['status'] === 'resolved') {
      res.status(409).json({ error: { code: 'ALREADY_RESOLVED', message: 'SOS alert already resolved.' } });
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('sos_alerts')
      .update({
        status: 'resolved',
        resolved_at: now,
        resolved_by: user.id,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Failed to resolve SOS alert');
    }

    res.status(200).json({
      sos: mapSosAlert(updated as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// POST /sos
router.post('/', requireRole('flat_owner', 'tenant'), triggerSos);

// GET /sos/history — must come before /:id
router.get('/history', getSosHistory);

// PATCH /sos/:id/resolve
router.patch('/:id/resolve', requireRole('guard', 'society_admin', 'super_admin'), resolveSos);

export default router;
