import * as Network from 'expo-network';
import { TaskComplete } from '@/constants/types';
import { getApiUrl, getToken } from './secureStorage';
import { API_TIMEOUT, RETRY_CONFIG } from '@/constants/config';
import * as db from './database';
import { logout, reauthenticateSilently } from './auth';

let isSyncing = false;

function isJwtToken(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Calculate delay with exponential backoff
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected ?? false;
  } catch (error) {
    console.error('Failed to check network status:', error);
    return false;
  }
}

/**
 * Fetch tasks from API with retry logic
 */
async function fetchTasksFromApi(): Promise<TaskComplete[]> {
  const [apiUrl, storedToken] = await Promise.all([getApiUrl(), getToken()]);
  let token = storedToken;
  let hasReauthenticated = false;

  if (!token || !apiUrl) {
    throw new Error('Missing API URL or token');
  }

  if (!isJwtToken(token)) {
    const reauthResult = await reauthenticateSilently();
    if (!reauthResult.success) {
      await logout();
      await db.clearDatabase();
      throw new Error(reauthResult.error ?? 'Invalid token. Please log in again.');
    }

    token = reauthResult.token ?? await getToken();
    hasReauthenticated = true;

    if (!token || !isJwtToken(token)) {
      await logout();
      await db.clearDatabase();
      throw new Error('Failed to renew token. Please log in again.');
    }
  }

  console.log(`Fetching tasks from: ${apiUrl}/tasks`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`Request timeout after ${API_TIMEOUT}ms to ${apiUrl}/tasks (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`);
        controller.abort();
      }, API_TIMEOUT);

      const response = await fetch(`${apiUrl}/tasks`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (response.status === 401 || response.status === 403) {
          if (!hasReauthenticated) {
            const reauthResult = await reauthenticateSilently();
            if (reauthResult.success) {
              const refreshedToken = reauthResult.token ?? await getToken();
              if (refreshedToken && isJwtToken(refreshedToken)) {
                token = refreshedToken;
                hasReauthenticated = true;
                console.log('Retrying /tasks request after silent re-authentication...');
                continue;
              }
            }
          }

          await logout();
          await db.clearDatabase();
          throw new Error('Unauthorized. Please log in again.');
        }
        // Don't retry on 4xx errors (except timeout)
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.length || 0} tasks`);
      return data;
    } catch (error) {
      clearTimeout(0);
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Check if error is retryable
      const isRetryable = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Network') ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNREFUSED')
      );

      if (isRetryable && attempt < RETRY_CONFIG.maxAttempts) {
        const delay = getBackoffDelay(attempt);
        console.warn(`Attempt ${attempt} failed (${lastError.message}), retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }

      // Last attempt or non-retryable error
      if (lastError.name === 'AbortError') {
        throw new Error(`Request timeout after ${API_TIMEOUT}ms. Backend at ${apiUrl} took too long to respond.`);
      }
      throw lastError;
    }
  }

  throw lastError || new Error('Failed to fetch tasks after retries');
}

/**
 * Pull latest data from API and update local database
 */
async function pullRemoteData(): Promise<TaskComplete[]> {
  try {
    const tasks = await fetchTasksFromApi();
    await db.saveTasks(tasks);
    await db.setLastSyncTime(Date.now());
    return tasks;
  } catch (error) {
    console.error('Failed to pull remote data:', error);
    throw error;
  }
}

/**
 * Perform full sync: pull remote data and update cache
 */
export async function syncData(): Promise<{
  success: boolean;
  tasks?: TaskComplete[];
  error?: string;
}> {
  if (isSyncing) {
    console.log('Sync already in progress, skipping...');
    return { success: false, error: 'Sync already in progress' };
  }

  // Check if database is initialized
  if (!db.isDatabaseInitialized()) {
    console.warn('Database not initialized, sync skipped');
    return { success: false, error: 'Database not initialized' };
  }

  const online = await isOnline();
  if (!online) {
    console.log('Device is offline, sync skipped');
    return { success: false, error: 'Device is offline' };
  }

  isSyncing = true;

  try {
    console.log('Starting sync...');

    const tasks = await pullRemoteData();

    console.log('Sync completed successfully');
    return { success: true, tasks };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync failed:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    isSyncing = false;
  }
}

/**
 * Get tasks with automatic sync
 * Returns local data immediately, syncs in background if online
 */
export async function getTasksWithSync(): Promise<{
  tasks: TaskComplete[];
  fromCache: boolean;
  syncError?: string;
}> {
  // Ensure database is initialized
  if (!db.isDatabaseInitialized()) {
    console.warn('Database not initialized, returning empty tasks');
    return { tasks: [], fromCache: false, syncError: 'Database not initialized' };
  }

  // Always get local data first for instant response
  const localTasks = await db.getTasks();

  // Try to sync in background if online
  const online = await isOnline();
  if (online && !isSyncing) {
    syncData().catch((error) => {
      console.error('Background sync failed:', error);
    });
  }

  return {
    tasks: localTasks,
    fromCache: true,
  };
}

/**
 * Force refresh from server
 */
export async function forceRefresh(): Promise<{
  success: boolean;
  tasks?: TaskComplete[];
  error?: string;
}> {
  const online = await isOnline();

  if (!online) {
    return {
      success: false,
      error: 'Device is offline. Showing cached data.',
    };
  }

  return await syncData();
}

/**
 * Start automatic sync (single initial sync)
 */
export function startAutoSync(): void {
  console.log('Starting auto-sync...');

  setTimeout(() => {
    syncData().catch((error) => {
      console.error('Initial sync failed:', error);
    });
  }, 1000);
}

/**
 * Stop automatic sync (no-op for single sync)
 */
export function stopAutoSync(): void {
  console.log('Auto-sync stopped');
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}> {
  const online = await isOnline();

  if (!db.isDatabaseInitialized()) {
    return {
      isSyncing,
      isOnline: online,
      lastSyncTime: null,
      pendingOperations: 0,
    };
  }

  const lastSync = await db.getLastSyncTime();

  return {
    isSyncing,
    isOnline: online,
    lastSyncTime: lastSync,
    pendingOperations: 0,
  };
}

/**
 * Initialize sync service
 */
export async function initializeSyncService(): Promise<void> {
  try {
    await db.initDatabase();
    startAutoSync();
    console.log('Sync service initialized');
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
    throw error;
  }
}

/**
 * Cleanup sync service (call on logout)
 */
export async function cleanupSyncService(): Promise<void> {
  stopAutoSync();
  await db.clearDatabase();
  console.log('Sync service cleaned up');
}
