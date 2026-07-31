import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ['maid', 'cook', 'driver', 'security', 'delivery', 'other'] as const;
type StaffCategory = (typeof VALID_CATEGORIES)[number];

const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be 10 digits')
    .optional(),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }),
  }),
  allowedDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'At least one allowed day is required'),
  entryFrom: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'entryFrom must be HH:MM'),
  entryUntil: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'entryUntil must be HH:MM'),
});

const updateStaffSchema = createStaffSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

// ---------------------------------------------------------------------------
// Shape returned to clients
// ---------------------------------------------------------------------------

export interface RecurringStaff {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  name: string;
  phone: string | null;
  category: StaffCategory;
  allowedDays: number[];
  entryFrom: string;
  entryUntil: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapStaff(row: Record<string, unknown>): RecurringStaff {
  return {
    id: row['id'] as string,
    societyId: row['society_id'] as string,
    flatId: row['flat_id'] as string,
    residentId: row['resident_id'] as string,
    name: row['name'] as string,
    phone: (row['phone'] as string | null) ?? null,
    category: row['category'] as StaffCategory,
    allowedDays: row['allowed_days'] as number[],
    entryFrom: row['entry_from'] as string,
    entryUntil: row['entry_until'] as string,
    isActive: row['is_active'] as boolean,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ---------------------------------------------------------------------------
// POST /recurring-staff
// Auth: flat_owner or tenant JWT
// ---------------------------------------------------------------------------

const createStaff: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.flat_id || !user.society_id) {
      throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat');
    }

    const parsed = createStaffSchema.safeParse(req.body);
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

    const { name, phone, category, allowedDays, entryFrom, entryUntil } = parsed.data;

    if (entryFrom >= entryUntil) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'entryFrom must be before entryUntil' },
      });
      return;
    }

    const { data: staff, error } = await supabaseAdmin
      .from('recurring_staff')
      .insert({
        society_id: user.society_id,
        flat_id: user.flat_id,
        resident_id: user.id,
        name,
        phone: phone ?? null,
        category,
        allowed_days: allowedDays,
        entry_from: entryFrom,
        entry_until: entryUntil,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !staff) {
      throw new AppError(500, 'CREATE_FAILED', error?.message ?? 'Failed to create staff');
    }

    res.status(201).json({ staff: mapStaff(staff as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /recurring-staff
// Auth: resident JWT
// Returns: active recurring_staff for user's flat
// ---------------------------------------------------------------------------

const listStaff: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.flat_id) {
      throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat');
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_staff')
      .select('*')
      .eq('flat_id', user.flat_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      staff: (data ?? []).map((row) => mapStaff(row as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /recurring-staff/:id
// Auth: resident JWT (flat_id must match)
// ---------------------------------------------------------------------------

const updateStaff: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const parsed = updateStaffSchema.safeParse(req.body);
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

    // Fetch existing to verify ownership
    const { data: existing, error: findError } = await supabaseAdmin
      .from('recurring_staff')
      .select('id, flat_id')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff not found' } });
      return;
    }

    if ((existing as Record<string, unknown>)['flat_id'] !== user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const d = parsed.data;
    if (d.name !== undefined) updates['name'] = d.name;
    if (d.phone !== undefined) updates['phone'] = d.phone ?? null;
    if (d.category !== undefined) updates['category'] = d.category;
    if (d.allowedDays !== undefined) updates['allowed_days'] = d.allowedDays;
    if (d.entryFrom !== undefined) updates['entry_from'] = d.entryFrom;
    if (d.entryUntil !== undefined) updates['entry_until'] = d.entryUntil;
    if (d.isActive !== undefined) updates['is_active'] = d.isActive;

    // Validate time window if both provided
    const newFrom = d.entryFrom ?? (existing as Record<string, unknown>)['entry_from'] as string;
    const newUntil = d.entryUntil ?? (existing as Record<string, unknown>)['entry_until'] as string;
    if (newFrom >= newUntil) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'entryFrom must be before entryUntil' },
      });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('recurring_staff')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new AppError(500, 'UPDATE_FAILED', updateError?.message ?? 'Update failed');
    }

    res.status(200).json({ staff: mapStaff(updated as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /recurring-staff/:id   (soft delete — sets is_active = false)
// Auth: resident JWT (flat_id must match)
// ---------------------------------------------------------------------------

const deleteStaff: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('recurring_staff')
      .select('id, flat_id')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff not found' } });
      return;
    }

    if ((existing as Record<string, unknown>)['flat_id'] !== user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('recurring_staff')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw new AppError(500, 'DELETE_FAILED', updateError.message);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /recurring-staff/search?phone=&name=&societyId=
// Auth: guard JWT
// Returns: [{ staff, flat, building, resident }]
// ---------------------------------------------------------------------------

const searchStaff: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    const query = req.query as Record<string, string>;

    const societyId = query['societyId'] ?? user.society_id ?? '';
    if (!societyId) {
      res.status(400).json({ error: { code: 'MISSING_PARAM', message: 'societyId is required' } });
      return;
    }

    const phone = query['phone']?.trim();
    const name = query['name']?.trim();

    if (!phone && !name) {
      res.status(400).json({
        error: { code: 'MISSING_PARAM', message: 'At least one of phone or name is required' },
      });
      return;
    }

    let dbQuery = supabaseAdmin
      .from('recurring_staff')
      .select(`
        *,
        flats ( flat_number, buildings ( name ) ),
        resident:resident_id ( id, full_name, phone )
      `)
      .eq('society_id', societyId)
      .eq('is_active', true)
      .limit(20);

    if (phone) {
      dbQuery = dbQuery.ilike('phone', `%${phone}%`);
    } else if (name) {
      dbQuery = dbQuery.ilike('name', `%${name}%`);
    }

    const { data, error } = await dbQuery;
    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    const results = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const flat = r['flats'] as { flat_number: string; buildings: { name: string } | null } | null;
      const resident = r['resident'] as { id: string; full_name: string | null; phone: string | null } | null;

      return {
        staff: mapStaff(r),
        flat: flat
          ? { flatNumber: flat.flat_number, buildingName: flat.buildings?.name ?? null }
          : null,
        resident: resident
          ? { id: resident.id, fullName: resident.full_name ?? null, phone: resident.phone ?? null }
          : null,
      };
    });

    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Route registration
// NOTE: /search must come before /:id
// ---------------------------------------------------------------------------

router.get('/search', requireRole('guard', 'society_admin', 'super_admin'), searchStaff);
router.post('/', requireRole('flat_owner', 'tenant'), createStaff);
router.get('/', requireRole('flat_owner', 'tenant', 'guard', 'society_admin'), listStaff);
router.patch('/:id', requireRole('flat_owner', 'tenant'), updateStaff);
router.delete('/:id', requireRole('flat_owner', 'tenant'), deleteStaff);

export default router;
