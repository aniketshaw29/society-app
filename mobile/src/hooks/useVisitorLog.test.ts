/**
 * Tests for useVisitorLog hook.
 *
 * Strategy: mock the api client and supabase client so the hook
 * can be exercised in pure Node/Jest without native modules or a live backend.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockGet = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn().mockReturnThis();
const mockOn = jest.fn().mockReturnThis();
const mockChannel = jest.fn().mockReturnValue({
  on: mockOn,
  subscribe: mockSubscribe,
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import { useVisitorLog } from './useVisitorLog';
import type { CreateVisitorInput } from './useVisitorLog';

function getHook() {
  return useVisitorLog();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeVisitorLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'vlog-001',
    societyId: 'soc-001',
    flatId: 'flat-001',
    guardId: null,
    visitorName: 'Ramesh Kumar',
    visitorPhone: null,
    visitorPhotoUrl: null,
    vehicleNumber: null,
    purpose: 'guest',
    entryMethod: 'manual',
    status: 'pending',
    entryTime: null,
    exitTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const validInput: CreateVisitorInput = {
  flatId: 'flat-001',
  visitorName: 'Ramesh Kumar',
  purpose: 'guest',
  entryMethod: 'manual',
};

// ── Test suite ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── submitVisitor ──────────────────────────────────────────────────────────

describe('submitVisitor', () => {
  it('calls POST /visitors with the correct payload', async () => {
    const fakeLog = makeVisitorLog();
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    const result = await hook.submitVisitor(validInput);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/visitors');
    expect(body.flatId).toBe('flat-001');
    expect(body.visitorName).toBe('Ramesh Kumar');
    expect(body.purpose).toBe('guest');
    expect(body.entryMethod).toBe('manual');
    expect(result).toEqual(fakeLog);
  });

  it('throws if visitorName is empty string', async () => {
    const hook = getHook();
    await expect(
      hook.submitVisitor({ ...validInput, visitorName: '' })
    ).rejects.toThrow('Visitor name is required');
  });

  it('throws if visitorName is only whitespace', async () => {
    const hook = getHook();
    await expect(
      hook.submitVisitor({ ...validInput, visitorName: '   ' })
    ).rejects.toThrow('Visitor name is required');
  });

  it('trims visitorName before sending', async () => {
    const fakeLog = makeVisitorLog({ visitorName: 'Suresh' });
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    await hook.submitVisitor({ ...validInput, visitorName: '  Suresh  ' });

    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.visitorName).toBe('Suresh');
  });

  it('correctly maps purpose=delivery to API enum', async () => {
    const fakeLog = makeVisitorLog({ purpose: 'delivery' });
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    await hook.submitVisitor({ ...validInput, purpose: 'delivery' });

    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.purpose).toBe('delivery');
  });

  it('correctly maps purpose=service to API enum', async () => {
    const fakeLog = makeVisitorLog({ purpose: 'service' });
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    await hook.submitVisitor({ ...validInput, purpose: 'service' });

    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.purpose).toBe('service');
  });

  it('includes optional phone when provided', async () => {
    const fakeLog = makeVisitorLog({ visitorPhone: '9876543210' });
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    await hook.submitVisitor({ ...validInput, visitorPhone: '9876543210' });

    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.visitorPhone).toBe('9876543210');
  });

  it('does not include visitorPhone key when not provided', async () => {
    const fakeLog = makeVisitorLog();
    mockPost.mockResolvedValueOnce({ data: { visitor: fakeLog } });

    const hook = getHook();
    await hook.submitVisitor(validInput);

    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.visitorPhone).toBeUndefined();
  });

  it('propagates API errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));

    const hook = getHook();
    await expect(hook.submitVisitor(validInput)).rejects.toThrow('Network Error');
  });
});

// ── markExit ───────────────────────────────────────────────────────────────

describe('markExit', () => {
  it('calls PATCH /visitors/:id/exit', async () => {
    mockPatch.mockResolvedValueOnce({ data: {} });

    const hook = getHook();
    await hook.markExit('vlog-123');

    expect(mockPatch).toHaveBeenCalledTimes(1);
    const [url] = mockPatch.mock.calls[0] as [string];
    expect(url).toBe('/visitors/vlog-123/exit');
  });

  it('propagates API errors', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Server error'));

    const hook = getHook();
    await expect(hook.markExit('vlog-999')).rejects.toThrow('Server error');
  });
});

// ── fetchActive ────────────────────────────────────────────────────────────

describe('fetchActive', () => {
  it('calls GET /visitors/active and returns the list', async () => {
    const fakeList = [makeVisitorLog(), makeVisitorLog({ id: 'vlog-002', visitorName: 'Priya' })];
    mockGet.mockResolvedValueOnce({ data: { visitors: fakeList } });

    const hook = getHook();
    const result = await hook.fetchActive();

    expect(mockGet).toHaveBeenCalledWith('/visitors/active');
    expect(result).toHaveLength(2);
    expect(result[1]?.visitorName).toBe('Priya');
  });
});

// ── subscribeToActive ──────────────────────────────────────────────────────

describe('subscribeToActive', () => {
  it('subscribes to visitor_logs realtime channel and returns unsubscribe fn', () => {
    const hook = getHook();
    const onUpdate = jest.fn();
    const unsubscribe = hook.subscribeToActive(onUpdate);

    expect(mockChannel).toHaveBeenCalledWith('visitor_logs_active');
    expect(mockOn).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });

  it('calls removeChannel when unsubscribe is invoked', () => {
    const hook = getHook();
    const unsubscribe = hook.subscribeToActive(jest.fn());
    unsubscribe();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
