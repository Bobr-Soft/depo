import type { WarehouseLocationApi } from "@/components/adminApi";

export type WarehouseLocation = WarehouseLocationApi;

export interface MapColumn {
  colNum: number;
  shelves: WarehouseLocation[];
}

export interface MapRow {
  rowNum: number;
  cols: MapColumn[];
}

export interface MapSummary {
  total: number;
  active: number;
  inactive: number;
  xl: number;
}

export interface MapFilters {
  query: string;
  hideInactive: boolean;
  xlOnly: boolean;
}

export const isTruthy = (value: number | boolean): boolean => Boolean(value);

export function filterLocations(locations: WarehouseLocation[], filters: MapFilters): WarehouseLocation[] {
  const normalizedQuery = (filters.query ?? "").trim().toLowerCase();

  return locations.filter((loc) => {
    if (!loc) return false;

    const isActive = isTruthy(loc.is_active);
    const isXl = isTruthy(loc.is_xl);

    if (filters.hideInactive && !isActive) return false;
    if (filters.xlOnly && !isXl) return false;
    if (!normalizedQuery) return true;

    const locationCode = typeof loc.location_code === "string" ? loc.location_code : "";
    return locationCode.toLowerCase().includes(normalizedQuery);
  });
}

export function summarizeLocations(locations: WarehouseLocation[]): MapSummary {
  let active = 0;
  let inactive = 0;
  let xl = 0;
  let total = 0;

  for (const loc of locations) {
    if (!loc) continue;

    total += 1;

    if (isTruthy(loc.is_active)) active += 1;
    else inactive += 1;

    if (isTruthy(loc.is_xl)) xl += 1;
  }

  return {
    total,
    active,
    inactive,
    xl,
  };
}

export function buildMapRows(locations: WarehouseLocation[]): MapRow[] {
  const rows: Record<number, Record<number, WarehouseLocation[]>> = {};

  for (const loc of locations) {
    if (!loc) continue;
    if (loc.row_num == null || loc.col_num == null) continue;

    if (!rows[loc.row_num]) {
      rows[loc.row_num] = {};
    }

    if (!rows[loc.row_num][loc.col_num]) {
      rows[loc.row_num][loc.col_num] = [];
    }

    rows[loc.row_num][loc.col_num].push(loc);
  }

  return Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b)
    .map((rowNum) => {
      const colsMap = rows[rowNum];
      const sortedCols = Object.keys(colsMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((colNum) => {
          const sortedShelves = [...colsMap[colNum]].sort((a, b) => b.shelf_level - a.shelf_level);
          return { colNum, shelves: sortedShelves };
        });

      return {
        rowNum,
        cols: sortedCols,
      };
    });
}
