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
      const [rows] = await db.query(`
        SELECT
          items.id,
          items.name,
          items.barcode,
          items.description,
          items.quantity,
          categories.name AS category,
          locations.name AS location
        FROM items
        LEFT JOIN categories ON items.category_id = categories.id
        LEFT JOIN locations ON items.location_id = locations.id
      `);
      res.json(rows);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Database error getting items:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});


app.post('/items', authenticateJWT, async (req, res) => {
  const { name, barcode, description, quantity, category_id, location_id } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid item name' });
  }

  try {
    if (dbConnected) {
      const [result] = await db.query(
        'INSERT INTO items (name, barcode, description, quantity, category_id, location_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, barcode, description, parseInt(quantity), category_id, location_id]
      );

      // Get the newly created item with category and location names
      const [rows] = await db.query(`
        SELECT
          items.id,
          items.name,
          items.barcode,
          items.description,
          items.quantity,
          items.category_id,
          items.location_id,
          categories.name AS category,
          locations.name AS location
        FROM items
        LEFT JOIN categories ON items.category_id = categories.id
        LEFT JOIN locations ON items.location_id = locations.id
        WHERE items.id = ?
      `, [result.insertId]);

      res.json(rows[0]);
    } else {
      res.status(503).json({ message: 'Database not available' });
    }
  } catch (err) {
    console.error('❌ Database error creating item:', err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

app.put('/items/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { name, barcode, description, quantity, category_id, location_id } = req.body;

  if (!isValidString(name, 255)) {
    return res.status(400).json({ message: 'Invalid item name' });
  }

  try {
    await db.query(
      `UPDATE items
       SET name=?, barcode=?, description=?, quantity=?, category_id=?, location_id=?
       WHERE id=?`,
      [name, barcode, description, quantity, category_id, location_id, id]
    );

    // Get the updated item with category and location names
    const [rows] = await db.query(`
      SELECT
        items.id,
        items.name,
        items.barcode,
        items.description,
        items.quantity,
        items.category_id,
        items.location_id,
        categories.name AS category,
        locations.name AS location
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      LEFT JOIN locations ON items.location_id = locations.id
      WHERE items.id = ?
    `, [id]);

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
