import * as SQLite from 'expo-sqlite';
import { TaskComplete, TaskItemComplete } from '@/constants/types';

const DB_NAME = 'depo.db';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

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
        retry_count INTEGER DEFAULT 0
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        source_id TEXT,
        assigned_user INTEGER,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        deadline INTEGER,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
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
    `);

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
           (id, name, type, source_id, assigned_user, status, priority, deadline, updated_at, created_at, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            task.id,
            task.name,
            task.type,
            task.source_id,
            task.assigned_user,
            taskStatus,
            task.priority,
            task.deadline ? new Date(task.deadline).getTime() : null,
            new Date(task.updated_at).getTime(),
            new Date(task.created_at).getTime(),
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
        assigned_user_data: null, // TODO: Add user data if needed
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
      assigned_user_data: null,
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
 * Add a sync operation to the queue
 */
export async function enqueueSyncOperation(
  operation: string,
  entityType: string,
  entityId: number | null,
  payload: Record<string, unknown>
): Promise<void> {
  const database = getDb();

  try {
    await database.runAsync(
      `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [operation, entityType, entityId, JSON.stringify(payload), Date.now()]
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
