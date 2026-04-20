const db = require('./db');
const { sortItemsBySerpentineRoute } = require('./wms');

const taskSchemaCache = {
  userIsActiveSelectExpr: null,
};

async function tableHasColumn(tableName, columnName) {
  try {
    const [rows] = await db.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND LOWER(COLUMN_NAME) = LOWER(?)
       LIMIT 1`,
      [tableName, columnName]
    );

    return rows.length > 0;
  } catch (_error) {
    return false;
  }
}

async function getUserIsActiveSelectExpr() {
  if (taskSchemaCache.userIsActiveSelectExpr) {
    return taskSchemaCache.userIsActiveSelectExpr;
  }

  const [hasSnakeCaseColumn, hasCamelCaseColumn] = await Promise.all([
    tableHasColumn('users', 'is_active'),
    tableHasColumn('users', 'isActive'),
  ]);

  if (hasSnakeCaseColumn) {
    taskSchemaCache.userIsActiveSelectExpr = 'u.is_active';
  } else if (hasCamelCaseColumn) {
    taskSchemaCache.userIsActiveSelectExpr = 'u.isActive';
  } else {
    taskSchemaCache.userIsActiveSelectExpr = '1';
  }

  return taskSchemaCache.userIsActiveSelectExpr;
}

async function getTaskSelectQuery() {
  const userIsActiveSelectExpr = await getUserIsActiveSelectExpr();

  const locationJoinClause = 'LEFT JOIN locations l ON l.id = i.location_id';

  return `
  SELECT
    t.id AS task_id,
    t.name AS task_name,
    t.type AS task_type,
    t.source_id AS task_source_id,
    t.assigned_user AS task_assigned_user,
    t.status AS task_status,
    t.priority AS task_priority,
    t.deadline AS task_deadline,
    t.updated_at AS task_updated_at,
    t.created_at AS task_created_at,
    u.id AS user_id,
    u.email AS user_email,
    u.role AS user_role,
    ${userIsActiveSelectExpr} AS user_is_active,
    u.last_login AS user_last_login,
    ti.id AS task_item_id,
    ti.task_id AS task_item_task_id,
    ti.requested_quantity,
    ti.picked_quantity,
    ti.status AS task_item_status,
    i.id AS item_id,
    i.name AS item_name,
    i.barcode,
    i.description,
    i.quantity AS item_quantity,
    c.id AS category_id,
    c.name AS category_name,
    c.size_class AS category_size_class,
    c.min_stock_level AS category_min_stock_level,
    l.id AS location_id,
    l.row_num AS location_row_num,
    l.col_num AS location_col_num,
    l.shelf_level AS location_shelf_level,
    l.is_xl AS location_is_xl,
    l.location_code AS location_code,
    l.is_active AS location_is_active
  FROM tasks t
  LEFT JOIN task_items ti ON ti.task_id = t.id
  LEFT JOIN items i ON ti.item_id = i.id
  LEFT JOIN categories c ON i.category_id = c.id
  ${locationJoinClause}
  LEFT JOIN users u ON u.id = t.assigned_user
`;
}

function buildTaskAccessParams(userEmail, userId, userRole) {
  const normalizedEmail = typeof userEmail === 'string' ? userEmail.trim() : '';
  const normalizedRole = typeof userRole === 'string' ? userRole.trim().toLowerCase() : '';
  const resolvedUserId = Number.isInteger(Number(userId)) ? Number(userId) : null;

  return [normalizedRole, resolvedUserId, resolvedUserId, normalizedEmail];
}

function buildTaskObject(row) {
  return {
    id: row.task_id,
    name: row.task_name,
    type: row.task_type,
    source_id: row.task_source_id,
    assigned_user: row.task_assigned_user,
    status: row.task_status,
    priority: row.task_priority,
    deadline: row.task_deadline,
    updated_at: row.task_updated_at,
    created_at: row.task_created_at,
    assigned_user_data:
      row.user_id && row.user_email && row.user_role && row.user_is_active !== null
        ? {
            id: row.user_id,
            email: row.user_email,
            role: row.user_role,
            is_active: row.user_is_active,
            last_login: row.user_last_login,
          }
        : null,
    items: [],
  };
}

function buildTaskItem(row) {
  return {
    id: row.task_item_id,
    task_id: row.task_item_task_id,
    requested_quantity: row.requested_quantity,
    picked_quantity: row.picked_quantity,
    status: row.task_item_status,
    item: {
      id: row.item_id,
      name: row.item_name,
      barcode: row.barcode,
      description: row.description,
      quantity: row.item_quantity,
      category:
        row.category_id && row.category_name && row.category_size_class
          ? {
              id: row.category_id,
              name: row.category_name,
              size_class: row.category_size_class,
              min_stock_level: row.category_min_stock_level,
            }
          : null,
      location:
        row.location_id && row.location_row_num !== null && row.location_col_num !== null
          ? {
              id: row.location_id,
              row_num: row.location_row_num,
              col_num: row.location_col_num,
              shelf_level: row.location_shelf_level ?? 0,
              is_xl: row.location_is_xl ?? false,
              location_code: row.location_code ?? '',
              is_active: row.location_is_active ?? false,
            }
          : null,
    },
  };
}

function hydrateTasks(rows) {
  const tasksMap = new Map();

  rows.forEach((row) => {
    if (!tasksMap.has(row.task_id)) {
      tasksMap.set(row.task_id, buildTaskObject(row));
    }

    const task = tasksMap.get(row.task_id);
    if (!task || !row.task_item_id) {
      return;
    }

    task.items.push(buildTaskItem(row));
  });

  return Array.from(tasksMap.values()).map((task) => ({
    ...task,
    items: sortItemsBySerpentineRoute(task.items),
  }));
}

async function getTasksForUser(userEmail, userId = null, userRole = null) {
  const accessParams = buildTaskAccessParams(userEmail, userId, userRole);
  const taskSelectQuery = await getTaskSelectQuery();

  const [rows] = await db.query(
    `${taskSelectQuery}
     WHERE (
       ? IN ('admin', 'supervisor')
       OR (? IS NOT NULL AND t.assigned_user = ?)
       OR LOWER(COALESCE(u.email, '')) = LOWER(?)
       OR t.assigned_user IS NULL
     )
     ORDER BY t.id, ti.id`,
    accessParams
  );

  return hydrateTasks(rows);
}

async function getTaskByIdForUser(taskId, userEmail, userId = null, userRole = null) {
  const accessParams = buildTaskAccessParams(userEmail, userId, userRole);
  const taskSelectQuery = await getTaskSelectQuery();

  const [rows] = await db.query(
    `${taskSelectQuery}
     WHERE t.id = ?
       AND (
         ? IN ('admin', 'supervisor')
         OR (? IS NOT NULL AND t.assigned_user = ?)
         OR LOWER(COALESCE(u.email, '')) = LOWER(?)
         OR t.assigned_user IS NULL
       )
     ORDER BY t.id, ti.id`,
    [taskId, ...accessParams]
  );

  if (rows.length === 0) {
    return null;
  }

  const [task] = hydrateTasks(rows);
  return task ?? null;
}

module.exports = { getTaskByIdForUser, getTasksForUser };
