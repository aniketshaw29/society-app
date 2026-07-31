import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ============================================================
// Helpers
// ============================================================

/**
 * Generate a 6-character invite code using only unambiguous uppercase
 * alphanumeric characters (no O, 0, I, 1).
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Keep generating until we find a code not already in use.
 */
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const { data } = await supabaseAdmin
      .from('societies')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new AppError(500, 'INVITE_CODE_GENERATION_FAILED', 'Could not generate unique invite code');
}

// ============================================================
// Validation schemas
// ============================================================

const createSocietySchema = z.object({
  name: z.string().min(2, 'Society name must be at least 2 characters').trim(),
  address: z.string().min(5, 'Address is required').trim(),
  city: z.string().min(2, 'City is required').trim(),
  state: z.string().min(2, 'State is required').trim(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  totalBuildings: z.number().int().min(1).optional(),
});

const joinSocietySchema = z.object({
  inviteCode: z.string().length(6, 'Invite code must be 6 characters').toUpperCase(),
  flatId: z.string().uuid('Invalid flat ID'),
  residentType: z.enum(['owner', 'tenant']),
  fullName: z.string().min(2, 'Full name is required').trim(),
});

// ============================================================
// POST /societies
// Creates a new society; the authenticated user becomes society_admin
// ============================================================

const createSociety: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createSocietySchema.safeParse(req.body);
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

    const { name, address, city, state, pincode, totalBuildings } = parsed.data;
    const userId = req.user!.id;

    // Check for duplicate name + pincode (soft warning, not a hard block)
    const { data: existing } = await supabaseAdmin
      .from('societies')
      .select('id, name, city, pincode, invite_code')
      .eq('name', name)
      .eq('pincode', pincode)
      .maybeSingle();

    if (existing) {
      res.status(409).json({
        warning: true,
        message: 'A society with the same name and pincode already exists.',
        existingSociety: {
          id: existing.id,
          name: existing.name,
          city: existing.city,
          pincode: existing.pincode,
        },
      });
      return;
    }

    const inviteCode = await generateUniqueInviteCode();

    // Create society
    const { data: society, error: societyError } = await supabaseAdmin
      .from('societies')
      .insert({
        name,
        address,
        city,
        state,
        pincode,
        invite_code: inviteCode,
        total_flats: 0,
        settings: totalBuildings ? { totalBuildings } : {},
        is_active: true,
      })
      .select()
      .single();

    if (societyError || !society) {
      throw new AppError(500, 'SOCIETY_CREATE_FAILED', societyError?.message ?? 'Failed to create society');
    }

    // Get user phone from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const phone = authUser?.user?.phone ?? '';

    // Upsert user_profiles row with society_admin role
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          phone,
          role: 'society_admin',
          society_id: society.id,
          flat_id: null,
          is_active: true,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      // Roll back society creation
      await supabaseAdmin.from('societies').delete().eq('id', society.id);
      throw new AppError(500, 'PROFILE_UPDATE_FAILED', profileError.message);
    }

    res.status(201).json({
      society: {
        id: society.id,
        name: society.name,
        address: society.address,
        city: society.city,
        state: society.state,
        pincode: society.pincode,
        invite_code: society.invite_code,
        total_flats: society.total_flats,
        is_active: society.is_active,
        created_at: society.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /societies/by-invite/:code
// Lookup society by invite code (T1-5)
// ============================================================

const getSocietyByInvite: RequestHandler = async (req, res, next) => {
  try {
    const code = (req.params['code'] ?? '').toUpperCase();

    if (!code || code.length !== 6) {
      res.status(404).json({
        error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found for this invite code' },
      });
      return;
    }

    const { data: society, error } = await supabaseAdmin
      .from('societies')
      .select('id, name, city, state, address, total_flats')
      .eq('invite_code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !society) {
      res.status(404).json({
        error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found for this invite code' },
      });
      return;
    }

    res.status(200).json({
      society: {
        id: society.id,
        name: society.name,
        city: society.city,
        state: society.state,
        address: society.address,
        totalFlats: society.total_flats,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /societies/:societyId/join
// Resident joins via invite code (T1-5)
// ============================================================

const joinSociety: RequestHandler = async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };
    const userId = req.user!.id;

    const parsed = joinSocietySchema.safeParse(req.body);
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

    const { inviteCode, flatId, residentType, fullName } = parsed.data;

    // Verify society + invite code
    const { data: society, error: societyError } = await supabaseAdmin
      .from('societies')
      .select('id, name, invite_code')
      .eq('id', societyId)
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .maybeSingle();

    if (societyError || !society) {
      res.status(404).json({
        error: { code: 'SOCIETY_NOT_FOUND', message: 'Society not found or invite code is invalid' },
      });
      return;
    }

    // Verify flat belongs to this society
    const { data: flat, error: flatError } = await supabaseAdmin
      .from('flats')
      .select('id, flat_number, building_id')
      .eq('id', flatId)
      .eq('society_id', societyId)
      .maybeSingle();

    if (flatError || !flat) {
      res.status(404).json({
        error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found in this society' },
      });
      return;
    }

    // Check if this user already joined this society + flat
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, society_id, flat_id')
      .eq('id', userId)
      .maybeSingle();

    if (
      existingProfile &&
      existingProfile.society_id === societyId &&
      existingProfile.flat_id === flatId
    ) {
      res.status(409).json({
        error: { code: 'ALREADY_JOINED', message: 'You have already joined this society and flat' },
      });
      return;
    }

    // Get user phone
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const phone = authUser?.user?.phone ?? '';

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
      throw new AppError(500, 'PROFILE_UPDATE_FAILED', profileError?.message ?? 'Failed to update profile');
    }

    // Mark flat as occupied
    await supabaseAdmin
      .from('flats')
      .update({ is_occupied: true })
      .eq('id', flatId);

    res.status(201).json({
      profile: {
        id: profile.id,
        phone: profile.phone,
        fullName: profile.full_name,
        role: profile.role,
        societyId: profile.society_id,
        flatId: profile.flat_id,
      },
      society: {
        id: society.id,
        name: society.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Route registration
// ============================================================

// All routes require authentication
router.use(authenticate);

// POST /societies — create a society (any authenticated user)
router.post('/', createSociety);

// GET /societies/by-invite/:code — find society by invite code (before :societyId routes)
router.get('/by-invite/:code', getSocietyByInvite);

// POST /societies/:societyId/join — join society as resident
router.post('/:societyId/join', joinSociety);

// GET /societies/:societyId/flats — used by select-flat screen (forwarded from onboarding router)
router.get('/:societyId/flats', async (req, res, next) => {
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
});

// GET /societies/:societyId/buildings
router.get('/:societyId/buildings', requireRole('society_admin', 'super_admin'), async (req, res, next) => {
  try {
    const { societyId } = req.params as { societyId: string };

    const { data: buildings, error } = await supabaseAdmin
      .from('buildings')
      .select('id, name, total_floors, created_at')
      .eq('society_id', societyId)
      .order('name', { ascending: true });

    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    // Get flat counts per building
    const buildingsWithCount = await Promise.all(
      (buildings ?? []).map(async (b) => {
        const { count } = await supabaseAdmin
          .from('flats')
          .select('*', { count: 'exact', head: true })
          .eq('building_id', b.id);
        return { ...b, flatCount: count ?? 0 };
      })
    );

    res.status(200).json({ buildings: buildingsWithCount });
  } catch (err) {
    next(err);
  }
});

export default router;
