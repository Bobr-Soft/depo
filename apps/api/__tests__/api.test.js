/**
 * Simple integration tests for the API.
 * The MySQL db module is mocked so no real database connection is needed.
 */

process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue([[{ 1: 1 }], []]),
  getConnection: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../db');
const app = require('../index');
const { allocatePutawayLocation, sortItemsBySerpentineRoute } = require('../wms');

function makeToken(payload = {}) {
  return jwt.sign(
    { email: 'test@example.com', userId: '1', role: 'Admin', ...payload },
    'test-secret',
    { expiresIn: '1h' }
  );
}

function createMockConnection(queryResults = []) {
  let queryIndex = 0;

  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn().mockImplementation(async () => {
      if (queryIndex >= queryResults.length) {
        return [[], []];
      }

      const result = queryResults[queryIndex];
      queryIndex += 1;
      return result;
    }),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
}

const adminToken = makeToken({ role: 'Admin' });
const workerToken = makeToken({ role: 'Worker' });

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockResolvedValue([[{ 1: 1 }], []]);
  db.getConnection.mockReset();
});

describe('WMS utilities', () => {
  test('sortItemsBySerpentineRoute orders odd rows ascending and even rows descending', () => {
    const sorted = sortItemsBySerpentineRoute([
      { id: 1, item: { location: { row_num: 2, col_num: 2, shelf_level: 1 } } },
      { id: 2, item: { location: { row_num: 1, col_num: 2, shelf_level: 1 } } },
      { id: 3, item: { location: { row_num: 1, col_num: 1, shelf_level: 2 } } },
      { id: 4, item: { location: { row_num: 1, col_num: 1, shelf_level: 1 } } },
      { id: 5, item: { location: { row_num: 2, col_num: 4, shelf_level: 1 } } },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([4, 3, 2, 5, 1]);
  });

  test('allocatePutawayLocation falls back to the nearest empty matching location', async () => {
    const queryable = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{
          id: 9,
          row_num: 1,
          col_num: 3,
          shelf_level: 1,
          is_xl: 0,
          location_code: 'A-03-1',
          is_active: 1,
        }], []]),
    };

    const location = await allocatePutawayLocation(42, false, queryable);

    expect(location).toMatchObject({ id: 9, location_code: 'A-03-1', is_xl: false });
    expect(queryable.query).toHaveBeenCalledTimes(2);
  });
});

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
    db.query.mockResolvedValueOnce([[], []]);
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

describe('GET /api', () => {
  test('200 returns backend landing payload', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Depo API',
      status: 'ok',
    });
    expect(res.body.docs).toMatchObject({
      login: 'POST /login',
    });
  });
});

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

describe('GET /items', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(401);
  });

  test('200 returns array of items', async () => {
    db.query.mockResolvedValue([[{ id: 1, barcode: 'BC001', name: 'Widget' }], []]);
    const res = await request(app).get('/items').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

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

describe('GET /tasks', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
  });

  test('200 returns array', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);
    db.query.mockResolvedValueOnce([[{ task_id: 1, task_name: 'Pick', task_type: 'picking', task_source_id: 'SRC', task_assigned_user: 1, task_status: 'pending', task_priority: 1, task_deadline: null, task_updated_at: null, task_created_at: null, user_id: 1, user_email: 'test@example.com', user_role: 'Admin', user_is_active: 1, user_last_login: null, task_item_id: null, task_item_task_id: null, requested_quantity: null, picked_quantity: null, task_item_status: null, item_id: null, item_name: null, barcode: null, description: null, item_quantity: null, category_id: null, category_name: null, category_size_class: null, category_min_stock_level: null, location_id: null, location_row_num: null, location_col_num: null, location_shelf_level: null, location_is_xl: null, location_code: null, location_is_active: null }], []]);
    const res = await request(app).get('/tasks').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/tasks/:id', () => {
  test('returns task items in serpentine route order', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);
    db.query.mockResolvedValueOnce([[
      {
        task_id: 7,
        task_name: 'Route test',
        task_type: 'picking',
        task_source_id: 'SRC-7',
        task_assigned_user: 1,
        task_status: 'pending',
        task_priority: 1,
        task_deadline: null,
        task_updated_at: null,
        task_created_at: null,
        user_id: 1,
        user_email: 'test@example.com',
        user_role: 'Admin',
        user_is_active: 1,
        user_last_login: null,
        task_item_id: 11,
        task_item_task_id: 7,
        requested_quantity: 1,
        picked_quantity: 0,
        task_item_status: 'pending',
        item_id: 100,
        item_name: 'Item A',
        barcode: 'A',
        description: 'A',
        item_quantity: 5,
        category_id: null,
        category_name: null,
        category_size_class: null,
        category_min_stock_level: null,
        location_id: 2,
        location_row_num: 1,
        location_col_num: 2,
        location_shelf_level: 1,
        location_is_xl: 0,
        location_code: 'R1-C2-S1',
        location_is_active: 1,
      },
      {
        task_id: 7,
        task_name: 'Route test',
        task_type: 'picking',
        task_source_id: 'SRC-7',
        task_assigned_user: 1,
        task_status: 'pending',
        task_priority: 1,
        task_deadline: null,
        task_updated_at: null,
        task_created_at: null,
        user_id: 1,
        user_email: 'test@example.com',
        user_role: 'Admin',
        user_is_active: 1,
        user_last_login: null,
        task_item_id: 12,
        task_item_task_id: 7,
        requested_quantity: 1,
        picked_quantity: 0,
        task_item_status: 'pending',
        item_id: 101,
        item_name: 'Item B',
        barcode: 'B',
        description: 'B',
        item_quantity: 5,
        category_id: null,
        category_name: null,
        category_size_class: null,
        category_min_stock_level: null,
        location_id: 1,
        location_row_num: 1,
        location_col_num: 1,
        location_shelf_level: 2,
        location_is_xl: 0,
        location_code: 'R1-C1-S2',
        location_is_active: 1,
      },
      {
        task_id: 7,
        task_name: 'Route test',
        task_type: 'picking',
        task_source_id: 'SRC-7',
        task_assigned_user: 1,
        task_status: 'pending',
        task_priority: 1,
        task_deadline: null,
        task_updated_at: null,
        task_created_at: null,
        user_id: 1,
        user_email: 'test@example.com',
        user_role: 'Admin',
        user_is_active: 1,
        user_last_login: null,
        task_item_id: 13,
        task_item_task_id: 7,
        requested_quantity: 1,
        picked_quantity: 0,
        task_item_status: 'pending',
        item_id: 102,
        item_name: 'Item C',
        barcode: 'C',
        description: 'C',
        item_quantity: 5,
        category_id: null,
        category_name: null,
        category_size_class: null,
        category_min_stock_level: null,
        location_id: 3,
        location_row_num: 1,
        location_col_num: 1,
        location_shelf_level: 1,
        location_is_xl: 0,
        location_code: 'R1-C1-S1',
        location_is_active: 1,
      },
      {
        task_id: 7,
        task_name: 'Route test',
        task_type: 'picking',
        task_source_id: 'SRC-7',
        task_assigned_user: 1,
        task_status: 'pending',
        task_priority: 1,
        task_deadline: null,
        task_updated_at: null,
        task_created_at: null,
        user_id: 1,
        user_email: 'test@example.com',
        user_role: 'Admin',
        user_is_active: 1,
        user_last_login: null,
        task_item_id: 14,
        task_item_task_id: 7,
        requested_quantity: 1,
        picked_quantity: 0,
        task_item_status: 'pending',
        item_id: 103,
        item_name: 'Item D',
        barcode: 'D',
        description: 'D',
        item_quantity: 5,
        category_id: null,
        category_name: null,
        category_size_class: null,
        category_min_stock_level: null,
        location_id: 4,
        location_row_num: 2,
        location_col_num: 4,
        location_shelf_level: 1,
        location_is_xl: 0,
        location_code: 'R2-C4-S1',
        location_is_active: 1,
      },
    ], []]);

    const res = await request(app)
      .get('/api/tasks/7')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.id)).toEqual([13, 12, 11, 14]);
  });
});

describe('POST /api/inbound/putaway', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/api/inbound/putaway').send({ itemId: 1, quantity: 3, isXl: false });
    expect(res.status).toBe(401);
  });

  test('201 allocates a consolidation location and updates inventory', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);

    const connection = createMockConnection([
      [[{ id: 1 }], []],
      [[{ id: 55, row_num: 1, col_num: 1, shelf_level: 1, is_xl: 0, location_code: 'A-01-01', is_active: 1 }], []],
      [[{ id: 9, quantity: 2 }], []],
      [{ affectedRows: 1 }, []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/api/inbound/putaway')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemId: 1, quantity: 3, isXl: false });

    expect(res.status).toBe(201);
    expect(res.body.location_code).toBe('A-01-01');
    expect(connection.commit).toHaveBeenCalled();
  });

  test('400 when no matching putaway location exists', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);

    const connection = createMockConnection([
      [[{ id: 1 }], []],
      [[], []],
      [[], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/api/inbound/putaway')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemId: 1, quantity: 3, isXl: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no putaway location/i);
    expect(connection.rollback).toHaveBeenCalled();
  });
});

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

// ─── Task Assignment Endpoints ─────────────────────────────────────────────

describe('POST /tasks/:taskId/take', () => {
  test('400 for invalid taskId', async () => {
    const res = await request(app)
      .post('/tasks/abc/take')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(400);
  });

  test('404 when task does not exist', async () => {
    const connection = createMockConnection([
      [[], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/999/take')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(404);
  });

  test('409 when task is already completed', async () => {
    const connection = createMockConnection([
      [[{ id: 1, assigned_user: null, status: 'completed' }], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/1/take')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(409);
  });

  test('200 assigns unassigned task to worker', async () => {
    const connection = createMockConnection([
      [[{ id: 1, assigned_user: null, status: 'pending' }], []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/1/take')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.assigned_user).toBe(1);
  });
});

describe('POST /tasks/:taskId/release', () => {
  test('200 releases assigned task', async () => {
    const connection = createMockConnection([
      [[{ id: 1, assigned_user: 1, status: 'in_progress' }], []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/1/release')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.assigned_user).toBeNull();
  });

  test('409 when task is already unassigned', async () => {
    const connection = createMockConnection([
      [[{ id: 1, assigned_user: null, status: 'pending' }], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/1/release')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(409);
  });
});

describe('POST /tasks/:taskId/assign', () => {
  test('403 for non-supervisor/admin user', async () => {
    const res = await request(app)
      .post('/tasks/1/assign')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ userId: 2 });
    expect(res.status).toBe(403);
  });

  test('400 with missing userId', async () => {
    const res = await request(app)
      .post('/tasks/1/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('200 assigns task to specified user', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);

    const connection = createMockConnection([
      [[{ id: 5, assigned_user: null, status: 'pending' }], []],
      [[{ id: 2 }], []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/5/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 2 });
    expect(res.status).toBe(200);
    expect(res.body.assigned_user).toBe(2);
  });

  test('404 when target user does not exist', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);

    const connection = createMockConnection([
      [[{ id: 5, assigned_user: null, status: 'pending' }], []],
      [[], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks/5/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 999 });
    expect(res.status).toBe(404);
  });
});

describe('PUT /tasks/:taskId/status', () => {
  test('400 for invalid status value', async () => {
    const res = await request(app)
      .put('/tasks/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('200 updates status for admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []]);

    const connection = createMockConnection([
      [[{ id: 1, assigned_user: 1, status: 'pending' }], []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .put('/tasks/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.previousStatus).toBe('pending');
  });

  test('403 for unrelated worker', async () => {
    const unrelatedToken = makeToken({ userId: '99', role: 'Worker' });

    const connection = createMockConnection([
      [[{ id: 1, assigned_user: 2, status: 'pending' }], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .put('/tasks/1/status')
      .set('Authorization', `Bearer ${unrelatedToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /tasks/:taskId/items/:itemId/picked', () => {
  test('400 for invalid pickedQuantity', async () => {
    const res = await request(app)
      .put('/tasks/1/items/1/picked')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ pickedQuantity: -1 });
    expect(res.status).toBe(400);
  });

  test('404 when task item does not exist', async () => {
    const connection = createMockConnection([
      [[], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .put('/tasks/1/items/999/picked')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ pickedQuantity: 5 });
    expect(res.status).toBe(404);
  });

  test('200 updates picked quantity and completes task when all items picked', async () => {
    const connection = createMockConnection([
      [[{ id: 10, requested_quantity: 5, picked_quantity: 0, assigned_user: 1, assigned_email: 'test@example.com' }], []],
      [{ affectedRows: 1 }, []],
      [{ affectedRows: 1 }, []],
      [[{ totalItems: 1, pickedItems: 1 }], []],
      [{ affectedRows: 1 }, []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .put('/tasks/1/items/100/picked')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ pickedQuantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.itemStatus).toBe('picked');
    expect(res.body.taskStatus).toBe('completed');
  });
});
