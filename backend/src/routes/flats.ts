import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendOtpSms } from '../services/smsService';

const router = Router();
router.use(authenticate);

// ============================================================
// Validation schemas
// ============================================================

const addMemberSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91\d{10}$|^\d{10}$/, 'Phone must be a valid Indian number')
    .transform((v) => (v.startsWith('+91') ? v : `+91${v}`)),
  fullName: z.string().min(2, 'Full name is required').trim(),
  residentType: z.enum(['owner', 'tenant']),
});

// ============================================================
// Helper: UserProfile shape returned to clients
// ============================================================

interface MemberProfile {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  flatId: string | null;
  societyId: string | null;
  isActive: boolean;
  joinedAt: string;
  avatarUrl: string | null;
}

function mapProfile(row: Record<string, unknown>): MemberProfile {
  return {
    id: row['id'] as string,
    fullName: (row['full_name'] as string | null) ?? null,
    phone: (row['phone'] as string | null) ?? null,
    role: (row['role'] as string) ?? 'tenant',
    flatId: (row['flat_id'] as string | null) ?? null,
    societyId: (row['society_id'] as string | null) ?? null,
    isActive: (row['is_active'] as boolean) ?? true,
    joinedAt: (row['created_at'] as string) ?? new Date().toISOString(),
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
  };
}

// ============================================================
// Guard: caller must be a member of the flat
// ============================================================

async function assertFlatMember(
  userId: string,
  flatId: string
): Promise<void> {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .eq('flat_id', flatId)
    .maybeSingle();

  if (!data) {
    throw new AppError(403, 'FORBIDDEN', 'You are not a member of this flat');
  }
}

// Guard: caller must be flat_owner of the flat
async function assertFlatOwner(
  userId: string,
  flatId: string
): Promise<void> {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role')
    .eq('id', userId)
    .eq('flat_id', flatId)
    .maybeSingle();

  if (!data) {
    throw new AppError(403, 'FORBIDDEN', 'You are not a member of this flat');
  }
  if ((data as Record<string, unknown>)['role'] !== 'flat_owner') {
    throw new AppError(403, 'FORBIDDEN', 'Only the flat owner can perform this action');
  }
}

// ============================================================
// GET /flats/:id/members
// Auth: must be member of flat_id
// Returns: user_profiles for the flat
// ============================================================

const listFlatMembers: RequestHandler = async (req, res, next) => {
  try {
    const { id: flatId } = req.params as { id: string };
    const user = req.user!;

    // Verify caller is a member of the flat (guards/admins bypass)
    const isPrivileged = ['guard', 'society_admin', 'super_admin'].includes(user.role);
    if (!isPrivileged) {
      await assertFlatMember(user.id, flatId);
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, phone, role, flat_id, society_id, is_active, created_at, avatar_url')
      .eq('flat_id', flatId)
      .order('created_at', { ascending: true });

    if (error) throw new AppError(500, 'FETCH_FAILED', error.message);

    res.status(200).json({
      members: (data ?? []).map((row) => mapProfile(row as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /flats/:id/members
// Auth: flat_owner only
// Body: { phone, fullName, residentType }
// Finds or creates user by phone, links to flat
// Sends SMS invite
// 409 if phone already in another flat of same society
// ============================================================

const addFlatMember: RequestHandler = async (req, res, next) => {
  try {
    const { id: flatId } = req.params as { id: string };
    const user = req.user!;

    // Only flat_owner can add members
    await assertFlatOwner(user.id, flatId);

    // Validate body
    const parsed = addMemberSchema.safeParse(req.body);
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

    const { phone, fullName, residentType } = parsed.data;

    // Get flat's society_id
    const { data: flat, error: flatError } = await supabaseAdmin
      .from('flats')
      .select('id, society_id, flat_number, buildings ( name )')
      .eq('id', flatId)
      .maybeSingle();

    if (flatError || !flat) {
      res.status(404).json({ error: { code: 'FLAT_NOT_FOUND', message: 'Flat not found' } });
      return;
    }

    const flatRow = flat as Record<string, unknown>;
    const societyId = flatRow['society_id'] as string;
    const flatNumber = flatRow['flat_number'] as string;
    const buildingName =
      (flatRow['buildings'] as { name: string } | null)?.name ?? '';

    // 409 if phone already belongs to another flat in same society
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, flat_id, society_id')
      .eq('phone', phone)
      .eq('society_id', societyId)
      .maybeSingle();

    if (existingProfile) {
      const ep = existingProfile as Record<string, unknown>;
      if (ep['flat_id'] !== null && ep['flat_id'] !== flatId) {
        res.status(409).json({
          error: {
            code: 'ALREADY_IN_ANOTHER_FLAT',
            message:
              'This phone number is already registered in another flat of the same society',
          },
        });
        return;
      }
      // Already in this flat
      if (ep['flat_id'] === flatId) {
        res.status(409).json({
          error: {
            code: 'ALREADY_IN_FLAT',
            message: 'This phone number is already a member of this flat',
          },
        });
        return;
      }
    }

    // Find or create user in Supabase Auth by phone
    // Try to find an existing auth user with this phone
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const existingAuthUser = authList?.users?.find(
      (u) =>
        u.phone === phone ||
        u.user_metadata?.['phone'] === phone
    );

    let targetUserId: string;

    if (existingAuthUser) {
      targetUserId = existingAuthUser.id;

      // Update or create profile to link them to this flat
      const { data: existingProfileForUser } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('id', targetUserId)
        .maybeSingle();

      if (existingProfileForUser) {
        await supabaseAdmin
          .from('user_profiles')
          .update({
            flat_id: flatId,
            society_id: societyId,
            role: residentType === 'owner' ? 'flat_owner' : 'tenant',
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);
      } else {
        await supabaseAdmin.from('user_profiles').insert({
          id: targetUserId,
          full_name: fullName,
          phone,
          role: residentType === 'owner' ? 'flat_owner' : 'tenant',
          flat_id: flatId,
          society_id: societyId,
          is_active: true,
        });
      }
    } else {
      // Create a new auth user with phone (password-less — they'll sign in via OTP)
      const { data: newAuthUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          phone,
          phone_confirm: true,
          user_metadata: { full_name: fullName, phone },
        });

      if (createError || !newAuthUser.user) {
        throw new AppError(
          500,
          'USER_CREATE_FAILED',
          createError?.message ?? 'Failed to create user'
        );
      }

      targetUserId = newAuthUser.user.id;

      // Create profile
      await supabaseAdmin.from('user_profiles').insert({
        id: targetUserId,
        full_name: fullName,
        phone,
        role: residentType === 'owner' ? 'flat_owner' : 'tenant',
        flat_id: flatId,
        society_id: societyId,
        is_active: true,
      });
    }

    // Fetch the updated profile to return
    const { data: newMember, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, phone, role, flat_id, society_id, is_active, created_at, avatar_url')
      .eq('id', targetUserId)
      .single();

    if (fetchError || !newMember) {
      throw new AppError(500, 'FETCH_FAILED', 'Failed to retrieve created member');
    }

    res.status(201).json({ member: mapProfile(newMember as Record<string, unknown>) });

    // Fire-and-forget SMS invite
    const smsPhone = phone.replace('+91', '');
    const appStoreUrl = process.env['APP_STORE_URL'] ?? 'https://example.com/app';
    void sendOtpSms(
      smsPhone,
      'INVITE',
      `You've been added to Flat ${flatNumber}${buildingName ? ` (${buildingName})` : ''} in your society. Download the app: ${appStoreUrl}`
    );
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /flats/:id/members/:memberId
// Auth: flat_owner only
// Cannot delete yourself (primary owner)
// Sets flat_id = null on user_profiles
// ============================================================

const removeFlatMember: RequestHandler = async (req, res, next) => {
  try {
    const { id: flatId, memberId } = req.params as {
      id: string;
      memberId: string;
    };
    const user = req.user!;

    // Only flat_owner can remove members
    await assertFlatOwner(user.id, flatId);

    // Cannot remove yourself
    if (memberId === user.id) {
      res.status(400).json({
        error: {
          code: 'CANNOT_REMOVE_SELF',
          message: 'You cannot remove yourself from the flat',
        },
      });
      return;
    }

    // Verify target is actually in this flat
    const { data: targetProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, flat_id')
      .eq('id', memberId)
      .maybeSingle();

    if (!targetProfile) {
      res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' },
      });
      return;
    }

    const tp = targetProfile as Record<string, unknown>;
    if (tp['flat_id'] !== flatId) {
      res.status(403).json({
        error: { code: 'NOT_IN_FLAT', message: 'Member does not belong to this flat' },
      });
      return;
    }

    // Unlink from flat (set flat_id = null, role back to tenant)
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        flat_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) {
      throw new AppError(500, 'UPDATE_FAILED', updateError.message);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Route registration
// ============================================================

router.get('/:id/members', listFlatMembers);
router.post(
  '/:id/members',
  requireRole('flat_owner'),
  addFlatMember
);
router.delete(
  '/:id/members/:memberId',
  requireRole('flat_owner'),
  removeFlatMember
);

export default router;
