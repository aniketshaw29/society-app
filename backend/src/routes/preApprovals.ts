import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { generateQrPayload, verifyQrPayload } from '../lib/qrUtils';
import { notifyFlatResidents } from '../services/notificationService';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createPreApprovalSchema = z.object({
  guestName: z.string().min(1, 'Guest name is required').trim(),
  guestPhone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be 10 digits')
    .optional(),
  validFrom: z.string().datetime({ message: 'validFrom must be ISO 8601' }),
  validUntil: z.string().datetime({ message: 'validUntil must be ISO 8601' }),
  note: z.string().trim().optional(),
});

const verifyQrSchema = z.object({
  qrPayload: z.string().min(1, 'qrPayload is required'),
});

// ---------------------------------------------------------------------------
// Shape returned to clients
// ---------------------------------------------------------------------------

export interface PreApproval {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  guestName: string;
  guestPhone: string | null;
  validFrom: string;
  validUntil: string;
  status: string;
  usedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapPreApproval(row: Record<string, unknown>): PreApproval {
  return {
    id: row['id'] as string,
    societyId: row['society_id'] as string,
    flatId: row['flat_id'] as string,
    residentId: row['resident_id'] as string,
    guestName: row['guest_name'] as string,
    guestPhone: (row['guest_phone'] as string | null) ?? null,
    validFrom: row['valid_from'] as string,
    validUntil: row['valid_until'] as string,
    status: row['status'] as string,
    usedAt: (row['used_at'] as string | null) ?? null,
    note: (row['note'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ---------------------------------------------------------------------------
// POST /pre-approvals
// Auth: resident JWT
// Body: { guestName, guestPhone?, validFrom, validUntil, note? }
// ---------------------------------------------------------------------------

const createPreApproval: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.flat_id || !user.society_id) {
      throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat to create pre-approvals');
    }

    const parsed = createPreApprovalSchema.safeParse(req.body);
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

    const { guestName, guestPhone, validFrom, validUntil, note } = parsed.data;

    if (new Date(validUntil) <= new Date(validFrom)) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'validUntil must be after validFrom' },
      });
      return;
    }

    const { data: newApproval, error: insertError } = await supabaseAdmin
      .from('pre_approvals')
      .insert({
        society_id: user.society_id,
        flat_id: user.flat_id,
        resident_id: user.id,
        guest_name: guestName,
        guest_phone: guestPhone ?? null,
        valid_from: validFrom,
        valid_until: validUntil,
        status: 'active',
        note: note ?? null,
      })
      .select('*')
      .single();

    if (insertError || !newApproval) {
      throw new AppError(500, 'CREATE_FAILED', insertError?.message ?? 'Failed to create pre-approval');
    }

    res.status(201).json({ preApproval: mapPreApproval(newApproval as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /pre-approvals
// Auth: resident JWT
// Returns: all pre-approvals for the user's flat (most recent first)
// ---------------------------------------------------------------------------

const listPreApprovals: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.flat_id) {
      throw new AppError(403, 'NO_FLAT', 'You must be assigned to a flat');
    }

    const { data, error } = await supabaseAdmin
      .from('pre_approvals')
      .select('*')
      .eq('flat_id', user.flat_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new AppError(500, 'FETCH_FAILED', error.message);
    }

    res.status(200).json({
      preApprovals: (data ?? []).map((row) => mapPreApproval(row as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /pre-approvals/:id
// Auth: resident JWT (must own the pre-approval)
// ---------------------------------------------------------------------------

const getPreApproval: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const { data, error } = await supabaseAdmin
      .from('pre_approvals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pre-approval not found' } });
      return;
    }

    const row = data as Record<string, unknown>;

    // Residents can only see their own flat's pre-approvals
    const isPrivileged = ['guard', 'society_admin', 'super_admin'].includes(user.role);
    if (!isPrivileged && row['flat_id'] !== user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    res.status(200).json({ preApproval: mapPreApproval(row) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /pre-approvals/:id  (cancel)
// Auth: resident JWT (must own the pre-approval)
// ---------------------------------------------------------------------------

const cancelPreApproval: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('pre_approvals')
      .select('id, flat_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pre-approval not found' } });
      return;
    }

    const row = existing as Record<string, unknown>;

    if (row['flat_id'] !== user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (row['status'] === 'cancelled') {
      res.status(409).json({ error: { code: 'ALREADY_CANCELLED', message: 'Already cancelled' } });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('pre_approvals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw new AppError(500, 'UPDATE_FAILED', updateError.message);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /pre-approvals/:id/qr
// Auth: resident JWT (must own the pre-approval)
// Returns: { qrPayload: string }
// ---------------------------------------------------------------------------

const generateQr: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('pre_approvals')
      .select('id, flat_id, society_id, status, valid_from, valid_until')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pre-approval not found' } });
      return;
    }

    const row = existing as Record<string, unknown>;

    if (row['flat_id'] !== user.flat_id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (row['status'] !== 'active') {
      res.status(409).json({
        error: {
          code: row['status'] === 'used' ? 'already_used' : 'pre_approval_expired',
          message: `Pre-approval is ${row['status'] as string}`,
        },
      });
      return;
    }

    const now = new Date();
    const validUntil = new Date(row['valid_until'] as string);
    if (now > validUntil) {
      res.status(409).json({
        error: { code: 'pre_approval_expired', message: 'Pre-approval validity window has passed' },
      });
      return;
    }

    const qrPayload = generateQrPayload(id, row['society_id'] as string);
    res.status(200).json({ qrPayload });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /pre-approvals/verify-qr
// Auth: guard JWT
// Body: { qrPayload: string }
// Flow:
//   1. verifyQrPayload — throws on invalid/expired/tampered
//   2. Fetch pre-approval, validate status='active' and time window
//   3. Create visitor_logs row (status='approved', entry_method='qr_code')
//   4. Update pre-approval: status='used', used_at=now()
//   5. Send FCM to flat residents
// ---------------------------------------------------------------------------

const verifyQr: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyQrSchema.safeParse(req.body);
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

    const { qrPayload } = parsed.data;
    const user = req.user!;

    // Step 1: verify HMAC + expiry
    let decoded: { preApprovalId: string; societyId: string; timestamp: number };
    try {
      decoded = verifyQrPayload(qrPayload);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'invalid_qr';
      res.status(400).json({ error: { code, message: 'QR verification failed' } });
      return;
    }

    // Guard must belong to the same society encoded in the QR
    if (user.society_id !== decoded.societyId) {
      res.status(403).json({ error: { code: 'invalid_qr', message: 'QR is for a different society' } });
      return;
    }

    // Step 2: fetch pre-approval
    const { data: preApproval, error: paError } = await supabaseAdmin
      .from('pre_approvals')
      .select('*')
      .eq('id', decoded.preApprovalId)
      .maybeSingle();

    if (paError || !preApproval) {
      res.status(404).json({ error: { code: 'invalid_qr', message: 'Pre-approval not found' } });
      return;
    }

    const pa = preApproval as Record<string, unknown>;

    if (pa['status'] === 'used') {
      res.status(409).json({ error: { code: 'already_used', message: 'This QR has already been used' } });
      return;
    }

    if (pa['status'] !== 'active') {
      res.status(409).json({ error: { code: 'pre_approval_expired', message: 'Pre-approval is not active' } });
      return;
    }

    const now = new Date();
    const validFrom = new Date(pa['valid_from'] as string);
    const validUntil = new Date(pa['valid_until'] as string);

    if (now < validFrom || now > validUntil) {
      res.status(409).json({
        error: { code: 'pre_approval_expired', message: 'Pre-approval validity window has passed' },
      });
      return;
    }

    // Step 3: resolve guard record id
    const { data: guardRecord } = await supabaseAdmin
      .from('guards')
      .select('id')
      .eq('user_id', user.id)
      .eq('society_id', user.society_id!)
      .maybeSingle();

    // Step 4: create visitor_logs row
    const { data: visitorLog, error: insertError } = await supabaseAdmin
      .from('visitor_logs')
      .insert({
        society_id: pa['society_id'],
        flat_id: pa['flat_id'],
        guard_id: guardRecord?.id ?? null,
        visitor_name: pa['guest_name'],
        visitor_phone: pa['guest_phone'] ?? null,
        purpose: 'guest',
        entry_method: 'qr_code',
        status: 'approved',
        approved_by: user.id,
        approved_at: now.toISOString(),
        entry_time: now.toISOString(),
      })
      .select(`
        id, society_id, flat_id, guard_id,
        visitor_name, visitor_phone, visitor_photo_url,
        vehicle_number, purpose, entry_method, status,
        approved_by, approved_at, entry_time, exit_time,
        created_at, updated_at,
        flats ( flat_number, buildings ( name ) )
      `)
      .single();

    if (insertError || !visitorLog) {
      throw new AppError(500, 'CREATE_FAILED', insertError?.message ?? 'Failed to create visitor log');
    }

    // Step 5: mark pre-approval as used
    await supabaseAdmin
      .from('pre_approvals')
      .update({ status: 'used', used_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', decoded.preApprovalId);

    // Fetch flat info for response
    const flatRow = (visitorLog as Record<string, unknown>)['flats'] as
      | { flat_number: string; buildings: { name: string } | null }
      | null;

    const responseLog = {
      id: (visitorLog as Record<string, unknown>)['id'] as string,
      societyId: (visitorLog as Record<string, unknown>)['society_id'] as string,
      flatId: (visitorLog as Record<string, unknown>)['flat_id'] as string,
      guardId: (visitorLog as Record<string, unknown>)['guard_id'] as string | null,
      visitorName: (visitorLog as Record<string, unknown>)['visitor_name'] as string,
      visitorPhone: (visitorLog as Record<string, unknown>)['visitor_phone'] as string | null,
      visitorPhotoUrl: null,
      vehicleNumber: null,
      purpose: 'guest',
      entryMethod: 'qr_code',
      status: 'approved',
      approvedBy: (visitorLog as Record<string, unknown>)['approved_by'] as string,
      approvedAt: (visitorLog as Record<string, unknown>)['approved_at'] as string,
      entryTime: (visitorLog as Record<string, unknown>)['entry_time'] as string,
      exitTime: null,
      createdAt: (visitorLog as Record<string, unknown>)['created_at'] as string,
      updatedAt: (visitorLog as Record<string, unknown>)['updated_at'] as string,
      flat: flatRow
        ? { flatNumber: flatRow.flat_number, buildingName: flatRow.buildings?.name ?? null }
        : undefined,
    };

    res.status(200).json({
      visitor: responseLog,
      guestName: pa['guest_name'] as string,
      flatNumber: flatRow?.flat_number ?? null,
    });

    // Step 6: FCM to flat residents (fire-and-forget)
    void notifyFlatResidents(pa['society_id'] as string, pa['flat_id'] as string, {
      title: 'Guest Arrived via QR',
      body: `Your guest ${pa['guest_name'] as string} has arrived via QR code`,
      data: {
        type: 'qr_entry',
        visitorId: responseLog.id,
        flatId: pa['flat_id'] as string,
        societyId: pa['society_id'] as string,
        guestName: pa['guest_name'] as string,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// POST /pre-approvals/verify-qr — must come before /:id routes
router.post('/verify-qr', requireRole('guard'), verifyQr);

// Resident routes
router.post('/', requireRole('flat_owner', 'tenant'), createPreApproval);
router.get('/', requireRole('flat_owner', 'tenant'), listPreApprovals);
router.get('/:id', getPreApproval);
router.delete('/:id', requireRole('flat_owner', 'tenant'), cancelPreApproval);
router.post('/:id/qr', requireRole('flat_owner', 'tenant'), generateQr);

export default router;
