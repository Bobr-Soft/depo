import * as Network from 'expo-network';
import { TaskComplete } from '@/constants/types';
import { buildApiUrl, getApiUrl, getToken } from './secureStorage';
import { API_TIMEOUT, RETRY_CONFIG } from '@/constants/config';
import * as db from './database';
import { markItemAsPicked } from './database';
import { logout, reauthenticateSilently } from './auth';

let isSyncing = false;
let activeSyncPromise: Promise<{ success: boolean; tasks?: TaskComplete[]; error?: string }> | null = null;

class ApiSyncError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiSyncError';
    this.statusCode = statusCode;
  }
}

function isNonRetryableStatus(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

type InboundItemUpsertPayload = {
  barcode: string;
  quantityIncrement: number;
  name?: string;
  description?: string | null;
  category_id?: number | null;
  location_id?: number | null;
};

type TaskCreateQueuePayload = {
  name: string;
  type: 'picking' | 'inbound' | 'transfer';
  priority: number;
  source_id?: string | null;
  deadline?: string | null;
  assigned_user?: number | null;
  items?: Array<{
    item_id: number;
    requested_quantity: number;
  }>;
};

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

  console.log(`Fetching tasks from: ${buildApiUrl(apiUrl, '/tasks')}`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`Request timeout after ${API_TIMEOUT}ms to ${buildApiUrl(apiUrl, '/tasks')} (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`);
        controller.abort();
      }, API_TIMEOUT);

      const response = await fetch(buildApiUrl(apiUrl, '/tasks'), {
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

async function fetchTaskByIdFromApi(taskId: number): Promise<TaskComplete | null> {
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

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(
          `Request timeout after ${API_TIMEOUT}ms to ${buildApiUrl(apiUrl, `/tasks/${taskId}`)} (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`
        );
        controller.abort();
      }, API_TIMEOUT);

      const response = await fetch(buildApiUrl(apiUrl, `/tasks/${taskId}`), {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return null;
      }

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
                continue;
              }
            }
          }

          await logout();
          await db.clearDatabase();
          throw new Error('Unauthorized. Please log in again.');
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const task = await response.json();
      return task as TaskComplete;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      const isRetryable = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Network') ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNREFUSED')
      );

      if (isRetryable && attempt < RETRY_CONFIG.maxAttempts) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
        continue;
      }

      if (lastError.name === 'AbortError') {
        throw new Error(`Request timeout after ${API_TIMEOUT}ms. Backend at ${apiUrl} took too long to respond.`);
      }
      throw lastError;
    }
  }

  throw lastError || new Error(`Failed to fetch task ${taskId} after retries`);
}

function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

async function upsertInboundItem(
  token: string,
  apiUrl: string,
  payload: InboundItemUpsertPayload
): Promise<void> {
  const barcode = payload.barcode?.trim();
  if (!barcode) {
    throw new Error('Missing barcode for inbound item upsert');
  }

  const quantityIncrement = Math.max(1, Math.floor(payload.quantityIncrement || 1));

  const listResponse = await fetch(buildApiUrl(apiUrl, '/items'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text().catch(() => 'Unknown error');
    throw new ApiSyncError(
      listResponse.status,
      `Failed to fetch items for inbound sync: ${listResponse.status} - ${errorText}`
    );
  }

  const existingItems = await listResponse.json();
  const existingItem = Array.isArray(existingItems)
    ? existingItems.find((item: any) => normalizeBarcode(item?.barcode ?? '') === normalizeBarcode(barcode))
    : null;

  if (existingItem) {
    const updatedQuantity = Math.max(0, Number(existingItem.quantity || 0)) + quantityIncrement;
    const updateResponse = await fetch(buildApiUrl(apiUrl, `/items/${existingItem.id}`), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: existingItem.name ?? payload.name ?? `Termék ${barcode}`,
        barcode: existingItem.barcode ?? barcode,
        description: existingItem.description ?? payload.description ?? null,
        quantity: updatedQuantity,
        category_id: existingItem.category_id ?? payload.category_id ?? null,
        location_id: existingItem.location_id ?? payload.location_id ?? null,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text().catch(() => 'Unknown error');
      throw new ApiSyncError(
        updateResponse.status,
        `Failed to update item ${existingItem.id}: ${updateResponse.status} - ${errorText}`
      );
    }

    return;
  }

  const createResponse = await fetch(buildApiUrl(apiUrl, '/items'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name ?? `Beolvasott termék ${barcode}`,
      barcode,
      description: payload.description ?? null,
      quantity: quantityIncrement,
      category_id: payload.category_id ?? null,
      location_id: payload.location_id ?? null,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => 'Unknown error');
    throw new ApiSyncError(
      createResponse.status,
      `Failed to create item for barcode ${barcode}: ${createResponse.status} - ${errorText}`
    );
  }
}

/**
 * Push pending sync queue operations to API
 */
async function pushSyncQueue(token: string, apiUrl: string): Promise<void> {
  const queue = await db.getSyncQueue();
  if (queue.length === 0) {
    return;
  }

  console.log(`Processing ${queue.length} pending sync operations...`);

  for (const operation of queue) {
    try {
      const payload = JSON.parse(operation.payload);

      if (operation.entity_type === 'task' && operation.operation === 'CREATE') {
        const response = await fetch(buildApiUrl(apiUrl, '/tasks'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload as TaskCreateQueuePayload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new ApiSyncError(response.status, `API error: ${response.status} - ${errorText}`);
        }

        console.log(`✅ Synced task create operation ${operation.id}`);
        await db.removeSyncOperation(operation.id);
      } else if (operation.entity_type === 'task_item' && operation.operation === 'UPDATE') {
        const { picked_quantity } = payload;
        const taskItemId = operation.entity_id;

        const taskItemDetails = await db.getTaskItemDetails(taskItemId);

        if (!taskItemDetails) {
          console.warn(`Task item ${taskItemId} not found, removing from queue`);
          await db.removeSyncOperation(operation.id);
          continue;
        }

        const { task_id, item_id } = taskItemDetails;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
          const response = await fetch(
            buildApiUrl(apiUrl, `/tasks/${task_id}/items/${item_id}/picked`),
            {
              method: 'PUT',
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pickedQuantity: picked_quantity }),
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            if (response.status === 401 || response.status === 403) {
              console.error(`Auth error: ${response.status} - ${errorText}`);
              throw new ApiSyncError(response.status, 'Unauthorized');
            }
            throw new ApiSyncError(response.status, `API error: ${response.status} - ${errorText}`);
          }

          console.log(`✅ Synced task_item ${taskItemId} to server`);
          await db.removeSyncOperation(operation.id);
        } catch (apiError) {
          clearTimeout(timeoutId);
          if (apiError instanceof ApiSyncError && isNonRetryableStatus(apiError.statusCode)) {
            console.warn(
              `Skipping non-retryable task_item operation ${operation.id}: ${apiError.message}`
            );
            await db.removeSyncOperation(operation.id);
            continue;
          }

          console.warn(
            `⚠️  Failed to push operation ${operation.id} (attempt ${operation.retry_count + 1}):`,
            apiError instanceof Error ? apiError.message : 'Unknown error'
          );
          await db.incrementSyncRetry(operation.id);
        }
      } else if (operation.entity_type === 'item' && operation.operation === 'UPSERT') {
        try {
          await upsertInboundItem(token, apiUrl, payload as InboundItemUpsertPayload);
          console.log(`✅ Synced inbound item operation ${operation.id}`);
          await db.removeSyncOperation(operation.id);
        } catch (apiError) {
          if (apiError instanceof ApiSyncError && isNonRetryableStatus(apiError.statusCode)) {
            console.warn(
              `Skipping non-retryable inbound operation ${operation.id}: ${apiError.message}`
            );
            await db.removeSyncOperation(operation.id);
            continue;
          }

          console.warn(
            `⚠️  Failed to sync inbound item operation ${operation.id} (attempt ${operation.retry_count + 1}):`,
            apiError instanceof Error ? apiError.message : 'Unknown error'
          );
          await db.incrementSyncRetry(operation.id);
        }
      } else {
        console.warn(`Unsupported sync operation: ${operation.entity_type} ${operation.operation}`);
        await db.removeSyncOperation(operation.id);
      }
    } catch (parseError) {
      console.error(`Failed to parse sync operation ${operation.id}:`, parseError);
      await db.removeSyncOperation(operation.id);
    }
  }
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
  if (activeSyncPromise) {
    console.log('Sync already in progress, joining active sync...');
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    // Lock immediately to prevent race between concurrent callers.
    isSyncing = true;

    try {
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

      console.log('Starting sync...');

      const [apiUrl, token] = await Promise.all([getApiUrl(), getToken()]);
      if (!token || !apiUrl) {
        throw new Error('Missing API URL or token for sync');
      }

      await pushSyncQueue(token, apiUrl);

      const tasks = await pullRemoteData();

      console.log('Sync completed successfully');
      return { success: true, tasks };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Sync failed:', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      isSyncing = false;
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
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

export async function refreshTaskById(taskId: number): Promise<{
  success: boolean;
  task?: TaskComplete;
  error?: string;
}> {
  if (!db.isDatabaseInitialized()) {
    return { success: false, error: 'Database not initialized' };
  }

  const cachedTask = await db.getTaskById(taskId);
  const online = await isOnline();

  if (!online) {
    return {
      success: false,
      task: cachedTask ?? undefined,
      error: 'Device is offline. Showing cached data.',
    };
  }

  if (isSyncing) {
    return {
      success: false,
      task: cachedTask ?? undefined,
      error: 'Sync already in progress. Showing cached data.',
    };
  }

  isSyncing = true;
  try {
    const [apiUrl, token] = await Promise.all([getApiUrl(), getToken()]);
    if (!apiUrl || !token) {
      throw new Error('Missing API URL or token for refresh');
    }

    await pushSyncQueue(token, apiUrl);

    const task = await fetchTaskByIdFromApi(taskId);
    if (!task) {
      return {
        success: false,
        task: cachedTask ?? undefined,
        error: 'Task not found on server',
      };
    }

    await db.saveTasks([task]);
    await db.setLastSyncTime(Date.now());

    return { success: true, task };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      task: cachedTask ?? undefined,
      error: errorMessage,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Start automatic sync (single initial sync)
 */
export function startAutoSync(): void {
  console.log('Starting auto-sync...');

  syncData().catch((error) => {
    console.error('Initial sync failed:', error);
  });
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
  const queue = await db.getSyncQueue();

  return {
    isSyncing,
    isOnline: online,
    lastSyncTime: lastSync,
    pendingOperations: queue.length,
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

/** Mark a task item as picked and sync with server
 */

export async function taskItemPicked(taskId: number, itemId: number, pickedQuantity: number): Promise<void> {
  try {
    await markItemAsPicked(taskId, itemId, pickedQuantity);
    // Optionally trigger a sync after marking as picked
    await syncData();
  } catch (error) {
    console.error('Failed to mark item as picked:', error);
    throw error;
  }
}
