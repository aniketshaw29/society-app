import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendNoticeToAudience } from '../services/noticeScheduler';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createNoticeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(5000),
  audience: z.union([
    z.literal('all'),
    z.literal('guards'),
    z.string().regex(/^building:[0-9a-f-]{36}$/, 'audience must be "all", "guards", or "building:<uuid>"'),
  ]),
  noticeType: z.enum(['general', 'urgent', 'event', 'maintenance']),
  isPinned: z.boolean().optional().default(false),
  scheduledAt: z.string().datetime().optional(),
});

const updateNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  audience: z.union([
    z.literal('all'),
    z.literal('guards'),
    z.string().regex(/^building:[0-9a-f-]{36}$/),
  ]).optional(),
  noticeType: z.enum(['general', 'urgent', 'event', 'maintenance']).optional(),
  isPinned: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

// ---------------------------------------------------------------------------
// Shape returned to clients
// ---------------------------------------------------------------------------

interface Notice {
  id: string;
  societyId: string;
  createdBy: string;
  title: string;
  body: string;
  audience: string;
  noticeType: string;
  isPinned: boolean;
  status: 'draft' | 'published' | 'archived';
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapNotice(row: Record<string, unknown>): Notice {
  return {
    id: row['id'] as string,
    societyId: row['society_id'] as string,
    createdBy: row['created_by'] as string,
    title: row['title'] as string,
    body: row['body'] as string,
    audience: row['audience'] as string,
    noticeType: row['notice_type'] as string,
    isPinned: row['is_pinned'] as boolean,
    status: row['status'] as 'draft' | 'published' | 'archived',
    scheduledAt: (row['scheduled_at'] as string | null) ?? null,
    publishedAt: (row['published_at'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ---------------------------------------------------------------------------
// POST /notices
// Auth: society_admin
// ---------------------------------------------------------------------------

const createNotice: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const parsed = createNoticeSchema.safeParse(req.body);
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

    const { title, body, audience, noticeType, isPinned, scheduledAt } = parsed.data;

    const now = new Date();
    const isScheduled = scheduledAt ? new Date(scheduledAt) > now : false;
    const status = isScheduled ? 'draft' : 'published';
    const publishedAt = isScheduled ? null : now.toISOString();

    const { data: notice, error: insertError } = await supabaseAdmin
      .from('notices')
      .insert({
        society_id: user.society_id,
        created_by: user.id,
        title,
        body,
        audience,
        notice_type: noticeType,
        is_pinned: isPinned ?? false,
        status,
        scheduled_at: scheduledAt ?? null,
        published_at: publishedAt,
      })
      .select('*')
      .single();

    if (insertError || !notice) {
      throw new AppError(500, 'CREATE_FAILED', insertError?.message ?? 'Failed to create notice');
    }

    const mapped = mapNotice(notice as Record<string, unknown>);

    res.status(201).json({ notice: mapped });

    // Fire-and-forget FCM if published immediately
    if (status === 'published') {
      void sendNoticeToAudience(mapped, user.society_id);
    }
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /notices
// Auth: any authenticated user in society
// ---------------------------------------------------------------------------

const listNotices: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      });
      return;
    }

    const { limit, page } = parsed.data;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('notices')
      .select('*', { count: 'exact' })
      .eq('society_id', user.society_id)
      .eq('status', 'published')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      notices: (data ?? []).map((row) => mapNotice(row as Record<string, unknown>)),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /notices/:id
// Auth: society_admin, same society
// ---------------------------------------------------------------------------

const updateNotice: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params as { id: string };

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    // Fetch the existing notice
    const { data: existing, error: findError } = await supabaseAdmin
      .from('notices')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notice not found.' } });
      return;
    }

    const row = existing as Record<string, unknown>;

    // Must belong to same society
    if (row['society_id'] !== user.society_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    // Cannot edit archived notices
    if (row['status'] === 'archived') {
      res.status(409).json({ error: { code: 'NOTICE_ARCHIVED', message: 'Cannot edit an archived notice.' } });
      return;
    }

    const parsed = updateNoticeSchema.safeParse(req.body);
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

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const { title, body, audience, noticeType, isPinned, scheduledAt } = parsed.data;
    if (title !== undefined) updates['title'] = title;
    if (body !== undefined) updates['body'] = body;
    if (audience !== undefined) updates['audience'] = audience;
    if (noticeType !== undefined) updates['notice_type'] = noticeType;
    if (isPinned !== undefined) updates['is_pinned'] = isPinned;

    if (scheduledAt !== undefined) {
      if (scheduledAt === null) {
        updates['scheduled_at'] = null;
        // Publish immediately if clearing schedule
        updates['status'] = 'published';
        updates['published_at'] = new Date().toISOString();
      } else {
        const schedDate = new Date(scheduledAt);
        if (schedDate > new Date()) {
          updates['scheduled_at'] = scheduledAt;
          updates['status'] = 'draft';
          updates['published_at'] = null;
        } else {
          updates['scheduled_at'] = null;
          updates['status'] = 'published';
          updates['published_at'] = new Date().toISOString();
        }
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('notices')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Failed to update notice');
    }

    res.status(200).json({ notice: mapNotice(updated as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /notices/:id
// Auth: society_admin, same society
// Soft-delete: sets status='archived'
// ---------------------------------------------------------------------------

const archiveNotice: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params as { id: string };

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('notices')
      .select('id, society_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notice not found.' } });
      return;
    }

    const row = existing as Record<string, unknown>;

    if (row['society_id'] !== user.society_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('notices')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw new AppError(500, 'ARCHIVE_FAILED', updateError.message);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /notices/admin
// Auth: society_admin — returns all notices (draft, published, archived) with optional status filter
// ---------------------------------------------------------------------------

const adminListNotices: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const querySchema = z.object({
      status: z.enum(['draft', 'published', 'archived']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      page: z.coerce.number().int().min(1).default(1),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      });
      return;
    }

    const { status, limit, page } = parsed.data;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notices')
      .select('*', { count: 'exact' })
      .eq('society_id', user.society_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      notices: (data ?? []).map((row) => mapNotice(row as Record<string, unknown>)),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// Admin-only list (all statuses)
router.get('/admin', requireRole('society_admin', 'super_admin'), adminListNotices);

// Public list (published only)
router.get('/', listNotices);

// Create notice (admin only)
router.post('/', requireRole('society_admin', 'super_admin'), createNotice);

// Update notice (admin only)
router.patch('/:id', requireRole('society_admin', 'super_admin'), updateNotice);

// Archive notice (admin only)
router.delete('/:id', requireRole('society_admin', 'super_admin'), archiveNotice);

export default router;
