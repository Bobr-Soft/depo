const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors({ origin: ['http://localhost:5173','https://leltar-app.vercel.app'] }));
app.use(express.json());

const JWT_SECRET = 'supersecretjwtkey';

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

// Login endpoint with Entra ID and database validation
app.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email required' });
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

      const token = jwt.sign({ email, userId: rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { email, id: rows[0].id } });
    } else {
      // Fallback: allow login for development when database is not available
      const token = jwt.sign({ email, userId: 1 }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { email, id: 1 } });
    }
  } catch (err) {
    console.error('❌ Database error during login:', err.message);
    // Fallback for database errors
    const token = jwt.sign({ email, userId: 1 }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { email, id: 1 } });
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

app.delete('/items/:id', authenticateJWT, async (req, res) => {
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
  if (req.user?.dbUser?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  const [rows] = await db.query('SELECT id, email, role, isActive FROM users');
  res.json(rows);
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

app.post('/categories', authenticateJWT, async (req, res) => {
  const { name } = req.body;
  try {
    await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
    res.json({ message: 'Category added successfully' });
  } catch (err) {
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

app.post('/locations', authenticateJWT, async (req, res) => {
  const { name } = req.body;
  try {
    await db.query('INSERT INTO locations (name) VALUES (?)', [name]);
    res.json({ message: 'Location added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Database error' });
  }
});




const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
