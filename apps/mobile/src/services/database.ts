import * as SQLite from 'expo-sqlite';
import { TaskComplete, TaskItemComplete } from '@/constants/types';

const DB_NAME = 'depo.db';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

const DEAD_LETTER_REASONS = {
  maxRetriesExceeded: 'MAX_RETRIES_EXCEEDED',
  nonRetryableStatus: 'NON_RETRYABLE_STATUS',
  parseError: 'PARSE_ERROR',
  unsupportedOperation: 'UNSUPPORTED_OPERATION',
} as const;

export type DeadLetterReason = (typeof DEAD_LETTER_REASONS)[keyof typeof DEAD_LETTER_REASONS];

function toEpoch(value: Date | string | number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hydrateAssignedUser(taskRow: any) {
  if (
    taskRow.assigned_user == null ||
    !taskRow.assigned_user_email ||
    !taskRow.assigned_user_role ||
    taskRow.assigned_user_is_active == null
  ) {
    return null;
  }

  return {
    id: taskRow.assigned_user,
    email: taskRow.assigned_user_email,
    role: taskRow.assigned_user_role,
    is_active: taskRow.assigned_user_is_active === 1,
    last_login: taskRow.assigned_user_last_login
      ? new Date(taskRow.assigned_user_last_login)
      : null,
  };
}

/**
 * Initialize database and create tables
 */
export async function initDatabase(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized && db) {
    return;
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    try {
      console.log('Initializing database...');
      db = await SQLite.openDatabaseAsync(DB_NAME);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Pending sync operations queue
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        idempotency_key TEXT
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        source_id TEXT,
        assigned_user INTEGER,
        assigned_user_email TEXT,
        assigned_user_role TEXT,
        assigned_user_is_active INTEGER,
        assigned_user_last_login INTEGER,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        deadline INTEGER,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
      );

      -- Dead-letter queue for failed sync operations
      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_sync_operation_id INTEGER,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        payload TEXT NOT NULL,
        failure_reason TEXT NOT NULL,
        failure_details TEXT,
        original_created_at INTEGER NOT NULL,
        moved_to_dead_letter_at INTEGER NOT NULL,
        final_retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (original_sync_operation_id) REFERENCES sync_queue(id) ON DELETE SET NULL
      );

      -- Task items table
      CREATE TABLE IF NOT EXISTS task_items (
        id INTEGER PRIMARY KEY,
        task_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        requested_quantity INTEGER NOT NULL,
        picked_quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        synced INTEGER DEFAULT 1,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- Items table
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        barcode TEXT,
        description TEXT,
        quantity INTEGER NOT NULL,
        category_id INTEGER,
        location_id INTEGER,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        size_class TEXT NOT NULL,
        min_stock_level INTEGER
      );

      -- Locations table
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY,
        row_num INTEGER NOT NULL,
        col_num INTEGER NOT NULL,
        shelf_level INTEGER NOT NULL,
        is_xl INTEGER NOT NULL,
        location_code TEXT NOT NULL,
        is_active INTEGER NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user);
      CREATE INDEX IF NOT EXISTS idx_task_items_task_id ON task_items(task_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_failure_reason ON dead_letter_queue(failure_reason);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_created_at ON dead_letter_queue(moved_to_dead_letter_at);
    `);

      // Ensure additive columns exist in already-created databases.
      await db.runAsync('ALTER TABLE tasks ADD COLUMN assigned_user_email TEXT').catch(() => undefined);
      await db.runAsync('ALTER TABLE tasks ADD COLUMN assigned_user_role TEXT').catch(() => undefined);
      await db.runAsync('ALTER TABLE tasks ADD COLUMN assigned_user_is_active INTEGER').catch(() => undefined);
      await db.runAsync('ALTER TABLE tasks ADD COLUMN assigned_user_last_login INTEGER').catch(() => undefined);
      await db.runAsync('ALTER TABLE sync_queue ADD COLUMN idempotency_key TEXT').catch(() => undefined);

    isInitialized = true;
    console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      db = null;
      isInitialized = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized && db !== null;
}

/**
 * Get database instance
 */
function getDb(): SQLite.SQLiteDatabase {
  if (!db || !isInitialized) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================================
// TASKS OPERATIONS
// ============================================================

function resolveTaskStatusForLocalStore(task: TaskComplete): string {
  const rawStatus = String(task.status || '').trim().toLowerCase();

  if (rawStatus === 'cancelled') {
    return 'cancelled';
  }

  const normalizedStatus = rawStatus === 'done' || rawStatus === 'delivered'
    ? 'completed'
    : rawStatus;

  if (!Array.isArray(task.items) || task.items.length === 0) {
    return normalizedStatus || 'pending';
  }

  const allItemsPicked = task.items.every(
    (item) => item.status === 'picked' || item.picked_quantity >= item.requested_quantity
  );

  if (allItemsPicked) {
    return 'completed';
  }

  const hasAnyProgress = task.items.some((item) => item.picked_quantity > 0);
  if (hasAnyProgress && normalizedStatus === 'pending') {
    return 'in_progress';
  }

  return normalizedStatus || 'pending';
}

/**
 * Save tasks to local database
 */
export async function saveTasks(tasks: TaskComplete[]): Promise<void> {
  const database = getDb();

  try {
    await database.withTransactionAsync(async () => {
      for (const task of tasks) {
        const taskStatus = resolveTaskStatusForLocalStore(task);

        // Insert or replace task
        await database.runAsync(
          `INSERT OR REPLACE INTO tasks
           (id, name, type, source_id, assigned_user, assigned_user_email, assigned_user_role, assigned_user_is_active, assigned_user_last_login, status, priority, deadline, updated_at, created_at, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            task.id,
            task.name,
            task.type,
            task.source_id,
            task.assigned_user,
            task.assigned_user_data?.email ?? null,
            task.assigned_user_data?.role ?? null,
            task.assigned_user_data == null ? null : task.assigned_user_data.is_active ? 1 : 0,
            toEpoch(task.assigned_user_data?.last_login),
            taskStatus,
            task.priority,
            toEpoch(task.deadline),
            toEpoch(task.updated_at),
            toEpoch(task.created_at),
          ]
        );

        // Save task items
        for (const taskItem of task.items) {
          await database.runAsync(
            `INSERT OR REPLACE INTO task_items
             (id, task_id, item_id, requested_quantity, picked_quantity, status, synced)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
              taskItem.id,
              taskItem.task_id,
              taskItem.item.id,
              taskItem.requested_quantity,
              taskItem.picked_quantity,
              taskItem.status,
            ]
          );

          // Save item details
          await database.runAsync(
            `INSERT OR REPLACE INTO items
             (id, name, barcode, description, quantity, category_id, location_id, updated_at, created_at, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              taskItem.item.id,
              taskItem.item.name,
              taskItem.item.barcode,
              taskItem.item.description,
              taskItem.item.quantity,
              taskItem.item.category?.id ?? null,
              taskItem.item.location?.id ?? null,
              Date.now(),
              Date.now(),
            ]
          );

          // Save category if exists
          if (taskItem.item.category) {
            await database.runAsync(
              `INSERT OR REPLACE INTO categories
               (id, name, size_class, min_stock_level)
               VALUES (?, ?, ?, ?)`,
              [
                taskItem.item.category.id,
                taskItem.item.category.name,
                taskItem.item.category.size_class,
                taskItem.item.category.min_stock_level,
              ]
            );
          }

          // Save location if exists
          if (taskItem.item.location) {
            await database.runAsync(
              `INSERT OR REPLACE INTO locations
               (id, row_num, col_num, shelf_level, is_xl, location_code, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                taskItem.item.location.id,
                taskItem.item.location.row_num,
                taskItem.item.location.col_num,
                taskItem.item.location.shelf_level,
                taskItem.item.location.is_xl ? 1 : 0,
                taskItem.item.location.location_code,
                taskItem.item.location.is_active ? 1 : 0,
              ]
            );
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to save tasks:', error);
    throw error;
  }
}

/**
 * Get all tasks from local database
 */
export async function getTasks(): Promise<TaskComplete[]> {
  const database = getDb();

  try {
    const tasks = await database.getAllAsync<any>(
      'SELECT * FROM tasks ORDER BY priority ASC, created_at DESC'
    );

    const tasksComplete: TaskComplete[] = [];

    for (const task of tasks) {
      const taskItems = await database.getAllAsync<any>(
        `SELECT
           ti.id AS ti_id, ti.task_id, ti.requested_quantity, ti.picked_quantity, ti.status, ti.item_id,
           i.id AS i_id, i.name AS i_name, i.barcode, i.description, i.quantity, i.category_id, i.location_id,
           c.id AS c_id, c.name AS c_name, c.size_class, c.min_stock_level,
           l.id AS l_id, l.row_num, l.col_num, l.shelf_level, l.is_xl, l.location_code, l.is_active
         FROM task_items ti
         LEFT JOIN items i ON ti.item_id = i.id
         LEFT JOIN categories c ON i.category_id = c.id
         LEFT JOIN locations l ON i.location_id = l.id
         WHERE ti.task_id = ?`,
        [task.id]
      );

      const items: TaskItemComplete[] = taskItems.map((ti) => ({
        id: ti.ti_id,
        task_id: ti.task_id,
        requested_quantity: ti.requested_quantity,
        picked_quantity: ti.picked_quantity,
        status: ti.status,
        item: {
          id: ti.i_id,
          name: ti.i_name,
          barcode: ti.barcode,
          description: ti.description,
          quantity: ti.quantity,
          category: ti.c_id ? {
            id: ti.c_id,
            name: ti.c_name,
            size_class: ti.size_class,
            min_stock_level: ti.min_stock_level,
          } : null,
          location: ti.l_id ? {
            id: ti.l_id,
            row_num: ti.row_num,
            col_num: ti.col_num,
            shelf_level: ti.shelf_level,
            is_xl: ti.is_xl === 1,
            location_code: ti.location_code,
            is_active: ti.is_active === 1,
          } : null,
        },
      }));

      tasksComplete.push({
        id: task.id,
        name: task.name,
        type: task.type,
        source_id: task.source_id,
        assigned_user: task.assigned_user,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline ? new Date(task.deadline) : null,
        updated_at: new Date(task.updated_at),
        created_at: new Date(task.created_at),
        assigned_user_data: hydrateAssignedUser(task),
        items,
      });
    }

    return tasksComplete;
  } catch (error) {
    console.error('Failed to get tasks:', error);
    return [];
  }
}

/**
 * Get single task by ID
 */
export async function getTaskById(id: number): Promise<TaskComplete | null> {
  const database = getDb();

  try {
    const task = await database.getFirstAsync<any>(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );

    if (!task) {
      return null;
    }

    const taskItems = await database.getAllAsync<any>(
      `SELECT
         ti.id AS ti_id, ti.task_id, ti.requested_quantity, ti.picked_quantity, ti.status, ti.item_id,
         i.id AS i_id, i.name AS i_name, i.barcode, i.description, i.quantity, i.category_id, i.location_id,
         c.id AS c_id, c.name AS c_name, c.size_class, c.min_stock_level,
         l.id AS l_id, l.row_num, l.col_num, l.shelf_level, l.is_xl, l.location_code, l.is_active
       FROM task_items ti
       LEFT JOIN items i ON ti.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN locations l ON i.location_id = l.id
       WHERE ti.task_id = ?`,
      [task.id]
    );

    const items: TaskItemComplete[] = taskItems.map((ti) => ({
      id: ti.ti_id,
      task_id: ti.task_id,
      requested_quantity: ti.requested_quantity,
      picked_quantity: ti.picked_quantity,
      status: ti.status,
      item: {
        id: ti.i_id,
        name: ti.i_name,
        barcode: ti.barcode,
        description: ti.description,
        quantity: ti.quantity,
        category: ti.c_id ? {
          id: ti.c_id,
          name: ti.c_name,
          size_class: ti.size_class,
          min_stock_level: ti.min_stock_level,
        } : null,
        location: ti.l_id ? {
          id: ti.l_id,
          row_num: ti.row_num,
          col_num: ti.col_num,
          shelf_level: ti.shelf_level,
          is_xl: ti.is_xl === 1,
          location_code: ti.location_code,
          is_active: ti.is_active === 1,
        } : null,
      },
    }));

    return {
      id: task.id,
      name: task.name,
      type: task.type,
      source_id: task.source_id,
      assigned_user: task.assigned_user,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline) : null,
      updated_at: new Date(task.updated_at),
      created_at: new Date(task.created_at),
      assigned_user_data: hydrateAssignedUser(task),
      items,
    };
  } catch (error) {
    console.error('Failed to get task by ID:', error);
    return null;
  }
}

/**
 * Update task status locally.
 * Task-level status mutations do not have a direct API sync path yet,
 * so unsupported `task` queue entries must not be created here.
 */
export async function updateTaskStatus(
  taskId: number,
  status: string
): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      'UPDATE tasks SET status = ?, synced = 1, updated_at = ? WHERE id = ?',
      [status, Date.now(), taskId]
    );
  } catch (error) {
    console.error('Failed to update task status:', error);
    throw error;
  }
}

async function recomputeAndPersistTaskStatus(
  database: SQLite.SQLiteDatabase,
  taskId: number,
  updatedAt: number
): Promise<string> {
  const taskProgress = await database.getFirstAsync<any>(
    `SELECT COUNT(*) AS total_items,
            SUM(CASE WHEN status = 'picked' THEN 1 ELSE 0 END) AS picked_items
     FROM task_items
     WHERE task_id = ?`,
    [taskId]
  );

  const totalItems = taskProgress?.total_items ?? 0;
  const pickedItems = taskProgress?.picked_items ?? 0;
  const nextTaskStatus = totalItems > 0 && pickedItems === totalItems ? 'completed' : 'in_progress';

  await database.runAsync(
    'UPDATE tasks SET status = ?, synced = 0, updated_at = ? WHERE id = ?',
    [nextTaskStatus, updatedAt, taskId]
  );

  return nextTaskStatus;
}

/**
 * Update task item picked quantity locally and queue for sync
 */
export async function updateTaskItemQuantity(
  taskItemId: number,
  pickedQuantity: number
): Promise<void> {
  const database = getDb();

  try {
    await database.withTransactionAsync(async () => {
      const taskItem = await database.getFirstAsync<any>(
        `SELECT id, task_id, requested_quantity
         FROM task_items
         WHERE id = ?
         LIMIT 1`,
        [taskItemId]
      );

      if (!taskItem) {
        throw new Error(`Task item not found for taskItemId=${taskItemId}`);
      }

      const itemStatus = pickedQuantity >= taskItem.requested_quantity ? 'picked' : 'pending';
      const now = Date.now();

      await database.runAsync(
        'UPDATE task_items SET picked_quantity = ?, status = ?, synced = 0 WHERE id = ?',
        [pickedQuantity, itemStatus, taskItemId]
      );

      await database.runAsync(
        `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'UPDATE',
          'task_item',
          taskItemId,
          JSON.stringify({ picked_quantity: pickedQuantity, status: itemStatus }),
          now,
        ]
      );

      await recomputeAndPersistTaskStatus(database, taskItem.task_id, now);
    });
  } catch (error) {
    console.error('Failed to update task item quantity:', error);
    throw error;
  }
}

// ============================================================
// SYNC QUEUE OPERATIONS
// ============================================================

/**
 * Get all pending sync operations
 */
export async function getSyncQueue(): Promise<any[]> {
  const database = getDb();

  try {
    return await database.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
}

/**
 * Remove sync operation from queue
 */
export async function removeSyncOperation(id: number): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to remove sync operation:', error);
  }
}

/**
 * Increment retry count for sync operation
 */
export async function incrementSyncRetry(id: number): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
  } catch (error) {
    console.error('Failed to increment sync retry:', error);
  }
}

/**
 * Move a failed sync operation to dead-letter queue and remove from active queue.
 */
export async function moveSyncOperationToDeadLetter(
  id: number,
  reason: DeadLetterReason,
  details?: Record<string, unknown>
): Promise<void> {
  const database = getDb();

  try {
    await database.withTransactionAsync(async () => {
      const operation = await database.getFirstAsync<any>(
        'SELECT * FROM sync_queue WHERE id = ?',
        [id]
      );

      if (!operation) {
        return;
      }

      await database.runAsync(
        `INSERT INTO dead_letter_queue
         (original_sync_operation_id, operation, entity_type, entity_id, payload, failure_reason, failure_details, original_created_at, moved_to_dead_letter_at, final_retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operation.id,
          operation.operation,
          operation.entity_type,
          operation.entity_id,
          operation.payload,
          reason,
          JSON.stringify(details ?? {}),
          operation.created_at,
          Date.now(),
          operation.retry_count ?? 0,
        ]
      );

      await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
    });
  } catch (error) {
    console.error('Failed to move sync operation to dead-letter queue:', error);
    throw error;
  }
}

export async function getDeadLetterCount(): Promise<number> {
  const database = getDb();

  try {
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM dead_letter_queue'
    );
    return result?.count ?? 0;
  } catch (error) {
    console.error('Failed to get dead-letter count:', error);
    return 0;
  }
}

export { DEAD_LETTER_REASONS };

/**
 * Add a sync operation to the queue
 */
export async function enqueueSyncOperation(
  operation: string,
  entityType: string,
  entityId: number | null,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [operation, entityType, entityId, JSON.stringify(payload), Date.now(), idempotencyKey ?? null]
    );
  } catch (error) {
    console.error('Failed to enqueue sync operation:', error);
    throw error;
  }
}

/**
 * Find a local item by barcode
 */
export async function getItemByBarcode(barcode: string): Promise<any | null> {
  const database = getDb();

  try {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) {
      return null;
    }

    const result = await database.getFirstAsync<any>(
      'SELECT * FROM items WHERE barcode = ? LIMIT 1',
      [normalizedBarcode]
    );
    return result || null;
  } catch (error) {
    console.error('Failed to get item by barcode:', error);
    return null;
  }
}

/**
 * Save or update a single item in local cache
 */
export async function saveItemToLocal(item: {
  id: number;
  name: string;
  barcode?: string | null;
  description?: string | null;
  quantity: number;
  category_id?: number | null;
  location_id?: number | null;
}): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      `INSERT OR REPLACE INTO items
       (id, name, barcode, description, quantity, category_id, location_id, updated_at, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.id,
        item.name,
        item.barcode ?? null,
        item.description ?? null,
        item.quantity,
        item.category_id ?? null,
        item.location_id ?? null,
        Date.now(),
        Date.now(),
      ]
    );
  } catch (error) {
    console.error('Failed to save item to local database:', error);
    throw error;
  }
}

/**
 * Clear all synced data (for logout)
 */
export async function clearDatabase(): Promise<void> {
  if (!db || !isInitialized) {
    console.warn('Database not initialized, nothing to clear');
    return;
  }

  try {
    await db.execAsync(`
      DELETE FROM sync_queue;
      DELETE FROM task_items;
      DELETE FROM tasks;
      DELETE FROM items;
      DELETE FROM categories;
      DELETE FROM locations;
      DELETE FROM sync_metadata;
    `);
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Failed to clear database:', error);
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<number | null> {
  if (!isDatabaseInitialized()) {
    return null;
  }

  const database = getDb();

  try {
    const result = await database.getFirstAsync<any>(
      "SELECT value FROM sync_metadata WHERE key = 'last_sync'"
    );
    return result ? parseInt(result.value, 10) : null;
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

/**
 * Update last sync timestamp
 */
export async function setLastSyncTime(timestamp: number): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
       VALUES ('last_sync', ?, ?)`,
      [timestamp.toString(), Date.now()]
    );
  } catch (error) {
    console.error('Failed to set last sync time:', error);
  }
}

// ============================================================
// INBOUND DRAFT PERSISTENCE
// ============================================================

/**
 * Save inbound draft items to persistent storage (sync_metadata key-value).
 * Survives app kills/restarts.
 */
export async function saveInboundDraft(items: unknown[]): Promise<void> {
  const database = getDb();

  try {
    const payload = JSON.stringify(items);
    await database.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
       VALUES ('inbound_draft', ?, ?)`,
      [payload, Date.now()]
    );
  } catch (error) {
    console.error('Failed to save inbound draft:', error);
  }
}

/**
 * Load persisted inbound draft items. Returns empty array if nothing saved.
 */
export async function loadInboundDraft(): Promise<unknown[]> {
  const database = getDb();

  try {
    const result = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = 'inbound_draft'"
    );
    if (!result?.value) return [];
    const parsed = JSON.parse(result.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load inbound draft:', error);
    return [];
  }
}

/**
 * Clear persisted inbound draft.
 */
export async function clearInboundDraft(): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync("DELETE FROM sync_metadata WHERE key = 'inbound_draft'");
  } catch (error) {
    console.error('Failed to clear inbound draft:', error);
  }
}

// ============================================================
// DEAD-LETTER QUEUE DETAILS
// ============================================================

/**
 * Get dead-letter queue entries with details for diagnostics UI.
 */
export async function getDeadLetterEntries(): Promise<Array<{
  id: number;
  operation: string;
  entity_type: string;
  failure_reason: string;
  failure_details: string;
  moved_to_dead_letter_at: number;
  final_retry_count: number;
}>> {
  const database = getDb();

  try {
    return await database.getAllAsync(
      'SELECT id, operation, entity_type, failure_reason, failure_details, moved_to_dead_letter_at, final_retry_count FROM dead_letter_queue ORDER BY moved_to_dead_letter_at DESC LIMIT 50'
    );
  } catch (error) {
    console.error('Failed to get dead-letter entries:', error);
    return [];
  }
}

/**
 * Clear all dead-letter entries (after user acknowledges).
 */
export async function clearDeadLetterQueue(): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync('DELETE FROM dead_letter_queue');
  } catch (error) {
    console.error('Failed to clear dead-letter queue:', error);
  }
}

/**
 * Get task_id and item_id for a given task_item id (for sync operations)
 */
export async function getTaskItemDetails(taskItemId: number): Promise<{ task_id: number; item_id: number } | null> {
  const database = getDb();

  try {
    const result = await database.getFirstAsync<any>(
      'SELECT task_id, item_id FROM task_items WHERE id = ?',
      [taskItemId]
    );
    return result || null;
  } catch (error) {
    console.error('Failed to get task item details:', error);
    return null;
  }
}

/**
 * Mark task item as picked and queue for sync
 */
export async function markItemAsPicked(
  taskId: number,
  itemId: number,
  pickedQuantity: number
): Promise<void> {
  const database = getDb();

  if (!Number.isFinite(pickedQuantity) || pickedQuantity < 0) {
    throw new Error('Invalid picked quantity.');
  }

  const safePickedQuantity = Math.floor(pickedQuantity);

  try {
    await database.withTransactionAsync(async () => {
      const taskItem = await database.getFirstAsync<any>(
        `SELECT id, requested_quantity
         FROM task_items
         WHERE task_id = ? AND item_id = ?
         LIMIT 1`,
        [taskId, itemId]
      );

      if (!taskItem) {
        throw new Error(`Task item not found for taskId=${taskId}, itemId=${itemId}`);
      }

      const itemStatus = safePickedQuantity >= taskItem.requested_quantity ? 'picked' : 'pending';
      const now = Date.now();

      await database.runAsync(
        `UPDATE task_items
         SET picked_quantity = ?, status = ?, synced = 0
         WHERE id = ?`,
        [safePickedQuantity, itemStatus, taskItem.id]
      );

      await database.runAsync(
        `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'UPDATE',
          'task_item',
          taskItem.id,
          JSON.stringify({ picked_quantity: safePickedQuantity, status: itemStatus }),
          now,
        ]
      );

      await recomputeAndPersistTaskStatus(database, taskId, now);
    });
  } catch (error) {
    console.error('Failed to mark item as picked:', error);
    throw error;
  }
}
