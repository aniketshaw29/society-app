import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(requireRole('society_admin', 'super_admin'));

// ---------------------------------------------------------------------------
// Shared query schema
// ---------------------------------------------------------------------------

const dateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be YYYY-MM-DD').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be YYYY-MM-DD').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// GET /admin/reports/visitors
// Auth: society_admin
// Query: ?fromDate&toDate&buildingId&guardId&status&page&limit
// ---------------------------------------------------------------------------

const visitorReportSchema = dateRangeSchema.extend({
  buildingId: z.string().uuid().optional(),
  guardId: z.string().uuid().optional(),
  status: z.string().optional(),
});

const getVisitorReport: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const parsed = visitorReportSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }

    const { fromDate, toDate, buildingId, guardId, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('visitor_logs')
      .select(
        `
        id, visitor_name, visitor_phone, purpose, status,
        entry_time, exit_time, created_at,
        flats ( flat_number, buildings ( id, name ) ),
        guards ( id, user_id, user_profiles:user_id ( full_name ) )
        `,
        { count: 'exact' }
      )
      .eq('society_id', user.society_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00Z`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59Z`);
    if (status) query = query.eq('status', status);
    if (guardId) query = query.eq('guard_id', guardId);

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    // Filter by building post-fetch (building is nested under flat)
    let rows = (data ?? []) as Record<string, unknown>[];
    if (buildingId) {
      rows = rows.filter((row) => {
        const flat = row['flats'] as { buildings: { id: string } | null } | null;
        return flat?.buildings?.id === buildingId;
      });
    }

    const visitors = rows.map((row) => {
      const flat = row['flats'] as {
        flat_number: string;
        buildings: { name: string } | null;
      } | null;
      const guard = row['guards'] as {
        id: string;
        user_profiles: { full_name: string | null } | null;
      } | null;

      return {
        id: row['id'] as string,
        name: row['visitor_name'] as string,
        phone: (row['visitor_phone'] as string | null) ?? null,
        purpose: (row['purpose'] as string | null) ?? null,
        flat: flat ? flat.flat_number : null,
        building: flat?.buildings?.name ?? null,
        guard: guard?.user_profiles?.full_name ?? null,
        status: row['status'] as string,
        entryTime: (row['entry_time'] as string | null) ?? null,
        exitTime: (row['exit_time'] as string | null) ?? null,
        createdAt: row['created_at'] as string,
      };
    });

    const total = buildingId ? visitors.length : (count ?? 0);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ visitors, total, page, totalPages });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /admin/reports/staff
// Auth: society_admin
// Query: ?fromDate&toDate&flatId&staffCategory&page&limit
// ---------------------------------------------------------------------------

const staffReportSchema = dateRangeSchema.extend({
  flatId: z.string().uuid().optional(),
  staffCategory: z.string().optional(),
});

const getStaffReport: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const parsed = staffReportSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }

    const { fromDate, toDate, flatId, staffCategory, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('staff_visits')
      .select(
        `
        id, entry_time, exit_time, created_at,
        recurring_staff ( id, name, category, phone, flat_id,
          flats ( flat_number, buildings ( name ) )
        )
        `,
        { count: 'exact' }
      )
      .eq('society_id', user.society_id)
      .order('entry_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fromDate) query = query.gte('entry_time', `${fromDate}T00:00:00Z`);
    if (toDate) query = query.lte('entry_time', `${toDate}T23:59:59Z`);
    if (flatId) query = query.eq('flat_id', flatId);

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    let rows = (data ?? []) as Record<string, unknown>[];

    if (staffCategory) {
      rows = rows.filter((row) => {
        const staff = row['recurring_staff'] as { category: string } | null;
        return staff?.category === staffCategory;
      });
    }

    const visits = rows.map((row) => {
      const staff = row['recurring_staff'] as {
        id: string;
        name: string;
        category: string;
        phone: string | null;
        flat_id: string;
        flats: { flat_number: string; buildings: { name: string } | null } | null;
      } | null;

      return {
        id: row['id'] as string,
        staffName: staff?.name ?? null,
        staffCategory: staff?.category ?? null,
        staffPhone: staff?.phone ?? null,
        flat: staff?.flats?.flat_number ?? null,
        building: staff?.flats?.buildings?.name ?? null,
        entryTime: (row['entry_time'] as string | null) ?? null,
        exitTime: (row['exit_time'] as string | null) ?? null,
        createdAt: row['created_at'] as string,
      };
    });

    const total = staffCategory ? visits.length : (count ?? 0);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ visits, total, page, totalPages });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /admin/reports/sos
// Auth: society_admin
// Query: ?fromDate&toDate&status&page&limit
// ---------------------------------------------------------------------------

const sosReportSchema = dateRangeSchema.extend({
  status: z.enum(['active', 'resolved']).optional(),
});

const getSosReport: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'You must belong to a society.');
    }

    const parsed = sosReportSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }

    const { fromDate, toDate, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('sos_alerts')
      .select(
        `
        id, message, status, resolved_at, created_at,
        flats ( flat_number, buildings ( name ) ),
        resident:resident_id ( full_name, phone )
        `,
        { count: 'exact' }
      )
      .eq('society_id', user.society_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00Z`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59Z`);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    const alerts = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const flat = r['flats'] as { flat_number: string; buildings: { name: string } | null } | null;
      const resident = r['resident'] as { full_name: string | null; phone: string | null } | null;
      const createdAt = r['created_at'] as string;
      const resolvedAt = (r['resolved_at'] as string | null) ?? null;

      // Calculate resolution duration in minutes
      let resolutionMinutes: number | null = null;
      if (resolvedAt) {
        const diffMs = new Date(resolvedAt).getTime() - new Date(createdAt).getTime();
        resolutionMinutes = Math.round(diffMs / 60000);
      }

      return {
        id: r['id'] as string,
        message: (r['message'] as string | null) ?? null,
        status: r['status'] as string,
        flat: flat?.flat_number ?? null,
        building: flat?.buildings?.name ?? null,
        residentName: resident?.full_name ?? null,
        residentPhone: resident?.phone ?? null,
        resolvedAt,
        resolutionMinutes,
        createdAt,
      };
    });

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ alerts, total, page, totalPages });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

router.get('/visitors', getVisitorReport);
router.get('/staff', getStaffReport);
router.get('/sos', getSosReport);

export default router;
