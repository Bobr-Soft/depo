'use strict';

/**
 * OpenAPI 3.0 specification for the Depo Warehouse API.
 * Served at GET /api/docs via swagger-ui-express.
 */

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Depo Warehouse API',
    version: '1.0.0',
    description:
      'REST API for the Depo warehouse management system. ' +
      'All protected endpoints require a JWT Bearer token obtained from `POST /login`.',
    contact: {
      name: 'Depo Backend',
      url: 'https://depo.htibee.hu',
    },
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Local development' },
    { url: 'https://depo.htibee.hu', description: 'Production' },
  ],

  // ─── Security ────────────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from POST /login. Include as `Authorization: Bearer <token>`.',
      },
    },

    // ─── Reusable Schemas ───────────────────────────────────────────────────
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Unauthorized' },
        },
        required: ['message'],
      },

      LoginRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'worker@example.com' },
        },
      },

      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT access token (1 h expiry)' },
          user: { $ref: '#/components/schemas/User' },
        },
      },

      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          role: { type: 'string', enum: ['Admin', 'Supervisor', 'Worker'], example: 'Admin' },
          username: { type: 'string', description: 'First name derived from email', example: 'admin' },
          isActive: { type: 'boolean', example: true },
        },
      },

      UserInput: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'newuser@example.com' },
          role: {
            type: 'string',
            enum: ['admin', 'supervisor', 'worker', 'teacher', 'operator', 'user'],
            default: 'worker',
          },
          isActive: { type: 'boolean', default: true },
        },
      },

      Item: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Wrench 12mm' },
          barcode: { type: 'string', nullable: true, example: 'BC001' },
          description: { type: 'string', nullable: true },
          quantity: { type: 'integer', example: 25 },
          category_id: { type: 'integer', nullable: true },
          location_id: { type: 'integer', nullable: true },
          category: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
        },
      },

      ItemInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255, example: 'Wrench 12mm' },
          barcode: { type: 'string', example: 'BC001' },
          description: { type: 'string' },
          quantity: { type: 'integer', minimum: 0, example: 25 },
          category_id: { type: 'integer' },
          location_id: { type: 'integer' },
        },
      },

      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Hand Tools' },
          description: { type: 'string', nullable: true },
        },
      },

      CategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255, example: 'Hand Tools' },
          description: { type: 'string' },
        },
      },

      Location: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', nullable: true, example: 'A-01-1' },
          description: { type: 'string', nullable: true },
          location_code: { type: 'string', nullable: true, example: 'R1-C1-S1' },
          row_num: { type: 'integer', nullable: true, example: 1 },
          col_num: { type: 'integer', nullable: true, example: 1 },
          shelf_level: { type: 'integer', nullable: true, example: 1 },
          is_xl: { type: 'boolean', nullable: true, example: false },
          is_active: { type: 'boolean', nullable: true, example: true },
        },
      },

      LocationInput: {
        type: 'object',
        required: ['row_num', 'col_num'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string' },
          row_num: { type: 'integer', minimum: 1 },
          col_num: { type: 'integer', minimum: 1 },
          shelf_level: { type: 'integer', minimum: 0 },
          is_xl: { type: 'boolean' },
          is_active: { type: 'boolean' },
        },
      },

      RackWithItems: {
        type: 'object',
        properties: {
          location_id: { type: 'integer' },
          location_name: { type: 'string' },
          location_description: { type: 'string' },
          row_num: { type: 'integer' },
          col_num: { type: 'integer' },
          shelf_level: { type: 'integer' },
          is_xl: { type: 'boolean' },
          is_active: { type: 'boolean' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                barcode: { type: 'string' },
                quantity: { type: 'integer' },
              },
            },
          },
        },
      },

      Rental: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected', 'returned', 'cancelled'],
            example: 'pending',
          },
          itemId: { type: 'integer', example: 1 },
          itemName: { type: 'string', nullable: true, example: 'Wrench 12mm' },
          itemBarcode: { type: 'string', nullable: true, example: 'BC001' },
          quantity: { type: 'integer', example: 2 },
          purpose: { type: 'string', nullable: true, example: 'Annual maintenance' },
          requesterEmail: { type: 'string', nullable: true },
          approvedAt: { type: 'string', format: 'date-time', nullable: true },
          returnedAt: { type: 'string', format: 'date-time', nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      RentalRequest: {
        type: 'object',
        required: ['itemId', 'quantity'],
        properties: {
          itemId: { type: 'integer', minimum: 1, example: 1 },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          purpose: { type: 'string', example: 'Annual maintenance' },
        },
      },

      ReviewNote: {
        type: 'object',
        properties: {
          note: { type: 'string', maxLength: 500, example: 'Approved — stock available' },
        },
      },

      TaskItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          task_id: { type: 'integer' },
          requested_quantity: { type: 'integer' },
          picked_quantity: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['pending', 'picked', 'partial', 'shortage_accepted'],
          },
          item: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              barcode: { type: 'string' },
              description: { type: 'string', nullable: true },
              quantity: { type: 'integer' },
              category: {
                nullable: true,
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  size_class: { type: 'string', nullable: true },
                  min_stock_level: { type: 'integer', nullable: true },
                },
              },
              location: {
                nullable: true,
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  row_num: { type: 'integer' },
                  col_num: { type: 'integer' },
                  shelf_level: { type: 'integer' },
                  is_xl: { type: 'boolean' },
                  location_code: { type: 'string' },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
      },

      Task: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Pick order #42' },
          type: { type: 'string', enum: ['picking', 'inbound', 'transfer'], example: 'picking' },
          source_id: { type: 'string', nullable: true },
          assigned_user: { type: 'integer', nullable: true },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            example: 'pending',
          },
          priority: { type: 'integer', enum: [1, 2, 3, 4], description: '1=critical, 4=low', example: 2 },
          deadline: { type: 'string', format: 'date-time', nullable: true },
          updated_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          assigned_user_data: {
            nullable: true,
            type: 'object',
            properties: {
              id: { type: 'integer' },
              email: { type: 'string' },
              role: { type: 'string' },
              is_active: { type: 'boolean' },
              last_login: { type: 'string', format: 'date-time', nullable: true },
            },
          },
          items: { type: 'array', items: { $ref: '#/components/schemas/TaskItem' } },
        },
      },

      TaskInput: {
        type: 'object',
        required: ['name', 'type', 'priority'],
        properties: {
          name: { type: 'string', maxLength: 255, example: 'Pick order #42' },
          type: { type: 'string', enum: ['picking', 'inbound', 'transfer'], example: 'picking' },
          priority: { type: 'integer', enum: [1, 2, 3, 4], example: 2 },
          deadline: { type: 'string', format: 'date-time' },
          assigned_user: { type: 'integer' },
          source_id: { type: 'string', maxLength: 255 },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['item_id', 'requested_quantity'],
              properties: {
                item_id: { type: 'integer' },
                requested_quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },

      TaskStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          },
        },
      },

      PickedUpdate: {
        type: 'object',
        required: ['pickedQuantity'],
        properties: {
          pickedQuantity: { type: 'integer', minimum: 0, example: 5 },
        },
      },

      ExceptionReport: {
        type: 'object',
        required: ['locationId', 'pickedQuantity', 'missingQuantity', 'reason'],
        properties: {
          locationId: { type: 'integer', example: 3 },
          pickedQuantity: { type: 'integer', minimum: 0, example: 3 },
          missingQuantity: { type: 'integer', minimum: 0, example: 2 },
          reason: { type: 'string', enum: ['shortage', 'damage'], example: 'shortage' },
        },
      },

      PutawayRequest: {
        type: 'object',
        required: ['itemId', 'quantity', 'isXl'],
        properties: {
          itemId: { type: 'integer', minimum: 1, example: 1 },
          quantity: { type: 'integer', minimum: 1, example: 10 },
          isXl: { type: 'boolean', example: false },
        },
      },

      PutawayResponse: {
        type: 'object',
        properties: {
          itemId: { type: 'integer' },
          quantity: { type: 'integer' },
          location_code: { type: 'string', example: 'R1-C1-S1' },
          location: { $ref: '#/components/schemas/Location' },
        },
      },

      MaterialRequestItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          itemId: { type: 'integer' },
          name: { type: 'string' },
          barcode: { type: 'string' },
          stock: { type: 'integer' },
          requestedQuantity: { type: 'integer' },
          pickedQuantity: { type: 'integer' },
          status: { type: 'string' },
        },
      },

      MaterialRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'REQ-{taskId}', example: 'REQ-7' },
          taskId: { type: 'integer' },
          name: { type: 'string', nullable: true },
          line: { type: 'string', example: 'LINE-A' },
          status: { type: 'string', enum: ['pending', 'picking', 'delivered'], example: 'pending' },
          priority: { type: 'string', enum: ['urgent', 'normal'], example: 'normal' },
          totalItems: { type: 'integer' },
          pickedItems: { type: 'integer', nullable: true },
          assignedUserId: { type: 'integer', nullable: true },
          assignedUserEmail: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            nullable: true,
            items: { $ref: '#/components/schemas/MaterialRequestItem' },
          },
        },
      },

      MaterialRequestInput: {
        type: 'object',
        required: ['line', 'items'],
        properties: {
          line: { type: 'string', maxLength: 64, example: 'LINE-A' },
          priority: { type: 'string', enum: ['urgent', 'normal'], default: 'normal' },
          deadline: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['itemId', 'quantity'],
              properties: {
                itemId: { type: 'integer', minimum: 1 },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },

      DamageReport: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          reported_by: { type: 'integer' },
          item_barcode: { type: 'string', nullable: true },
          item_name: { type: 'string', nullable: true },
          description: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          reviewed_by: { type: 'integer', nullable: true },
          review_note: { type: 'string', nullable: true },
          reporter_email: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },

      DamageReportInput: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 1000, example: 'Shelf bracket bent' },
          item_barcode: { type: 'string', maxLength: 255, example: 'BC001' },
          item_name: { type: 'string', maxLength: 255, example: 'Wrench 12mm' },
        },
      },

      DamageReportStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['approved', 'rejected'] },
          review_note: { type: 'string', maxLength: 500, example: 'Confirmed — item scrapped' },
        },
      },
    },

    // ─── Common Response Shapes ─────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: '401 — Missing or invalid JWT token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: '403 — Insufficient role / wrong owner',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: '404 — Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Conflict: {
        description: '409 — State conflict (e.g. task already assigned)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      BadRequest: {
        description: '400 — Validation error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  security: [{ BearerAuth: [] }],

  // ─── Tags ─────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Auth', description: 'Authentication & current user' },
    { name: 'Items', description: 'Inventory items' },
    { name: 'Categories', description: 'Item categories' },
    { name: 'Locations', description: 'Warehouse rack locations' },
    { name: 'Tasks', description: 'Picking / inbound / transfer tasks' },
    { name: 'Inbound', description: 'Putaway — receive incoming goods' },
    { name: 'Rentals', description: 'Equipment checkout workflow' },
    { name: 'MaterialRequests', description: 'Production-line material requests' },
    { name: 'DamageReports', description: 'Incident / damage reporting' },
    { name: 'Users', description: 'User management (admin only)' },
    { name: 'Simulator', description: 'Dev/test utilities — Admin only' },
  ],

  // ─── Paths ────────────────────────────────────────────────────────────────
  paths: {

    // ── Auth ──────────────────────────────────────────────────────────────
    '/api': {
      get: {
        tags: ['Auth'],
        summary: 'API health / index',
        security: [],
        responses: {
          200: { description: 'Server is running, returns docs index', content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, status: { type: 'string' }, message: { type: 'string' } } } } } },
        },
      },
    },

    '/login': {
      post: {
        tags: ['Auth'],
        summary: 'Obtain a JWT token (passwordless — email lookup)',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get authenticated user from token',
        responses: {
          200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Items ─────────────────────────────────────────────────────────────
    '/items': {
      get: {
        tags: ['Items'],
        summary: 'List all inventory items',
        responses: {
          200: { description: 'Array of items', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Item' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Items'],
        summary: 'Create a new item (Admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemInput' } } } },
        responses: {
          201: { description: 'Created item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/items/{id}': {
      put: {
        tags: ['Items'],
        summary: 'Update item (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemInput' } } } },
        responses: {
          200: { description: 'Updated item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Items'],
        summary: 'Delete item (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted confirmation' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Categories ────────────────────────────────────────────────────────
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories',
        responses: {
          200: { description: 'Array of categories', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create category (Admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } } },
        responses: {
          201: { description: 'Created category', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/categories/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Update category (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } } },
        responses: {
          200: { description: 'Updated category', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete category (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Locations ─────────────────────────────────────────────────────────
    '/locations': {
      get: {
        tags: ['Locations'],
        summary: 'List all warehouse locations',
        responses: {
          200: { description: 'Array of locations', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Location' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Locations'],
        summary: 'Create location (Admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationInput' } } } },
        responses: {
          201: { description: 'Created location', content: { 'application/json': { schema: { $ref: '#/components/schemas/Location' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/locations/position': {
      get: {
        tags: ['Locations'],
        summary: 'Find location by row/col/shelf coordinates',
        parameters: [
          { name: 'row_num', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'col_num', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'shelf_level', in: 'query', required: false, schema: { type: 'integer', minimum: 0 } },
        ],
        responses: {
          200: { description: 'Matching location(s)', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Location' } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/locations/position/rack': {
      get: {
        tags: ['Locations'],
        summary: 'Get full rack with grouped items at given row/col',
        parameters: [
          { name: 'row_num', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'col_num', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          200: { description: 'Rack object with items per shelf', content: { 'application/json': { schema: { $ref: '#/components/schemas/RackWithItems' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/locations/{id}': {
      put: {
        tags: ['Locations'],
        summary: 'Update location (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationInput' } } } },
        responses: {
          200: { description: 'Updated location', content: { 'application/json': { schema: { $ref: '#/components/schemas/Location' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Locations'],
        summary: 'Delete location (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Tasks ─────────────────────────────────────────────────────────────
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks for authenticated user',
        responses: {
          200: { description: 'Array of tasks', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create task (Admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: {
          201: { description: 'Created task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task details (items in serpentine order)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Task with items', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Tasks'],
        summary: 'Update task metadata (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: {
          200: { description: 'Updated task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete task (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/tasks/{taskId}/take': {
      post: {
        tags: ['Tasks'],
        summary: 'Self-assign an unassigned task',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Task assigned to caller' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    '/tasks/{taskId}/release': {
      post: {
        tags: ['Tasks'],
        summary: 'Release / unassign a task',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Task unassigned' },
          401: { $ref: '#/components/responses/Unauthorized' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    '/tasks/{taskId}/assign': {
      post: {
        tags: ['Tasks'],
        summary: 'Assign task to a specific user (Supervisor / Admin)',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                properties: { userId: { type: 'integer', example: 5 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Task assigned' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/tasks/{taskId}/status': {
      put: {
        tags: ['Tasks'],
        summary: 'Update task status',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskStatusUpdate' } } } },
        responses: {
          200: { description: 'Status updated' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/tasks/{taskId}/items/{itemId}/picked': {
      put: {
        tags: ['Tasks'],
        summary: 'Mark item as picked with quantity',
        parameters: [
          { name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PickedUpdate' } } } },
        responses: {
          200: { description: 'Picked quantity recorded' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/tasks/{taskId}/items/{itemId}/exception': {
      post: {
        tags: ['Tasks'],
        summary: 'Report shortage or damage for a task item',
        description: 'This route must be called with the `/api/` prefix. The assigned worker reports a shortage or damage.',
        parameters: [
          { name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ExceptionReport' } } } },
        responses: {
          200: { description: 'Exception recorded' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/tasks/{taskId}/items/{itemId}/accept-shortage': {
      put: {
        tags: ['Tasks'],
        summary: 'Accept item shortage (Supervisor / Admin)',
        parameters: [
          { name: 'taskId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Shortage accepted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Inbound ───────────────────────────────────────────────────────────
    '/api/inbound/putaway': {
      post: {
        tags: ['Inbound'],
        summary: 'Allocate a putaway location and add inventory',
        description:
          'Attempts to consolidate into an existing location first. Falls back to the ' +
          'first empty matching location. Returns 400 if no location is available.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PutawayRequest' } } } },
        responses: {
          201: { description: 'Putaway successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/PutawayResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Rentals ───────────────────────────────────────────────────────────
    '/rentals': {
      get: {
        tags: ['Rentals'],
        summary: 'List all rentals (Supervisor / Admin)',
        responses: {
          200: { description: 'Array of rentals', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Rental' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Rentals'],
        summary: 'Create a rental request (any authenticated user)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RentalRequest' } } } },
        responses: {
          201: { description: 'Rental created (status: pending)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Rental' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/rentals/my': {
      get: {
        tags: ['Rentals'],
        summary: "List the authenticated user's own rentals",
        responses: {
          200: { description: "User's rentals", content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Rental' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/rentals/pending': {
      get: {
        tags: ['Rentals'],
        summary: 'List pending rentals awaiting approval (Supervisor / Admin)',
        responses: {
          200: { description: 'Pending rentals', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Rental' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/rentals/{id}/approve': {
      post: {
        tags: ['Rentals'],
        summary: 'Approve a rental and deduct stock (Supervisor / Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewNote' } } } },
        responses: {
          200: { description: 'Rental approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/Rental' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    '/rentals/{id}/reject': {
      post: {
        tags: ['Rentals'],
        summary: 'Reject a rental (Supervisor / Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewNote' } } } },
        responses: {
          200: { description: 'Rental rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/Rental' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/rentals/{id}/return': {
      post: {
        tags: ['Rentals'],
        summary: 'Return approved rental (requester / admin / supervisor)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Rental returned, stock restored', content: { 'application/json': { schema: { $ref: '#/components/schemas/Rental' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    '/rentals/{id}/cancel': {
      post: {
        tags: ['Rentals'],
        summary: 'Cancel a pending rental (requester)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Rental cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Rental' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    '/rentals/{id}': {
      delete: {
        tags: ['Rentals'],
        summary: 'Delete a returned rental (Admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Material Requests ─────────────────────────────────────────────────
    '/material-requests': {
      get: {
        tags: ['MaterialRequests'],
        summary: 'List material requests for a production line',
        parameters: [
          { name: 'line', in: 'query', required: false, description: 'Filter by production line identifier', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Array of material requests', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MaterialRequest' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['MaterialRequests'],
        summary: 'Create a material request',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequestInput' } } } },
        responses: {
          201: { description: 'Created material request', content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequest' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/material-requests/metrics': {
      get: {
        tags: ['MaterialRequests'],
        summary: 'Get active/urgent counts (Admin)',
        responses: {
          200: {
            description: 'Counts of active and urgent requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    active: { type: 'integer' },
                    urgent: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/material-requests/all': {
      get: {
        tags: ['MaterialRequests'],
        summary: 'List all material requests across all lines (Admin)',
        responses: {
          200: { description: 'All material requests', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MaterialRequest' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/material-requests/{requestId}': {
      get: {
        tags: ['MaterialRequests'],
        summary: 'Get material request details',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Material request with items', content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequest' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['MaterialRequests'],
        summary: 'Edit material request items/priority/line (Admin)',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequestInput' } } } },
        responses: {
          200: { description: 'Updated material request', content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequest' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['MaterialRequests'],
        summary: 'Delete material request (Admin)',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/material-requests/{requestId}/assign': {
      put: {
        tags: ['MaterialRequests'],
        summary: 'Assign material request to a picker (Admin)',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                properties: { userId: { type: 'integer', example: 3 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Assigned', content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequest' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/material-requests/{requestId}/status': {
      put: {
        tags: ['MaterialRequests'],
        summary: 'Override material request status (Admin)',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['pending', 'picking', 'delivered'] } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/material-requests/{requestId}/cancel': {
      post: {
        tags: ['MaterialRequests'],
        summary: 'Cancel a pending material request',
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Cancelled' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Damage Reports ────────────────────────────────────────────────────
    '/damage-reports': {
      get: {
        tags: ['DamageReports'],
        summary: 'List all damage reports (Supervisor / Admin)',
        responses: {
          200: { description: 'Array of damage reports', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/DamageReport' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['DamageReports'],
        summary: 'Submit a damage report',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DamageReportInput' } } } },
        responses: {
          201: { description: 'Report submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/DamageReport' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/damage-reports/{id}/status': {
      put: {
        tags: ['DamageReports'],
        summary: 'Review damage report — approve or reject (Supervisor / Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DamageReportStatusUpdate' } } } },
        responses: {
          200: { description: 'Report reviewed', content: { 'application/json': { schema: { $ref: '#/components/schemas/DamageReport' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Users ─────────────────────────────────────────────────────────────
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users',
        responses: {
          200: { description: 'Array of users', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user (Admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' } } } },
        responses: {
          201: { description: 'Created user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/users/{id}': {
      put: {
        tags: ['Users'],
        summary: 'Update user (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' } } } },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Simulator ─────────────────────────────────────────────────────────
    '/simulator/status': {
      get: {
        tags: ['Simulator'],
        summary: 'Get simulator state (Admin)',
        responses: {
          200: {
            description: 'Current simulator state',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    delay: {
                      type: 'object',
                      properties: { enabled: { type: 'boolean' }, ms: { type: 'integer' } },
                    },
                    blockedUsers: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/simulator/spawn-task': {
      post: {
        tags: ['Simulator'],
        summary: 'Create a test task with [FAKER] prefix (Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'priority', 'items'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['picking', 'inbound', 'transfer'] },
                  priority: { type: 'integer', enum: [1, 2, 3, 4] },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        item_id: { type: 'integer' },
                        requested_quantity: { type: 'integer', minimum: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Test task created' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/simulator/nuke': {
      post: {
        tags: ['Simulator'],
        summary: 'Delete all [FAKER] test data (Admin)',
        responses: {
          200: { description: 'Test data deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/simulator/delay': {
      post: {
        tags: ['Simulator'],
        summary: 'Enable or disable global response delay (Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['enabled'],
                properties: {
                  enabled: { type: 'boolean' },
                  ms: { type: 'integer', minimum: 1, maximum: 30000, example: 2000 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Delay state updated' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    '/simulator/block-user': {
      post: {
        tags: ['Simulator'],
        summary: 'Block or unblock a user (forces 401 on auth) (Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'blocked'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'worker@example.com' },
                  blocked: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Block state updated' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
