# Offline Sync Documentation

## Overview

The mobile app now includes a simplified offline cache using SQLite for local data storage. The sync flow is pull-only: the app reads cached data and refreshes from the server when online. Offline edits are not queued or pushed.

## Architecture

### Components

1. **Database Service** (`src/services/database.ts`)
   - SQLite database management
   - Local storage for tasks, items, categories, and locations
  - Local storage for tasks, items, categories, and locations
  - Read-only cache for offline viewing

2. **Sync Service** (`src/services/sync.ts`)
   - Network status monitoring
  - Pull-only refresh from server
  - Simple online/offline checks
  - One-shot sync on app start or manual refresh

3. **Hooks** (`src/hooks/useSync.ts`)
   - `useSyncStatus`: Monitor sync status and network connectivity
   - `useNetworkStatus`: Track online/offline state
   - `useAutoSync`: Automatic sync on network reconnection

4. **Updated API Layer** (`src/components/api.ts`)
   - Offline-first approach
   - Returns cached data immediately
   - Background sync when online

## Features

### ✅ Offline-First Data Access
- Data is always read from local SQLite database first
- Instant response times even without network
- Automatic background sync when online

### ✅ Automatic Synchronization
- Auto-sync every 5 minutes when online
- Immediate sync on network reconnection
- Background sync after local updates

### ✅ Operation Queue
- All write operations are queued when offline
- Automatic retry with exponential backoff
- Maximum 3 retry attempts per operation
- Queue persists across app restarts

### ✅ Network Status Indicators
- Visual offline indicator in the UI
- Pending operations counter
- Last sync timestamp tracking

### ✅ Manual Refresh
- Force refresh button to pull latest data
- Disabled when offline with visual feedback
- Shows loading state during refresh

## Database Schema

### Tables

```sql
-- Sync metadata
sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)

-- Pending operations queue
sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,        -- CREATE, UPDATE, DELETE
  entity_type TEXT NOT NULL,      -- task, task_item, etc.
  entity_id INTEGER,
  payload TEXT NOT NULL,          -- JSON payload
  created_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0
)

-- Tasks (cached from API)
tasks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  source_id TEXT,
  assigned_user INTEGER,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  deadline INTEGER,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  synced INTEGER DEFAULT 1
)

-- Task items
task_items (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  requested_quantity INTEGER NOT NULL,
  picked_quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  synced INTEGER DEFAULT 1,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)

-- Items, categories, locations
-- (Full schema in database.ts)
```

## Usage Examples

### Loading Tasks with Offline Support

```typescript
import loadTasks from '@/components/api';

// Returns cached data immediately, syncs in background
const tasks = await loadTasks();
```

### Force Refresh from Server

```typescript
import { refreshTasks } from '@/components/api';

// Only works when online, returns error if offline
const tasks = await refreshTasks();
```

### Update with Offline Support

```typescript
import { updateTaskStatusOffline } from '@/services/sync';

// Updates locally and queues for sync
const result = await updateTaskStatusOffline(taskId, 'completed');

if (result.success) {
  console.log('Updated successfully (will sync when online)');
}
```

### Monitor Sync Status

```typescript
import { useSyncStatus } from '@/hooks';

function MyComponent() {
  const syncStatus = useSyncStatus();
  
  return (
    <View>
      {!syncStatus.isOnline && <Text>Offline Mode</Text>}
      {syncStatus.pendingOperations > 0 && (
        <Text>{syncStatus.pendingOperations} pending changes</Text>
      )}
      {syncStatus.lastSyncTime && (
        <Text>Last sync: {new Date(syncStatus.lastSyncTime).toLocaleString()}</Text>
      )}
    </View>
  );
}
```

### Network Reconnection Handling

```typescript
import { useAutoSync } from '@/hooks';

function MyComponent() {
  const { isOnline } = useAutoSync();
  
  // Automatically syncs when network reconnects
  return <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>;
}
```

## Sync Flow

### Pull (Server → Local)

1. Fetch latest data from API
2. Update local SQLite database
3. Update last sync timestamp
4. Return fresh data to UI

### Push (Local → Server)

1. Get all pending operations from sync queue
2. For each operation:
   - Attempt to send to server
   - On success: Remove from queue
   - On failure: Increment retry count
   - After 3 failures: Remove from queue with warning
3. Mark local records as synced

### Full Sync

1. Push local changes first (resolve conflicts)
2. Pull remote data
3. Update UI with fresh data

## Initialization

The sync service is automatically initialized in the root layout:

```typescript
// app/_layout.tsx
import { initializeSyncService } from '@/services/sync';

useEffect(() => {
  async function init() {
    const authed = await isAuthenticated();
    if (authed) {
      await initializeSyncService();
    }
  }
  init();
}, []);
```

## Configuration

Edit these constants in `src/services/sync.ts`:

```typescript
// Retry limit for failed sync operations
const SYNC_RETRY_LIMIT = 3;

// Auto-sync interval (5 minutes)
const SYNC_INTERVAL = 5 * 60 * 1000;
```

## API Timeout

Configure API timeout in `src/constants/config.ts`:

```typescript
export const API_TIMEOUT = 30000; // 30 seconds
```

## Error Handling

### Network Errors
- Operations are queued automatically
- Retry mechanism handles transient failures
- UI shows offline indicator

### Sync Conflicts
- Last-write-wins strategy (server data takes precedence)
- Local changes pushed before pulling remote data
- Consider implementing conflict resolution UI if needed

### Database Errors
- Logged to console
- Graceful fallback to empty data
- Database can be cleared and re-initialized

## Testing Offline Mode

### Simulate Offline

```typescript
// Enable airplane mode on device
// OR
// Use network link conditioner (iOS Simulator)
// OR
// Disconnect WiFi/cellular data
```

### Verify Offline Functionality

1. Load app while online
2. Switch to airplane mode
3. Navigate app - should show cached data
4. Make changes (they queue for sync)
5. Reconnect to network
6. Verify changes sync automatically

### Check Sync Queue

```typescript
import { getSyncQueue } from '@/services/database';

const queue = await getSyncQueue();
console.log('Pending operations:', queue);
```

## Best Practices

1. **Always use the sync-aware API functions**
   - Use `loadTasks()` for reading
   - Use `updateTaskStatusOffline()` for writing

2. **Handle both online and offline states in UI**
   - Show offline indicators
   - Disable server-only features when offline
   - Display pending sync count

3. **Test offline scenarios thoroughly**
   - App launch when offline
   - Network loss during operation
   - App backgrounding with pending changes

4. **Monitor sync queue growth**
   - Large queues may indicate sync issues
   - Consider batch operations for efficiency

5. **Clean up on logout**
   - Call `cleanupSyncService()` to clear local data
   - Prevents data leakage between users

## Troubleshooting

### Sync Not Working

```typescript
// Check sync status
import { getSyncStatus } from '@/services/sync';
const status = await getSyncStatus();
console.log(status);
```

### Clear Local Database

```typescript
// For testing or debugging
import { clearDatabase } from '@/services/database';
await clearDatabase();
```

### Force Manual Sync

```typescript
import { syncData } from '@/services/sync';
const result = await syncData();
console.log(result);
```

### Check Database Contents

```typescript
import { getTasks } from '@/services/database';
const localTasks = await getTasks();
console.log('Local tasks:', localTasks);
```

## Future Enhancements

- [ ] Conflict resolution UI
- [ ] Partial sync for large datasets
- [ ] Background sync using background tasks
- [ ] Compression for large payloads
- [ ] Encryption for sensitive data
- [ ] Delta sync for efficiency
- [ ] Real-time sync with WebSockets
- [ ] Offline image/file caching

## Performance Considerations

- **Database Size**: SQLite performs well up to tens of thousands of records
- **Sync Queue**: Consider batch operations to prevent queue buildup
- **Network Usage**: Auto-sync every 5 minutes is reasonable for most use cases
- **Battery Impact**: Network checks every 5 seconds - adjust if needed

## Security

- All API calls use JWT authentication
- Local database is app-sandboxed (secure on device)
- Consider encryption for sensitive fields if needed
- Clear database on logout to prevent data leakage

## Dependencies

```json
{
  "expo-sqlite": "~15.0.4",      // Local database
  "expo-network": "~7.0.4"       // Network status
}
```

## Migration from Non-Offline Version

If upgrading from a version without offline sync:

1. Install dependencies: `npx expo install expo-sqlite expo-network`
2. Database initializes automatically on first launch
3. First sync downloads all data from server
4. No data migration needed (fresh start)

## Support

For issues or questions:
- Check console logs for detailed error messages
- Verify network connectivity
- Check sync queue status
- Clear database and re-sync if data is corrupted
