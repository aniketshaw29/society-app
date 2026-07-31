import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole, requireSocietyAccess } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ============================================================
// Validation schemas
// ============================================================

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

export default router;
