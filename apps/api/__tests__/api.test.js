/**
 * Simple integration tests for the API.
 * The MySQL db module is mocked so no real database connection is needed.
 */

process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue([[{ id: 1, email: 'test@example.com', role: 'admin' }], []]),
  getConnection: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../db');
const app = require('../index');
const { schemaCaches } = require('../index');
const { taskSchemaCache } = require('../tasks');
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

const adminToken = makeToken({ email: 'admin@example.com', role: 'Admin' });
const workerToken = makeToken({ email: 'worker@example.com', role: 'Worker' });
const supervisorToken = makeToken({ email: 'supervisor@example.com', role: 'Supervisor' });

const defaultQueryMock = jest.fn().mockImplementation(async (_sql, params) => {
  const email = params?.[0] && typeof params[0] === 'string' ? params[0].toLowerCase() : null;
  if (email === 'admin@example.com') return [[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []];
  if (email === 'worker@example.com') return [[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []];
  if (email === 'supervisor@example.com') return [[{ id: 1, email: 'supervisor@example.com', role: 'Supervisor' }], []];
  if (email === 'unrelated-worker@example.com') return [[{ id: 99, email: 'unrelated-worker@example.com', role: 'Worker' }], []];
  return [[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []];
});

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockImplementation(defaultQueryMock);
  db.getConnection.mockReset();
  // Reset schema caches so each test starts with a clean slate
  if (schemaCaches) {
    Object.values(schemaCaches).forEach((cache) => { cache.value = null; });
  }
  if (taskSchemaCache) {
    taskSchemaCache.userIsActiveSelectExpr = null;
  }
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
    expect(res.body.user).toHaveProperty('email', 'admin@example.com');
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

describe('Rentals flow', () => {
  test('POST /rentals requires auth', async () => {
    const res = await request(app).post('/rentals').send({ itemId: 1, quantity: 1 });
    expect(res.status).toBe(401);
  });

  test('Worker can create a pending rental request', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])
      .mockResolvedValueOnce([{ insertId: 10 }, []])
      .mockResolvedValueOnce([[{
        id: 10,
        status: 'pending',
        requester_email: 'test@example.com',
        item_id: 1,
        quantity: 2,
        purpose: 'Need it',
        item_name: 'Widget',
        item_barcode: 'BC001',
        reviewer_email: null,
        review_note: null,
        reviewed_at: null,
        approved_at: null,
        returned_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }], []]);

    const res = await request(app)
      .post('/rentals')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ itemId: 1, quantity: 2, purpose: 'Need it' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 10,
      status: 'pending',
      itemId: 1,
      quantity: 2,
    });
  });

  test('Worker cannot approve rental', async () => {
    const res = await request(app)
      .post('/rentals/10/approve')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ note: 'ok' });

    expect(res.status).toBe(403);
  });

  test('Admin can approve pending rental and deduct stock', async () => {
    const connection = createMockConnection([
      [[{ id: 10, item_id: 1, quantity: 2, status: 'pending' }], []],
      [[{ id: 1, quantity: 5 }], []],
      [[], []],
      [[], []],
      [[], []],
    ]);
    db.getConnection.mockResolvedValue(connection);

    const res = await request(app)
      .post('/rentals/10/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Approved' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10, status: 'approved' });
    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalled();
  });

  test('Supervisor cannot delete returned rental', async () => {
    const res = await request(app)
      .delete('/rentals/10')
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(res.status).toBe(403);
  });

  test('Admin cannot delete non-returned rental', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'approved' }], []]);

    const res = await request(app)
      .delete('/rentals/10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only returned rentals can be deleted/i);
  });

  test('Admin can delete returned rental', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'test@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'returned' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .delete('/rentals/10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10, deleted: true });
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
    // tasks.js getUserIsActiveSelectExpr fires 2 schema probes before the actual SELECT
    db.query.mockResolvedValueOnce([[{ id: 1 }], []]);  // is_active probe
    db.query.mockResolvedValueOnce([[{ id: 1 }], []]);  // isActive probe
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
    const unrelatedToken = makeToken({ email: 'unrelated-worker@example.com', userId: '99', role: 'Worker' });

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
      [[{ id: 10, requested_quantity: 5, picked_quantity: 0, assigned_user: 1, assigned_email: 'worker@example.com' }], []],
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

// ─── Rentals — additional coverage ────────────────────────────────────────────

describe('GET /rentals (all)', () => {
  test('403 for worker', async () => {
    const res = await request(app).get('/rentals').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 for supervisor', async () => {
    db.query.mockResolvedValue([[{ id: 1, email: 'supervisor@example.com', role: 'Supervisor' }], []]);
    const res = await request(app).get('/rentals').set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('200 for admin', async () => {
    db.query.mockResolvedValue([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []]);
    const res = await request(app).get('/rentals').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /rentals/pending', () => {
  test('403 for worker', async () => {
    const res = await request(app).get('/rentals/pending').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 for admin returns array', async () => {
    db.query.mockResolvedValue([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []]);
    const res = await request(app).get('/rentals/pending').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /rentals/:id/cancel', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/rentals/10/cancel');
    expect(res.status).toBe(401);
  });

  test('404 when rental not found', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .post('/rentals/999/cancel')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(404);
  });

  test('409 when rental is not pending', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'approved', requester_user_id: 1, requester_email: 'worker@example.com' }], []]);
    const res = await request(app)
      .post('/rentals/10/cancel')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(409);
  });

  test('200 requester can cancel own pending rental', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'pending', requester_user_id: 1, requester_email: 'worker@example.com' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .post('/rentals/10/cancel')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10, status: 'cancelled' });
  });

  test('403 when different worker tries to cancel', async () => {
    const otherToken = makeToken({ email: 'other@example.com', userId: '99', role: 'Worker' });
    db.query
      .mockResolvedValueOnce([[{ id: 99, email: 'other@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'pending', requester_user_id: 1, requester_email: 'worker@example.com' }], []]);
    const res = await request(app)
      .post('/rentals/10/cancel')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /rentals/:id/reject', () => {
  test('200 admin can reject pending rental', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 10, status: 'pending' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 10, status: 'rejected', item_id: 1, quantity: 2, requester_email: 'worker@example.com', item_name: null, item_barcode: null, reviewer_email: null, review_note: null, reviewed_at: null, approved_at: null, returned_at: null, created_at: null, updated_at: null }], []]);
    const res = await request(app)
      .post('/rentals/10/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Out of stock' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10, status: 'rejected' });
  });
});

describe('POST /rentals/:id/return', () => {
  test('200 requester can return approved rental', async () => {
    const connection = createMockConnection([
      [[{ id: 10, item_id: 1, quantity: 2, status: 'approved', requester_user_id: 1, requester_email: 'worker@example.com' }], []],
      [[{ id: 1, quantity: 5 }], []],  // item fetch
      [{ affectedRows: 1 }, []],        // update item quantity
      [{ affectedRows: 1 }, []],        // insert inventory_log
      [{ affectedRows: 1 }, []],        // update rental status
    ]);
    db.getConnection.mockResolvedValueOnce(connection);
    const res = await request(app)
      .post('/rentals/10/return')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(connection.commit).toHaveBeenCalled();
  });
});

// ─── Users CRUD ────────────────────────────────────────────────────────────

describe('POST /users', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ email: 'new@example.com' });
    expect(res.status).toBe(403);
  });

  test('400 for invalid email', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('200 admin can create user', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      // 3 schema probe calls handled by defaultQueryMock fallback
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])  // probe 1
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])  // probe 2
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])  // probe 3
      .mockResolvedValueOnce([{ insertId: 5 }, []])
      .mockResolvedValueOnce([[{ id: 5, email: 'new@example.com', role: 'Worker', isActive: 1 }], []]);
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'new@example.com', role: 'worker' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 5);
  });
});

describe('PUT /users/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/users/1')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ email: 'x@example.com', role: 'worker' });
    expect(res.status).toBe(403);
  });

  test('400 for invalid email', async () => {
    const res = await request(app)
      .put('/users/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'bad', role: 'worker' });
    expect(res.status).toBe(400);
  });

  test('200 admin can update user', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      // 3 probes for getUsersSchemaCapabilities
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      // 3 probes again for SELECT (cache was populated but SELECT also calls getUsersSchemaCapabilities)
      .mockResolvedValueOnce([[{ id: 2, email: 'updated@example.com', role: 'Worker', isActive: 1 }], []]);
    const res = await request(app)
      .put('/users/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'updated@example.com', role: 'worker', isActive: true });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'updated@example.com');
  });
});

describe('DELETE /users/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .delete('/users/1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 admin can delete user', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .delete('/users/5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

// ─── Categories CRUD ───────────────────────────────────────────────────────

describe('POST /categories', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  test('400 when name is missing', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('200 admin can create category', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      // getCategoriesSchemaCapabilities: 3 parallel tableHasColumn calls
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_description
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_size_class
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_min_stock_level
      .mockResolvedValueOnce([{ insertId: 3 }, []])
      .mockResolvedValueOnce([[{ id: 3, name: 'Power Tools', description: null }], []]);
    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Power Tools' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 3);
    expect(res.body).toHaveProperty('name', 'Power Tools');
  });
});

describe('PUT /categories/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/categories/1')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  test('200 admin can update category', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_description
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_size_class
      .mockResolvedValueOnce([[{ id: 1 }], []])  // probe has_min_stock_level
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 1, name: 'Hand Tools Updated', description: null }], []]);
    const res = await request(app)
      .put('/categories/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hand Tools Updated' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Hand Tools Updated');
  });
});

describe('DELETE /categories/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .delete('/categories/1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 admin can delete category', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .delete('/categories/1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── Locations additional coverage ────────────────────────────────────────

describe('GET /locations/position', () => {
  test('400 when row_num missing', async () => {
    const res = await request(app)
      .get('/locations/position?col_num=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('200 returns matching locations', async () => {
    db.query.mockResolvedValue([[{ id: 1, row_num: 1, col_num: 1, shelf_level: 1, is_xl: 0, is_active: 1 }], []]);
    const res = await request(app)
      .get('/locations/position?row_num=1&col_num=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /locations/position/rack', () => {
  test('400 when row_num missing', async () => {
    const res = await request(app)
      .get('/locations/position/rack?col_num=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('200 returns rack with items', async () => {
    db.query.mockResolvedValue([[{ id: 1, row_num: 1, col_num: 1, shelf_level: 1, is_xl: 0, is_active: 1, name: 'R1-C1', description: null, location_code: 'R1-C1-S1', item_id: null, item_name: null, barcode: null, item_quantity: null }], []]);
    const res = await request(app)
      .get('/locations/position/rack?row_num=1&col_num=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PUT /locations/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/locations/1')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ row_num: 1, col_num: 1 });
    expect(res.status).toBe(403);
  });

  test('400 PUT /locations/:id requires name', async () => {
    const res = await request(app)
      .put('/locations/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ row_num: 2, col_num: 1 });  // missing name
    expect(res.status).toBe(400);
  });
});

describe('DELETE /locations/:id', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .delete('/locations/1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 admin can delete location', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[], []])   // schema probe
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .delete('/locations/1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── Tasks — admin CRUD ────────────────────────────────────────────────────

describe('POST /tasks (admin create)', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'T1', type: 'picking', priority: 2 });
    // workerToken auth calls db.query so set up a mock for it
    expect(res.status).toBe(403);
  });

  test('400 for missing name', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'picking', priority: 2 });
    expect(res.status).toBe(400);
  });

  test('400 for invalid type', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'T1', type: 'invalid', priority: 2 });
    expect(res.status).toBe(400);
  });

  test('400 for priority out of range', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'T1', type: 'picking', priority: 9 });
    expect(res.status).toBe(400);
  });

  test('201 admin can create a task', async () => {
    // Auth (db.query) → getConnection for INSERT → tasks.js getUserIsActiveSelectExpr (2 probes) → db.query SELECT
    const taskRow = {
      task_id: 20, task_name: 'New Task', task_type: 'picking', task_source_id: null,
      task_assigned_user: null, task_status: 'pending', task_priority: 2,
      task_deadline: null, task_updated_at: null, task_created_at: null,
      user_id: null, user_email: null, user_role: null, user_is_active: null, user_last_login: null,
      task_item_id: null, task_item_task_id: null, requested_quantity: null, picked_quantity: null,
      task_item_status: null, item_id: null, item_name: null, barcode: null, description: null,
      item_quantity: null, category_id: null, category_name: null, category_size_class: null,
      category_min_stock_level: null, location_id: null, location_row_num: null, location_col_num: null,
      location_shelf_level: null, location_is_xl: null, location_code: null, location_is_active: null,
    };
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])  // auth
      .mockResolvedValueOnce([[{ id: 1 }], []])   // getUserIsActiveSelectExpr probe is_active
      .mockResolvedValueOnce([[{ id: 1 }], []])   // getUserIsActiveSelectExpr probe isActive
      .mockResolvedValueOnce([[taskRow], []]);      // getTaskByIdForUser select

    const connection = createMockConnection([
      [{ insertId: 20 }, []],  // INSERT task
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Task', type: 'picking', priority: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 20, name: 'New Task', type: 'picking' });
  });
});

describe('PUT /tasks/:id (admin update)', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/tasks/1')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  test('400 for no fields to update', async () => {
    const res = await request(app)
      .put('/tasks/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('200 admin can update task name', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 1 }], []])   // getUserIsActiveSelectExpr probe is_active
      .mockResolvedValueOnce([[{ id: 1 }], []])   // getUserIsActiveSelectExpr probe isActive
      .mockResolvedValueOnce([[{
        task_id: 1, task_name: 'Updated Name', task_type: 'picking', task_source_id: null,
        task_assigned_user: null, task_status: 'pending', task_priority: 2,
        task_deadline: null, task_updated_at: null, task_created_at: null,
        user_id: null, user_email: null, user_role: null, user_is_active: null, user_last_login: null,
        task_item_id: null, task_item_task_id: null, requested_quantity: null, picked_quantity: null,
        task_item_status: null, item_id: null, item_name: null, barcode: null, description: null,
        item_quantity: null, category_id: null, category_name: null, category_size_class: null,
        category_min_stock_level: null, location_id: null, location_row_num: null, location_col_num: null,
        location_shelf_level: null, location_is_xl: null, location_code: null, location_is_active: null,
      }], []]);
    const res = await request(app)
      .put('/tasks/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Updated Name' });
  });
});

describe('DELETE /tasks/:id (admin delete)', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .delete('/tasks/1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('404 when task does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    const res = await request(app)
      .delete('/tasks/999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('200 admin can delete task', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .delete('/tasks/5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: expect.stringMatching(/deleted/i), taskId: 5 });
  });
});

// ─── Task item exception ───────────────────────────────────────────────────

describe('POST /api/tasks/:taskId/items/:itemId/exception', () => {
  test('400 when missing required fields', async () => {
    const res = await request(app)
      .post('/api/tasks/1/items/1/exception')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('400 for invalid reason', async () => {
    const res = await request(app)
      .post('/api/tasks/1/items/1/exception')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ locationId: 1, pickedQuantity: 2, missingQuantity: 1, reason: 'unknown' });
    expect(res.status).toBe(400);
  });

  test('404 when task item does not exist', async () => {
    const connection = createMockConnection([
      [[], []],
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/api/tasks/1/items/999/exception')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ locationId: 3, pickedQuantity: 0, missingQuantity: 2, reason: 'shortage' });
    expect(res.status).toBe(404);
  });
});

// ─── Task accept-shortage ─────────────────────────────────────────────────

describe('PUT /tasks/:taskId/items/:itemId/accept-shortage', () => {
  test('403 for worker', async () => {
    const res = await request(app)
      .put('/tasks/1/items/1/accept-shortage')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('404 when task item not found', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'supervisor@example.com', role: 'Supervisor' }], []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    const res = await request(app)
      .put('/tasks/1/items/999/accept-shortage')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(404);
  });

  test('200 supervisor can accept shortage', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'supervisor@example.com', role: 'Supervisor' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ total: 2, done: 1 }], []]);
    const res = await request(app)
      .put('/tasks/1/items/1/accept-shortage')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taskId: 1, itemId: 1 });
  });
});

// ─── Material Requests ────────────────────────────────────────────────────

describe('POST /material-requests', () => {
  test('401 without token', async () => {
    const res = await request(app)
      .post('/material-requests')
      .send({ line: 'LINE-A', items: [{ itemId: 1, quantity: 2 }] });
    expect(res.status).toBe(401);
  });

  test('400 when line is missing', async () => {
    const res = await request(app)
      .post('/material-requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ items: [{ itemId: 1, quantity: 2 }] });
    expect(res.status).toBe(400);
  });

  test('400 when items array is empty', async () => {
    const res = await request(app)
      .post('/material-requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ line: 'LINE-A', items: [] });
    expect(res.status).toBe(400);
  });

  test('201 creates material request', async () => {
    // Auth db.query + tasks schema probe (db.query) + getConnection for transaction
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[], []]);  // getTasksSchemaCapabilities probe

    const connection = createMockConnection([
      [[{ id: 1 }], []],    // items exist check
      [{ insertId: 7 }, []], // insert task
      [[], []],              // insert task_item
    ]);
    db.getConnection.mockResolvedValueOnce(connection);

    const res = await request(app)
      .post('/material-requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ line: 'LINE-A', items: [{ itemId: 1, quantity: 3 }], priority: 'normal' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 7, line: 'LINE-A', status: 'pending' });
  });
});

describe('GET /material-requests', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/material-requests');
    expect(res.status).toBe(401);
  });

  test('200 returns array', async () => {
    // Auth query + getTasksSchemaCapabilities (1 probe) + list query
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])   // getTasksSchemaCapabilities probe
      .mockResolvedValueOnce([[], []]);            // tasks list (empty)
    const res = await request(app)
      .get('/material-requests?line=LINE-A')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /material-requests/all', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .get('/material-requests/all')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 admin gets all material requests', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])  // schema probe
      .mockResolvedValueOnce([[], []]);           // tasks list
    const res = await request(app)
      .get('/material-requests/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /material-requests/metrics', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .get('/material-requests/metrics')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 admin gets metrics', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ active: 3, urgent: 1 }], []]);
    const res = await request(app)
      .get('/material-requests/metrics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /material-requests/:requestId', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/material-requests/1');
    expect(res.status).toBe(401);
  });

  test('404 when request does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])  // schema probe
      .mockResolvedValueOnce([[], []]);           // empty task rows
    const res = await request(app)
      .get('/material-requests/999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /material-requests/:requestId/assign', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/material-requests/1/assign')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ userId: 2 });
    expect(res.status).toBe(403);
  });

  test('404 when request not found', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])         // schema probe
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // update returns 0 rows
    const res = await request(app)
      .put('/material-requests/999/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedUserId: null });
    expect(res.status).toBe(404);
  });
});

describe('PUT /material-requests/:requestId/status', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .put('/material-requests/1/status')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(403);
  });

  test('400 for invalid status', async () => {
    const res = await request(app)
      .put('/material-requests/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
  });
});

describe('POST /material-requests/:requestId/cancel', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/material-requests/1/cancel');
    expect(res.status).toBe(401);
  });

  test('404 when request not found', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'worker@example.com', role: 'Worker' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])  // schema probe
      .mockResolvedValueOnce([[], []]);            // empty task rows → 404
    const res = await request(app)
      .post('/material-requests/999/cancel')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /material-requests/:requestId', () => {
  test('403 for non-admin', async () => {
    const res = await request(app)
      .delete('/material-requests/1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('404 when request does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []])        // schema probe
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // delete returns 0
    const res = await request(app)
      .delete('/material-requests/999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Damage Reports GET + review ──────────────────────────────────────────

describe('GET /damage-reports', () => {
  test('403 for worker', async () => {
    const res = await request(app)
      .get('/damage-reports')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('200 supervisor gets all damage reports', async () => {
    db.query.mockResolvedValue([[{ id: 1, email: 'supervisor@example.com', role: 'Supervisor' }], []]);
    const res = await request(app)
      .get('/damage-reports')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PUT /damage-reports/:id/status', () => {
  test('403 for worker', async () => {
    const res = await request(app)
      .put('/damage-reports/1/status')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  test('400 for invalid status', async () => {
    const res = await request(app)
      .put('/damage-reports/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
  });

  test('404 when report not found', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]);  // UPDATE returns 0 rows
    const res = await request(app)
      .put('/damage-reports/999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
  });

  test('200 admin can approve damage report', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 5, status: 'approved', description: 'broken', reported_by: 2, reviewed_by: 1, review_note: 'Confirmed', created_at: null, updated_at: null }], []]);
    const res = await request(app)
      .put('/damage-reports/5/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', review_note: 'Confirmed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5, status: 'approved' });
  });
});

// ─── Simulator ────────────────────────────────────────────────────────────

describe('Simulator endpoints', () => {
  test('GET /simulator/status requires Admin', async () => {
    const res = await request(app)
      .get('/simulator/status')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /simulator/status returns state for admin', async () => {
    const res = await request(app)
      .get('/simulator/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('delay');
  });

  test('POST /simulator/delay 403 for non-admin', async () => {
    const res = await request(app)
      .post('/simulator/delay')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ enabled: true, ms: 1000 });
    expect(res.status).toBe(403);
  });

  test('POST /simulator/delay 200 accepts any ms, ignores out-of-range', async () => {
    const res = await request(app)
      .post('/simulator/delay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, ms: 99999 });
    // the route ignores invalid ms, always returns 200
    expect(res.status).toBe(200);
  });

  test('POST /simulator/delay 200 sets delay', async () => {
    const res = await request(app)
      .post('/simulator/delay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, ms: 500 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ delay: { enabled: true, ms: 500 } });
  });

  test('POST /simulator/block-user 403 for non-admin', async () => {
    const res = await request(app)
      .post('/simulator/block-user')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ email: 'x@x.com', blocked: true });
    expect(res.status).toBe(403);
  });

  test('POST /simulator/block-user 400 for invalid email', async () => {
    const res = await request(app)
      .post('/simulator/block-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-valid', blocked: true });
    expect(res.status).toBe(400);
  });

  test('POST /simulator/block-user 200 blocks user', async () => {
    const res = await request(app)
      .post('/simulator/block-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'target@example.com', blocked: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'target@example.com', blocked: true });
  });

  test('POST /simulator/nuke 403 for non-admin', async () => {
    const res = await request(app)
      .post('/simulator/nuke')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('POST /simulator/nuke 200 for admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'admin@example.com', role: 'Admin' }], []]);
    const connection = createMockConnection([
      [{ affectedRows: 0 }, []],  // delete tasks
      [{ affectedRows: 0 }, []],  // delete items
      [{ affectedRows: 0 }, []],  // delete damage_reports
    ]);
    db.getConnection.mockResolvedValueOnce(connection);
    const res = await request(app)
      .post('/simulator/nuke')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /simulator/spawn-task 400 when items missing', async () => {
    const res = await request(app)
      .post('/simulator/spawn-task')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '[FAKER] Test', type: 'picking', priority: 2 });
    expect(res.status).toBe(400);
  });
});

