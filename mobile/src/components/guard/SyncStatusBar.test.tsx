// ---------------------------------------------------------------------------
// Unit tests: mobile/src/components/guard/SyncStatusBar.tsx
// ---------------------------------------------------------------------------

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SyncStatusBar } from './SyncStatusBar';

// ---------------------------------------------------------------------------
// Mock useSyncStatus
// ---------------------------------------------------------------------------

const mockUseSyncStatus = jest.fn();

jest.mock('@/hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockUseSyncStatus(),
}));

// ---------------------------------------------------------------------------
// Default sync state helper
// ---------------------------------------------------------------------------

const defaultState = {
  isOnline: true,
  pendingCount: 0,
  abandonedCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  triggerSync: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncStatusBar', () => {
  beforeEach(() => {
    mockUseSyncStatus.mockReturnValue({ ...defaultState });
  });

  it('shows "Synced" when online and no pending entries', () => {
    mockUseSyncStatus.mockReturnValue({ ...defaultState, isOnline: true, pendingCount: 0 });
    render(<SyncStatusBar />);
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('shows "Offline" message when isOnline is false', () => {
    mockUseSyncStatus.mockReturnValue({
      ...defaultState,
      isOnline: false,
      pendingCount: 3,
    });
    render(<SyncStatusBar />);
    // Label includes "Offline" and entry count
    expect(screen.getByText(/Offline/)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
  });

  it('shows pending count when online and pendingCount > 0', () => {
    mockUseSyncStatus.mockReturnValue({
      ...defaultState,
      isOnline: true,
      pendingCount: 5,
    });
    render(<SyncStatusBar />);
    expect(screen.getByText(/Syncing/)).toBeTruthy();
    expect(screen.getByText(/5/)).toBeTruthy();
  });

  it('shows abandoned warning when abandonedCount > 0', () => {
    mockUseSyncStatus.mockReturnValue({
      ...defaultState,
      isOnline: true,
      pendingCount: 0,
      abandonedCount: 2,
    });
    render(<SyncStatusBar />);
    expect(screen.getByText(/failed to sync/i)).toBeTruthy();
  });

  it('shows Retry button when abandonedCount > 0', () => {
    mockUseSyncStatus.mockReturnValue({
      ...defaultState,
      isOnline: true,
      abandonedCount: 1,
    });
    render(<SyncStatusBar />);
    expect(screen.getByTestId('sync-retry-btn')).toBeTruthy();
  });

  it('does not show Retry button when abandonedCount is 0', () => {
    mockUseSyncStatus.mockReturnValue({
      ...defaultState,
      isOnline: true,
      abandonedCount: 0,
    });
    render(<SyncStatusBar />);
    expect(screen.queryByTestId('sync-retry-btn')).toBeNull();
  });
});
