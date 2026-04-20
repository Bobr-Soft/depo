# Known Limitations & Rollback Notes

## Known Limitations

### Idempotency
- Idempotency keys are generated client-side (`Date.now()-random`). If the app is killed and restarted between enqueue and push, a duplicate operation could theoretically be sent. Server-side dedup is **not** implemented.
- The `processedKeys` Set in `sync.ts` is per-push-cycle only — it does not persist across app restarts.

### Dead-Letter Queue
- Dead-letter entries live only in local SQLite. If the user clears app data or reinstalls, failed operations are permanently lost.
- There is no server-side retry mechanism — dead-letter replay is manual (user taps "clear" or re-performs the action).

### Sync
- Auto-sync interval is fixed at 30 seconds; not configurable at runtime.
- Single-flight guard means concurrent sync triggers are coalesced, which can delay urgent pushes by up to 30s.
- Pull overwrites local data — there is no merge/conflict resolution for items or tasks.

### Inbound Drafts
- Only one draft is persisted at a time (keyed as `inbound_draft`). Opening a second inbound session overwrites the first.
- Draft save is debounced at 500ms — a crash within that window may lose the last edit.

### Task Assignment
- The `/tasks/:taskId/assign` endpoint does not send notifications to the assigned user. They will only see the assignment on next sync pull.

## Rollback Procedure

### Mobile App
1. Revert to previous EAS build channel / version in app stores
2. No database migration rollback needed — new columns (`idempotency_key`) are additive and ignored by older code

### API
1. `git revert` the commits adding `/tasks/:taskId/assign` and `/tasks/:taskId/status` endpoints
2. Redeploy API
3. No schema changes required — endpoints are purely application-level

### Data Cleanup (if needed)
- Dead-letter entries: cleared automatically on app reinstall, or manually via profile screen
- Inbound drafts: stored in `sync_metadata` table, key `inbound_draft` — safe to leave in place
