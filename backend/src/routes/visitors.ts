import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  notifyFlatResidents,
  notifyGuard,
} from '../services/notificationService';

const router = Router();

// ============================================================
// Validation schemas
// ============================================================

const createVisitorSchema = z.object({
  flatId: z.string().uuid('Invalid flat ID'),
  visitorName: z.string().min(1, 'Visitor name is required').trim(),
  visitorPhone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional(),
  purpose: z.enum(['guest', 'delivery', 'service', 'cab', 'other']),
  vehicleNumber: z.string().trim().optional(),
  entryMethod: z.literal('manual'),
});

const photoUrlSchema = z.object({
  storagePath: z.string().min(1, 'storagePath is required'),
});

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;

// ============================================================
// VisitorLog shape returned to clients
// ============================================================

export interface VisitorLog {
  id: string;
  societyId: string;
  flatId: string;
  guardId: string | null;
  visitorName: string;
  visitorPhone: string | null;
  visitorPhotoUrl: string | null;
  vehicleNumber: string | null;
  purpose: string;
  entryMethod: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  entryTime: string | null;
  exitTime: string | null;
  createdAt: string;
  updatedAt: string;
  flat?: {
    flatNumber: string;
    buildingName: string | null;
  };
  approver?: {
    fullName: string | null;
    phone: string | null;
  } | null;
}

function mapRow(row: Record<string, unknown>): VisitorLog {
  const flat = row['flats'] as
    | { flat_number: string; buildings: { name: string } | null }
    | null;
  const approver = row['approver'] as
    | { full_name: string | null; phone: string | null }
    | null;
  return {
    id: row['id'] as string,
    societyId: row['society_id'] as string,
    flatId: row['flat_id'] as string,
    guardId: (row['guard_id'] as string | null) ?? null,
    visitorName: row['visitor_name'] as string,
    visitorPhone: (row['visitor_phone'] as string | null) ?? null,
    visitorPhotoUrl: (row['visitor_photo_url'] as string | null) ?? null,
    vehicleNumber: (row['vehicle_number'] as string | null) ?? null,
    purpose: row['purpose'] as string,
    entryMethod: row['entry_method'] as string,
    status: row['status'] as string,
    approvedBy: (row['approved_by'] as string | null) ?? null,
    approvedAt: (row['approved_at'] as string | null) ?? null,
    entryTime: (row['entry_time'] as string | null) ?? null,
    exitTime: (row['exit_time'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
    flat: flat
      ? {
          flatNumber: flat.flat_number,
          buildingName: flat.buildings?.name ?? null,
        }
      : undefined,
    approver: approver
      ? { fullName: approver.full_name ?? null, phone: approver.phone ?? null }
      : null,
  };
}

// ============================================================
// POST /visitors
// Auth: guard JWT
// Body: { flatId, visitorName, visitorPhone?, purpose, vehicleNumber?, entryMethod: 'manual' }
// ============================================================

const logVisitor: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createVisitorSchema.safeParse(req.body);
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

    const { flatId, visitorName, visitorPhone, purpose, vehicleNumber, entryMethod } =
      parsed.data;

    const guardUserId = req.user!.id;
    const guardSocietyId = req.user!.society_id;

    if (!guardSocietyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Guard is not assigned to a society');
    }

    // Verify flat belongs to guard's society
    const { data: flat, error: flatError } = await supabaseAdmin
      .from('flats')
      .select('id, society_id')
      .eq('id', flatId)
      .maybeSingle();

    if (flatError || !flat) {
      res.status(404).json({
        error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found' },
      });
      return;
    }

    if (flat.society_id !== guardSocietyId) {
      res.status(403).json({
        error: {
          code: 'CROSS_SOCIETY_ACCESS',
          message: 'Flat does not belong to your society',
        },
      });
      return;
    }

    // Resolve guard record id (guards table) from user_id
    const { data: guardRecord } = await supabaseAdmin
      .from('guards')
      .select('id')
      .eq('user_id', guardUserId)
      .eq('society_id', guardSocietyId)
      .maybeSingle();

    const { data: newLog, error: insertError } = await supabaseAdmin
      .from('visitor_logs')
      .insert({
        society_id: guardSocietyId,
        flat_id: flatId,
        guard_id: guardRecord?.id ?? null,
        visitor_name: visitorName,
        visitor_phone: visitorPhone ?? null,
        purpose,
        vehicle_number: vehicleNumber ?? null,
        entry_method: entryMethod,
        status: 'pending',
      })
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) )
      `)
      .single();

    if (insertError || !newLog) {
      throw new AppError(
        500,
        'VISITOR_CREATE_FAILED',
        insertError?.message ?? 'Failed to create visitor log'
      );
    }

    const mapped = mapRow(newLog as Record<string, unknown>);

    // Return immediately; FCM is async
    res.status(201).json({ visitor: mapped });

    // Fire-and-forget push to all residents of the target flat
    const notifData: Record<string, string> = {
      type: 'visitor_approval',
      visitorId: mapped.id,
      flatId,
      societyId: guardSocietyId,
      visitorName,
      purpose,
    };
    void notifyFlatResidents(guardSocietyId, flatId, {
      title: 'Visitor at Gate',
      body: `${visitorName} is here to see you (${purpose})`,
      data: notifData,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /visitors/active
// Auth: guard JWT
// Returns: visitor_logs where society_id = guard's society AND status IN ('pending','approved','entered')
// ============================================================

const getActiveVisitors: RequestHandler = async (req, res, next) => {
  try {
    const societyId = req.user!.society_id;

    if (!societyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Guard is not assigned to a society');
    }

    const { data: logs, error } = await supabaseAdmin
      .from('visitor_logs')
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) )
      `)
      .eq('society_id', societyId)
      .in('status', ['pending', 'approved', 'entered'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      visitors: (logs ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /visitors/:id/exit
// Auth: guard JWT
// Sets exit_time = now(), status = 'exited'
// ============================================================

const markExit: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const societyId = req.user!.society_id;

    if (!societyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Guard is not assigned to a society');
    }

    // Ensure log belongs to guard's society
    const { data: existing, error: findError } = await supabaseAdmin
      .from('visitor_logs')
      .select('id, society_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor log not found' },
      });
      return;
    }

    if (existing.society_id !== societyId) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('visitor_logs')
      .update({
        exit_time: new Date().toISOString(),
        status: 'exited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) )
      `)
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Failed to update exit');
    }

    res.status(200).json({ visitor: mapRow(updated as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /visitors/:id/photo-url
// Auth: guard JWT
// Body: { storagePath }
// Generates 1-hour signed URL, updates visitor_photo_url
// ============================================================

const generatePhotoUrl: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const societyId = req.user!.society_id;

    if (!societyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Guard is not assigned to a society');
    }

    const parsed = photoUrlSchema.safeParse(req.body);
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

    const { storagePath } = parsed.data;

    // Verify visitor log exists and belongs to guard's society
    const { data: existing, error: findError } = await supabaseAdmin
      .from('visitor_logs')
      .select('id, society_id')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor log not found' },
      });
      return;
    }

    if (existing.society_id !== societyId) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    // Generate 1-hour signed URL from Supabase Storage
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('visitor-photos')
      .createSignedUrl(storagePath, 60 * 60); // 1 hour

    if (signedError || !signedData?.signedUrl) {
      throw new AppError(
        500,
        'SIGNED_URL_FAILED',
        signedError?.message ?? 'Failed to generate signed URL'
      );
    }

    // Persist signed URL on the visitor log
    await supabaseAdmin
      .from('visitor_logs')
      .update({
        visitor_photo_url: signedData.signedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.status(200).json({ signedUrl: signedData.signedUrl });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /visitors/:id
// Auth: any authenticated member of the society
// ============================================================

const getVisitor: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const { data: log, error } = await supabaseAdmin
      .from('visitor_logs')
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        approved_by, approved_at,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) ),
        guards ( user_id )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !log) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' },
      });
      return;
    }

    const row = log as Record<string, unknown> & { guards: { user_id: string } | null };

    // Residents can only view visitors for their own flat
    const isPrivileged =
      user.role === 'guard' ||
      user.role === 'society_admin' ||
      user.role === 'super_admin';

    if (!isPrivileged && row['flat_id'] !== user.flat_id) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this visitor' },
      });
      return;
    }

    res.status(200).json({ visitor: mapRow(row) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Helper: fetch visitor + guard user_id in one query
// ============================================================

interface VisitorWithGuard {
  id: string;
  society_id: string;
  flat_id: string;
  guard_id: string | null;
  visitor_name: string;
  purpose: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  guard_user_id: string | null;
}

async function fetchVisitorWithGuard(visitorId: string): Promise<VisitorWithGuard | null> {
  const { data } = await supabaseAdmin
    .from('visitor_logs')
    .select('id, society_id, flat_id, guard_id, visitor_name, purpose, status, approved_by, approved_at, guards ( user_id )')
    .eq('id', visitorId)
    .maybeSingle();

  if (!data) return null;

  const row = data as typeof data & { guards: { user_id: string } | null };
  return {
    id: row.id as string,
    society_id: row.society_id as string,
    flat_id: row.flat_id as string,
    guard_id: (row.guard_id as string | null) ?? null,
    visitor_name: row.visitor_name as string,
    purpose: (row.purpose as string | null) ?? null,
    status: row.status as string,
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    guard_user_id: row.guards?.user_id ?? null,
  };
}

// ============================================================
// PATCH /visitors/:id/approve
// Auth: resident JWT (flat_owner or tenant)
// Validates: visitor belongs to req.user.flat_id
// Updates: status='approved', approved_by, approved_at
// Sends FCM to guard
// ============================================================

const approveVisitor: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const visitor = await fetchVisitorWithGuard(id);

    if (!visitor) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' },
      });
      return;
    }

    if (visitor.flat_id !== user.flat_id) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This visitor is not destined for your flat' },
      });
      return;
    }

    if (visitor.status === 'approved') {
      res.status(409).json({
        error: { code: 'ALREADY_APPROVED', message: 'Visitor has already been approved' },
      });
      return;
    }

    if (visitor.status === 'denied') {
      res.status(409).json({
        error: { code: 'ALREADY_DENIED', message: 'Visitor has already been denied' },
      });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('visitor_logs')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        approved_by, approved_at,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) )
      `)
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Failed to approve visitor');
    }

    res.status(200).json({ visitor: mapRow(updated as Record<string, unknown>) });

    if (visitor.guard_user_id) {
      void notifyGuard(visitor.guard_user_id, {
        title: 'Visitor Approved',
        body: `${visitor.visitor_name} has been approved to enter`,
        data: {
          type: 'visitor_approved',
          visitorId: id,
          flatId: visitor.flat_id,
          societyId: visitor.society_id,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /visitors/:id/deny
// Auth: resident JWT (flat_owner or tenant) OR guard denying at the gate
// Resident path: validates visitor belongs to req.user.flat_id
// Guard path:    validates visitor belongs to guard's society
// Updates: status='denied', approved_by, approved_at
// Sends FCM to guard (when resident denies)
// ============================================================

const denyVisitor: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const visitor = await fetchVisitorWithGuard(id);

    if (!visitor) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' },
      });
      return;
    }

    const isGuardOrAdmin = ['guard', 'society_admin', 'super_admin'].includes(user.role);

    // Guard path: must be in same society
    if (isGuardOrAdmin) {
      if (visitor.society_id !== user.society_id && user.role !== 'super_admin') {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Access denied.' },
        });
        return;
      }
    } else {
      // Resident path: must own the flat
      if (visitor.flat_id !== user.flat_id) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'This visitor is not destined for your flat' },
        });
        return;
      }
    }

    if (visitor.status === 'denied') {
      res.status(409).json({
        error: { code: 'ALREADY_DENIED', message: 'Visitor has already been denied' },
      });
      return;
    }

    // Residents cannot override an already-approved visitor (guard can)
    if (!isGuardOrAdmin && visitor.status === 'approved') {
      res.status(409).json({
        error: { code: 'ALREADY_APPROVED', message: 'Visitor has already been approved' },
      });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('visitor_logs')
      .update({
        status: 'denied',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        approved_by, approved_at,
        entry_time, exit_time, created_at, updated_at,
        flats ( flat_number, buildings ( name ) ),
        approver:approved_by ( full_name, phone )
      `)
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Failed to deny visitor');
    }

    res.status(200).json({ visitor: mapRow(updated as Record<string, unknown>) });

    if (!isGuardOrAdmin && visitor.guard_user_id) {
      void notifyGuard(visitor.guard_user_id, {
        title: `Visitor Denied - ${visitor.visitor_name}`,
        body: `${visitor.visitor_name} has been denied entry`,
        data: {
          type: 'visitor_denied',
          visitorId: id,
          flatId: visitor.flat_id,
          societyId: visitor.society_id,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /visitors
// List today's visitors for the guard's society
// Auth: guard / society_admin
// Query: ?societyId=&limit=50
// ============================================================

const listVisitors: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const query = req.query as Record<string, string>;
    const societyId = query['societyId'] ?? user.society_id ?? '';
    const limit = Math.min(100, parseInt(query['limit'] ?? '50', 10) || 50);

    if (!societyId) {
      res.status(400).json({
        error: { code: 'MISSING_SOCIETY_ID', message: 'societyId is required' },
      });
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const isGuardOrAdmin = ['guard', 'society_admin', 'super_admin'].includes(user.role);

    let dbQuery = supabaseAdmin
      .from('visitor_logs')
      .select(`
        *,
        flats ( flat_number, buildings ( name ) ),
        approver:approved_by ( full_name, phone )
      `)
      .eq('society_id', societyId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!isGuardOrAdmin && user.flat_id) {
      dbQuery = dbQuery.eq('flat_id', user.flat_id);
    }

    const { data, error } = await dbQuery;
    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    res.status(200).json({
      visitors: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /visitors/history
// Paginated visitor history
// Auth: guard or resident
// Guards: see all visitors for society_id
// Residents: see only visitors for their flat_id
// Query: ?page=1&limit=20&status=&fromDate=&toDate=&flatId=
// Returns: { visitors, total, page, totalPages }
// ============================================================

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  flatId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

const getVisitorHistory: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const { page, limit, status, fromDate, toDate, flatId, search } = parsed.data;
    const offset = (page - 1) * limit;
    const societyId = user.society_id;

    if (!societyId) {
      res.status(400).json({
        error: { code: 'NO_SOCIETY', message: 'User is not associated with a society.' },
      });
      return;
    }

    const isGuardOrAdmin = ['guard', 'society_admin', 'super_admin'].includes(user.role);

    let dbQuery = supabaseAdmin
      .from('visitor_logs')
      .select(
        `*, flats ( flat_number, buildings ( name ) ), approver:approved_by ( full_name, phone )`,
        { count: 'exact' }
      )
      .eq('society_id', societyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isGuardOrAdmin) {
      if (!user.flat_id) {
        res.status(400).json({
          error: { code: 'NO_FLAT', message: 'User is not associated with a flat.' },
        });
        return;
      }
      dbQuery = dbQuery.eq('flat_id', user.flat_id);
    } else if (flatId) {
      dbQuery = dbQuery.eq('flat_id', flatId);
    }

    if (status) dbQuery = dbQuery.eq('status', status);
    if (fromDate) dbQuery = dbQuery.gte('created_at', `${fromDate}T00:00:00Z`);
    if (toDate) dbQuery = dbQuery.lte('created_at', `${toDate}T23:59:59Z`);
    // Search by visitor name (case-insensitive prefix/contains match)
    if (search && search.trim()) {
      dbQuery = dbQuery.ilike('visitor_name', `%${search.trim()}%`);
    }

    const { data, error, count } = await dbQuery;
    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      visitors: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /visitors/:id/enter
// Auth: guard JWT
// Sets: status='entered', entry_time=now()
// Returns: { visitor }
// ============================================================

const markEntered: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params as { id: string };

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('visitor_logs')
      .select('id, society_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      res.status(404).json({
        error: { code: 'VISITOR_NOT_FOUND', message: 'Visitor not found.' },
      });
      return;
    }

    if (existing.society_id !== user.society_id && user.role !== 'super_admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    if (!['approved', 'pending'].includes(existing.status as string)) {
      res.status(409).json({
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot mark as entered from status '${existing.status}'.`,
        },
      });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('visitor_logs')
      .update({ status: 'entered', entry_time: new Date().toISOString() })
      .eq('id', id)
      .select(`*, flats ( flat_number, buildings ( name ) ), approver:approved_by ( full_name, phone )`)
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Update failed');
    }

    res.status(200).json({ visitor: mapRow(updated as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /visitors/staff-entry
// Auth: guard JWT
// Body: { staffId }
// Validates: staff is_active, today is in allowedDays, current time in [entryFrom, entryUntil]
// Creates staff_visits row
// Returns: { staffVisit } with { staff, flat }
// ============================================================

const staffEntrySchema = z.object({
  staffId: z.string().uuid('Invalid staffId'),
});

const logStaffEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.society_id) {
      throw new AppError(403, 'NO_SOCIETY', 'Guard is not assigned to a society');
    }

    const parsed = staffEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }

    const { staffId } = parsed.data;

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('recurring_staff')
      .select('*, flats ( flat_number, buildings ( name ) )')
      .eq('id', staffId)
      .maybeSingle();

    if (staffError || !staff) {
      res.status(404).json({ error: { code: 'STAFF_NOT_FOUND', message: 'Staff not found' } });
      return;
    }

    const s = staff as Record<string, unknown>;

    // Guard must be in the same society as the staff
    if (s['society_id'] !== user.society_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Staff belongs to a different society' } });
      return;
    }

    if (!s['is_active']) {
      res.status(400).json({ error: { code: 'staff_inactive', message: 'This staff member is inactive' } });
      return;
    }

    const now = new Date();
    const todayDay = now.getDay(); // 0=Sunday, 6=Saturday
    const allowedDays = s['allowed_days'] as number[];

    if (!allowedDays.includes(todayDay)) {
      res.status(400).json({
        error: { code: 'not_allowed_today', message: 'Staff is not allowed on today' },
      });
      return;
    }

    // Check time window — compare HH:MM strings
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const entryFrom = s['entry_from'] as string;
    const entryUntil = s['entry_until'] as string;

    if (currentTime < entryFrom || currentTime > entryUntil) {
      res.status(400).json({
        error: {
          code: 'outside_window',
          message: `Staff is only allowed between ${entryFrom} and ${entryUntil}`,
        },
      });
      return;
    }

    // Resolve guard record id
    const { data: guardRecord } = await supabaseAdmin
      .from('guards')
      .select('id')
      .eq('user_id', user.id)
      .eq('society_id', user.society_id)
      .maybeSingle();

    // Create staff_visits row
    const { data: staffVisit, error: insertError } = await supabaseAdmin
      .from('staff_visits')
      .insert({
        staff_id: staffId,
        society_id: user.society_id,
        flat_id: s['flat_id'],
        guard_id: guardRecord?.id ?? null,
        entry_time: now.toISOString(),
      })
      .select('id, staff_id, society_id, flat_id, guard_id, entry_time, created_at')
      .single();

    if (insertError || !staffVisit) {
      throw new AppError(500, 'CREATE_FAILED', insertError?.message ?? 'Failed to log staff entry');
    }

    const flat = s['flats'] as { flat_number: string; buildings: { name: string } | null } | null;

    res.status(201).json({
      staffVisit: {
        id: (staffVisit as Record<string, unknown>)['id'],
        staffId,
        societyId: user.society_id,
        flatId: s['flat_id'],
        guardId: (staffVisit as Record<string, unknown>)['guard_id'],
        entryTime: (staffVisit as Record<string, unknown>)['entry_time'],
        createdAt: (staffVisit as Record<string, unknown>)['created_at'],
      },
      staff: {
        id: s['id'],
        name: s['name'],
        phone: s['phone'] ?? null,
        category: s['category'],
      },
      flat: flat
        ? { flatNumber: flat.flat_number, buildingName: flat.buildings?.name ?? null }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Route registration
// NOTE: Specific paths (e.g. /active, /history) must come before
// the parametric /:id route to avoid shadowing.
// ============================================================

router.use(authenticate);

// POST /visitors/staff-entry — guard logs staff entry
router.post('/staff-entry', requireRole('guard'), logStaffEntry);

// POST /visitors — log a visitor (guard only)
router.post('/', requireRole('guard'), logVisitor);

// GET /visitors — today's visitor list (guard gate feed, used by realtime hook)
router.get('/', listVisitors);

// GET /visitors/active — active visitor list for guard's gate
router.get('/active', requireRole('guard'), getActiveVisitors);

// GET /visitors/history — paginated history (guard: all; resident: own flat)
router.get('/history', getVisitorHistory);

// GET /visitors/:id — single visitor detail (resident or guard)
router.get('/:id', getVisitor);

// PATCH /visitors/:id/approve — resident approves entry
router.patch('/:id/approve', requireRole('flat_owner', 'tenant'), approveVisitor);

// PATCH /visitors/:id/deny — resident denies OR guard denies at gate
router.patch('/:id/deny', denyVisitor);

// PATCH /visitors/:id/enter — guard marks visitor as entered
router.patch('/:id/enter', requireRole('guard', 'society_admin', 'super_admin'), markEntered);

// PATCH /visitors/:id/exit — mark visitor exited
router.patch('/:id/exit', requireRole('guard'), markExit);

// POST /visitors/:id/photo-url — generate signed URL and persist it
router.post('/:id/photo-url', requireRole('guard'), generatePhotoUrl);

export default router;
