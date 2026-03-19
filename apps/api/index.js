const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { getTaskByIdForUser, getTasksForUser } = require('./tasks');
const { allocatePutawayLocation } = require('./wms');
require('dotenv').config();

const app = express();
const REQUIRED_WEB_ORIGIN = 'https://depo.htibee.hu';

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

// Use CORS_ORIGINS env var (comma-separated). Ensure production web origin is always allowed.
const configuredCorsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
  : null;

const corsOrigins = configuredCorsOrigins
  ? [...new Set([...configuredCorsOrigins, normalizeOrigin(REQUIRED_WEB_ORIGIN)])]
  : null;

app.use(
  cors(
    corsOrigins
      ? {
          origin: (origin, callback) => {
            if (!origin) {
              callback(null, true);
              return;
            }

            callback(null, corsOrigins.includes(normalizeOrigin(origin)));
          },
          credentials: true,
        }
      : { origin: true, credentials: true }
  )
);
app.use(express.json());

// Accept both /endpoint and /api/endpoint request shapes.
app.use((req, _res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api?')) {
    req.url = req.url.replace('/api', '/');
  } else if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  }

  next();
});

// Simulator delay middleware — delays all non-simulator API responses
app.use((req, res, next) => {
  if (simulatorDelay.enabled && !req.path.startsWith('/simulator')) {
    setTimeout(next, simulatorDelay.ms);
  } else {
    next();
  }
});

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

async function ensureDamageReportsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS damage_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reported_by INT,
        item_barcode VARCHAR(255),
        item_name VARCHAR(255),
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        reviewed_by INT,
        review_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('⚠️ Could not create damage_reports table:', err.message);
  }
}

async function ensureInventoryLogsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        user_id INT,
        action_type VARCHAR(50) NOT NULL,
        change_amount INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('⚠️ Could not create inventory_logs table:', err.message);
  }
}

// Initialize database connection test
let dbConnected = false;
testDBConnection().then(result => {
  dbConnected = result;
  if (result) {
    ensureDamageReportsTable();
    ensureInventoryLogsTable();
  }
});

// ─── Simulator In-Memory State ────────────────────────────────────────────────
const blockedUsers = new Set();
const simulatorDelay = { enabled: false, ms: 5000 };

// Input validation helpers
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidString(str, maxLength = 255) {
  return typeof str === 'string' && str.trim().length > 0 && str.length <= maxLength;
}

function mapExceptionReasonToActionType(reason) {
  return reason === 'damage' ? 'damage' : 'adjust';
}

function normalizeId(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

function safeStringify(value) {
  return JSON.stringify(value, (_, nestedValue) =>
    typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue
  );
}

function normalizeRole(value) {
  if (value === null || value === undefined) {
    return 'Teacher';
  }

  const raw = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : String(value);

  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return 'Teacher';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildUserResponse(user) {
  const emailValue = String(user?.email || '');
  const localPart = emailValue.split('@')[0] || '';
  const nameParts = localPart.split('.').filter(Boolean);
  const firstName = nameParts.length > 1 ? nameParts[1] : (nameParts[0] || 'User');

  return {
    ...user,
    id: normalizeId(user?.id),
    username: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
    role: normalizeRole(user?.role),
  };
}

const itemsSchemaCache = {
  value: null,
};

const usersSchemaCache = {
  value: null,
};

const tasksSchemaCache = {
  value: null,
};

const categoriesSchemaCache = {
  value: null,
};

const locationsSchemaCache = {
  value: null,
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

    if (rows.length > 0) {
      return true;
    }

    const [fallbackRows] = await db.query(
      `SHOW COLUMNS FROM \`${tableName}\` LIKE ?`,
      [columnName]
    );

    return fallbackRows.length > 0;
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

async function getUsersSchemaCapabilities() {
  if (usersSchemaCache.value) {
    return usersSchemaCache.value;
  }

  const [hasIsActive, hasIsActiveSnake, hasPassword] = await Promise.all([
    tableHasColumn('users', 'isActive'),
    tableHasColumn('users', 'is_active'),
    tableHasColumn('users', 'password'),
  ]);

  usersSchemaCache.value = {
    hasIsActive,
    hasIsActiveSnake,
    hasPassword,
  };

  return usersSchemaCache.value;
}

function getUsersIsActiveSelectExpr(capabilities) {
  if (capabilities.hasIsActive) {
    return 'isActive';
  }

  if (capabilities.hasIsActiveSnake) {
    return 'is_active AS isActive';
  }

  return '1 AS isActive';
}

function getUsersIsActiveColumnName(capabilities) {
  if (capabilities.hasIsActive) {
    return 'isActive';
  }

  if (capabilities.hasIsActiveSnake) {
    return 'is_active';
  }

  return null;
}

async function getCategoriesSchemaCapabilities() {
  if (categoriesSchemaCache.value) {
    return categoriesSchemaCache.value;
  }

  const [hasDescription, hasSizeClass, hasMinStockLevel] = await Promise.all([
    tableHasColumn('categories', 'description'),
    tableHasColumn('categories', 'size_class'),
    tableHasColumn('categories', 'min_stock_level'),
  ]);

  categoriesSchemaCache.value = {
    hasDescription,
    hasSizeClass,
    hasMinStockLevel,
  };

  return categoriesSchemaCache.value;
}

function getCategoryDescriptionSelectExpr(capabilities) {
  if (capabilities.hasDescription) {
    return 'description';
  }

  if (capabilities.hasSizeClass) {
    return 'size_class AS description';
  }

  return 'NULL AS description';
}

async function getLocationsSchemaCapabilities() {
  if (locationsSchemaCache.value) {
    return locationsSchemaCache.value;
  }

  const [
    hasName,
    hasDescription,
    hasLocationCode,
    hasRowNum,
    hasColNum,
    hasShelfLevel,
    hasIsXl,
    hasIsActive,
  ] = await Promise.all([
    tableHasColumn('locations', 'name'),
    tableHasColumn('locations', 'description'),
    tableHasColumn('locations', 'location_code'),
    tableHasColumn('locations', 'row_num'),
    tableHasColumn('locations', 'col_num'),
    tableHasColumn('locations', 'shelf_level'),
    tableHasColumn('locations', 'is_xl'),
    tableHasColumn('locations', 'is_active'),
  ]);

  locationsSchemaCache.value = {
    hasName,
    hasDescription,
    hasLocationCode,
    hasRowNum,
    hasColNum,
    hasShelfLevel,
    hasIsXl,
    hasIsActive,
  };

  return locationsSchemaCache.value;
}

function getLocationNameSelectExpr(capabilities) {
  if (capabilities.hasName) {
    return 'name';
  }

  if (capabilities.hasLocationCode) {
    return 'location_code AS name';
  }

  return "CONCAT('Location-', id) AS name";
}

function getLocationDescriptionSelectExpr(capabilities) {
  if (capabilities.hasDescription) {
    return 'description';
  }

  if (capabilities.hasLocationCode) {
    return 'location_code AS description';
  }

  return 'NULL AS description';
}

function normalizeIncomingRole(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return 'worker';
  }

  if (raw === 'admin') {
    return 'admin';
  }

  if (raw === 'teacher' || raw === 'operator' || raw === 'user') {
    return 'worker';
  }

  if (raw === 'supervisor' || raw === 'worker') {
    return raw;
  }

  return 'worker';
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
        // Simulator: block-user invalidates sessions for testing mobile 401 flows
        if (blockedUsers.has(decoded.email.toLowerCase())) {
          return res.status(401).json({ message: 'Session invalidated by simulator' });
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

function requireSupervisorOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const userRole = req.user.role?.toLowerCase();
  if (userRole !== 'admin' && userRole !== 'supervisor') {
    return res.status(403).json({ message: 'Supervisor or Admin privileges required' });
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
      console.log('🔍 Full user row:', safeStringify(rows[0]));
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

      const userId = normalizeId(rows[0].id);
      const responseData = { token: '', user: { email, id: userId, role } };
      const token = jwt.sign({ email, userId, role }, JWT_SECRET, { expiresIn: '1h' });
      responseData.token = token;

      console.log('📤 Sending response:', safeStringify(responseData));
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

const MATERIAL_REQUEST_NAME_PREFIX = 'Anyagigénylés - ';

async function getTasksSchemaCapabilities() {
  if (tasksSchemaCache.value) {
    return tasksSchemaCache.value;
  }

  let hasMaterialRequestType = false;

  try {
    const [rows] = await db.query(
      `SELECT COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tasks'
         AND LOWER(COLUMN_NAME) = 'type'
       LIMIT 1`
    );

    const columnType = String(rows?.[0]?.COLUMN_TYPE || '').toLowerCase();
    hasMaterialRequestType = columnType.includes('material_request');
  } catch (error) {
    hasMaterialRequestType = false;
  }

  tasksSchemaCache.value = { hasMaterialRequestType };
  return tasksSchemaCache.value;
}

function getMaterialRequestTaskType(capabilities) {
  return capabilities.hasMaterialRequestType ? 'material_request' : 'picking';
}

function getMaterialRequestTaskFilter(prefix, capabilities) {
  const scopedPrefix = prefix ? `${prefix}.` : '';
  const taskType = getMaterialRequestTaskType(capabilities);
  const params = [taskType];

  let clause = `${scopedPrefix}type = ?`;
  if (!capabilities.hasMaterialRequestType) {
    clause += ` AND ${scopedPrefix}name LIKE ?`;
    params.push(`${MATERIAL_REQUEST_NAME_PREFIX}%`);
  }

  return { clause, params };
}

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

    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestTaskType = getMaterialRequestTaskType(taskSchemaCapabilities);

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
       VALUES (?, ?, ?, NULL, 'pending', ?, NULL, NOW(), NOW())`,
      [taskName, materialRequestTaskType, line, requestPriority]
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('t', taskSchemaCapabilities);

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
      WHERE ${materialRequestFilter.clause} AND t.source_id = ?
      GROUP BY t.id, t.source_id, t.status, t.priority, t.created_at
      ORDER BY t.created_at DESC
      LIMIT 25`,
      [...materialRequestFilter.params, String(line)]
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('t', taskSchemaCapabilities);

    const [rows] = await db.query(
      `SELECT
        SUM(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) AS active_requests,
        SUM(CASE WHEN t.status IN ('pending', 'in_progress') AND t.priority = 1 THEN 1 ELSE 0 END) AS urgent_requests,
        COUNT(*) AS total_requests
      FROM tasks t
      WHERE ${materialRequestFilter.clause}`,
      materialRequestFilter.params
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('t', taskSchemaCapabilities);

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
      WHERE ${materialRequestFilter.clause}
      GROUP BY t.id, t.name, t.source_id, t.status, t.priority, t.assigned_user, u.email, t.created_at, t.updated_at
      ORDER BY t.created_at DESC`,
      materialRequestFilter.params
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('t', taskSchemaCapabilities);

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
      WHERE t.id = ? AND ${materialRequestFilter.clause}
      LIMIT 1`,
      [taskId, ...materialRequestFilter.params]
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('', taskSchemaCapabilities);

    if (normalizedAssignedUserId !== null) {
      const [userRows] = await db.query('SELECT id, email FROM users WHERE id = ? LIMIT 1', [normalizedAssignedUserId]);
      if (!userRows.length) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
    }

    const [result] = await db.query(
      `UPDATE tasks
       SET assigned_user = ?, updated_at = NOW()
       WHERE id = ? AND ${materialRequestFilter.clause}`,
      [normalizedAssignedUserId, taskId, ...materialRequestFilter.params]
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('', taskSchemaCapabilities);

    const [result] = await db.query(
      `UPDATE tasks
       SET status = ?, updated_at = NOW()
       WHERE id = ? AND ${materialRequestFilter.clause}`,
      [nextStatus, taskId, ...materialRequestFilter.params]
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

    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('', taskSchemaCapabilities);

    const [taskRows] = await connection.query(
      `SELECT id, status, assigned_user
       FROM tasks
       WHERE id = ? AND ${materialRequestFilter.clause}
       LIMIT 1 FOR UPDATE`,
      [taskId, ...materialRequestFilter.params]
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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('', taskSchemaCapabilities);

    const [taskRows] = await db.query(
      `SELECT id, status
       FROM tasks
       WHERE id = ? AND ${materialRequestFilter.clause}
       LIMIT 1`,
      [taskId, ...materialRequestFilter.params]
    );

    if (!taskRows.length) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    if (String(taskRows[0].status).toLowerCase() !== 'pending') {
      return res.status(409).json({ message: 'Only pending requests can be cancelled' });
    }

    await db.query(
      `DELETE FROM tasks WHERE id = ? AND ${materialRequestFilter.clause}`,
      [taskId, ...materialRequestFilter.params]
    );

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
    const taskSchemaCapabilities = await getTasksSchemaCapabilities();
    const materialRequestFilter = getMaterialRequestTaskFilter('', taskSchemaCapabilities);
    const [result] = await db.query(
      `DELETE FROM tasks WHERE id = ? AND ${materialRequestFilter.clause}`,
      [taskId, ...materialRequestFilter.params]
    );

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
      const capabilities = await getUsersSchemaCapabilities();
      const [rows] = await db.query(`SELECT id, email, role, ${getUsersIsActiveSelectExpr(capabilities)} FROM users`);
      const usersWithUsername = rows.map((user) => buildUserResponse(user));
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
      const capabilities = await getUsersSchemaCapabilities();
      const isActiveColumn = getUsersIsActiveColumnName(capabilities);
      const normalizedRole = normalizeIncomingRole(role);
      const normalizedIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1;

      const insertFields = ['email', 'role'];
      const insertValues = [email, normalizedRole];

      if (capabilities.hasPassword) {
        insertFields.push('password');
        insertValues.push(password || null);
      }

      if (isActiveColumn) {
        insertFields.push(isActiveColumn);
        insertValues.push(normalizedIsActive);
      }

      const placeholders = insertFields.map(() => '?').join(', ');
      const [result] = await db.query(
        `INSERT INTO users (${insertFields.join(', ')}) VALUES (${placeholders})`,
        insertValues
      );

      const [rows] = await db.query(
        `SELECT id, email, role, ${getUsersIsActiveSelectExpr(capabilities)} FROM users WHERE id = ?`,
        [result.insertId]
      );
      const userWithUsername = buildUserResponse(rows[0]);
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
      const capabilities = await getUsersSchemaCapabilities();
      const isActiveColumn = getUsersIsActiveColumnName(capabilities);
      const normalizedRole = normalizeIncomingRole(role);
      const normalizedIsActive = isActive !== undefined ? (isActive ? 1 : 0) : 1;
      console.log('📝 Normalized values:', { normalizedRole, normalizedIsActive });

      const updateAssignments = ['email=?', 'role=?'];
      const updateValues = [email, normalizedRole];
      if (isActiveColumn) {
        updateAssignments.push(`${isActiveColumn}=?`);
        updateValues.push(normalizedIsActive);
      }

      const [result] = await db.query(
        `UPDATE users SET ${updateAssignments.join(', ')} WHERE id=?`,
        [...updateValues, id]
      );
      console.log('📝 Update result:', result);
      const [rows] = await db.query(
        `SELECT id, email, role, ${getUsersIsActiveSelectExpr(capabilities)} FROM users WHERE id = ?`,
        [id]
      );
      const userWithUsername = buildUserResponse(rows[0]);
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
      const capabilities = await getCategoriesSchemaCapabilities();
      const [rows] = await db.query(
        `SELECT id, name, ${getCategoryDescriptionSelectExpr(capabilities)} FROM categories`
      );
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
      const capabilities = await getCategoriesSchemaCapabilities();
      const insertFields = ['name'];
      const insertValues = [name];

      if (capabilities.hasDescription) {
        insertFields.push('description');
        insertValues.push(description ?? null);
      } else if (capabilities.hasSizeClass) {
        insertFields.push('size_class');
        insertValues.push(String(description || 'közepes'));
      }

      const placeholders = insertFields.map(() => '?').join(', ');
      const [result] = await db.query(
        `INSERT INTO categories (${insertFields.join(', ')}) VALUES (${placeholders})`,
        insertValues
      );
      const [rows] = await db.query(
        `SELECT id, name, ${getCategoryDescriptionSelectExpr(capabilities)} FROM categories WHERE id = ?`,
        [result.insertId]
      );
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
      const capabilities = await getCategoriesSchemaCapabilities();

      if (capabilities.hasDescription) {
        await db.query('UPDATE categories SET name=?, description=? WHERE id=?', [name, description ?? null, id]);
      } else if (capabilities.hasSizeClass) {
        await db.query('UPDATE categories SET name=?, size_class=? WHERE id=?', [name, String(description || 'közepes'), id]);
      } else {
        await db.query('UPDATE categories SET name=? WHERE id=?', [name, id]);
      }

      const [rows] = await db.query(
        `SELECT id, name, ${getCategoryDescriptionSelectExpr(capabilities)} FROM categories WHERE id = ?`,
        [id]
      );
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
      const capabilities = await getLocationsSchemaCapabilities();
      const [rows] = await db.query(
        `SELECT id, ${getLocationNameSelectExpr(capabilities)}, ${getLocationDescriptionSelectExpr(capabilities)} FROM locations`
      );
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
      const capabilities = await getLocationsSchemaCapabilities();

      if (capabilities.hasName) {
        const [result] = await db.query('INSERT INTO locations (name, description) VALUES (?, ?)', [name, description ?? null]);
        const [rows] = await db.query(
          `SELECT id, ${getLocationNameSelectExpr(capabilities)}, ${getLocationDescriptionSelectExpr(capabilities)} FROM locations WHERE id = ?`,
          [result.insertId]
        );
        return res.json(rows[0]);
      }

      if (capabilities.hasLocationCode) {
        const normalizedCode = String(name).trim();
        const rowNum = Number.parseInt(String(req.body?.row_num ?? 1), 10) || 1;
        const colNum = Number.parseInt(String(req.body?.col_num ?? 1), 10) || 1;
        const shelfLevel = Number.parseInt(String(req.body?.shelf_level ?? 0), 10) || 0;
        const isXl = req.body?.is_xl ? 1 : 0;
        const isActive = req.body?.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0);

        const insertFields = ['location_code'];
        const insertValues = [normalizedCode];

        if (capabilities.hasRowNum) {
          insertFields.push('row_num');
          insertValues.push(rowNum);
        }
        if (capabilities.hasColNum) {
          insertFields.push('col_num');
          insertValues.push(colNum);
        }
        if (capabilities.hasShelfLevel) {
          insertFields.push('shelf_level');
          insertValues.push(shelfLevel);
        }
        if (capabilities.hasIsXl) {
          insertFields.push('is_xl');
          insertValues.push(isXl);
        }
        if (capabilities.hasIsActive) {
          insertFields.push('is_active');
          insertValues.push(isActive);
        }

        const placeholders = insertFields.map(() => '?').join(', ');
        const [result] = await db.query(
          `INSERT INTO locations (${insertFields.join(', ')}) VALUES (${placeholders})`,
          insertValues
        );
        const [rows] = await db.query(
          `SELECT id, ${getLocationNameSelectExpr(capabilities)}, ${getLocationDescriptionSelectExpr(capabilities)} FROM locations WHERE id = ?`,
          [result.insertId]
        );
        return res.json(rows[0]);
      }

      return res.status(400).json({ message: 'Current schema does not support location creation' });
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
      const capabilities = await getLocationsSchemaCapabilities();

      if (capabilities.hasName) {
        await db.query('UPDATE locations SET name=?, description=? WHERE id=?', [name, description ?? null, id]);
      } else if (capabilities.hasLocationCode) {
        await db.query('UPDATE locations SET location_code=? WHERE id=?', [String(name).trim(), id]);
      } else {
        return res.status(400).json({ message: 'Current schema does not support location updates' });
      }

      const [rows] = await db.query(
        `SELECT id, ${getLocationNameSelectExpr(capabilities)}, ${getLocationDescriptionSelectExpr(capabilities)} FROM locations WHERE id = ?`,
        [id]
      );
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
      const userId = resolveAuthenticatedUserId(req);
      const userRole = req.user?.role ?? req.user?.dbUser?.role ?? null;
      const tasks = await getTasksForUser(userEmail, userId, userRole);
      res.json(tasks);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Error fetching tasks:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

function resolveAuthenticatedUserId(req) {
  if (req?.user?.dbUser?.id !== undefined && req.user.dbUser.id !== null) {
    const parsed = Number.parseInt(String(req.user.dbUser.id), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (req?.user?.userId !== undefined && req.user.userId !== null) {
    const parsed = Number.parseInt(String(req.user.userId), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parseBooleanInput(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return null;
}

async function handleGetTaskById(req, res) {
  const parsedTaskId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  try {
    const userEmail = req.user?.email ?? '';
    const userId = resolveAuthenticatedUserId(req);
    const userRole = req.user?.role ?? req.user?.dbUser?.role ?? null;
    const task = await getTaskByIdForUser(parsedTaskId, userEmail, userId, userRole);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.json(task);
  } catch (err) {
    console.error('❌ Error fetching task details:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
}

async function handleInboundPutaway(req, res) {
  const parsedItemId = Number.parseInt(String(req.body?.itemId), 10);
  const parsedQuantity = Number.parseInt(String(req.body?.quantity), 10);
  const parsedIsXl = parseBooleanInput(req.body?.isXl);

  if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    return res.status(400).json({ message: 'itemId must be a positive integer' });
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ message: 'quantity must be a positive integer' });
  }

  if (parsedIsXl === null) {
    return res.status(400).json({ message: 'isXl must be a boolean' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [itemRows] = await connection.query(
      `SELECT id
       FROM items
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedItemId]
    );

    if (!itemRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Item not found' });
    }

    const location = await allocatePutawayLocation(parsedItemId, parsedIsXl, connection);
    if (!location) {
      await connection.rollback();
      return res.status(400).json({ message: 'No putaway location available' });
    }

    const [inventoryRows] = await connection.query(
      `SELECT id, quantity
       FROM inventory
       WHERE item_id = ? AND location_id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedItemId, location.id]
    );

    if (inventoryRows.length > 0) {
      await connection.query(
        `UPDATE inventory
         SET quantity = COALESCE(quantity, 0) + ?
         WHERE id = ?`,
        [parsedQuantity, inventoryRows[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO inventory (item_id, location_id, quantity)
         VALUES (?, ?, ?)`,
        [parsedItemId, location.id, parsedQuantity]
      );
    }

    await connection.query(
      `UPDATE items
       SET quantity = COALESCE(quantity, 0) + ?
       WHERE id = ?`,
      [parsedQuantity, parsedItemId]
    );

    await connection.commit();
    return res.status(201).json({
      itemId: parsedItemId,
      quantity: parsedQuantity,
      location_code: location.location_code,
      location,
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error processing putaway:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
}

app.get('/tasks/:id', authenticateJWT, handleGetTaskById);
app.get('/api/tasks/:id', authenticateJWT, handleGetTaskById);
app.post('/api/inbound/putaway', authenticateJWT, handleInboundPutaway);

app.post('/tasks/:taskId/take', authenticateJWT, async (req, res) => {
  const parsedTaskId = Number.parseInt(req.params.taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const userId = resolveAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unable to resolve authenticated user id' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [taskRows] = await connection.query(
      `SELECT id, assigned_user, status
       FROM tasks
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedTaskId]
    );

    if (!taskRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskRows[0];
    const currentStatus = String(task.status || '').toLowerCase();
    if (currentStatus === 'completed' || currentStatus === 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'Completed or cancelled tasks cannot be taken' });
    }

    if (task.assigned_user !== null && Number(task.assigned_user) !== userId) {
      await connection.rollback();
      return res.status(409).json({ message: 'Task is already assigned to another user' });
    }

    await connection.query(
      `UPDATE tasks
       SET assigned_user = ?, updated_at = NOW()
       WHERE id = ?`,
      [userId, parsedTaskId]
    );

    await connection.commit();
    return res.json({ message: 'Task assigned successfully', taskId: parsedTaskId, assigned_user: userId });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error taking task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
});

app.post('/tasks/:taskId/release', authenticateJWT, async (req, res) => {
  const parsedTaskId = Number.parseInt(req.params.taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const userId = resolveAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unable to resolve authenticated user id' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [taskRows] = await connection.query(
      `SELECT id, assigned_user, status
       FROM tasks
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedTaskId]
    );

    if (!taskRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskRows[0];
    const currentStatus = String(task.status || '').toLowerCase();
    if (currentStatus === 'completed' || currentStatus === 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'Completed or cancelled tasks cannot be released' });
    }

    if (task.assigned_user === null) {
      await connection.rollback();
      return res.status(409).json({ message: 'Task is already unassigned' });
    }

    if (Number(task.assigned_user) !== userId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Only the assigned user can release this task' });
    }

    await connection.query(
      `UPDATE tasks
       SET assigned_user = NULL, updated_at = NOW()
       WHERE id = ?`,
      [parsedTaskId]
    );

    await connection.commit();
    return res.json({ message: 'Task released successfully', taskId: parsedTaskId, assigned_user: null });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error releasing task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
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
      if (!taskItem.assigned_user) {
        await connection.rollback();
        return res.status(409).json({ message: 'Task is unassigned. Take the task first.' });
      }

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

// ─── Damage Reports ──────────────────────────────────────────────────────────

// Submit a damage report (any authenticated user)
app.post('/damage-reports', authenticateJWT, async (req, res) => {
  const { item_barcode, item_name, description } = req.body;

  if (!description || typeof description !== 'string' || description.trim().length === 0 || description.length > 1000) {
    return res.status(400).json({ message: 'Description is required (max 1000 characters)' });
  }

  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const userId = resolveAuthenticatedUserId(req);
    if (!userId) return res.status(403).json({ message: 'User not found in database' });

    const safeBarcode = typeof item_barcode === 'string' ? item_barcode.trim().slice(0, 255) : null;
    const safeName = typeof item_name === 'string' ? item_name.trim().slice(0, 255) : null;

    const [result] = await db.query(
      `INSERT INTO damage_reports (reported_by, item_barcode, item_name, description, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, safeBarcode, safeName, description.trim()]
    );
    return res.status(201).json({
      id: Number(result.insertId),
      reported_by: userId,
      item_barcode: safeBarcode,
      item_name: safeName,
      description: description.trim(),
      status: 'pending',
    });
  } catch (err) {
    console.error('❌ Error creating damage report:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Get all damage reports (supervisor / admin)
app.get('/damage-reports', authenticateJWT, requireSupervisorOrAdmin, async (req, res) => {
  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const [rows] = await db.query(
      `SELECT dr.*, u.email AS reporter_email
       FROM damage_reports dr
       LEFT JOIN users u ON u.id = dr.reported_by
       ORDER BY dr.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching damage reports:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Review a damage report (supervisor / admin)
app.put('/damage-reports/:id/status', authenticateJWT, requireSupervisorOrAdmin, async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ message: 'Invalid report ID' });
  }

  const { status, review_note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
  }

  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const reviewerId = resolveAuthenticatedUserId(req);
    const safeNote = typeof review_note === 'string' ? review_note.trim().slice(0, 500) : null;

    const [result] = await db.query(
      `UPDATE damage_reports SET status = ?, reviewed_by = ?, review_note = ?, updated_at = NOW() WHERE id = ?`,
      [status, reviewerId, safeNote, reportId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found' });

    const [rows] = await db.query('SELECT * FROM damage_reports WHERE id = ?', [reportId]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error updating damage report:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Task CRUD (Admin) ────────────────────────────────────────────────────────

// Create a new task
app.post('/tasks', authenticateJWT, requireAdmin, async (req, res) => {
  const { name, type, priority, deadline, assigned_user } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid task name' });
  }
  if (!['picking', 'inbound', 'transfer'].includes(type)) {
    return res.status(400).json({ message: "Task type must be 'picking', 'inbound', or 'transfer'" });
  }
  const parsedPriority = Number.parseInt(String(priority), 10);
  if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 4) {
    return res.status(400).json({ message: 'Priority must be 1 (critical) to 4 (low)' });
  }

  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const safeDeadline = deadline ? new Date(deadline) : null;
    if (deadline && isNaN(safeDeadline?.getTime())) {
      return res.status(400).json({ message: 'Invalid deadline date' });
    }
    const safeAssignedUser = Number.isInteger(Number(assigned_user)) && Number(assigned_user) > 0
      ? Number(assigned_user) : null;

    const [result] = await db.query(
      `INSERT INTO tasks (name, type, priority, status, deadline, assigned_user, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
      [name.trim(), type, parsedPriority, safeDeadline, safeAssignedUser]
    );
    const newId = Number(result.insertId);
    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [newId]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ Error creating task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Update task fields (priority, status, assigned_user, name, deadline)
app.put('/tasks/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const taskId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }

  const { name, priority, status, assigned_user, deadline } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!isValidString(name, 255)) return res.status(400).json({ message: 'Invalid task name' });
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (priority !== undefined) {
    const p = Number.parseInt(String(priority), 10);
    if (!Number.isInteger(p) || p < 1 || p > 4) return res.status(400).json({ message: 'Priority must be 1-4' });
    updates.push('priority = ?');
    values.push(p);
  }
  if (status !== undefined) {
    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    updates.push('status = ?');
    values.push(status);
  }
  if ('assigned_user' in req.body) {
    const au = Number.isInteger(Number(assigned_user)) && Number(assigned_user) > 0
      ? Number(assigned_user) : null;
    updates.push('assigned_user = ?');
    values.push(au);
  }
  if ('deadline' in req.body) {
    const dl = deadline ? new Date(deadline) : null;
    if (deadline && isNaN(dl?.getTime())) return res.status(400).json({ message: 'Invalid deadline date' });
    updates.push('deadline = ?');
    values.push(dl);
  }

  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
  updates.push('updated_at = NOW()');
  values.push(taskId);

  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const [result] = await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error updating task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Delete task
app.delete('/tasks/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const taskId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }
  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const [result] = await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    return res.json({ message: 'Task deleted', taskId });
  } catch (err) {
    console.error('❌ Error deleting task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Accept shortage: supervisor marks a task item shortage as acknowledged (status = shortage_accepted)
app.put('/tasks/:taskId/items/:itemId/accept-shortage', authenticateJWT, requireSupervisorOrAdmin, async (req, res) => {
  const taskId = Number.parseInt(req.params.taskId, 10);
  const itemId = Number.parseInt(req.params.itemId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId or itemId' });
  }
  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' });
    const [result] = await db.query(
      `UPDATE task_items SET status = 'shortage_accepted' WHERE task_id = ? AND item_id = ? AND status != 'picked'`,
      [taskId, itemId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task item not found or already picked' });
    // Check if all items are now done (picked or shortage_accepted)
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('picked','shortage_accepted') THEN 1 ELSE 0 END) AS done
       FROM task_items WHERE task_id = ?`,
      [taskId]
    );
    if (rows[0]?.total > 0 && rows[0]?.done === rows[0]?.total) {
      await db.query('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?', ['completed', taskId]);
    }
    return res.json({ message: 'Shortage accepted', taskId, itemId });
  } catch (err) {
    console.error('❌ Error accepting shortage:', err.message);
    return res.status(500).json({ message: 'Database error' });
  }
});

async function handleTaskItemException(req, res) {
  const parsedTaskId = Number.parseInt(req.params.taskId, 10);
  const parsedItemId = Number.parseInt(req.params.itemId, 10);
  const parsedLocationId = Number.parseInt(String(req.body?.locationId), 10);
  const parsedPickedQuantity = Number.parseInt(String(req.body?.pickedQuantity), 10);
  const parsedMissingQuantity = Number.parseInt(String(req.body?.missingQuantity), 10);
  const reason = String(req.body?.reason || '').trim().toLowerCase();

  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    return res.status(400).json({ message: 'Invalid taskId' });
  }
  if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    return res.status(400).json({ message: 'Invalid itemId' });
  }
  if (!Number.isInteger(parsedLocationId) || parsedLocationId <= 0) {
    return res.status(400).json({ message: 'locationId must be a positive integer' });
  }
  if (!Number.isInteger(parsedPickedQuantity) || parsedPickedQuantity < 0) {
    return res.status(400).json({ message: 'pickedQuantity must be a non-negative integer' });
  }
  if (!Number.isInteger(parsedMissingQuantity) || parsedMissingQuantity < 0) {
    return res.status(400).json({ message: 'missingQuantity must be a non-negative integer' });
  }
  if (!['shortage', 'damage'].includes(reason)) {
    return res.status(400).json({ message: "reason must be 'shortage' or 'damage'" });
  }

  if (!dbConnected) {
    return res.status(503).json({ message: 'Database not available' });
  }

  const userId = resolveAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unable to resolve authenticated user id' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [taskItemRows] = await connection.query(
      `SELECT ti.id, ti.requested_quantity, ti.picked_quantity,
              t.assigned_user, t.status AS task_status, u.email AS assigned_email
       FROM task_items ti
       JOIN tasks t ON t.id = ti.task_id
       LEFT JOIN users u ON u.id = t.assigned_user
       WHERE ti.task_id = ? AND ti.item_id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedTaskId, parsedItemId]
    );

    if (!taskItemRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Task item not found' });
    }

    const taskItem = taskItemRows[0];
    const requestedQuantity = Number(taskItem.requested_quantity || 0);
    if (parsedPickedQuantity + parsedMissingQuantity > requestedQuantity) {
      await connection.rollback();
      return res.status(400).json({ message: 'pickedQuantity + missingQuantity cannot exceed requested quantity' });
    }

    if (!taskItem.assigned_user) {
      await connection.rollback();
      return res.status(409).json({ message: 'Task is unassigned. Take the task first.' });
    }

    if (
      taskItem.assigned_email &&
      req.user?.email &&
      taskItem.assigned_email.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      await connection.rollback();
      return res.status(403).json({ message: 'Access denied: task is not assigned to this user' });
    }

    const taskStatus = String(taskItem.task_status || '').toLowerCase();
    if (taskStatus === 'completed' || taskStatus === 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'Cannot update completed or cancelled tasks' });
    }

    const [inventoryRows] = await connection.query(
      `SELECT id, quantity
       FROM inventory
       WHERE item_id = ? AND location_id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedItemId, parsedLocationId]
    );

    if (!inventoryRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Inventory row not found for item and location' });
    }

    const inventoryRow = inventoryRows[0];
    const currentQuantity = Number(inventoryRow.quantity || 0);
    const totalDeduction = parsedPickedQuantity + parsedMissingQuantity;
    const rawNextQuantity = currentQuantity - totalDeduction;
    const nextQuantity = Math.max(0, rawNextQuantity);

    if (rawNextQuantity < 0) {
      console.error('CRITICAL: Inventory would go below zero during picking exception', {
        taskId: parsedTaskId,
        itemId: parsedItemId,
        locationId: parsedLocationId,
        currentQuantity,
        attemptedDeduction: totalDeduction,
      });
    }

    const nextItemStatus = parsedMissingQuantity > 0 ? 'partial' : 'picked';

    await connection.query(
      `UPDATE task_items
       SET picked_quantity = ?, status = ?
       WHERE task_id = ? AND item_id = ?`,
      [parsedPickedQuantity, nextItemStatus, parsedTaskId, parsedItemId]
    );

    await connection.query(
      `UPDATE inventory
       SET quantity = ?
       WHERE id = ?`,
      [nextQuantity, inventoryRow.id]
    );

    if (parsedPickedQuantity > 0) {
      await connection.query(
        `INSERT INTO inventory_logs (item_id, user_id, action_type, change_amount)
         VALUES (?, ?, 'pick', ?)`,
        [parsedItemId, userId, -parsedPickedQuantity]
      );
    }

    if (parsedMissingQuantity > 0) {
      await connection.query(
        `INSERT INTO inventory_logs (item_id, user_id, action_type, change_amount)
         VALUES (?, ?, ?, ?)`,
        [parsedItemId, userId, mapExceptionReasonToActionType(reason), -parsedMissingQuantity]
      );
    }

    const [locationRows] = await connection.query(
      `SELECT location_code
       FROM locations
       WHERE id = ?
       LIMIT 1`,
      [parsedLocationId]
    );

    const locationCode = locationRows[0]?.location_code || `#${parsedLocationId}`;
    const [auditTaskResult] = await connection.query(
      `INSERT INTO tasks (name, type, priority, status, created_at, updated_at)
       VALUES (?, 'audit', 1, 'pending', NOW(), NOW())`,
      [`System Generated Audit: Location ${locationCode}`]
    );

    const [progressRows] = await connection.query(
      `SELECT COUNT(*) AS totalItems,
              SUM(CASE WHEN status IN ('picked', 'partial', 'shortage_accepted') THEN 1 ELSE 0 END) AS doneItems
       FROM task_items
       WHERE task_id = ?`,
      [parsedTaskId]
    );

    const totalItems = Number(progressRows[0]?.totalItems || 0);
    const doneItems = Number(progressRows[0]?.doneItems || 0);
    const nextTaskStatus = totalItems > 0 && doneItems === totalItems ? 'completed' : 'in_progress';

    await connection.query(
      `UPDATE tasks
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [nextTaskStatus, parsedTaskId]
    );

    await connection.commit();

    return res.status(200).json({
      message: 'Picking exception reported successfully',
      success: true,
      taskId: parsedTaskId,
      itemId: parsedItemId,
      locationId: parsedLocationId,
      pickedQuantity: parsedPickedQuantity,
      missingQuantity: parsedMissingQuantity,
      reason,
      itemStatus: nextItemStatus,
      taskStatus: nextTaskStatus,
      auditTaskId: Number(auditTaskResult.insertId),
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error reporting picking exception:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
}

app.post('/tasks/:taskId/items/:itemId/exception', authenticateJWT, handleTaskItemException);
app.post('/api/tasks/:taskId/items/:itemId/exception', authenticateJWT, handleTaskItemException);

// ─── Simulator Endpoints ─────────────────────────────────────────────────────

// GET /simulator/status — current in-memory simulator state
app.get('/simulator/status', authenticateJWT, requireAdmin, (req, res) => {
  res.json({
    delay: simulatorDelay,
    blockedUsers: [...blockedUsers],
  });
});

// POST /simulator/spawn-task — create a task + task_items in a single transaction
app.post('/simulator/spawn-task', authenticateJWT, requireAdmin, async (req, res) => {
  const { name, type, priority, items } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid task name' });
  }
  if (!['picking', 'inbound', 'transfer'].includes(type)) {
    return res.status(400).json({ message: "Task type must be 'picking', 'inbound', or 'transfer'" });
  }
  const parsedPriority = Number.parseInt(String(priority), 10);
  if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 4) {
    return res.status(400).json({ message: 'Priority must be 1–4' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items array is required' });
  }
  const parsedItems = items
    .map(i => ({
      item_id: Number.parseInt(String(i?.item_id), 10),
      requested_quantity: Number.parseInt(String(i?.requested_quantity), 10),
    }))
    .filter(i => Number.isInteger(i.item_id) && i.item_id > 0 && Number.isInteger(i.requested_quantity) && i.requested_quantity > 0);
  if (parsedItems.length !== items.length) {
    return res.status(400).json({ message: 'Invalid items payload – check item_id and requested_quantity' });
  }

  if (!dbConnected) return res.status(503).json({ message: 'Database not available' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const itemIds = parsedItems.map(i => i.item_id);
    const placeholders = itemIds.map(() => '?').join(',');
    const [existingItems] = await connection.query(
      `SELECT id FROM items WHERE id IN (${placeholders})`,
      itemIds
    );
    if (existingItems.length !== parsedItems.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'One or more items not found' });
    }

    const [taskResult] = await connection.query(
      `INSERT INTO tasks (name, type, source_id, assigned_user, status, priority, deadline, created_at, updated_at)
       VALUES (?, ?, 'SIMULATOR', NULL, 'pending', ?, NULL, NOW(), NOW())`,
      [name.trim(), type, parsedPriority]
    );
    const taskId = Number(taskResult.insertId);

    for (const item of parsedItems) {
      await connection.query(
        `INSERT INTO task_items (task_id, item_id, requested_quantity, picked_quantity, status)
         VALUES (?, ?, ?, 0, 'pending')`,
        [taskId, item.item_id, item.requested_quantity]
      );
    }

    await connection.commit();

    const [taskRows] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    const [taskItemRows] = await db.query(
      `SELECT ti.task_id, ti.item_id, ti.requested_quantity, ti.picked_quantity, ti.status,
              i.name AS item_name, i.barcode
       FROM task_items ti
       JOIN items i ON i.id = ti.item_id
       WHERE ti.task_id = ?
       ORDER BY ti.id ASC`,
      [taskId]
    );

    return res.status(201).json({ task: taskRows[0], items: taskItemRows });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error spawning simulator task:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
});

// POST /simulator/nuke — hard-delete all FAKER-tagged test data
app.post('/simulator/nuke', authenticateJWT, requireAdmin, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Task items belonging to [FAKER] tasks
    await connection.query(
      `DELETE ti FROM task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
       WHERE t.name LIKE '[FAKER]%'`
    );
    // 2. [FAKER] tasks
    const [taskResult] = await connection.query(
      `DELETE FROM tasks WHERE name LIKE '[FAKER]%'`
    );
    // 3. Task items still referencing FAKER_ items (orphaned by non-faker tasks)
    await connection.query(
      `DELETE ti FROM task_items ti
       INNER JOIN items i ON i.id = ti.item_id
       WHERE i.barcode LIKE ?`,
      ['FAKER\\_%']
    );
    // 4. FAKER_ items
    const [itemResult] = await connection.query(
      `DELETE FROM items WHERE barcode LIKE ?`,
      ['FAKER\\_%']
    );
    // 5. [FAKER] damage reports
    const [reportResult] = await connection.query(
      `DELETE FROM damage_reports WHERE description LIKE '[FAKER]%'`
    );

    await connection.commit();
    return res.json({
      message: 'Test data nuked successfully',
      deleted: {
        tasks: taskResult.affectedRows,
        items: itemResult.affectedRows,
        damageReports: reportResult.affectedRows,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error nuking test data:', err.message);
    return res.status(500).json({ message: 'Database error' });
  } finally {
    connection.release();
  }
});

// POST /simulator/delay — enable/disable global API response delay
app.post('/simulator/delay', authenticateJWT, requireAdmin, (req, res) => {
  const { enabled, ms } = req.body;
  simulatorDelay.enabled = Boolean(enabled);
  const parsedMs = Number.parseInt(String(ms), 10);
  if (Number.isInteger(parsedMs) && parsedMs > 0 && parsedMs <= 30000) {
    simulatorDelay.ms = parsedMs;
  }
  console.log(`🔧 Simulator delay: ${simulatorDelay.enabled ? `ACTIVE (${simulatorDelay.ms}ms)` : 'DISABLED'}`);
  res.json({ delay: simulatorDelay });
});

// POST /simulator/block-user — add/remove a user from the blocked set (forces 401)
app.post('/simulator/block-user', authenticateJWT, requireAdmin, (req, res) => {
  const { email, blocked } = req.body;
  if (!isValidEmail(String(email || ''))) {
    return res.status(400).json({ message: 'Invalid email' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  if (blocked) {
    blockedUsers.add(normalizedEmail);
    console.log(`🚫 Simulator: blocked ${normalizedEmail}`);
  } else {
    blockedUsers.delete(normalizedEmail);
    console.log(`✅ Simulator: unblocked ${normalizedEmail}`);
  }
  res.json({
    email: normalizedEmail,
    blocked: blockedUsers.has(normalizedEmail),
    blockedUsers: [...blockedUsers],
  });
});

const PORT = process.env.PORT || 4000;
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, BIND_HOST, () => {
    console.log(`✅ Server running on ${BIND_HOST}:${PORT}`);
  });
}

module.exports = app;
