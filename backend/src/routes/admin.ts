import { Router, RequestHandler } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ============================================================
// All /admin routes require society_admin JWT
// ============================================================
router.use(authenticate);
router.use(requireRole('society_admin', 'super_admin'));

// ============================================================
// Helpers
// ============================================================

/**
 * Get the start-of-day timestamp in IST (UTC+5:30).
 * Returns an ISO string suitable for Supabase gte/lt filters.
 */
function getISTDayBounds(): { start: string; end: string } {
  const nowUtc = new Date();
  // IST offset: +5h30m = 330 minutes
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  // Current time in IST as a "fake" UTC date with same wall-clock value
  const istNow = new Date(nowUtc.getTime() + IST_OFFSET_MS);

  // Midnight IST = start of day
  const istMidnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );

  // Convert back to real UTC by subtracting the offset
  const startUtc = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  };
}

/**
 * Returns an array of last N days as YYYY-MM-DD strings in IST.
 */
function getLastNDaysIST(n: number): string[] {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + IST_OFFSET_MS);

  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(istNow);
    d.setUTCDate(d.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }
  return days;
}

// ============================================================
// GET /admin/stats
// ============================================================

const getStats: RequestHandler = async (req, res, next) => {
  try {
    const societyId = req.user!.society_id;

    if (!societyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Admin must belong to a society.');
    }

    const { start: todayStart, end: todayEnd } = getISTDayBounds();

    // Run all queries in parallel
    const [
      totalFlatsResult,
      occupiedFlatsResult,
      guardsOnDutyResult,
      visitorsTodayResult,
      activeSosResult,
      visitorLogsResult,
    ] = await Promise.all([
      // Total flats
      supabaseAdmin
        .from('flats')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId),

      // Occupied flats
      supabaseAdmin
        .from('flats')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId)
        .eq('is_occupied', true),

      // Guards on duty (is_active = true in guards table)
      supabaseAdmin
        .from('guards')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId)
        .eq('is_active', true),

      // Visitors today (IST)
      supabaseAdmin
        .from('visitor_logs')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId)
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      // Active SOS alerts
      supabaseAdmin
        .from('sos_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId)
        .eq('status', 'active'),

      // Last 7 days of visitor logs for trend (raw rows, grouped in-memory)
      supabaseAdmin
        .from('visitor_logs')
        .select('created_at')
        .eq('society_id', societyId)
        .gte('created_at', (() => {
          const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return new Date(sevenDaysAgo.getTime() - IST_OFFSET_MS).toISOString();
        })()),
    ]);

    // Build visitor trend: last 7 days in IST
    const days = getLastNDaysIST(7);
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const countsByDay: Record<string, number> = {};
    days.forEach((d) => { countsByDay[d] = 0; });

    if (visitorLogsResult.data) {
      for (const row of visitorLogsResult.data as Array<Record<string, unknown>>) {
        const utcDate = new Date(row['created_at'] as string);
        const istDate = new Date(utcDate.getTime() + IST_OFFSET_MS);
        const yyyy = istDate.getUTCFullYear();
        const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(istDate.getUTCDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        if (dayKey in countsByDay) {
          countsByDay[dayKey]++;
        }
      }
    }

    const visitorTrend = days.map((date) => ({
      date,
      count: countsByDay[date] ?? 0,
    }));

    res.status(200).json({
      totalFlats: totalFlatsResult.count ?? 0,
      occupiedFlats: occupiedFlatsResult.count ?? 0,
      guardsOnDuty: guardsOnDutyResult.count ?? 0,
      visitorsToday: visitorsTodayResult.count ?? 0,
      activeSos: activeSosResult.count ?? 0,
      visitorTrend,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /admin/activity
// ============================================================

interface ActivityItem {
  type: 'visitor' | 'sos';
  id: string;
  summary: string;
  createdAt: string;
  status: string;
}

const getActivity: RequestHandler = async (req, res, next) => {
  try {
    const societyId = req.user!.society_id;

    if (!societyId) {
      throw new AppError(403, 'NO_SOCIETY', 'Admin must belong to a society.');
    }

    // Fetch last 10 visitor logs + last 10 SOS alerts in parallel
    const [visitorResult, sosResult] = await Promise.all([
      supabaseAdmin
        .from('visitor_logs')
        .select('id, visitor_name, status, created_at, flat_id')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(10),

      supabaseAdmin
        .from('sos_alerts')
        .select('id, message, status, created_at, flat_id')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const items: ActivityItem[] = [];

    if (visitorResult.data) {
      for (const row of visitorResult.data) {
        const r = row as Record<string, unknown>;
        items.push({
          type: 'visitor',
          id: r['id'] as string,
          summary: `Visitor: ${r['visitor_name'] as string}`,
          createdAt: r['created_at'] as string,
          status: r['status'] as string,
        });
      }
    }

    if (sosResult.data) {
      for (const row of sosResult.data) {
        const r = row as Record<string, unknown>;
        items.push({
          type: 'sos',
          id: r['id'] as string,
          summary: `SOS: ${(r['message'] as string) || 'Emergency alert'}`,
          createdAt: r['created_at'] as string,
          status: r['status'] as string,
        });
      }
    }

    // Sort combined list by createdAt DESC, take top 10
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = items.slice(0, 10);

    res.status(200).json({ activity: latest });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Route registration
// ============================================================
router.get('/stats', getStats);
router.get('/activity', getActivity);

export default router;
