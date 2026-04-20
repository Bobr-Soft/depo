# Offline Sync Documentation

## Overview

The mobile app uses a **push-and-pull** sync architecture backed by SQLite. Local writes (picking updates, inbound scans, task creation) are queued in the `sync_queue` table and pushed to the server when connectivity is available. Remote data is pulled from the `/tasks` endpoint and cached locally for instant offline access.

## Architecture

### Components

1. **Database Service** (`src/services/database.ts`)
   - SQLite database management (via `expo-sqlite`)
   - Local storage for tasks, task items, items, categories, and locations
   - Sync queue (pending operations) and dead-letter queue (permanently failed operations)
   - Inbound draft persistence (survives app kill/restart)

2. **Sync Service** (`src/services/sync.ts`)
   - Single-flight sync guard (`activeSyncPromise`) prevents concurrent syncs
   - Push: processes `sync_queue` entries (task_item UPDATE, item UPSERT, task CREATE)
   - Pull: fetches `/tasks` and persists to local DB
   - Retry with exponential backoff (max 5 retries per operation)
   - Dead-letter queue for permanently failed operations
   - Diagnostic logging via `logDiagnostic()` for every lifecycle event

3. **Hooks** (`src/hooks/useSync.ts`)
   - `useSyncStatus()`: polls sync state every 10 s (pending ops, dead-letter count, online status)
   - `useNetworkStatus()`: polls network every 5 s
   - `useAutoSync()`: triggers sync on offline-online transition with 10 s cooldown

4. **API Layer** (`src/components/api.ts`)
   - Offline-first: returns cached data immediately via `getTasksWithSync()`
   - Background sync when online
   - Task assignment (take/release/assign) and status update endpoints

## Sync Queue Operations

### Supported queue entry types

| `entity_type` | `operation` | Payload | API endpoint |
|---|---|---|---|
| `task_item` | `UPDATE` | `{ picked_quantity, status }` | `PUT /tasks/:taskId/items/:itemId/picked` |
| `item` | `UPSERT` | `{ barcode, quantityIncrement, ... }` | `POST /items` or `PUT /items/:id` |
| `task` | `CREATE` | `{ name, type, priority, ... }` | `POST /tasks` |

Unsupported combinations are moved to the dead-letter queue automatically.

### Idempotency

Inbound UPSERT operations include an `idempotency_key` to prevent duplicate processing. The push cycle tracks processed keys and skips duplicates within the same run.

### Dead-letter queue

Operations are moved to the dead-letter queue when:
- Max retries exceeded (5 attempts)
- Non-retryable HTTP status (4xx except timeout)
- Unsupported operation type
- Payload parse error

Dead-letter entries are visible in the profile screen sync status section and on task/picking screens.

## Sync Flow

### Full Sync Cycle

1. **Push** - Process all `sync_queue` entries against the server
2. **Pull** - Fetch `/tasks` (with items, categories, locations) and overwrite local cache
3. **Timestamp** - Update `last_sync` in `sync_metadata`

### Triggers

| Trigger | Source |
|---|---|
| `startup` | `initializeSyncService()` on app launch |
| `manual` | User taps Sync button |
| `reconnect` | `useAutoSync()` detects offline-online (10 s cooldown) |
| `background` | `getTasksWithSync()` background refresh |
| `task-item-picked` | After `markItemAsPicked()` |
| `task-refresh` | `refreshTaskById()` |

## Inbound Draft Persistence

Scanned inbound items are persisted to SQLite (`sync_metadata` key `inbound_draft`) with 500 ms debounce. On app restart, the draft is recovered automatically and a recovery banner is shown.

## Database Schema

### Core Tables

```sql
sync_metadata (key TEXT PK, value TEXT, updated_at INTEGER)
sync_queue (id INTEGER PK, operation TEXT, entity_type TEXT, entity_id INTEGER,
            payload TEXT, created_at INTEGER, retry_count INTEGER, idempotency_key TEXT)
dead_letter_queue (id INTEGER PK, original_sync_operation_id INTEGER,
                   operation TEXT, entity_type TEXT, entity_id INTEGER,
                   payload TEXT, failure_reason TEXT, failure_details TEXT,
                   original_created_at INTEGER, moved_to_dead_letter_at INTEGER,
                   final_retry_count INTEGER)
tasks (..., synced INTEGER DEFAULT 1)
task_items (..., synced INTEGER DEFAULT 1)
items (..., synced INTEGER DEFAULT 1)
categories (id, name, size_class, min_stock_level)
locations (id, row_num, col_num, shelf_level, is_xl, location_code, is_active)
```

## Usage Examples

### Loading Tasks (offline-first)

```typescript
import loadTasks from '@/components/api';
const tasks = await loadTasks(); // returns cache, triggers background sync
```

### Force Refresh

```typescript
import { refreshTasks } from '@/components/api';
const tasks = await refreshTasks(); // pulls from server, errors if offline
```

### Monitor Sync Status

```typescript
import { useSyncStatus } from '@/hooks';

function MyComponent() {
  const syncStatus = useSyncStatus();
  // syncStatus.pendingOperations - queued writes
  // syncStatus.deadLetterOperations - permanently failed
  // syncStatus.isOnline / syncStatus.isSyncing / syncStatus.lastSyncTime
}
```

## Configuration

- `API_TIMEOUT` - Request timeout in ms (`src/constants/config.ts`)
- `RETRY_CONFIG` - Max attempts, backoff multiplier, delays (`src/constants/config.ts`)
- `MAX_SYNC_RETRY_COUNT` - Queue retry limit before dead-letter (5, in `sync.ts`)
- `RECONNECT_SYNC_COOLDOWN_MS` - Cooldown between reconnect syncs (10 s, in `useSync.ts`)

## Error Handling

- **Network errors**: Operations queued automatically, retried on reconnect
- **Auth errors (401/403)**: Silent re-authentication attempted; on failure, user logged out
- **Sync conflicts**: Last-write-wins (server data overwrites local on pull)
- **Queue failures**: After 5 retries - dead-letter queue, visible in UI
- **Draft crashes**: Inbound drafts persist in SQLite, recovered on restart

## Troubleshooting

```typescript
import { getSyncStatus } from '@/services/sync';
const status = await getSyncStatus();
// Check: isOnline, pendingOperations, deadLetterOperations, lastFailureReason

import { getSyncQueue, getDeadLetterEntries } from '@/services/database';
const queue = await getSyncQueue();        // pending operations
const dead = await getDeadLetterEntries(); // permanently failed operations
```
