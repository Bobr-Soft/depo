import { useState, useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { getSyncStatus, syncData } from '@/services/sync';
import { isDatabaseInitialized } from '@/services/database';

export interface SyncStatus {
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}

/**
 * Hook to monitor network and sync status
 */
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    isOnline: false,
    lastSyncTime: null,
    pendingOperations: 0,
  });

  const updateStatus = async () => {
    try {
      const syncStatus = await getSyncStatus();
      setStatus(syncStatus);
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  };

  useEffect(() => {
    updateStatus().catch((error) => {
      console.error('Initial sync status update failed:', error);
    });

    // Update status every 10 seconds
    const interval = setInterval(updateStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Hook to listen for network status changes
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsOnline(networkState.isConnected ?? false);
        }
      } catch (error) {
        console.error('Failed to check network status:', error);
        if (mounted) {
          setIsOnline(false);
        }
      }
    };

    checkConnection();

    // Check every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to trigger sync on network reconnection
 */
export function useAutoSync() {
  const isOnline = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const lastTriggerAtRef = useRef(0);

  const RECONNECT_SYNC_COOLDOWN_MS = 10000;

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      const now = Date.now();
      const onCooldown = now - lastTriggerAtRef.current < RECONNECT_SYNC_COOLDOWN_MS;
      if (onCooldown) {
        setWasOffline(false);
        return;
      }

      if (!isDatabaseInitialized()) {
        setWasOffline(false);
        return;
      }

      getSyncStatus()
        .then((status) => {
          if (status.isSyncing) {
            return;
          }

          console.log('Network reconnected, triggering sync...');
          lastTriggerAtRef.current = Date.now();
          return syncData();
        })
        .catch((error) => {
          console.error('Auto-sync on reconnection failed:', error);
        });

      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  return { isOnline, isSyncing: false };
}
