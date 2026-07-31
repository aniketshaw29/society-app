// ============================================================
// Mobile hook tests: useVisitorApproval
// ============================================================

// Mock the api module
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useVisitorApproval, type VisitorLog } from '../useVisitorApproval';
import api from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ============================================================
// Fixtures
// ============================================================

const FLAT_ID = 'flat-0001';
const VISITOR_PENDING_ID = 'vis-0001';
const VISITOR_APPROVED_ID = 'vis-0002';

const pendingVisitorRow = {
  id: VISITOR_PENDING_ID,
  society_id: 'soc-0001',
  flat_id: FLAT_ID,
  guard_id: null,
  visitor_name: 'Ravi Kumar',
  visitor_phone: '9876543210',
  visitor_photo_url: null,
  vehicle_number: null,
  purpose: 'guest',
  entry_method: 'manual',
  status: 'pending',
  approved_by: null,
  approved_at: null,
  entry_time: null,
  exit_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  flats: { flat_number: '101', buildings: { name: 'A Block' } },
};

const approvedVisitorRow = {
  ...pendingVisitorRow,
  id: VISITOR_APPROVED_ID,
  status: 'approved',
  approved_by: 'user-001',
  approved_at: new Date().toISOString(),
};

// ============================================================
// Helpers
// ============================================================

function mockSupabaseSelect(rows: unknown[]) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

// ============================================================
// Tests
// ============================================================

describe('useVisitorApproval', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── fetchPendingForFlat ────────────────────────────────────

  describe('fetchPendingForFlat', () => {
    it('returns only pending visitors for the given flat', async () => {
      mockSupabaseSelect([pendingVisitorRow]);

      const { result } = renderHook(() => useVisitorApproval());

      let visitors: VisitorLog[] = [];
      await act(async () => {
        visitors = await result.current.fetchPendingForFlat(FLAT_ID);
      });

      expect(visitors).toHaveLength(1);
      expect(visitors[0]!.status).toBe('pending');
      expect(visitors[0]!.visitorName).toBe('Ravi Kumar');
    });

    it('filters by status=pending (verifies eq call)', async () => {
      const chain = mockSupabaseSelect([pendingVisitorRow]);

      const { result } = renderHook(() => useVisitorApproval());
      await act(async () => {
        await result.current.fetchPendingForFlat(FLAT_ID);
      });

      // eq should be called with 'status' and 'pending'
      const eqCalls = chain.eq.mock.calls as [string, string][];
      const statusCall = eqCalls.find(([field]) => field === 'status');
      expect(statusCall).toBeDefined();
      expect(statusCall![1]).toBe('pending');
    });

    it('returns empty array when no pending visitors exist', async () => {
      mockSupabaseSelect([]);

      const { result } = renderHook(() => useVisitorApproval());
      let visitors: VisitorLog[] = [];
      await act(async () => {
        visitors = await result.current.fetchPendingForFlat(FLAT_ID);
      });

      expect(visitors).toHaveLength(0);
    });
  });

  // ── approveVisitor ─────────────────────────────────────────

  describe('approveVisitor', () => {
    it('calls PATCH /visitors/:id/approve', async () => {
      (api.patch as jest.Mock).mockResolvedValueOnce({
        data: { visitor: approvedVisitorRow },
      });

      const { result } = renderHook(() => useVisitorApproval());
      await act(async () => {
        await result.current.approveVisitor(VISITOR_PENDING_ID);
      });

      expect(api.patch).toHaveBeenCalledWith(
        `/visitors/${VISITOR_PENDING_ID}/approve`
      );
    });

    it('throws and sets error when API returns an error', async () => {
      (api.patch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useVisitorApproval());
      await act(async () => {
        await expect(
          result.current.approveVisitor(VISITOR_PENDING_ID)
        ).rejects.toThrow('Network error');
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  // ── denyVisitor ────────────────────────────────────────────

  describe('denyVisitor', () => {
    it('calls PATCH /visitors/:id/deny', async () => {
      (api.patch as jest.Mock).mockResolvedValueOnce({
        data: { visitor: { ...pendingVisitorRow, status: 'denied' } },
      });

      const { result } = renderHook(() => useVisitorApproval());
      await act(async () => {
        await result.current.denyVisitor(VISITOR_PENDING_ID);
      });

      expect(api.patch).toHaveBeenCalledWith(
        `/visitors/${VISITOR_PENDING_ID}/deny`
      );
    });

    it('throws and sets error when API returns an error', async () => {
      (api.patch as jest.Mock).mockRejectedValueOnce(
        new Error('Request failed with status code 409')
      );

      const { result } = renderHook(() => useVisitorApproval());
      await act(async () => {
        await expect(
          result.current.denyVisitor(VISITOR_PENDING_ID)
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  // ── Double-approve ─────────────────────────────────────────

  describe('double-approve handling', () => {
    it('propagates 409 error gracefully without crashing', async () => {
      const conflictError = Object.assign(new Error('Already approved'), {
        response: { status: 409, data: { error: { code: 'ALREADY_APPROVED' } } },
      });

      (api.patch as jest.Mock).mockRejectedValueOnce(conflictError);

      const { result } = renderHook(() => useVisitorApproval());
      let caughtError: Error | null = null;

      await act(async () => {
        try {
          await result.current.approveVisitor(VISITOR_APPROVED_ID);
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError).not.toBeNull();
      expect(result.current.error).toBeTruthy();
      // loading should be reset to false after error
      expect(result.current.loading).toBe(false);
    });
  });

  // ── fetchVisitorDetail ─────────────────────────────────────

  describe('fetchVisitorDetail', () => {
    it('calls GET /visitors/:id and returns mapped VisitorLog', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { visitor: pendingVisitorRow },
      });

      const { result } = renderHook(() => useVisitorApproval());
      let visitor: VisitorLog | null = null;

      await act(async () => {
        visitor = await result.current.fetchVisitorDetail(VISITOR_PENDING_ID);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/visitors/${VISITOR_PENDING_ID}`
      );
      expect(visitor).not.toBeNull();
      expect(visitor!.id).toBe(VISITOR_PENDING_ID);
      expect(visitor!.visitorName).toBe('Ravi Kumar');
    });
  });

  // ── subscribeToFlatVisitors ────────────────────────────────

  describe('subscribeToFlatVisitors', () => {
    it('returns a cleanup function', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
      (supabase.removeChannel as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useVisitorApproval());
      let cleanup: (() => void) | null = null;

      act(() => {
        cleanup = result.current.subscribeToFlatVisitors(FLAT_ID, jest.fn());
      });

      expect(typeof cleanup).toBe('function');

      // Calling cleanup should remove the channel
      act(() => {
        cleanup!();
      });

      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });
});
