import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole, requireSocietyAccess } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ============================================================
// Validation schemas
// ============================================================

const updateBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').trim().optional(),
  totalFloors: z.number().int().min(1, 'Total floors must be at least 1').optional(),
});

const updateFlatSchema = z.object({
  flatNumber: z.string().min(1, 'Flat number is required').trim().optional(),
  floor: z.number().int().min(0, 'Floor must be 0 or higher').optional(),
});

const updateResidentSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').trim().optional(),
  flatId: z.string().uuid('flatId must be a valid UUID').optional(),
  residentType: z.enum(['owner', 'tenant']).optional(),
});

const updateGuardSchema = z.object({
  gateName: z.string().trim().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
  isActive: z.boolean().optional(),
});

const addBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').trim(),
  totalFloors: z.number().int().min(1, 'Total floors must be at least 1'),
});

const addFlatSchema = z.object({
  buildingId: z.string().uuid('buildingId must be a valid UUID'),
  flatNumber: z.string().min(1, 'Flat number is required').trim(),
  floor: z.number().int().min(0, 'Floor must be 0 or higher'),
});

const addResidentSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91\d{10}$|^\d{10}$/, 'Phone must be a valid Indian number')
    .transform((v) => (v.startsWith('+91') ? v : `+91${v}`)),
  fullName: z.string().min(2, 'Full name is required').trim(),
  flatId: z.string().uuid('flatId must be a valid UUID'),
  residentType: z.enum(['owner', 'tenant']),
});

const addGuardSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91\d{10}$|^\d{10}$/, 'Phone must be a valid Indian number')
    .transform((v) => (v.startsWith('+91') ? v : `+91${v}`)),
  fullName: z.string().min(2, 'Full name is required').trim(),
  gateName: z.string().trim().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
});

// ============================================================
// Middleware: all onboarding routes require society_admin
// ============================================================

router.use(authenticate);
router.use(requireRole('society_admin', 'super_admin'));
router.use(requireSocietyAccess);

// ============================================================
// POST /societies/:societyId/buildings
// ============================================================

const addBuilding: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const parsed = addBuildingSchema.safeParse(req.body);
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

    const { name, totalFloors } = parsed.data;

    // Verify society exists
    const { data: society } = await supabaseAdmin
      .from('societies')
      .select('id')
      .eq('id', societyId)
      .maybeSingle();

    if (!society) {
      res.status(404).json({
        error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found' },
      });
      return;
    }

    const { data: building, error } = await supabaseAdmin
      .from('buildings')
      .insert({ society_id: societyId, name, total_floors: totalFloors })
      .select()
      .single();

    if (error || !building) {
      throw new AppError(500, 'BUILDING_CREATE_FAILED', error?.message ?? 'Failed to create building');
    }

    res.status(201).json({
      building: {
        id: building.id,
        societyId: building.society_id,
        name: building.name,
        totalFloors: building.total_floors,
        createdAt: building.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /societies/:societyId/flats
// ============================================================

const addFlat: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const parsed = addFlatSchema.safeParse(req.body);
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

    const { buildingId, flatNumber, floor } = parsed.data;

    // Verify building belongs to this society
    const { data: building } = await supabaseAdmin
      .from('buildings')
      .select('id')
      .eq('id', buildingId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!building) {
      res.status(404).json({
        error: { code: 'BUILDING_NOT_FOUND', message: 'Building not found in this society' },
      });
      return;
    }

    const { data: flat, error } = await supabaseAdmin
      .from('flats')
      .insert({
        society_id: societyId,
        building_id: buildingId,
        flat_number: flatNumber,
        floor,
        is_occupied: false,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        res.status(409).json({
          error: {
            code: 'FLAT_EXISTS',
            message: 'A flat with this number already exists in this building',
          },
        });
        return;
      }
      throw new AppError(500, 'FLAT_CREATE_FAILED', error.message);
    }

    if (!flat) {
      throw new AppError(500, 'FLAT_CREATE_FAILED', 'Failed to create flat');
    }

    // Update total_flats count on society
    await supabaseAdmin.rpc('increment_society_flat_count', { p_society_id: societyId }).catch(() => {
      // RPC may not exist yet; fall back to manual count update
      supabaseAdmin
        .from('flats')
        .select('*', { count: 'exact', head: true })
        .eq('society_id', societyId)
        .then(({ count }) => {
          if (count !== null) {
            supabaseAdmin
              .from('societies')
              .update({ total_flats: count })
              .eq('id', societyId);
          }
        });
    });

    res.status(201).json({
      flat: {
        id: flat.id,
        societyId: flat.society_id,
        buildingId: flat.building_id,
        flatNumber: flat.flat_number,
        floor: flat.floor,
        isOccupied: flat.is_occupied,
        createdAt: flat.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /societies/:societyId/residents
// ============================================================

const addResident: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const parsed = addResidentSchema.safeParse(req.body);
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

    const { phone, fullName, flatId, residentType } = parsed.data;

    // Verify flat belongs to this society
    const { data: flat } = await supabaseAdmin
      .from('flats')
      .select('id')
      .eq('id', flatId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!flat) {
      res.status(404).json({
        error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found in this society' },
      });
      return;
    }

    // Try to find existing auth user by phone
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find((u) => u.phone === phone);

    let userId: string;

    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      // Create a placeholder auth user — they will claim it when logging in via OTP
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone,
        phone_confirm: true,
      });
      if (createError || !newUser?.user) {
        throw new AppError(500, 'USER_CREATE_FAILED', createError?.message ?? 'Failed to create user');
      }
      userId = newUser.user.id;
    }

    const role = residentType === 'owner' ? 'flat_owner' : 'tenant';

    // Upsert profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          phone,
          full_name: fullName,
          role,
          society_id: societyId,
          flat_id: flatId,
          is_active: true,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (profileError || !profile) {
      throw new AppError(500, 'PROFILE_CREATE_FAILED', profileError?.message ?? 'Failed to create profile');
    }

    // Mark flat as occupied
    await supabaseAdmin.from('flats').update({ is_occupied: true }).eq('id', flatId);

    res.status(201).json({
      resident: {
        id: profile.id,
        phone: profile.phone,
        fullName: profile.full_name,
        role: profile.role,
        societyId: profile.society_id,
        flatId: profile.flat_id,
        residentType,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /societies/:societyId/guards
// ============================================================

const addGuard: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const parsed = addGuardSchema.safeParse(req.body);
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

    const { phone, fullName, gateName, shift } = parsed.data;

    // Check for duplicate phone in this society
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, society_id')
      .eq('phone', phone)
      .eq('society_id', societyId)
      .eq('role', 'guard')
      .maybeSingle();

    if (existingProfile) {
      res.status(409).json({
        error: {
          code: 'GUARD_EXISTS',
          message: 'A guard with this phone number is already registered in this society',
        },
      });
      return;
    }

    // Find or create auth user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find((u) => u.phone === phone);

    let userId: string;

    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone,
        phone_confirm: true,
      });
      if (createError || !newUser?.user) {
        throw new AppError(500, 'USER_CREATE_FAILED', createError?.message ?? 'Failed to create user');
      }
      userId = newUser.user.id;
    }

    // Upsert user_profiles with guard role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          phone,
          full_name: fullName,
          role: 'guard',
          society_id: societyId,
          flat_id: null,
          is_active: true,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (profileError || !profile) {
      throw new AppError(500, 'PROFILE_CREATE_FAILED', profileError?.message ?? 'Failed to create profile');
    }

    // Insert into guards table
    const { data: guard, error: guardError } = await supabaseAdmin
      .from('guards')
      .insert({
        user_id: userId,
        society_id: societyId,
        gate_name: gateName ?? 'Main Gate',
        shift: shift ?? 'morning',
        is_active: true,
      })
      .select()
      .single();

    if (guardError || !guard) {
      throw new AppError(500, 'GUARD_CREATE_FAILED', guardError?.message ?? 'Failed to create guard record');
    }

    res.status(201).json({
      guard: {
        id: guard.id,
        userId: guard.user_id,
        societyId: guard.society_id,
        phone: profile.phone,
        fullName: profile.full_name,
        gateName: guard.gate_name,
        shift: guard.shift,
        isActive: guard.is_active,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /societies/:societyId/buildings
// ============================================================

const getBuildings: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const { data: buildings, error } = await supabaseAdmin
      .from('buildings')
      .select('id, name, total_floors, created_at')
      .eq('society_id', societyId)
      .order('name', { ascending: true });

    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    const buildingsWithCount = await Promise.all(
      (buildings ?? []).map(async (b) => {
        const { count } = await supabaseAdmin
          .from('flats')
          .select('*', { count: 'exact', head: true })
          .eq('building_id', b.id);
        return {
          id: b.id,
          name: b.name,
          totalFloors: b.total_floors,
          flatCount: count ?? 0,
          createdAt: b.created_at,
        };
      })
    );

    res.status(200).json({ buildings: buildingsWithCount });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /societies/:societyId/flats?buildingId=
// ============================================================

const getFlats: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };
    const buildingId = (req.query as Record<string, string>)['buildingId'];

    let query = supabaseAdmin
      .from('flats')
      .select(`
        id,
        flat_number,
        floor,
        is_occupied,
        building_id,
        buildings ( id, name )
      `)
      .eq('society_id', societyId)
      .order('flat_number', { ascending: true });

    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }

    const { data: flats, error } = await query;

    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    res.status(200).json({ flats: flats ?? [] });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Route registration
// ============================================================

router.post('/societies/:societyId/buildings', addBuilding);
router.post('/societies/:societyId/flats', addFlat);
router.post('/societies/:societyId/residents', addResident);
router.post('/societies/:societyId/guards', addGuard);
router.get('/societies/:societyId/buildings', getBuildings);
router.get('/societies/:societyId/flats', getFlats);

// ── T5-2: PATCH / DELETE ────────────────────────────────────────────────────

// PATCH /onboarding/societies/:societyId/buildings/:id
const updateBuilding: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, id } = req.params as { societyId: string; id: string };
    const parsed = updateBuildingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
      });
      return;
    }

    const { name, totalFloors } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates['name'] = name;
    if (totalFloors !== undefined) updates['total_floors'] = totalFloors;

    if (Object.keys(updates).length === 0) {
      res.status(422).json({ error: { code: 'NO_CHANGES', message: 'No fields to update.' } });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('buildings')
      .select('id')
      .eq('id', id)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Building not found.' } });
      return;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('buildings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) throw new AppError(500, 'UPDATE_FAILED', error?.message ?? 'Update failed');

    const u = updated as Record<string, unknown>;
    res.status(200).json({
      building: { id: u['id'], societyId: u['society_id'], name: u['name'], totalFloors: u['total_floors'], createdAt: u['created_at'] },
    });
  } catch (err) { next(err); }
};

// DELETE /onboarding/societies/:societyId/buildings/:id
const deleteBuilding: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, id } = req.params as { societyId: string; id: string };

    const { data: existing } = await supabaseAdmin
      .from('buildings')
      .select('id')
      .eq('id', id)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Building not found.' } });
      return;
    }

    // 409 if building has active flats
    const { count: flatCount } = await supabaseAdmin
      .from('flats')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', id);

    if (flatCount && flatCount > 0) {
      res.status(409).json({
        error: { code: 'HAS_ACTIVE_FLATS', message: 'Cannot delete building with existing flats. Delete or reassign all flats first.' },
      });
      return;
    }

    await supabaseAdmin.from('buildings').delete().eq('id', id);
    res.status(204).end();
  } catch (err) { next(err); }
};

// PATCH /onboarding/societies/:societyId/flats/:id
const updateFlat: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, id } = req.params as { societyId: string; id: string };
    const parsed = updateFlatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
      });
      return;
    }

    const { flatNumber, floor } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (flatNumber !== undefined) updates['flat_number'] = flatNumber;
    if (floor !== undefined) updates['floor'] = floor;

    if (Object.keys(updates).length === 0) {
      res.status(422).json({ error: { code: 'NO_CHANGES', message: 'No fields to update.' } });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('flats')
      .select('id')
      .eq('id', id)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flat not found.' } });
      return;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('flats')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) throw new AppError(500, 'UPDATE_FAILED', error?.message ?? 'Update failed');

    const u = updated as Record<string, unknown>;
    res.status(200).json({
      flat: { id: u['id'], societyId: u['society_id'], buildingId: u['building_id'], flatNumber: u['flat_number'], floor: u['floor'], isOccupied: u['is_occupied'], createdAt: u['created_at'] },
    });
  } catch (err) { next(err); }
};

// DELETE /onboarding/societies/:societyId/flats/:id
const deleteFlat: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, id } = req.params as { societyId: string; id: string };

    const { data: existing } = await supabaseAdmin
      .from('flats')
      .select('id, is_occupied')
      .eq('id', id)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flat not found.' } });
      return;
    }

    const flatRow = existing as Record<string, unknown>;

    // 409 if flat has active residents
    const { count: residentCount } = await supabaseAdmin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('flat_id', id)
      .eq('is_active', true);

    if (residentCount && residentCount > 0) {
      res.status(409).json({
        error: { code: 'HAS_ACTIVE_RESIDENTS', message: 'Cannot delete flat with active residents. Deactivate or reassign residents first.' },
      });
      return;
    }

    await supabaseAdmin.from('flats').delete().eq('id', id);
    res.status(204).end();
  } catch (err) { next(err); }
};

// PATCH /onboarding/societies/:societyId/residents/:userId
const updateResident: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, userId } = req.params as { societyId: string; userId: string };
    const parsed = updateResidentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
      });
      return;
    }

    const { fullName, flatId, residentType } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (fullName !== undefined) updates['full_name'] = fullName;
    if (flatId !== undefined) updates['flat_id'] = flatId;
    if (residentType !== undefined) updates['role'] = residentType === 'owner' ? 'flat_owner' : 'tenant';

    if (Object.keys(updates).length === 0) {
      res.status(422).json({ error: { code: 'NO_CHANGES', message: 'No fields to update.' } });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id, flat_id')
      .eq('id', userId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resident not found.' } });
      return;
    }

    // If reassigning flat, verify the new flat belongs to this society
    if (flatId) {
      const { data: flatCheck } = await supabaseAdmin
        .from('flats')
        .select('id')
        .eq('id', flatId)
        .eq('society_id', societyId)
        .maybeSingle();
      if (!flatCheck) {
        res.status(404).json({ error: { code: 'FLAT_NOT_FOUND', message: 'Target flat not found in this society.' } });
        return;
      }

      // Mark new flat occupied, potentially unoccupy old flat if no other residents
      const oldFlatId = (existing as Record<string, unknown>)['flat_id'] as string | null;
      if (oldFlatId && oldFlatId !== flatId) {
        const { count } = await supabaseAdmin
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('flat_id', oldFlatId)
          .eq('is_active', true)
          .neq('id', userId);
        if (!count || count === 0) {
          await supabaseAdmin.from('flats').update({ is_occupied: false }).eq('id', oldFlatId);
        }
      }
      await supabaseAdmin.from('flats').update({ is_occupied: true }).eq('id', flatId);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !updated) throw new AppError(500, 'UPDATE_FAILED', error?.message ?? 'Update failed');

    const u = updated as Record<string, unknown>;
    res.status(200).json({
      resident: { id: u['id'], fullName: u['full_name'], phone: u['phone'], role: u['role'], flatId: u['flat_id'], societyId: u['society_id'], isActive: u['is_active'] },
    });
  } catch (err) { next(err); }
};

// DELETE /onboarding/societies/:societyId/residents/:userId
const deactivateResident: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, userId } = req.params as { societyId: string; userId: string };

    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id, flat_id')
      .eq('id', userId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resident not found.' } });
      return;
    }

    await supabaseAdmin
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', userId);

    // Potentially unoccupy flat
    const flatId = (existing as Record<string, unknown>)['flat_id'] as string | null;
    if (flatId) {
      const { count } = await supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('flat_id', flatId)
        .eq('is_active', true)
        .neq('id', userId);
      if (!count || count === 0) {
        await supabaseAdmin.from('flats').update({ is_occupied: false }).eq('id', flatId);
      }
    }

    res.status(204).end();
  } catch (err) { next(err); }
};

// POST /onboarding/societies/:societyId/residents/:userId/resend-invite
const resendInvite: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, userId } = req.params as { societyId: string; userId: string };

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, phone, full_name, society_id')
      .eq('id', userId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!profile) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resident not found.' } });
      return;
    }

    const p = profile as Record<string, unknown>;
    const phone = (p['phone'] as string | null) ?? '';
    const fullName = (p['full_name'] as string | null) ?? 'Resident';

    // Get society invite code
    const { data: society } = await supabaseAdmin
      .from('societies')
      .select('invite_code, name')
      .eq('id', societyId)
      .maybeSingle();

    const inviteCode = society ? (society as Record<string, unknown>)['invite_code'] as string : '';
    const societyName = society ? (society as Record<string, unknown>)['name'] as string : 'your society';

    // Send SMS invite (non-fatal)
    const { sendOtpSms } = await import('../services/smsService');
    try {
      await sendOtpSms(phone, inviteCode, `${fullName} — Join ${societyName} with code`);
    } catch (smsErr) {
      console.warn('[resendInvite] SMS failed (non-fatal):', smsErr);
    }

    res.status(200).json({ message: 'Invite resent successfully.' });
  } catch (err) { next(err); }
};

// PATCH /onboarding/societies/:societyId/guards/:guardId
const updateGuard: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, guardId } = req.params as { societyId: string; guardId: string };
    const parsed = updateGuardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
      });
      return;
    }

    const { gateName, shift, isActive } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (gateName !== undefined) updates['gate_name'] = gateName;
    if (shift !== undefined) updates['shift'] = shift;
    if (isActive !== undefined) updates['is_active'] = isActive;

    if (Object.keys(updates).length === 0) {
      res.status(422).json({ error: { code: 'NO_CHANGES', message: 'No fields to update.' } });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('guards')
      .select('id, user_id')
      .eq('id', guardId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Guard not found.' } });
      return;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('guards')
      .update(updates)
      .eq('id', guardId)
      .select()
      .single();

    if (error || !updated) throw new AppError(500, 'UPDATE_FAILED', error?.message ?? 'Update failed');

    // Sync is_active to user_profiles as well
    if (isActive !== undefined) {
      const userId = (existing as Record<string, unknown>)['user_id'] as string;
      await supabaseAdmin.from('user_profiles').update({ is_active: isActive }).eq('id', userId);
    }

    const u = updated as Record<string, unknown>;
    res.status(200).json({
      guard: { id: u['id'], societyId: u['society_id'], userId: u['user_id'], gateName: u['gate_name'], shift: u['shift'], isActive: u['is_active'] },
    });
  } catch (err) { next(err); }
};

// DELETE /onboarding/societies/:societyId/guards/:guardId (soft delete)
const deactivateGuard: RequestHandler = async (req, res, next) => {
  try {
    const { societyId, guardId } = req.params as { societyId: string; guardId: string };

    const { data: existing } = await supabaseAdmin
      .from('guards')
      .select('id, user_id')
      .eq('id', guardId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Guard not found.' } });
      return;
    }

    const userId = (existing as Record<string, unknown>)['user_id'] as string;

    await Promise.all([
      supabaseAdmin.from('guards').update({ is_active: false }).eq('id', guardId),
      supabaseAdmin.from('user_profiles').update({ is_active: false }).eq('id', userId),
    ]);

    res.status(204).end();
  } catch (err) { next(err); }
};

// ── Additional route registrations ─────────────────────────────────────────
router.patch('/societies/:societyId/buildings/:id', updateBuilding);
router.delete('/societies/:societyId/buildings/:id', deleteBuilding);
router.patch('/societies/:societyId/flats/:id', updateFlat);
router.delete('/societies/:societyId/flats/:id', deleteFlat);
router.patch('/societies/:societyId/residents/:userId', updateResident);
router.delete('/societies/:societyId/residents/:userId', deactivateResident);
router.post('/societies/:societyId/residents/:userId/resend-invite', resendInvite);
router.patch('/societies/:societyId/guards/:guardId', updateGuard);
router.delete('/societies/:societyId/guards/:guardId', deactivateGuard);

export default router;
