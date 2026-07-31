/**
 * Tests for useRealtimeVisitors hook.
 *
 * Strategy: mock @supabase/supabase-js channel API and axios so no real
 * network calls are made. We verify:
 *   1. Channel is created with the correct filter string.
 *   2. UPDATE event replaces the correct visitor by id in state.
 *   3. Channel is unsubscribed on cleanup.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRealtimeVisitors } from './useRealtimeVisitors';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase
// ---------------------------------------------------------------------------

type ChangeHandler = (payload: Record<string, unknown>) => void;
type StatusHandler = (status: string) => void;

interface MockChannel {
  _filter: string;
  _changeHandler: ChangeHandler | null;
  _statusHandler: StatusHandler | null;
  on: jest.Mock;
  subscribe: jest.Mock;
}

let mockChannel: MockChannel;
const mockRemoveChannel = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn((name: string) => {
      mockChannel = {
        _filter: name,
        _changeHandler: null,
        _statusHandler: null,
        on: jest.fn(function (
          this: MockChannel,
          _event: string,
          _opts: unknown,
          handler: ChangeHandler
        ) {
          this._changeHandler = handler;
          return this;
        }),
        subscribe: jest.fn(function (this: MockChannel, handler: StatusHandler) {
          this._statusHandler = handler;
          // Immediately report SUBSCRIBED
          handler('SUBSCRIBED');
          return this;
        }),
      };
      return mockChannel;
    }),
    removeChannel: mockRemoveChannel,
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/api (axios instance)
// ---------------------------------------------------------------------------

const mockVisitors = [
  {
    id: 'v1',
    societyId: 'soc1',
    flatId: 'flat1',
    guardId: null,
    visitorName: 'Alice',
    visitorPhone: '9876543210',
    visitorPhotoUrl: null,
    vehicleNumber: null,
    purpose: 'Delivery',
    entryMethod: 'manual' as const,
    status: 'pending' as const,
    approvedBy: null,
    approvedAt: null,
    entryTime: null,
    exitTime: null,
    createdAt: '2026-07-31T10:00:00Z',
    updatedAt: '2026-07-31T10:00:00Z',
  },
  {
    id: 'v2',
    societyId: 'soc1',
    flatId: 'flat2',
    guardId: null,
    visitorName: 'Bob',
    visitorPhone: '9876543211',
    visitorPhotoUrl: null,
    vehicleNumber: null,
    purpose: 'Guest',
    entryMethod: 'manual' as const,
    status: 'pending' as const,
    approvedBy: null,
    approvedAt: null,
    entryTime: null,
    exitTime: null,
    createdAt: '2026-07-31T09:00:00Z',
    updatedAt: '2026-07-31T09:00:00Z',
  },
];

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: { visitors: mockVisitors } }),
  },
}));

// ---------------------------------------------------------------------------
// Mock react-native AppState
// ---------------------------------------------------------------------------

jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return {
    ...rn,
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRealtimeVisitors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a channel with the correct society_id filter', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { channel: jest.Mock };
    };

    renderHook(() => useRealtimeVisitors('soc1'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('soc1')
      );
    });
  });

  it('loads initial visitors on mount', async () => {
    const { result } = renderHook(() => useRealtimeVisitors('soc1'));

    await waitFor(() => {
      expect(result.current.visitors).toHaveLength(2);
      expect(result.current.visitors[0].visitorName).toBe('Alice');
    });
  });

  it('is connected after SUBSCRIBED status', async () => {
    const { result } = renderHook(() => useRealtimeVisitors('soc1'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('UPDATE event replaces the correct visitor by id', async () => {
    const { result } = renderHook(() => useRealtimeVisitors('soc1'));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.visitors).toHaveLength(2);
    });

    // Simulate an UPDATE payload from Supabase Realtime
    act(() => {
      mockChannel._changeHandler?.({
        eventType: 'UPDATE',
        new: {
          id: 'v1',
          society_id: 'soc1',
          flat_id: 'flat1',
          guard_id: null,
          visitor_name: 'Alice',
          visitor_phone: '9876543210',
          visitor_photo_url: null,
          vehicle_number: null,
          purpose: 'Delivery',
          entry_method: 'manual',
          status: 'approved',       // status changed
          approved_by: 'resident1',
          approved_at: '2026-07-31T10:05:00Z',
          entry_time: null,
          exit_time: null,
          created_at: '2026-07-31T10:00:00Z',
          updated_at: '2026-07-31T10:05:00Z',
        },
        old: {},
      });
    });

    await waitFor(() => {
      const alice = result.current.visitors.find((v) => v.id === 'v1');
      expect(alice?.status).toBe('approved');
      expect(alice?.approvedBy).toBe('resident1');
    });

    // Bob (v2) should be unchanged
    const bob = result.current.visitors.find((v) => v.id === 'v2');
    expect(bob?.status).toBe('pending');
  });

  it('INSERT event prepends a new visitor', async () => {
    const { result } = renderHook(() => useRealtimeVisitors('soc1'));

    await waitFor(() => {
      expect(result.current.visitors).toHaveLength(2);
    });

    act(() => {
      mockChannel._changeHandler?.({
        eventType: 'INSERT',
        new: {
          id: 'v3',
          society_id: 'soc1',
          flat_id: 'flat3',
          guard_id: null,
          visitor_name: 'Charlie',
          visitor_phone: null,
          visitor_photo_url: null,
          vehicle_number: null,
          purpose: 'Guest',
          entry_method: 'manual',
          status: 'pending',
          approved_by: null,
          approved_at: null,
          entry_time: null,
          exit_time: null,
          created_at: '2026-07-31T11:00:00Z',
          updated_at: '2026-07-31T11:00:00Z',
        },
        old: {},
      });
    });

    await waitFor(() => {
      expect(result.current.visitors).toHaveLength(3);
      expect(result.current.visitors[0].id).toBe('v3');
    });
  });

  it('unsubscribes the channel on cleanup', async () => {
    const { unmount } = renderHook(() => useRealtimeVisitors('soc1'));

    await waitFor(() => {
      expect(mockRemoveChannel).not.toHaveBeenCalled();
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
