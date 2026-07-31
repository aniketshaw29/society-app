// ---------------------------------------------------------------------------
// Network connectivity monitor
// ---------------------------------------------------------------------------
// Wraps @react-native-community/netinfo to track online/offline transitions.
// ---------------------------------------------------------------------------

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Subscribes to network state changes.
 *
 * Calls `onConnect` when the device transitions from offline → online.
 * Calls `onDisconnect` when the device transitions from online → offline.
 *
 * Returns a cleanup function that unsubscribes the listener.
 */
export function startNetworkMonitor(
  onConnect: () => void,
  onDisconnect: () => void
): () => void {
  let previouslyConnected: boolean | null = null;

  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isConnected = state.isConnected === true && state.isInternetReachable !== false;

    if (previouslyConnected === null) {
      // First event — capture initial state but don't fire callbacks
      previouslyConnected = isConnected;
      return;
    }

    if (!previouslyConnected && isConnected) {
      previouslyConnected = true;
      onConnect();
    } else if (previouslyConnected && !isConnected) {
      previouslyConnected = false;
      onDisconnect();
    }
  });

  return unsubscribe;
}

/**
 * Returns the current connectivity state.
 * Considers the device online only when both isConnected and
 * isInternetReachable are true (or reachability is unknown).
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}
