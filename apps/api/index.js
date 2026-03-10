const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { getTasksForUser } = require('./tasks');
require('dotenv').config();

const app = express();
// Use CORS_ORIGINS env var (comma-separated). Fallback to open CORS for dev.
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : null;

app.use(
  cors(
    corsOrigins
      ? { origin: corsOrigins, credentials: true }
      : { origin: true, credentials: true }
  )
);
app.use(express.json());

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Test database connection on startup
async function testDBConnection() {
  try {
    await db.query('SELECT 1');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database connection test
let dbConnected = false;
testDBConnection().then(result => {
  dbConnected = result;
});

// Input validation helpers
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidString(str, maxLength = 255) {
  return typeof str === 'string' && str.trim().length > 0 && str.length <= maxLength;
}

const itemsSchemaCache = {
  value: null,
};

async function tableHasColumn(tableName, columnName) {
  try {
    const [rows] = await db.query(
      `SHOW COLUMNS FROM \`${tableName}\` LIKE ?`,
      [columnName]
    );
    return rows.length > 0;
  } catch (error) {
    return false;
  }
}

async function getItemsSchemaCapabilities() {
  if (itemsSchemaCache.value) {
    return itemsSchemaCache.value;
  }

  const [
    hasItemCategoryId,
    hasItemLocationId,
    hasCategoryName,
    hasCategoryDescription,
    hasLocationName,
    hasLocationCode,
    hasLocationDescription,
  ] = await Promise.all([
    tableHasColumn('items', 'category_id'),
    tableHasColumn('items', 'location_id'),
    tableHasColumn('categories', 'name'),
    tableHasColumn('categories', 'description'),
    tableHasColumn('locations', 'name'),
    tableHasColumn('locations', 'location_code'),
    tableHasColumn('locations', 'description'),
  ]);

  itemsSchemaCache.value = {
    hasItemCategoryId,
    hasItemLocationId,
    hasCategoryName,
    hasCategoryDescription,
    hasLocationName,
    hasLocationCode,
    hasLocationDescription,
  };

  return itemsSchemaCache.value;
}

function getCategoryLabelExpr(capabilities) {
  if (capabilities.hasCategoryName) {
    return 'categories.name AS category';
  }
  if (capabilities.hasCategoryDescription) {
    return 'categories.description AS category';
  }
  return 'NULL AS category';
}

function getLocationLabelExpr(capabilities) {
  if (capabilities.hasLocationName) {
    return 'locations.name AS location';
  }
  if (capabilities.hasLocationCode) {
    return 'locations.location_code AS location';
  }
  if (capabilities.hasLocationDescription) {
    return 'locations.description AS location';
  }
  return 'NULL AS location';
}

async function fetchItemsWithLabels(whereClause = '', params = []) {
  const capabilities = await getItemsSchemaCapabilities();

  const categoryIdExpr = capabilities.hasItemCategoryId
    ? 'items.category_id'
    : 'NULL AS category_id';
  const locationIdExpr = capabilities.hasItemLocationId
    ? 'items.location_id'
    : 'NULL AS location_id';

  const joins = [];
  if (capabilities.hasItemCategoryId) {
    joins.push('LEFT JOIN categories ON items.category_id = categories.id');
  }
  if (capabilities.hasItemLocationId) {
    joins.push('LEFT JOIN locations ON items.location_id = locations.id');
  }

  const query = `
    SELECT
      items.id,
      items.name,
      items.barcode,
      items.description,
      items.quantity,
      ${categoryIdExpr},
      ${locationIdExpr},
      ${getCategoryLabelExpr(capabilities)},
      ${getLocationLabelExpr(capabilities)}
    FROM items
    ${joins.join('\n')}
    ${whereClause}
  `;

  const [rows] = await db.query(query, params);
  return rows;
}

// Auth middleware - strict database validation with fallback
async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (dbConnected) {
      try {
        // Strict database validation - user must exist (case-insensitive)
        const [rows] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [decoded.email]);
        if (rows.length === 0) {
          return res.status(403).json({ message: 'Access denied: User not found' });
        }
        req.user = { ...decoded, dbUser: rows[0] };
      } catch (dbErr) {
        console.error('❌ Database error during auth:', dbErr.message);
        req.user = decoded;
      }
    } else {
      req.user = decoded;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('❌ Token verification failed:', err.message);
    res.status(403).json({ message: 'Invalid token' });
  }
}

// Role-based access control middleware
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userRole = req.user.role?.toLowerCase();
  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges required' });
  }

  next();
}

// Login endpoint with Entra ID and database validation
app.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    if (dbConnected) {
      // Debug: log incoming email
      console.log('🔍 /login called with email:', email);

      // Check if user exists in database (case-insensitive comparison)
      const [rows] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      // Debug: log rows length and first row if present
      console.log('🔎 users rows found:', rows.length, rows[0] ? rows[0].email : null);

      if (rows.length === 0) {
        return res.status(403).json({ message: 'Access denied: User not authorized' });
      }

      // Debug: log raw role from database
      console.log('🔍 Raw role from DB:', rows[0].role, 'Type:', typeof rows[0].role);
      console.log('🔍 Is Buffer?', Buffer.isBuffer(rows[0].role));
      console.log('🔍 Full user row:', JSON.stringify(rows[0]));
      console.log('🔍 All keys:', Object.keys(rows[0]));

      // Handle both string and Buffer (MySQL enum can sometimes be returned as Buffer)
      let rawRole = '';
      if (rows[0].role) {
        if (Buffer.isBuffer(rows[0].role)) {
          rawRole = rows[0].role.toString('utf8').trim().toLowerCase();
        } else {
          rawRole = rows[0].role.toString().trim().toLowerCase();
        }
      }

      const role = rawRole ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1) : 'Teacher';

      console.log('✅ Raw role (lowercase):', rawRole);
      console.log('✅ Capitalized role:', role);

      const responseData = { token: '', user: { email, id: rows[0].id, role } };
      const token = jwt.sign({ email, userId: rows[0].id, role }, JWT_SECRET, { expiresIn: '1h' });
      responseData.token = token;

      console.log('📤 Sending response:', JSON.stringify(responseData));
      res.json(responseData);
    } else {
      return res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Database error during login:', err.message);
    return res.status(500).json({ message: 'Login failed. Please try again later.' });
  }
});

// Test auth endpoint
app.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: req.user });
});

// Items endpoints with database and fallback
app.get('/items', authenticateJWT, async (req, res) => {
  try {
    if (dbConnected) {
      const rows = await fetchItemsWithLabels();
      res.json(rows);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Database error getting items:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});


app.post('/items', authenticateJWT, requireAdmin, async (req, res) => {
  const { name, barcode, description, quantity, category_id, location_id } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid item name' });
  }

  try {
    if (dbConnected) {
      const capabilities = await getItemsSchemaCapabilities();

      let result;
      if (capabilities.hasItemCategoryId && capabilities.hasItemLocationId) {
        [result] = await db.query(
          'INSERT INTO items (name, barcode, description, quantity, category_id, location_id) VALUES (?, ?, ?, ?, ?, ?)',
          [name, barcode, description, parseInt(quantity), category_id, location_id]
        );
      } else {
        [result] = await db.query(
          'INSERT INTO items (name, barcode, description, quantity) VALUES (?, ?, ?, ?)',
          [name, barcode, description, parseInt(quantity)]
        );
      }

      const rows = await fetchItemsWithLabels('WHERE items.id = ?', [result.insertId]);

      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Database error creating item:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.put('/items/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, barcode, description, quantity, category_id, location_id } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid item name' });
  }

  try {
    const capabilities = await getItemsSchemaCapabilities();

    if (capabilities.hasItemCategoryId && capabilities.hasItemLocationId) {
      await db.query(
        `UPDATE items
         SET name=?, barcode=?, description=?, quantity=?, category_id=?, location_id=?
         WHERE id=?`,
        [name, barcode, description, quantity, category_id, location_id, id]
      );
    } else {
      await db.query(
        `UPDATE items
         SET name=?, barcode=?, description=?, quantity=?
         WHERE id=?`,
        [name, barcode, description, quantity, id]
      );
    }

    const rows = await fetchItemsWithLabels('WHERE items.id = ?', [id]);

    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error updating item:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.delete('/items/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM items WHERE id=?', [id]);
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting item:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

const materialRequestStatusMap = {
  pending: 'pending',
  in_progress: 'picking',
  completed: 'delivered',
};

const normalizeMaterialRequestStatus = (status) => {
  const key = String(status || '').toLowerCase();
  return materialRequestStatusMap[key] || 'pending';
};

const normalizeMaterialRequestPriority = (value) => {
  const raw = String(value || '').toLowerCase().trim();

  if (raw === 'urgent' || raw === 'p1' || raw === '1') {
    return 1;
  }

  return 3;
};

const parseMaterialRequestTaskId = (rawId) => {
  const normalized = String(rawId || '')
    .trim()
    .toUpperCase()
    .replace(/^REQ-/, '');

  const taskId = Number.parseInt(normalized, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return null;
  }

  return taskId;
};

const mapTaskStatusToApiStatus = (status) => normalizeMaterialRequestStatus(status);

const mapTaskPriorityToApiPriority = (priority) => (Number(priority) === 1 ? 'urgent' : 'normal');

const materialRequestUpdateStatusMap = {
  pending: 'pending',
  picking: 'in_progress',
  in_progress: 'in_progress',
  transit: 'in_progress',
  delivered: 'completed',
  completed: 'completed',
};

const normalizeMaterialRequestUpdateStatus = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  return materialRequestUpdateStatusMap[raw] || null;
};

// Create material request task from web picking dashboard
app.post('/material-requests', authenticateJWT, async (req, res) => {
  const { line, priority, items } = req.body;

  if (!isValidString(line, 64)) {
    return res.status(400).json({ message: 'Invalid line value' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one request item is required' });
  }

  const parsedItems = items
    .map((item) => ({
      itemId: Number.parseInt(String(item?.itemId), 10),
      quantity: Number.parseInt(String(item?.quantity), 10),
    }))
    .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);

  if (parsedItems.length !== items.length) {
    return res.status(400).json({ message: 'Invalid item payload' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const itemIds = parsedItems.map((item) => item.itemId);
    const placeholders = itemIds.map(() => '?').join(',');
    const [existingItems] = await connection.query(
      `SELECT id FROM items WHERE id IN (${placeholders})`,
      itemIds
    );

    const existingItemIds = new Set(existingItems.map((item) => item.id));
    const missingItem = parsedItems.find((item) => !existingItemIds.has(item.itemId));
    if (missingItem) {
      await connection.rollback();
      return res.status(404).json({ message: `Item not found: ${missingItem.itemId}` });
    }

    const requestPriority = normalizeMaterialRequestPriority(priority);
    const taskName = `Anyagigénylés - ${line}`;

    const [taskResult] = await connection.query(
      `INSERT INTO tasks (name, type, source_id, assigned_user, status, priority, deadline, created_at, updated_at)
       VALUES (?, 'material_request', ?, NULL, 'pending', ?, NULL, NOW(), NOW())`,
      [taskName, line, requestPriority]
    );

    const taskId = taskResult.insertId;

    for (const item of parsedItems) {
      await connection.query(
        `INSERT INTO task_items (task_id, item_id, requested_quantity, picked_quantity, status)
         VALUES (?, ?, ?, 0, 'pending')`,
        [taskId, item.itemId, item.quantity]
      );
    }

    await connection.commit();

    return res.status(201).json({
      id: taskId,
      line,
      priority: requestPriority,
      status: 'pending',
      totalItems: parsedItems.length,
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error creating material request:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
});

// List material request tasks for a production line (web dashboard live tracking)
app.get('/material-requests', authenticateJWT, async (req, res) => {
  const { line } = req.query;

  if (!isValidString(String(line || ''), 64)) {
    return res.status(400).json({ message: 'line query parameter is required' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        t.id,
        t.source_id AS line,
        t.status,
        t.priority,
        t.created_at,
        COUNT(ti.id) AS total_items
      FROM tasks t
      LEFT JOIN task_items ti ON ti.task_id = t.id
      WHERE t.type = 'material_request' AND t.source_id = ?
      GROUP BY t.id, t.source_id, t.status, t.priority, t.created_at
      ORDER BY t.created_at DESC
      LIMIT 25`,
      [String(line)]
    );

    const payload = rows.map((row) => ({
      id: `REQ-${row.id}`,
      line: row.line,
      status: normalizeMaterialRequestStatus(row.status),
      priority: Number(row.priority) === 1 ? 'urgent' : 'normal',
      totalItems: Number(row.total_items) || 0,
      createdAt: row.created_at,
    }));

    return res.json(payload);
  } catch (err) {
    console.error('❌ Error fetching material requests:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin metrics for material request dashboard header
app.get('/material-requests/metrics', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        SUM(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) AS active_requests,
        SUM(CASE WHEN t.status IN ('pending', 'in_progress') AND t.priority = 1 THEN 1 ELSE 0 END) AS urgent_requests,
        COUNT(*) AS total_requests
      FROM tasks t
      WHERE t.type = 'material_request'`
    );

    const metrics = rows[0] || {};

    return res.json({
      activeRequests: Number(metrics.active_requests) || 0,
      urgentRequests: Number(metrics.urgent_requests) || 0,
      totalRequests: Number(metrics.total_requests) || 0,
    });
  } catch (err) {
    console.error('❌ Error fetching material request metrics:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin list view for all production lines (management mode)
app.get('/material-requests/all', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        t.id,
        t.name,
        t.source_id AS line,
        t.status,
        t.priority,
        t.assigned_user,
        u.email AS assigned_email,
        t.created_at,
        t.updated_at,
        COUNT(ti.id) AS total_items,
        SUM(CASE WHEN ti.status = 'picked' THEN 1 ELSE 0 END) AS picked_items
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_user
      LEFT JOIN task_items ti ON ti.task_id = t.id
      WHERE t.type = 'material_request'
      GROUP BY t.id, t.name, t.source_id, t.status, t.priority, t.assigned_user, u.email, t.created_at, t.updated_at
      ORDER BY t.created_at DESC`
    );

    return res.json(
      rows.map((row) => ({
        id: `REQ-${row.id}`,
        taskId: row.id,
        name: row.name,
        line: row.line,
        status: mapTaskStatusToApiStatus(row.status),
        priority: mapTaskPriorityToApiPriority(row.priority),
        totalItems: Number(row.total_items) || 0,
        pickedItems: Number(row.picked_items) || 0,
        assignedUserId: row.assigned_user,
        assignedUserEmail: row.assigned_email || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  } catch (err) {
    console.error('❌ Error fetching all material requests:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Detailed material request view (items + assignment)
app.get('/material-requests/:requestId', authenticateJWT, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  try {
    const [taskRows] = await db.query(
      `SELECT
        t.id,
        t.name,
        t.source_id AS line,
        t.status,
        t.priority,
        t.assigned_user,
        u.email AS assigned_email,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_user
      WHERE t.id = ? AND t.type = 'material_request'
      LIMIT 1`,
      [taskId]
    );

    if (!taskRows.length) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    const [itemRows] = await db.query(
      `SELECT
        ti.id,
        ti.item_id,
        ti.requested_quantity,
        ti.picked_quantity,
        ti.status,
        i.name,
        i.barcode,
        i.quantity AS stock
      FROM task_items ti
      JOIN items i ON i.id = ti.item_id
      WHERE ti.task_id = ?
      ORDER BY ti.id ASC`,
      [taskId]
    );

    const task = taskRows[0];

    return res.json({
      id: `REQ-${task.id}`,
      taskId: task.id,
      name: task.name,
      line: task.line,
      status: mapTaskStatusToApiStatus(task.status),
      priority: mapTaskPriorityToApiPriority(task.priority),
      assignedUserId: task.assigned_user,
      assignedUserEmail: task.assigned_email || null,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      items: itemRows.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        name: item.name,
        barcode: item.barcode,
        stock: Number(item.stock) || 0,
        requestedQuantity: Number(item.requested_quantity) || 0,
        pickedQuantity: Number(item.picked_quantity) || 0,
        status: item.status,
      })),
    });
  } catch (err) {
    console.error('❌ Error fetching material request details:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin request assignment to mobile picker
app.put('/material-requests/:requestId/assign', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const assignedUserId = req.body?.assignedUserId;
  const normalizedAssignedUserId = assignedUserId === null || assignedUserId === undefined
    ? null
    : Number.parseInt(String(assignedUserId), 10);

  if (normalizedAssignedUserId !== null && (!Number.isInteger(normalizedAssignedUserId) || normalizedAssignedUserId <= 0)) {
    return res.status(400).json({ message: 'Invalid assigned user id' });
  }

  try {
    if (normalizedAssignedUserId !== null) {
      const [userRows] = await db.query('SELECT id, email FROM users WHERE id = ? LIMIT 1', [normalizedAssignedUserId]);
      if (!userRows.length) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
    }

    const [result] = await db.query(
      `UPDATE tasks
       SET assigned_user = ?, updated_at = NOW()
       WHERE id = ? AND type = 'material_request'`,
      [normalizedAssignedUserId, taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    const [rows] = await db.query(
      `SELECT t.id, t.assigned_user, u.email AS assigned_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_user
       WHERE t.id = ?
       LIMIT 1`,
      [taskId]
    );

    const row = rows[0];

    return res.json({
      id: `REQ-${row.id}`,
      assignedUserId: row.assigned_user,
      assignedUserEmail: row.assigned_email || null,
    });
  } catch (err) {
    console.error('❌ Error assigning material request:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin status override
app.put('/material-requests/:requestId/status', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const nextStatus = normalizeMaterialRequestUpdateStatus(req.body?.status);
  if (!nextStatus) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const [result] = await db.query(
      `UPDATE tasks
       SET status = ?, updated_at = NOW()
       WHERE id = ? AND type = 'material_request'`,
      [nextStatus, taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    return res.json({
      id: `REQ-${taskId}`,
      status: mapTaskStatusToApiStatus(nextStatus),
    });
  } catch (err) {
    console.error('❌ Error updating material request status:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin edit request items/priority/line
app.put('/material-requests/:requestId', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const { line, priority, items } = req.body || {};

  if (line !== undefined && !isValidString(String(line), 64)) {
    return res.status(400).json({ message: 'Invalid line value' });
  }

  const parsedItems = items === undefined
    ? null
    : items
        .map((item) => ({
          itemId: Number.parseInt(String(item?.itemId), 10),
          quantity: Number.parseInt(String(item?.quantity), 10),
        }))
        .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);

  if (items !== undefined && (!Array.isArray(items) || items.length === 0 || parsedItems.length !== items.length)) {
    return res.status(400).json({ message: 'Invalid items payload' });
  }

  const nextPriority = priority === undefined ? undefined : normalizeMaterialRequestPriority(priority);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [taskRows] = await connection.query(
      `SELECT id, status, assigned_user
       FROM tasks
       WHERE id = ? AND type = 'material_request'
       LIMIT 1 FOR UPDATE`,
      [taskId]
    );

    if (!taskRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Material request not found' });
    }

    const task = taskRows[0];

    const updateFields = [];
    const updateParams = [];

    if (line !== undefined) {
      updateFields.push('source_id = ?');
      updateParams.push(String(line));
    }

    if (nextPriority !== undefined) {
      updateFields.push('priority = ?');
      updateParams.push(nextPriority);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = NOW()');
      await connection.query(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
        [...updateParams, taskId]
      );
    }

    if (parsedItems) {
      const itemIds = parsedItems.map((item) => item.itemId);
      const placeholders = itemIds.map(() => '?').join(',');
      const [existingItems] = await connection.query(
        `SELECT id FROM items WHERE id IN (${placeholders})`,
        itemIds
      );

      const existingItemIds = new Set(existingItems.map((item) => item.id));
      const missingItem = parsedItems.find((item) => !existingItemIds.has(item.itemId));
      if (missingItem) {
        await connection.rollback();
        return res.status(404).json({ message: `Item not found: ${missingItem.itemId}` });
      }

      await connection.query('DELETE FROM task_items WHERE task_id = ?', [taskId]);

      for (const item of parsedItems) {
        await connection.query(
          `INSERT INTO task_items (task_id, item_id, requested_quantity, picked_quantity, status)
           VALUES (?, ?, ?, 0, 'pending')`,
          [taskId, item.itemId, item.quantity]
        );
      }

      await connection.query('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?', ['pending', taskId]);
    }

    await connection.commit();

    return res.json({
      id: `REQ-${taskId}`,
      warning:
        task.assigned_user !== null
          ? 'Worker currently picking this order. Changes will sync to their mobile device.'
          : null,
      status: mapTaskStatusToApiStatus(task.status),
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error editing material request:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
});

// Operator cancel pending request
app.post('/material-requests/:requestId/cancel', authenticateJWT, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  try {
    const [taskRows] = await db.query(
      `SELECT id, status
       FROM tasks
       WHERE id = ? AND type = 'material_request'
       LIMIT 1`,
      [taskId]
    );

    if (!taskRows.length) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    if (String(taskRows[0].status).toLowerCase() !== 'pending') {
      return res.status(409).json({ message: 'Only pending requests can be cancelled' });
    }

    await db.query('DELETE FROM tasks WHERE id = ? AND type = ?', [taskId, 'material_request']);

    return res.json({
      id: `REQ-${taskId}`,
      cancelled: true,
    });
  } catch (err) {
    console.error('❌ Error cancelling material request:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Admin delete/cancel request
app.delete('/material-requests/:requestId', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const taskId = parseMaterialRequestTaskId(req.params.requestId);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  try {
    const [result] = await db.query('DELETE FROM tasks WHERE id = ? AND type = ?', [taskId, 'material_request']);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    return res.json({
      id: `REQ-${taskId}`,
      deleted: true,
    });
  } catch (err) {
    console.error('❌ Error deleting material request:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

app.get('/users', authenticateJWT, async (req, res) => {
  try {
    if (dbConnected) {
      const [rows] = await db.query('SELECT id, email, role, isActive FROM users');
      // Add username from email and normalize role for compatibility
      const usersWithUsername = rows.map(user => {
        const localPart = user.email.split('@')[0];
        const nameParts = localPart.split('.');
        // Use second part (given name) if available, fallback to first part
        const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
        return {
          ...user,
          username: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
          // Capitalize role: 'admin' -> 'Admin', 'teacher' -> 'Teacher'
          role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase() : 'Teacher'
        };
      });
      res.json(usersWithUsername);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/users', authenticateJWT, requireAdmin, async (req, res) => {
  const { email, password, role, isActive } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    if (dbConnected) {
      // Normalize role: 'Admin' -> 'admin', 'Teacher' -> 'teacher' for database
      const normalizedRole = role ? role.toLowerCase() : 'teacher';
      // Convert boolean to integer for MySQL (1 or 0)
      const normalizedIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1;
      const [result] = await db.query(
        'INSERT INTO users (email, password, role, isActive) VALUES (?, ?, ?, ?)',
        [email, password, normalizedRole, normalizedIsActive]
      );
      const [rows] = await db.query('SELECT id, email, role, isActive FROM users WHERE id = ?', [result.insertId]);
      const localPart = rows[0].email.split('@')[0];
      const nameParts = localPart.split('.');
      // Use second part (given name) if available, fallback to first part
      const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
      const userWithUsername = {
        ...rows[0],
        username: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
        // Capitalize role for frontend
        role: rows[0].role ? rows[0].role.charAt(0).toUpperCase() + rows[0].role.slice(1).toLowerCase() : 'Teacher'
      };
      res.json(userWithUsername);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error creating user:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.put('/users/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, role, isActive } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  console.log('📝 Updating user:', { id, email, role, isActive, type: typeof isActive });
  try {
    if (dbConnected) {
      // Normalize role: 'Admin' -> 'admin', 'Teacher' -> 'teacher' for database
      const normalizedRole = role ? role.toLowerCase() : 'teacher';
      // Convert boolean to integer for MySQL (1 or 0)
      const normalizedIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1;
      console.log('📝 Normalized values:', { normalizedRole, normalizedIsActive });
      const [result] = await db.query(
        'UPDATE users SET email=?, role=?, isActive=? WHERE id=?',
        [email, normalizedRole, normalizedIsActive, id]
      );
      console.log('📝 Update result:', result);
      const [rows] = await db.query('SELECT id, email, role, isActive FROM users WHERE id = ?', [id]);
      const localPart = rows[0].email.split('@')[0];
      const nameParts = localPart.split('.');
      // Use second part (given name) if available, fallback to first part
      const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
      const userWithUsername = {
        ...rows[0],
        username: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
        // Capitalize role for frontend
        role: rows[0].role ? rows[0].role.charAt(0).toUpperCase() + rows[0].role.slice(1).toLowerCase() : 'Teacher'
      };
      res.json(userWithUsername);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error updating user:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.delete('/users/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    if (dbConnected) {
      await db.query('DELETE FROM users WHERE id=?', [id]);
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error deleting user:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});


app.get('/categories', authenticateJWT, async (req, res) => {
  try {
    if (dbConnected) {
      const [rows] = await db.query('SELECT * FROM categories');
      res.json(rows);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error fetching categories:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/categories', authenticateJWT, requireAdmin, async (req, res) => {
  const { name, description } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid category name' });
  }

  try {
    if (dbConnected) {
      const [result] = await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
      const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error creating category:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.put('/categories/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid category name' });
  }

  try {
    if (dbConnected) {
      await db.query('UPDATE categories SET name=?, description=? WHERE id=?', [name, description, id]);
      const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error updating category:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.delete('/categories/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    if (dbConnected) {
      await db.query('DELETE FROM categories WHERE id=?', [id]);
      res.json({ message: 'Category deleted successfully' });
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error deleting category:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.get('/locations', authenticateJWT, async (req, res) => {
  try {
    if (dbConnected) {
      const [rows] = await db.query('SELECT * FROM locations');
      res.json(rows);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error fetching locations:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/locations', authenticateJWT, requireAdmin, async (req, res) => {
  const { name, description } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid location name' });
  }

  try {
    if (dbConnected) {
      const [result] = await db.query('INSERT INTO locations (name, description) VALUES (?, ?)', [name, description]);
      const [rows] = await db.query('SELECT * FROM locations WHERE id = ?', [result.insertId]);
      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error creating location:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.put('/locations/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid location name' });
  }

  try {
    if (dbConnected) {
      await db.query('UPDATE locations SET name=?, description=? WHERE id=?', [name, description, id]);
      const [rows] = await db.query('SELECT * FROM locations WHERE id = ?', [id]);
      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error updating location:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.delete('/locations/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    if (dbConnected) {
      await db.query('DELETE FROM locations WHERE id=?', [id]);
      res.json({ message: 'Location deleted successfully' });
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error deleting location:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// Get tasks for authenticated user
app.get('/tasks', authenticateJWT, async (req, res) => {
  try {
    if (dbConnected) {
      const userEmail = req.user.email;
      const tasks = await getTasksForUser(userEmail);
      res.json(tasks);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error fetching tasks:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT Taskitem set picked amount
app.put('/tasks/:taskId/items/:itemId/picked', authenticateJWT, async (req, res) => {
  const { taskId, itemId } = req.params;
  const { pickedQuantity } = req.body;

  const parsedTaskId = Number.parseInt(taskId, 10);
  const parsedItemId = Number.parseInt(itemId, 10);
  const parsedPickedQuantity = Number.parseInt(String(pickedQuantity), 10);

  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }

  if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    return res.status(400).json({ message: 'Invalid itemId' });
  }

  if (!Number.isInteger(parsedPickedQuantity) || parsedPickedQuantity < 0) {
    return res.status(400).json({ message: 'pickedQuantity must be a non-negative integer' });
  }

  try {
    if (!dbConnected) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [taskItemRows] = await connection.query(
        `SELECT ti.id, ti.requested_quantity, ti.picked_quantity,
                t.assigned_user, u.email AS assigned_email
         FROM task_items ti
         JOIN tasks t ON t.id = ti.task_id
         LEFT JOIN users u ON u.id = t.assigned_user
         WHERE ti.task_id = ? AND ti.item_id = ?
         LIMIT 1`,
        [parsedTaskId, parsedItemId]
      );

      if (!taskItemRows.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Task item not found' });
      }

      const taskItem = taskItemRows[0];
      if (
        taskItem.assigned_email &&
        req.user?.email &&
        taskItem.assigned_email.toLowerCase() !== req.user.email.toLowerCase()
      ) {
        await connection.rollback();
        return res.status(403).json({ message: 'Access denied: task is not assigned to this user' });
      }

      const nextItemStatus = parsedPickedQuantity >= taskItem.requested_quantity ? 'picked' : 'pending';

      await connection.query(
        `UPDATE task_items
         SET picked_quantity = ?, status = ?
         WHERE task_id = ? AND item_id = ?`,
        [parsedPickedQuantity, nextItemStatus, parsedTaskId, parsedItemId]
      );

      // Subtract picked quantity from item stock
      const quantityChange = parsedPickedQuantity - (taskItem.picked_quantity || 0);
      if (quantityChange !== 0) {
        await connection.query(
          `UPDATE items
           SET quantity = quantity - ?
           WHERE id = ?`,
          [quantityChange, parsedItemId]
        );
      }

      const [progressRows] = await connection.query(
        `SELECT COUNT(*) AS totalItems,
                SUM(CASE WHEN status = 'picked' THEN 1 ELSE 0 END) AS pickedItems
         FROM task_items
         WHERE task_id = ?`,
        [parsedTaskId]
      );

      const totalItems = progressRows[0]?.totalItems ?? 0;
      const pickedItems = progressRows[0]?.pickedItems ?? 0;
      const nextTaskStatus = totalItems > 0 && pickedItems === totalItems ? 'completed' : 'in_progress';

      await connection.query(
        'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
        [nextTaskStatus, parsedTaskId]
      );

      await connection.commit();

      return res.json({
        message: 'Task item picked quantity updated successfully',
        taskId: parsedTaskId,
        itemId: parsedItemId,
        pickedQuantity: parsedPickedQuantity,
        itemStatus: nextItemStatus,
        taskStatus: nextTaskStatus,
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Error updating task item picked quantity:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
