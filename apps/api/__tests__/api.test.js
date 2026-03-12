/**
 * Simple integration tests for the API.
 * The MySQL db module is mocked so no real database connection is needed.
 */

process.env.JWT_SECRET = 'test-secret';

// Mock the db module before requiring the app
jest.mock('../db', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../db');
const app = require('../index');

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}) {
  return jwt.sign(
    { email: 'test@example.com', userId: '1', role: 'Admin', ...payload },
    'test-secret',
    { expiresIn: '1h' }
  );
}

const adminToken = makeToken({ role: 'Admin' });
const workerToken = makeToken({ role: 'Worker' });

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();

  // Default: schema-check queries return no columns (keeps schema guards passing)
  db.query.mockResolvedValue([[{ 1: 1 }], []]);
});

// ─── POST /login ───────────────────────────────────────────────────────────────

describe('POST /login', () => {
  test('400 when email is missing', async () => {
    const res = await request(app).post('/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email required');
  });

  test('400 when email format is invalid', async () => {
    const res = await request(app).post('/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email format');
  });

  test('403 when user is not found in database', async () => {
    // First call: SELECT 1 (DB health check already done at startup, but login does its own query)
    db.query.mockResolvedValueOnce([[/* empty */], []]);
    const res = await request(app).post('/login').send({ email: 'unknown@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  test('200 and returns token for known user', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []]);
    const res = await request(app).post('/login').send({ email: 'admin@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('Admin');
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

describe('GET /me', () => {
  test('401 when no token provided', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  test('200 returns user from token', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', 'test@example.com');
  });
});

// ─── GET /items ───────────────────────────────────────────────────────────────

describe('GET /items', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(401);
  });

  test('200 returns array of items', async () => {
    // schema capability checks + actual SELECT
    db.query.mockResolvedValue([[{ id: 1, barcode: 'BC001', name: 'Widget' }], []]);
    const res = await request(app).get('/items').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── POST /items ──────────────────────────────────────────────────────────────

describe('POST /items', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/items').send({ barcode: 'X', name: 'Y' });
    expect(res.status).toBe(401);
  });

  test('403 for non-admin user', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ barcode: 'X', name: 'Y' });
    expect(res.status).toBe(403);
  });

  test('400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /users ───────────────────────────────────────────────────────────────

describe('GET /users', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  test('200 returns array of users', async () => {
    db.query.mockResolvedValue([[{ id: 1, email: 'admin@example.com', role: 'Admin', isActive: 1 }], []]);
    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /categories ──────────────────────────────────────────────────────────

describe('GET /categories', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(401);
  });

  test('200 returns array', async () => {
    db.query.mockResolvedValue([[{ id: 1, name: 'Electronics', description: null }], []]);
    const res = await request(app).get('/categories').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /locations ───────────────────────────────────────────────────────────

describe('GET /locations', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/locations');
    expect(res.status).toBe(401);
  });

  test('200 returns array', async () => {
    db.query.mockResolvedValue([[{ id: 1, name: 'A-01', location_code: 'A01' }], []]);
    const res = await request(app).get('/locations').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /tasks ───────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
  });

  test('200 returns array', async () => {
    db.query.mockResolvedValue([[{ id: 1, status: 'open' }], []]);
    const res = await request(app).get('/tasks').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── POST /damage-reports ─────────────────────────────────────────────────────

describe('POST /damage-reports', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/damage-reports').send({ description: 'broken' });
    expect(res.status).toBe(401);
  });

  test('400 when description is missing', async () => {
    const res = await request(app)
      .post('/damage-reports')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('201 when valid damage report is submitted', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 42 }, []]);
    const res = await request(app)
      .post('/damage-reports')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ description: 'Shelf collapsed', item_barcode: 'BC001', item_name: 'Widget' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
