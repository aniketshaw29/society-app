// ---------------------------------------------------------------------------
// Unit tests: mobile/src/services/conflictResolver.ts
// ---------------------------------------------------------------------------

import {
  resolveStatusConflict,
  resolveExitTime,
} from './conflictResolver';
import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeLocal = (overrides: Partial<LocalVisitor> = {}): LocalVisitor => ({
  id: 'server-id-1',
  localId: 'local-id-1',
  societyId: 'society-1',
  flatId: 'flat-1',
  visitorName: 'Alice',
  visitorPhone: null,
  purpose: 'guest',
  vehicleNumber: null,
  status: 'pending',
  photoLocalPath: null,
  photoUrl: null,
  entryTime: '2026-07-31T05:00:00.000Z',
  exitTime: null,
  syncStatus: 'pending',
  syncError: null,
  createdAt: '2026-07-31T05:00:00.000Z',
  updatedAt: '2026-07-31T05:00:00.000Z',
  ...overrides,
});

const makeServer = (overrides: Partial<VisitorLog> = {}): VisitorLog => ({
  id: 'server-id-1',
  societyId: 'society-1',
  flatId: 'flat-1',
  guardId: null,
  visitorName: 'Alice',
  visitorPhone: null,
  visitorPhotoUrl: null,
  vehicleNumber: null,
  purpose: 'guest',
  entryMethod: 'manual',
  status: 'pending',
  approvedBy: null,
  approvedAt: null,
  entryTime: '2026-07-31T05:00:00.000Z',
  exitTime: null,
  createdAt: '2026-07-31T05:00:00.000Z',
  updatedAt: '2026-07-31T05:00:00.000Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// resolveStatusConflict
// ---------------------------------------------------------------------------

describe('resolveStatusConflict', () => {
  it('uses server status when server.updatedAt is newer', () => {
    const local = makeLocal({ status: 'pending', updatedAt: '2026-07-31T05:00:00.000Z' });
    const server = makeServer({ status: 'approved', updatedAt: '2026-07-31T05:05:00.000Z' });

    const result = resolveStatusConflict(local, server);

    expect(result.resolvedStatus).toBe('approved');
    expect(result.hadConflict).toBe(true);
  });

  it('uses local status when local.updatedAt is newer', () => {
    const local = makeLocal({ status: 'entered', updatedAt: '2026-07-31T05:10:00.000Z' });
    const server = makeServer({ status: 'approved', updatedAt: '2026-07-31T05:05:00.000Z' });

    const result = resolveStatusConflict(local, server);

    expect(result.resolvedStatus).toBe('entered');
    expect(result.hadConflict).toBe(false);
  });

  it('uses local status when timestamps are equal (local wins on tie)', () => {
    const ts = '2026-07-31T05:00:00.000Z';
    const local = makeLocal({ status: 'entered', updatedAt: ts });
    const server = makeServer({ status: 'approved', updatedAt: ts });

    const result = resolveStatusConflict(local, server);

    expect(result.resolvedStatus).toBe('entered');
    expect(result.hadConflict).toBe(false);
  });

  it('reports no conflict when values are equal regardless of timestamps', () => {
    const local = makeLocal({ status: 'approved', updatedAt: '2026-07-31T05:00:00.000Z' });
    const server = makeServer({ status: 'approved', updatedAt: '2026-07-31T05:05:00.000Z' });

    const result = resolveStatusConflict(local, server);

    expect(result.resolvedStatus).toBe('approved');
    expect(result.hadConflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveExitTime
// ---------------------------------------------------------------------------

describe('resolveExitTime', () => {
  const EXIT = '2026-07-31T07:00:00.000Z';
  const EXIT2 = '2026-07-31T08:00:00.000Z';

  it('keeps server exit_time when server has it and local does not', () => {
    const local = makeLocal({ exitTime: null });
    const server = makeServer({ exitTime: EXIT });

    const result = resolveExitTime(local, server);

    expect(result.resolvedExitTime).toBe(EXIT);
    expect(result.hadConflict).toBe(false);
  });

  it('keeps local exit_time when local has it and server does not', () => {
    const local = makeLocal({ exitTime: EXIT });
    const server = makeServer({ exitTime: null });

    const result = resolveExitTime(local, server);

    expect(result.resolvedExitTime).toBe(EXIT);
    expect(result.hadConflict).toBe(false);
  });

  it('uses server exit_time when both have different values (server wins)', () => {
    const local = makeLocal({ exitTime: EXIT });
    const server = makeServer({ exitTime: EXIT2 });

    const result = resolveExitTime(local, server);

    expect(result.resolvedExitTime).toBe(EXIT2);
    expect(result.hadConflict).toBe(true);
  });

  it('reports no conflict when both have the same exit_time', () => {
    const local = makeLocal({ exitTime: EXIT });
    const server = makeServer({ exitTime: EXIT });

    const result = resolveExitTime(local, server);

    expect(result.resolvedExitTime).toBe(EXIT);
    expect(result.hadConflict).toBe(false);
  });

  it('returns null when neither side has exit_time', () => {
    const local = makeLocal({ exitTime: null });
    const server = makeServer({ exitTime: null });

    const result = resolveExitTime(local, server);

    expect(result.resolvedExitTime).toBeNull();
    expect(result.hadConflict).toBe(false);
  });
});
