const db = require('./db');

function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
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

  return Boolean(value);
}

function mapWarehouseLocation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    row_num: Number(row.row_num),
    col_num: Number(row.col_num),
    shelf_level: Number(row.shelf_level ?? 0),
    is_xl: normalizeBooleanFlag(row.is_xl),
    location_code: row.location_code ?? '',
    is_active: normalizeBooleanFlag(row.is_active),
  };
}

function getRouteLocation(item) {
  return item?.location ?? item?.item?.location ?? null;
}

function compareBySerpentineRoute(left, right) {
  const leftLocation = getRouteLocation(left);
  const rightLocation = getRouteLocation(right);

  if (!leftLocation && !rightLocation) {
    return 0;
  }

  if (!leftLocation) {
    return 1;
  }

  if (!rightLocation) {
    return -1;
  }

  if (leftLocation.row_num !== rightLocation.row_num) {
    return leftLocation.row_num - rightLocation.row_num;
  }

  if (leftLocation.row_num % 2 !== 0) {
    if (leftLocation.col_num !== rightLocation.col_num) {
      return leftLocation.col_num - rightLocation.col_num;
    }
  } else if (leftLocation.col_num !== rightLocation.col_num) {
    return rightLocation.col_num - leftLocation.col_num;
  }

  return leftLocation.shelf_level - rightLocation.shelf_level;
}

function sortItemsBySerpentineRoute(items) {
  return [...items].sort(compareBySerpentineRoute);
}

async function allocatePutawayLocation(itemId, isXl, queryable = db) {
  const normalizedIsXl = normalizeBooleanFlag(isXl) ? 1 : 0;

  // Strategy 1: Consolidation — find the location that already holds this item
  const [consolidationRows] = await queryable.query(
    `SELECT DISTINCT
        l.id,
        l.row_num,
        l.col_num,
        l.shelf_level,
        l.is_xl,
        l.location_code,
        l.is_active
      FROM items i
      INNER JOIN locations l ON l.id = i.location_id
      WHERE i.id = ?
        AND COALESCE(i.quantity, 0) > 0
        AND l.is_active = 1
        AND l.is_xl = ?
      LIMIT 1`,
    [itemId, normalizedIsXl]
  );

  if (consolidationRows.length > 0) {
    return mapWarehouseLocation(consolidationRows[0]);
  }

  // Strategy 2: Find an empty active location (no items with stock assigned to it)
  const [emptyLocationRows] = await queryable.query(
    `SELECT
        l.id,
        l.row_num,
        l.col_num,
        l.shelf_level,
        l.is_xl,
        l.location_code,
        l.is_active
      FROM locations l
      LEFT JOIN items i ON i.location_id = l.id AND COALESCE(i.quantity, 0) > 0
      WHERE l.is_active = 1
        AND l.is_xl = ?
        AND i.id IS NULL
      ORDER BY l.row_num ASC, l.col_num ASC, l.shelf_level ASC
      LIMIT 1`,
    [normalizedIsXl]
  );

  if (emptyLocationRows.length === 0) {
    return null;
  }

  return mapWarehouseLocation(emptyLocationRows[0]);
}

module.exports = {
  allocatePutawayLocation,
  mapWarehouseLocation,
  normalizeBooleanFlag,
  sortItemsBySerpentineRoute,
};
