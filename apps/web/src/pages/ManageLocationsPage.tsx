import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { api } from '../services/api';

interface RackItem {
  id: number;
  name: string;
  barcode?: string | null;
  description?: string | null;
  quantity?: number | null;
  category_id?: number | null;
  location_id?: number | null;
}

interface RackLocation {
  location_id: number;
  location_name: string;
  row_num: number;
  col_num: number;
  shelf_level?: number | null;
  is_xl?: number | boolean | null;
  is_active?: number | boolean | null;
  items: RackItem[];
}

interface LocationRow {
  id: number;
  name: string;
  description?: string | null;
  row_num?: number | null;
  col_num?: number | null;
  shelf_level?: number | null;
  is_xl?: number | boolean | null;
  is_active?: number | boolean | null;
}

interface PositionLocationRow {
  id: number;
  name: string;
  description?: string | null;
  row_num?: number | null;
  col_num?: number | null;
  shelf_level?: number | null;
  is_active?: number | boolean | null;
}

const GRID_SIZE = 4;
const CELL_SIZE = 86;
const DISPLAY_SHELF_LEVELS = [3, 2, 1, 0];
const MAX_ITEMS_PER_SHELF = 5;
const MAX_ITEMS_PER_RACK = 20;

interface LastMoveState {
  itemId: number;
  itemName: string;
  fromLocationId: number;
  toLocationId: number;
}

type TargetResolution = {
  id: number;
  locations: LocationRow[];
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTwoDigits(value: number) {
  return String(Math.max(0, value)).padStart(2, '0');
}

function parseLocationCode(source: string) {
  const text = String(source || '').trim();
  const match = text.match(/(\d{1,2})-(\d{1,2})-(\d{1,2})/);

  if (!match) {
    return { row: null, col: null, shelf: null };
  }

  return {
    row: Number.parseInt(match[1], 10),
    col: Number.parseInt(match[2], 10),
    shelf: Number.parseInt(match[3], 10),
  };
}

function extractLocationCodeFromLocation(location: LocationRow) {
  const name = String(location.name || '');
  if (/(\d{1,2})-(\d{1,2})-(\d{1,2})/.test(name)) {
    return name;
  }

  const description = String(location.description || '');
  if (/(\d{1,2})-(\d{1,2})-(\d{1,2})/.test(description)) {
    return description;
  }

  return name;
}

function getRackRowCol(location: LocationRow) {
  const parsed = parseLocationCode(extractLocationCodeFromLocation(location));
  const row = num(location.row_num, parsed.row ?? -1);
  const col = num(location.col_num, parsed.col ?? -1);
  return { row, col };
}

function getShelfLevel(location: LocationRow) {
  const parsed = parseLocationCode(extractLocationCodeFromLocation(location));
  return num(location.shelf_level, parsed.shelf ?? 0);
}

function toXlLabel(value: number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return Number(value) === 1 ? 'XL' : 'Standard';
}

function toActiveLabel(value: number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return Number(value) === 1 ? 'Aktiv' : 'Inaktiv';
}

function upsertLocations(current: LocationRow[], additions: LocationRow[] | LocationRow) {
  const incoming = Array.isArray(additions) ? additions : [additions];
  if (incoming.length === 0) {
    return current;
  }

  const byId = new Map<number, LocationRow>();
  current.forEach((location) => byId.set(location.id, location));
  incoming.forEach((location) => {
    if (!location || typeof location.id !== 'number') {
      return;
    }
    byId.set(location.id, { ...byId.get(location.id), ...location });
  });

  return Array.from(byId.values());
}

function mapRackLocations(row: number, col: number, locations: LocationRow[], items: RackItem[]): RackLocation[] {
  const cellLocations = locations.filter(
    (location) => {
      const coords = getRackRowCol(location);
      return coords.row === row && coords.col === col;
    }
  );

  return cellLocations.map((location) => ({
    location_id: location.id,
    location_name: location.name,
    row_num: getRackRowCol(location).row,
    col_num: getRackRowCol(location).col,
    shelf_level: getShelfLevel(location),
    is_xl: location.is_xl,
    is_active: location.is_active,
    items: items.filter((item) => num(item.location_id, -1) === location.id),
  }));
}

export default function ManageLocationsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const modalTextPrimary = theme.palette.text.primary;
  const modalTextSecondary = theme.palette.text.secondary;
  const railColor = isDark ? theme.palette.grey[600] : theme.palette.primary.dark;
  const shelfBorder = isDark ? theme.palette.grey[600] : theme.palette.grey[400];
  const shelfEdge = isDark ? theme.palette.grey[700] : theme.palette.grey[400];
  const itemCardBg = theme.palette.background.paper;
  const itemCardBorder = isDark ? theme.palette.grey[600] : theme.palette.grey[300];

  const [selectedRack, setSelectedRack] = useState<{ row: number; col: number } | null>(null);
  const [allLocations, setAllLocations] = useState<LocationRow[]>([]);
  const [allItems, setAllItems] = useState<RackItem[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [draggingItemName, setDraggingItemName] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [dragOverLocationId, setDragOverLocationId] = useState<number | null>(null);
  const [dragOverRackKey, setDragOverRackKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [lastMove, setLastMove] = useState<LastMoveState | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cellItemCount = useMemo(() => {
    const byId = new Map<number, LocationRow>();
    allLocations.forEach((location) => byId.set(location.id, location));

    const counts = new Map<string, number>();
    allItems.forEach((item) => {
      const location = byId.get(num(item.location_id, -1));
      if (!location) {
        return;
      }
      const coords = getRackRowCol(location);
      if (coords.row < 1 || coords.col < 1) {
        return;
      }
      const key = `${coords.row}-${coords.col}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [allLocations, allItems]);

  const shelfLevels = useMemo(() => {
    return DISPLAY_SHELF_LEVELS;
  }, []);

  const rackItemCount = useMemo(() => {
    return rackLocations.reduce((sum, location) => sum + location.items.length, 0);
  }, [rackLocations]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const itemMatchesSearch = (item: RackItem) => {
    if (!normalizedSearch) {
      return true;
    }

    const name = String(item.name || '').toLowerCase();
    const barcode = String(item.barcode || '').toLowerCase();
    return name.includes(normalizedSearch) || barcode.includes(normalizedSearch);
  };

  const useZeroBasedShelf = useMemo(() => {
    const rawLevels = rackLocations.map((location) => num(location.shelf_level, 0));
    if (rawLevels.length === 0) {
      return true;
    }

    const hasZero = rawLevels.includes(0);
    const maxLevel = Math.max(...rawLevels);
    return hasZero && maxLevel <= 3;
  }, [rackLocations]);

  const handleClickRack = async (row: number, col: number) => {
    setSelectedRack({ row, col });
    setOpen(true);
    setLoading(true);
    setError(null);
    setSearchQuery('');

    try {
      const [locationsRes, itemsRes] = await Promise.all([
        api.get<LocationRow[]>('/locations'),
        api.get<RackItem[]>('/items'),
      ]);

      setAllLocations(locationsRes.data);
      setAllItems(itemsRes.data);
      setRackLocations(mapRackLocations(row, col, locationsRes.data, itemsRes.data));
    } catch (err) {
      console.error('Failed to load rack data:', err);
      setRackLocations([]);
      setError('Nem sikerult betolteni az adatokat.');
    } finally {
      setLoading(false);
    }
  };

  const moveItemToLocation = async (
    itemId: number,
    targetLocationId: number,
    options?: { trackHistory?: boolean; showSuccess?: boolean; locations?: LocationRow[] }
  ) => {
    const trackHistory = options?.trackHistory ?? true;
    const showSuccess = options?.showSuccess ?? true;
    const locationsSnapshot = options?.locations ?? allLocations;

    if (isSavingMove) {
      setWarningMessage('Varj, az elozo athelyezes mentese meg folyamatban van.');
      return false;
    }

    const movingItem = allItems.find((item) => item.id === itemId);
    if (!movingItem) {
      return false;
    }

    const currentLocationId = num(movingItem.location_id, -1);
    if (currentLocationId === targetLocationId) {
      return false;
    }

    const targetLocation = locationsSnapshot.find((location) => location.id === targetLocationId);
    const sourceLocation = locationsSnapshot.find((location) => location.id === currentLocationId);

    if (targetLocation) {
      const targetCoords = getRackRowCol(targetLocation);
      const targetShelf = getShelfLevel(targetLocation);

      const sameShelfMove = Boolean(
        sourceLocation
        && getRackRowCol(sourceLocation).row === targetCoords.row
        && getRackRowCol(sourceLocation).col === targetCoords.col
        && getShelfLevel(sourceLocation) === targetShelf
      );

      const targetShelfCount = allItems.filter((item) => {
        const location = locationsSnapshot.find((loc) => loc.id === num(item.location_id, -1));
        if (!location) {
          return false;
        }

        const coords = getRackRowCol(location);
        return (
          coords.row === targetCoords.row
          && coords.col === targetCoords.col
          && getShelfLevel(location) === targetShelf
        );
      }).length;

      if (!sameShelfMove && targetShelfCount >= MAX_ITEMS_PER_SHELF) {
        const displayShelf = useZeroBasedShelf ? targetShelf : Math.max(0, targetShelf - 1);
        setWarningMessage(`A cel polc (${displayShelf}. szint) megtelt. Maximum ${MAX_ITEMS_PER_SHELF} item lehet polconkent.`);
        return false;
      }
    }

    try {
      setIsSavingMove(true);

      await api.put(`/items/${itemId}`, {
        name: movingItem.name,
        barcode: movingItem.barcode ?? null,
        description: movingItem.description ?? null,
        quantity: num(movingItem.quantity, 0),
        category_id: movingItem.category_id ?? null,
        location_id: targetLocationId,
      });

      const updatedItems = allItems.map((item) =>
        item.id === itemId ? { ...item, location_id: targetLocationId } : item
      );

      setAllItems(updatedItems);
      if (options?.locations) {
        setAllLocations(options.locations);
      }
      if (selectedRack) {
        setRackLocations(mapRackLocations(selectedRack.row, selectedRack.col, locationsSnapshot, updatedItems));
      }
      setError(null);
      if (showSuccess) {
        setSuccessMessage(`Item athelyezve: ${movingItem.name}`);
      }

      if (trackHistory) {
        setLastMove({
          itemId,
          itemName: movingItem.name,
          fromLocationId: currentLocationId,
          toLocationId: targetLocationId,
        });
        setUndoOpen(true);
      }

      if (selectedItemId === itemId) {
        setSelectedItemId(null);
        setSelectedItemName(null);
      }

      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));

      setWarningMessage(null);
      return true;
    } catch (err) {
      console.error('Failed to move item:', err);
      const apiResponse = err as { response?: { status?: number; data?: { message?: string } } };
      const apiMessage = apiResponse?.response?.data?.message;
      const status = apiResponse?.response?.status;

      if (status === 403) {
        setError('Nincs admin jogosultsagod az athelyezeshez.');
      } else if (status === 409) {
        setError(apiMessage || 'Kapacitas limit vagy adatutkozes miatt nem sikerult a mozgatas.');
        setWarningMessage(apiMessage || 'Kapacitas limit vagy adatutkozes miatt nem sikerult a mozgatas.');
      } else if (status === 401) {
        setError('Lejart munkamenet. Lepj be ujra.');
      } else {
        setError(apiMessage || 'Az item mozgatasa nem sikerult. Ellenorizd a jogosultsagokat.');
      }
      return false;
    } finally {
      setIsSavingMove(false);
    }
  };

  const handleUndoLastMove = async () => {
    if (!lastMove) {
      return;
    }

    const movedBack = await moveItemToLocation(lastMove.itemId, lastMove.fromLocationId, {
      trackHistory: false,
      showSuccess: false,
    });

    if (movedBack) {
      setSuccessMessage(`Visszavonva: ${lastMove.itemName}`);
      setLastMove(null);
      setUndoOpen(false);
    }
  };

  const moveManyItemsToLocation = async (
    itemIds: number[],
    targetLocationId: number,
    locationsOverride?: LocationRow[]
  ) => {
    if (itemIds.length === 0) {
      return;
    }

    let successCount = 0;
    const failedIds: number[] = [];

    for (const itemId of itemIds) {
      const moved = await moveItemToLocation(itemId, targetLocationId, {
        trackHistory: false,
        showSuccess: false,
        locations: locationsOverride,
      });

      if (moved) {
        successCount += 1;
      } else {
        failedIds.push(itemId);
      }
    }

    if (successCount > 0) {
      setSuccessMessage(`${successCount} item athelyezve.`);
    }

    if (failedIds.length > 0) {
      setWarningMessage(`Nem sikerult ${failedIds.length} item athelyezese.`);
    }

    setSelectedItemIds([]);
    setSelectedItemId(null);
    setSelectedItemName(null);
  };

  const getLocationsByRack = (row: number, col: number) => {
    return allLocations.filter((location) => {
      const coords = getRackRowCol(location);
      return coords.row === row && coords.col === col;
    });
  };

  const findBestTargetLocationIdForRack = (row: number, col: number, itemId: number) => {
    const rackLocationsInTarget = getLocationsByRack(row, col)
      .sort((a, b) => {
        const aActive = num(a.is_active, 1) === 1 ? 1 : 0;
        const bActive = num(b.is_active, 1) === 1 ? 1 : 0;
        if (aActive !== bActive) {
          // Prefer active locations, but do not block inactive-only racks.
          return bActive - aActive;
        }

        const aShelf = getShelfLevel(a);
        const bShelf = getShelfLevel(b);
        if (aShelf !== bShelf) {
          return aShelf - bShelf;
        }
        return a.id - b.id;
      });

    if (rackLocationsInTarget.length === 0) {
      return null;
    }

    const movingItem = allItems.find((item) => item.id === itemId);
    const sourceLocation = allLocations.find((location) => location.id === num(movingItem?.location_id, -1));
    const preferredShelf = sourceLocation ? getShelfLevel(sourceLocation) : null;

    if (preferredShelf !== null) {
      const sameShelfTarget = rackLocationsInTarget.find((location) => getShelfLevel(location) === preferredShelf);
      if (sameShelfTarget) {
        return sameShelfTarget.id;
      }
    }

    return rackLocationsInTarget[0].id;
  };

  const pickBestTargetFromRows = (
    rows: PositionLocationRow[],
    preferredShelf: number | null
  ) => {
    if (rows.length === 0) {
      return null;
    }

    const sorted = [...rows].sort((a, b) => {
      const aActive = num(a.is_active, 1) === 1 ? 1 : 0;
      const bActive = num(b.is_active, 1) === 1 ? 1 : 0;
      if (aActive !== bActive) {
        return bActive - aActive;
      }

      const aShelf = num(a.shelf_level, 0);
      const bShelf = num(b.shelf_level, 0);
      if (aShelf !== bShelf) {
        return aShelf - bShelf;
      }

      return a.id - b.id;
    });

    if (preferredShelf !== null) {
      const sameShelf = sorted.find((row) => num(row.shelf_level, -1) === preferredShelf);
      if (sameShelf) {
        return sameShelf.id;
      }
    }

    return sorted[0].id;
  };

  const resolveTargetLocationIdForRack = async (row: number, col: number, itemId: number): Promise<TargetResolution | null> => {
    const localBest = findBestTargetLocationIdForRack(row, col, itemId);
    if (localBest) {
      return { id: localBest, locations: allLocations };
    }

    const movingItem = allItems.find((item) => item.id === itemId);
    const sourceLocation = allLocations.find((location) => location.id === num(movingItem?.location_id, -1));
    const preferredShelf = sourceLocation ? getShelfLevel(sourceLocation) : null;

    try {
      const response = await api.get<PositionLocationRow[]>('/locations/position', {
        params: { row_num: row, col_num: col },
      });

      const mergedLocations = upsertLocations(allLocations, response.data);
      if (mergedLocations !== allLocations) {
        setAllLocations(mergedLocations);
      }

      const picked = pickBestTargetFromRows(response.data, preferredShelf);
      if (picked) {
        return { id: picked, locations: mergedLocations };
      }
    } catch (err) {
      console.error('Failed to resolve target rack location via API:', err);
    }

    const createShelf = preferredShelf ?? 0;
    const created = await createLocationForRackShelf(row, col, createShelf);
    if (!created) {
      return null;
    }

    const mergedLocations = upsertLocations(allLocations, created);
    setAllLocations(mergedLocations);
    return { id: created.id, locations: mergedLocations };
  };

  const createLocationForRackShelf = async (row: number, col: number, shelfLevel: number): Promise<LocationRow | null> => {
    const normalizedShelf = Math.max(0, shelfLevel);
    const generatedCode = `${toTwoDigits(row)}-${toTwoDigits(col)}-${toTwoDigits(normalizedShelf)}`;

    try {
      const response = await api.post('/locations', {
        name: generatedCode,
        row_num: row,
        col_num: col,
        shelf_level: normalizedShelf,
        is_active: true,
        is_xl: false,
      });

      const createdId = num(response.data?.id, -1);
      if (createdId <= 0) {
        return null;
      }

      const createdLocation: LocationRow = {
        id: createdId,
        name: String(response.data?.name || generatedCode),
        description: String(response.data?.description || generatedCode),
        row_num: row,
        col_num: col,
        shelf_level: normalizedShelf,
        is_active: 1,
        is_xl: 0,
      };

      setAllLocations((prev) => upsertLocations(prev, createdLocation));

      setSuccessMessage(`Uj location letrehozva: ${createdLocation.name}`);
      return createdLocation;
    } catch (err) {
      console.error('Failed to create fallback location:', err);
      return null;
    }
  };

  const resolveTargetLocationIdForShelf = async (
    row: number,
    col: number,
    displayShelfLevel: number
  ): Promise<TargetResolution | null> => {
    const targetRawShelf = useZeroBasedShelf ? displayShelfLevel : displayShelfLevel + 1;

    const localCandidates = getLocationsByRack(row, col)
      .filter((location) => getShelfLevel(location) === targetRawShelf)
      .sort((a, b) => {
        const aActive = num(a.is_active, 1) === 1 ? 1 : 0;
        const bActive = num(b.is_active, 1) === 1 ? 1 : 0;
        if (aActive !== bActive) {
          return bActive - aActive;
        }
        return a.id - b.id;
      });

    if (localCandidates.length > 0) {
      return { id: localCandidates[0].id, locations: allLocations };
    }

    try {
      const response = await api.get<PositionLocationRow[]>('/locations/position', {
        params: { row_num: row, col_num: col },
      });

      const mergedLocations = upsertLocations(allLocations, response.data);
      if (mergedLocations !== allLocations) {
        setAllLocations(mergedLocations);
      }

      const shelfMatched = response.data.filter((location) => num(location.shelf_level, -1) === targetRawShelf);
      const bestOnShelf = pickBestTargetFromRows(shelfMatched, targetRawShelf);
      if (bestOnShelf) {
        return { id: bestOnShelf, locations: mergedLocations };
      }

      const fallbackInRack = pickBestTargetFromRows(response.data, targetRawShelf);
      if (fallbackInRack) {
        return { id: fallbackInRack, locations: mergedLocations };
      }
    } catch (err) {
      console.error('Failed to resolve target shelf location via API:', err);
    }

    const created = await createLocationForRackShelf(row, col, targetRawShelf);
    if (!created) {
      return null;
    }

    const mergedLocations = upsertLocations(allLocations, created);
    setAllLocations(mergedLocations);
    return { id: created.id, locations: mergedLocations };
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 2 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Raktar Rack Terkep</Typography>
        <Typography color="text.secondary">Kattints egy rackre a virtuális polc nézethez.</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.25}>
          {Array.from({ length: GRID_SIZE }, (_, y) => y + 1).map((colNum) => (
            <Box
              key={`row-${colNum}`}
              sx={{
                display: 'grid',
                width: '100%',
                gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                gap: 1.25,
              }}
            >
              {Array.from({ length: GRID_SIZE }, (_, x) => x + 1).map((rowNum) => {
                const key = `${rowNum}-${colNum}`;
                const count = cellItemCount.get(key) || 0;

                return (
                  <Button
                    key={key}
                    onClick={() => void handleClickRack(rowNum, colNum)}
                    variant="outlined"
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      height: CELL_SIZE,
                      minHeight: CELL_SIZE,
                      borderRadius: 1,
                      p: 0.5,
                      fontSize: '0.7rem',
                      lineHeight: 1,
                    }}
                  >
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>X{rowNum}Y{colNum}</Typography>
                      <Typography sx={{ fontSize: '0.64rem', opacity: 0.85 }}>{count} item</Typography>
                    </Box>
                  </Button>
                );
              })}
            </Box>
          ))}
        </Stack>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          {selectedRack ? `Virtualis rack - X=${selectedRack.row}, Y=${selectedRack.col}` : 'Virtualis rack'}
        </DialogTitle>
        <DialogContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && (
            <Box
              sx={{
                position: 'relative',
                px: 2,
                py: 2,
                color: modalTextPrimary,
                borderRadius: 2,
                background: isDark
                  ? `linear-gradient(180deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 100%)`
                  : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: 10,
                  bottom: 10,
                  width: 8,
                  background: railColor,
                  borderRadius: 1,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 10,
                  bottom: 10,
                  width: 8,
                  background: railColor,
                  borderRadius: 1,
                }}
              />

              <Stack spacing={1.25}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: modalTextPrimary, fontWeight: 700 }}>
                    Rack kapacitas: {rackItemCount}/{MAX_ITEMS_PER_RACK}
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Kereses nevre/barcode-ra"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    sx={{ minWidth: 240 }}
                  />
                </Box>

                {draggingItemName && (
                  <Alert severity="info" sx={{ mb: 0.25 }}>
                    Mozgatas folyamatban: {draggingItemName}. Huzd egy location dobozra vagy a lenti masik rack celzonaval masik rackbe.
                  </Alert>
                )}

                {selectedItemName && !draggingItemName && (
                  <Alert severity="info" sx={{ mb: 0.25 }}>
                    Kijelolt item: {selectedItemName}. Kattints egy location dobozra vagy masik rack cellara az athelyezeshez.
                  </Alert>
                )}

                {selectedItemIds.length > 0 && (
                  <Alert severity="info" sx={{ mb: 0.25 }}>
                    Bulk kijeloles aktiv: {selectedItemIds.length} item. Kattints cel locationre vagy masik rack cellara a tomeges athelyezeshez.
                  </Alert>
                )}

                {shelfLevels.map((level, shelfIndex) => {
                  const rawLevel = useZeroBasedShelf ? level : level + 1;
                  const shelfLocations = rackLocations.filter((location) => num(location.shelf_level, 0) === rawLevel);
                  const shelfItems = shelfLocations.flatMap((location) => location.items);
                  const shelfVisibleItems = shelfLocations.flatMap((location) => location.items.filter(itemMatchesSearch));
                  const shelfIsFull = shelfItems.length >= MAX_ITEMS_PER_SHELF;

                  return (
                    <Box
                      key={`shelf-${level}`}
                      sx={{
                        border: '2px solid',
                        borderColor: shelfIsFull ? 'error.main' : 'divider',
                        borderRadius: 1.5,
                        p: 1,
                        backgroundColor: shelfIndex % 2 === 0
                          ? theme.palette.background.paper
                          : theme.palette.action.hover,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 0.8,
                          pb: 0.8,
                          borderBottom: '1px solid',
                          borderBottomColor: 'divider',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: modalTextPrimary }}>
                          Polc {level}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          {shelfIsFull && (
                            <Box
                              sx={{
                                px: 0.7,
                                py: 0.15,
                                borderRadius: 999,
                                border: '1px solid',
                                borderColor: theme.palette.error.main,
                                color: theme.palette.error.main,
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                lineHeight: 1.2,
                              }}
                            >
                              Tele ({shelfItems.length}/{MAX_ITEMS_PER_SHELF})
                            </Box>
                          )}
                          <Typography variant="caption" sx={{ color: modalTextSecondary }}>
                            {shelfItems.length}/{MAX_ITEMS_PER_SHELF} item
                            {normalizedSearch ? ` (talalat: ${shelfVisibleItems.length})` : ''}
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          minHeight: 82,
                          border: shelfIsFull
                            ? `2px solid ${theme.palette.error.main}`
                            : `1px solid ${shelfBorder}`,
                          borderRadius: 1,
                          p: 1,
                          background: theme.palette.background.default,
                          boxShadow: `inset 0 -5px 0 ${shelfEdge}`,
                          cursor: selectedItemId ? 'pointer' : 'default',
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={async (event) => {
                          event.preventDefault();
                          if (!selectedRack) {
                            return;
                          }

                          const rawItemId = event.dataTransfer.getData('text/plain');
                          const itemId = Number.parseInt(rawItemId, 10);
                          if (!Number.isInteger(itemId)) {
                            return;
                          }

                          const resolution = await resolveTargetLocationIdForShelf(
                            selectedRack.row,
                            selectedRack.col,
                            level
                          );

                          if (!resolution) {
                            setError('A polcon nem talalhato target location.');
                            return;
                          }

                          await moveItemToLocation(itemId, resolution.id, { locations: resolution.locations });
                        }}
                        onClick={async () => {
                          if (!selectedRack || !selectedItemId) {
                            return;
                          }

                          const resolution = await resolveTargetLocationIdForShelf(
                            selectedRack.row,
                            selectedRack.col,
                            level
                          );

                          if (!resolution) {
                            setError('A polcon nem talalhato target location.');
                            return;
                          }

                          await moveItemToLocation(selectedItemId, resolution.id, { locations: resolution.locations });
                        }}
                      >
                        {shelfLocations.length === 0 && (
                          <Typography variant="body2" sx={{ color: modalTextSecondary, fontWeight: 600 }}>
                            Nincs kulon location kartya ezen a szinten. A polc tovabbra is aktiv celzona.
                          </Typography>
                        )}

                        {shelfLocations.length > 0 && (
                          <Stack spacing={0.8}>
                            {shelfLocations.map((location) => (
                              <Box
                                key={`drop-${level}-${location.location_id}`}
                                sx={{
                                  px: 0.7,
                                  py: 0.7,
                                  borderRadius: 1,
                                  border: dragOverLocationId === location.location_id
                                    ? `2px solid ${theme.palette.primary.main}`
                                    : `1px solid ${theme.palette.divider}`,
                                  backgroundColor: dragOverLocationId === location.location_id
                                    ? theme.palette.action.selected
                                    : theme.palette.background.paper,
                                  cursor: selectedItemId ? 'pointer' : 'default',
                                }}
                                onClick={async () => {
                                  if (selectedItemIds.length > 0) {
                                    await moveManyItemsToLocation(selectedItemIds, location.location_id);
                                    return;
                                  }

                                  if (!selectedItemId) {
                                    return;
                                  }
                                  await moveItemToLocation(selectedItemId, location.location_id);
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = 'move';
                                  setDragOverLocationId(location.location_id);
                                }}
                                onDragLeave={() => setDragOverLocationId((prev) => (
                                  prev === location.location_id ? null : prev
                                ))}
                                onDrop={async (event) => {
                                  event.preventDefault();
                                  const rawItemId = event.dataTransfer.getData('text/plain');
                                  const itemId = Number.parseInt(rawItemId, 10);
                                  setDragOverLocationId(null);
                                  if (Number.isInteger(itemId)) {
                                    await moveItemToLocation(itemId, location.location_id);
                                  }
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: modalTextPrimary }}>
                                  {location.location_name}
                                </Typography>

                                {location.items.length === 0 && (
                                  <Typography variant="caption" sx={{ color: modalTextSecondary }}>
                                    Ures location - ide dobhatsz itemet.
                                  </Typography>
                                )}

                                {location.items.length > 0 && (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7, mt: 0.6 }}>
                                    {location.items.filter(itemMatchesSearch).map((item) => (
                                      <Box
                                        key={`${level}-${location.location_id}-${item.id}`}
                                        draggable={true}
                                        onClick={() => {
                                          if (selectedItemIds.length > 0) {
                                            if (selectedItemIds.includes(item.id)) {
                                              setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                                            } else {
                                              setSelectedItemIds((prev) => [...prev, item.id]);
                                            }
                                            return;
                                          }

                                          if (selectedItemId === item.id) {
                                            setSelectedItemId(null);
                                            setSelectedItemName(null);
                                          } else {
                                            setSelectedItemId(item.id);
                                            setSelectedItemName(item.name);
                                          }
                                        }}
                                        onDragStart={(event) => {
                                          event.dataTransfer.setData('text/plain', String(item.id));
                                          event.dataTransfer.effectAllowed = 'move';

                                          // Custom drag preview for clearer feedback while moving.
                                          const preview = document.createElement('div');
                                          preview.textContent = item.name;
                                          preview.style.position = 'absolute';
                                          preview.style.top = '-1000px';
                                          preview.style.left = '-1000px';
                                          preview.style.padding = '8px 10px';
                                          preview.style.borderRadius = '6px';
                                          preview.style.fontSize = '12px';
                                          preview.style.fontWeight = '600';
                                          preview.style.background = theme.palette.background.paper;
                                          preview.style.color = theme.palette.text.primary;
                                          preview.style.border = `1px solid ${theme.palette.divider}`;
                                          preview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.18)';
                                          document.body.appendChild(preview);
                                          event.dataTransfer.setDragImage(preview, 12, 12);
                                          window.setTimeout(() => {
                                            if (document.body.contains(preview)) {
                                              document.body.removeChild(preview);
                                            }
                                          }, 0);

                                          setDraggingItemId(item.id);
                                          setDraggingItemName(item.name);
                                          setSelectedItemId(item.id);
                                          setSelectedItemName(item.name);
                                        }}
                                        onDragEnd={() => {
                                          setDraggingItemId(null);
                                          setDraggingItemName(null);
                                          setDragOverLocationId(null);
                                          setDragOverRackKey(null);
                                        }}
                                        sx={{
                                          px: 0.8,
                                          py: 0.6,
                                          borderRadius: 1,
                                          border: selectedItemId === item.id
                                            ? `2px solid ${theme.palette.primary.main}`
                                            : selectedItemIds.includes(item.id)
                                              ? `2px solid ${theme.palette.info.main}`
                                            : `1px solid ${itemCardBorder}`,
                                          backgroundColor: itemCardBg,
                                          minWidth: 120,
                                          cursor: 'grab',
                                          opacity: draggingItemId === item.id ? 0.6 : 1,
                                          userSelect: 'none',
                                          pointerEvents: isSavingMove ? 'none' : 'auto',
                                        }}
                                      >
                                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: theme.palette.text.primary }}>
                                          {item.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                          qty: {item.quantity ?? 0}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                )}

                                {location.items.length > 0 && location.items.filter(itemMatchesSearch).length === 0 && (
                                  <Typography variant="caption" sx={{ color: modalTextSecondary }}>
                                    Nincs talalat ezen a location-on.
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>

                      {shelfLocations.length > 0 && (
                        <Typography variant="caption" sx={{ mt: 0.4, display: 'block', color: modalTextSecondary }}>
                          {shelfLocations
                            .map((location) => `${location.location_name} (${toXlLabel(location.is_xl)}, ${toActiveLabel(location.is_active)})`)
                            .join(' | ')}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75, color: modalTextPrimary, fontWeight: 700 }}>
                  Masik rack celzona (drag and drop)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const visibleIds = rackLocations
                        .flatMap((location) => location.items)
                        .filter(itemMatchesSearch)
                        .map((item) => item.id);
                      setSelectedItemIds(Array.from(new Set(visibleIds)));
                      setSelectedItemId(null);
                      setSelectedItemName(null);
                    }}
                  >
                    Mind kijelolese
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setSelectedItemIds([]);
                    }}
                  >
                    Kijeloles torlese
                  </Button>
                </Box>
                <Typography variant="caption" sx={{ mb: 1, display: 'block', color: modalTextSecondary }}>
                  Huzd az itemet egy masik rack cellara. A rendszer automatikusan kivalaszt egy aktiv locationt a cel rackben.
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                    gap: 0.75,
                  }}
                >
                  {/** If coordinates are incomplete in /locations, we still allow drops and resolve target via API. */}
                  {(() => {
                    const hasCoordinateEvidence = allLocations.some((location) => {
                      const coords = getRackRowCol(location);
                      return coords.row >= 1 && coords.col >= 1;
                    });

                    return Array.from({ length: GRID_SIZE }, (_, y) => y + 1).flatMap((colNum) =>
                      Array.from({ length: GRID_SIZE }, (_, x) => x + 1).map((rowNum) => {
                        const rackKey = `${rowNum}-${colNum}`;
                        const rackLocationsForCell = getLocationsByRack(rowNum, colNum);
                        const localHasAnyLocation = rackLocationsForCell.length > 0;
                        const hasAnyLocation = hasCoordinateEvidence ? localHasAnyLocation : true;
                        const hasActiveLocation = rackLocationsForCell.some((location) => num(location.is_active, 1) === 1);

                        return (
                          <Box
                            key={`rack-drop-${rackKey}`}
                            onClick={async () => {
                              if (selectedItemIds.length > 0) {
                                const resolution = await resolveTargetLocationIdForRack(rowNum, colNum, selectedItemIds[0]);
                                if (!resolution) {
                                  setError('A cel rackben nincs target location.');
                                  return;
                                }
                                await moveManyItemsToLocation(selectedItemIds, resolution.id, resolution.locations);
                                return;
                              }

                              if (!selectedItemId) {
                                return;
                              }

                              const resolution = await resolveTargetLocationIdForRack(rowNum, colNum, selectedItemId);
                              if (!resolution) {
                                setError('A cel rackben nincs target location.');
                                return;
                              }

                              await moveItemToLocation(selectedItemId, resolution.id, { locations: resolution.locations });
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = 'move';
                              setDragOverRackKey(rackKey);
                            }}
                            onDragLeave={() => {
                              setDragOverRackKey((prev) => (prev === rackKey ? null : prev));
                            }}
                            onDrop={async (event) => {
                              event.preventDefault();
                              const rawItemId = event.dataTransfer.getData('text/plain');
                              const itemId = Number.parseInt(rawItemId, 10);
                              setDragOverRackKey(null);

                              if (!Number.isInteger(itemId)) {
                                return;
                              }

                              const resolution = await resolveTargetLocationIdForRack(rowNum, colNum, itemId);
                              if (!resolution) {
                                setError('A cel rackben nincs target location.');
                                return;
                              }

                              await moveItemToLocation(itemId, resolution.id, { locations: resolution.locations });
                            }}
                            sx={{
                              borderRadius: 1,
                              border: hasAnyLocation
                                ? `1px solid ${theme.palette.divider}`
                                : `1px dashed ${theme.palette.divider}`,
                              backgroundColor: !hasAnyLocation
                                ? theme.palette.action.disabledBackground
                                : dragOverRackKey === rackKey
                                  ? theme.palette.action.hover
                                  : theme.palette.background.paper,
                              px: 0.5,
                              py: 0.6,
                              textAlign: 'center',
                              opacity: hasAnyLocation ? 1 : 0.6,
                              cursor: selectedItemId ? 'pointer' : 'default',
                            }}
                          >
                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: modalTextPrimary }}>
                              X{rowNum}Y{colNum}
                            </Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: modalTextSecondary }}>
                              {!hasAnyLocation
                                ? 'nincs target'
                                : hasActiveLocation
                                  ? 'drop'
                                  : 'drop'}
                            </Typography>
                          </Box>
                        );
                      })
                    );
                  })()}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={2200}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={undoOpen && Boolean(lastMove)}
        autoHideDuration={5000}
        onClose={() => setUndoOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => void handleUndoLastMove()}>
              Visszavonas
            </Button>
          }
        >
          Utolso mozgatas: {lastMove?.itemName}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(warningMessage)}
        autoHideDuration={3200}
        onClose={() => setWarningMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setWarningMessage(null)}>
          {warningMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
