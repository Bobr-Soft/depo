import { useState, useEffect } from 'react';
import * as Network from 'expo-network';
import { getSyncStatus, syncData } from '@/services/sync';

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
    const syncStatus = await getSyncStatus();
    setStatus(syncStatus);
  };

  useEffect(() => {
    updateStatus();

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

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Just came back online, trigger sync
      console.log('Network reconnected, triggering sync...');
      syncData().catch((error) => {
        console.error('Auto-sync on reconnection failed:', error);
      });
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  return { isOnline, isSyncing: false };
}
