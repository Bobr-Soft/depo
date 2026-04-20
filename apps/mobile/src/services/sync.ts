import * as Network from 'expo-network';
import { TaskComplete } from '@/constants/types';
import { buildApiUrl, getApiUrl, getToken } from './secureStorage';
import { API_TIMEOUT, RETRY_CONFIG } from '@/constants/config';
import * as db from './database';
import { markItemAsPicked } from './database';
import { logout, reauthenticateSilently } from './auth';
import { logDiagnostic } from './diagnostics';

let isSyncing = false;
let activeSyncPromise: Promise<{ success: boolean; tasks?: TaskComplete[]; error?: string }> | null = null;
const MAX_SYNC_RETRY_COUNT = 5;
let isSyncServiceInitialized = false;
let lastSyncFailureReason: string | null = null;

type SyncTriggerSource = 'startup' | 'manual' | 'reconnect' | 'background' | 'task-item-picked' | 'task-refresh';

function createOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifySyncError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown';
  }

  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return 'timeout';
  }

  if (
    error.message.includes('Network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return 'network';
  }

  if (error.message.includes('Unauthorized') || error.message.includes('token')) {
    return 'auth';
  }

  if (error.message.includes('offline')) {
    return 'offline';
  }

  return 'unknown';
}

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
  quantityIncrement?: number;
  quantity?: number;
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
  items?: {
    item_id: number;
    requested_quantity: number;
  }[];
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
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

          await logout('auth_recovery_failed');
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
        logDiagnostic('sync.fetch.retry', {
          attempt,
          maxAttempts: RETRY_CONFIG.maxAttempts,
          retryDelayMs: Math.round(delay),
          error: lastError.message,
        }, 'warn');
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
  const explicitQuantity = payload.quantity != null ? Math.max(0, Math.floor(payload.quantity)) : null;

  const listResponse = await fetchWithTimeout(buildApiUrl(apiUrl, '/items'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).catch((error) => {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out fetching items for inbound sync after ${API_TIMEOUT}ms`);
    }
    throw error;
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
    const updatedQuantity = explicitQuantity ?? (Math.max(0, Number(existingItem.quantity || 0)) + quantityIncrement);
    const updateResponse = await fetchWithTimeout(buildApiUrl(apiUrl, `/items/${existingItem.id}`), {
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
    }).catch((error) => {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timed out updating item ${existingItem.id} after ${API_TIMEOUT}ms`);
      }
      throw error;
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

  const createResponse = await fetchWithTimeout(buildApiUrl(apiUrl, '/items'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name ?? `Beolvasott termék ${barcode}`,
      barcode,
      description: payload.description ?? null,
      quantity: explicitQuantity ?? quantityIncrement,
      category_id: payload.category_id ?? null,
      location_id: payload.location_id ?? null,
    }),
  }).catch((error) => {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out creating item for barcode ${barcode} after ${API_TIMEOUT}ms`);
    }
    throw error;
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

  // Track idempotency keys processed in this push cycle to skip duplicates
  const processedKeys = new Set<string>();

  for (const operation of queue) {
    try {
      // Skip if we've already processed this idempotency key in this cycle
      const idempotencyKey = (operation as any).idempotency_key;
      if (idempotencyKey && processedKeys.has(idempotencyKey)) {
        console.log(`Skipping duplicate idempotency key: ${idempotencyKey}`);
        await db.removeSyncOperation(operation.id);
        continue;
      }

      const payload = JSON.parse(operation.payload);
      const nextAttempt = (operation.retry_count ?? 0) + 1;

      if (operation.entity_type === 'task' && operation.operation === 'CREATE') {
        try {
          const response = await fetchWithTimeout(buildApiUrl(apiUrl, '/tasks'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload as TaskCreateQueuePayload),
          }).catch((error) => {
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error(`Timed out creating task from sync queue after ${API_TIMEOUT}ms`);
            }
            throw error;
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new ApiSyncError(response.status, `API error: ${response.status} - ${errorText}`);
          }

          console.log(`✅ Synced task create operation ${operation.id}`);
          if (idempotencyKey) processedKeys.add(idempotencyKey);
          await db.removeSyncOperation(operation.id);
        } catch (apiError) {
          if (apiError instanceof ApiSyncError && isNonRetryableStatus(apiError.statusCode)) {
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.nonRetryableStatus, {
              statusCode: apiError.statusCode,
              message: apiError.message,
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'non_retryable_status',
              statusCode: apiError.statusCode,
            }, 'warn');
            continue;
          }

          if (nextAttempt >= MAX_SYNC_RETRY_COUNT) {
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.maxRetriesExceeded, {
              message: apiError instanceof Error ? apiError.message : 'Unknown error',
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'max_retries_exceeded',
            }, 'warn');
            continue;
          }

          await db.incrementSyncRetry(operation.id);
        }
      } else if (operation.entity_type === 'task_item' && operation.operation === 'UPDATE') {
        const { picked_quantity } = payload;
        const taskItemId = operation.entity_id;

        const taskItemDetails = await db.getTaskItemDetails(taskItemId);

        if (!taskItemDetails) {
          console.warn(`Task item ${taskItemId} not found, removing from queue`);
          await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.unsupportedOperation, {
            reason: 'TASK_ITEM_NOT_FOUND',
            taskItemId,
          });
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
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.nonRetryableStatus, {
              statusCode: apiError.statusCode,
              message: apiError.message,
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'non_retryable_status',
              statusCode: apiError.statusCode,
            }, 'warn');
            continue;
          }

          if (nextAttempt >= MAX_SYNC_RETRY_COUNT) {
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.maxRetriesExceeded, {
              message: apiError instanceof Error ? apiError.message : 'Unknown error',
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'max_retries_exceeded',
            }, 'warn');
            continue;
          }

          console.warn(
            `⚠️  Failed to push operation ${operation.id} (attempt ${nextAttempt}):`,
            apiError instanceof Error ? apiError.message : 'Unknown error'
          );
          await db.incrementSyncRetry(operation.id);
        }
      } else if (operation.entity_type === 'item' && operation.operation === 'UPSERT') {
        try {
          await upsertInboundItem(token, apiUrl, payload as InboundItemUpsertPayload);
          console.log(`✅ Synced inbound item operation ${operation.id}`);
          if (idempotencyKey) processedKeys.add(idempotencyKey);
          await db.removeSyncOperation(operation.id);
        } catch (apiError) {
          if (apiError instanceof ApiSyncError && isNonRetryableStatus(apiError.statusCode)) {
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.nonRetryableStatus, {
              statusCode: apiError.statusCode,
              message: apiError.message,
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'non_retryable_status',
              statusCode: apiError.statusCode,
            }, 'warn');
            continue;
          }

          if (nextAttempt >= MAX_SYNC_RETRY_COUNT) {
            await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.maxRetriesExceeded, {
              message: apiError instanceof Error ? apiError.message : 'Unknown error',
              attempt: nextAttempt,
            });
            logDiagnostic('sync.queue.deadletter', {
              opId: operation.id,
              entityType: operation.entity_type,
              operation: operation.operation,
              reason: 'max_retries_exceeded',
            }, 'warn');
            continue;
          }

          console.warn(
            `⚠️  Failed to sync inbound item operation ${operation.id} (attempt ${nextAttempt}):`,
            apiError instanceof Error ? apiError.message : 'Unknown error'
          );
          await db.incrementSyncRetry(operation.id);
        }
      } else {
        console.warn(`Unsupported sync operation: ${operation.entity_type} ${operation.operation}`);
        await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.unsupportedOperation, {
          operation: operation.operation,
          entityType: operation.entity_type,
        });
      }
    } catch (parseError) {
      console.error(`Failed to parse sync operation ${operation.id}:`, parseError);
      await db.moveSyncOperationToDeadLetter(operation.id, db.DEAD_LETTER_REASONS.parseError, {
        message: parseError instanceof Error ? parseError.message : String(parseError),
      });
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
}>;
export async function syncData(options: {
  trigger: SyncTriggerSource;
  context?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  tasks?: TaskComplete[];
  error?: string;
}>;
export async function syncData(options?: {
  trigger: SyncTriggerSource;
  context?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  tasks?: TaskComplete[];
  error?: string;
}> {
  const opId = createOperationId();
  const trigger = options?.trigger ?? 'background';

  if (activeSyncPromise) {
    console.log('Sync already in progress, joining active sync...');
    logDiagnostic('sync.join_existing', { opId, trigger });
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const startedAt = Date.now();

    // Lock immediately to prevent race between concurrent callers.
    isSyncing = true;
    lastSyncFailureReason = null;
    logDiagnostic('sync.started', {
      opId,
      trigger,
      ...options?.context,
    });

    try {
      // Check if database is initialized
      if (!db.isDatabaseInitialized()) {
        console.warn('Database not initialized, sync skipped');
        lastSyncFailureReason = 'db_not_initialized';
        logDiagnostic('sync.skipped', { opId, trigger, reason: lastSyncFailureReason }, 'warn');
        return { success: false, error: 'Database not initialized' };
      }

      const online = await isOnline();
      if (!online) {
        console.log('Device is offline, sync skipped');
        lastSyncFailureReason = 'offline';
        logDiagnostic('sync.skipped', { opId, trigger, reason: lastSyncFailureReason }, 'warn');
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
      logDiagnostic('sync.success', {
        opId,
        trigger,
        durationMs: Date.now() - startedAt,
        taskCount: tasks.length,
      });
      return { success: true, tasks };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      lastSyncFailureReason = classifySyncError(error);
      console.error('Sync failed:', errorMessage);
      logDiagnostic('sync.failed', {
        opId,
        trigger,
        durationMs: Date.now() - startedAt,
        reason: lastSyncFailureReason,
        error: errorMessage,
      }, 'error');
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
    syncData({ trigger: 'background' }).catch((error) => {
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

  return await syncData({ trigger: 'manual' });
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

  try {
    if (activeSyncPromise) {
      await activeSyncPromise;
    } else {
      await syncData({ trigger: 'task-refresh', context: { taskId } });
    }

    let task = await db.getTaskById(taskId);
    if (!task) {
      task = await fetchTaskByIdFromApi(taskId);
      if (task) {
        await db.saveTasks([task]);
      }
    }

    if (!task) {
      return {
        success: false,
        task: cachedTask ?? undefined,
        error: 'Task not found on server',
      };
    }

    return { success: true, task };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      task: cachedTask ?? undefined,
      error: errorMessage,
    };
  }
}

/**
 * Start automatic sync (single initial sync)
 */
export function startAutoSync(): void {
  console.log('Starting auto-sync...');

  syncData({ trigger: 'startup' }).catch((error) => {
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
  deadLetterOperations: number;
  lastFailureReason: string | null;
}> {
  const online = await isOnline();

  if (!db.isDatabaseInitialized()) {
    return {
      isSyncing,
      isOnline: online,
      lastSyncTime: null,
      pendingOperations: 0,
      deadLetterOperations: 0,
      lastFailureReason: lastSyncFailureReason,
    };
  }

  const lastSync = await db.getLastSyncTime();
  const queue = await db.getSyncQueue();
  const deadLetterOperations = await db.getDeadLetterCount();

  return {
    isSyncing,
    isOnline: online,
    lastSyncTime: lastSync,
    pendingOperations: queue.length,
    deadLetterOperations,
    lastFailureReason: lastSyncFailureReason,
  };
}

/**
 * Initialize sync service
 */
export async function initializeSyncService(): Promise<void> {
  if (isSyncServiceInitialized) {
    return;
  }

  try {
    await db.initDatabase();
    // Mark initialized before first auto-sync trigger to avoid init-order races.
    isSyncServiceInitialized = true;
    startAutoSync();
    console.log('Sync service initialized');
    logDiagnostic('sync.service.initialized');
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
    logDiagnostic('sync.service.init_failed', {
      reason: classifySyncError(error),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'error');
    throw error;
  }
}

/**
 * Cleanup sync service (call on logout)
 */
export async function cleanupSyncService(): Promise<void> {
  stopAutoSync();
  await db.clearDatabase();
  isSyncServiceInitialized = false;
  console.log('Sync service cleaned up');
}

/** Mark a task item as picked and sync with server
 */

export async function taskItemPicked(taskId: number, itemId: number, pickedQuantity: number): Promise<void> {
  try {
    await markItemAsPicked(taskId, itemId, pickedQuantity);
    // Optionally trigger a sync after marking as picked
    await syncData({ trigger: 'task-item-picked', context: { taskId, itemId } });
  } catch (error) {
    console.error('Failed to mark item as picked:', error);
    throw error;
  }
}
