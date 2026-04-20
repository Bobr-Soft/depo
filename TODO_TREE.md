# TODO TREE — App ↔ DB Logic Audit

> Scope: static code audit across `apps/mobile`, `apps/api`, `apps/web`.
> Format: Todo Tree friendly (`TODO`, `FIXME`, `BUG`, `HACK` tags + checklist hierarchy).

## MOBILE APP (apps/mobile)

- [x] TODO[P0][MOBILE]: Implement real inbound persistence flow in `app/inbound.tsx`
  - [x] TODO: Replace demo `scannedItems` local-only save with API-backed item creation/update
  - [x] TODO: Resolve scanned barcode to existing item first; create only when not found
  - [x] TODO: Add quantity increment logic for repeated scans of same barcode
  - [x] TODO: Persist failures to offline queue and show retry state
  - [x] TODO: Show success/failure summary after batch save

- [x] TODO[P0][MOBILE]: Fix picking completion consistency in `app/picking/[id].tsx` and `src/components/api.ts`
  - [x] BUG: `loadTask()` reads cached data (`getTasksWithSync`) and may show stale status right after pick
  - [x] TODO: After successful `taskItemPicked`, force server refresh for that task (or optimistic local recompute)
  - [x] TODO: Ensure task status transitions to `completed` immediately in UI when last item is picked — `markItemAsPicked` in `database.ts` recomputes and persists task status

- [x] TODO[P0][MOBILE]: Fix completed-item edit path to keep task lifecycle consistent
  - [x] BUG: `updateTaskItemQuantity()` updates only `task_items`, not local `tasks.status`
  - [x] TODO: Recompute and update task status locally after edit (same logic as `markItemAsPicked`)
  - [x] TODO: Trigger sync + refresh after edit save so task list/detail remain consistent

- [x] TODO[P1][MOBILE]: Align task list behavior across screens
  - [x] TODO: Apply same status grouping/sorting logic in `app/picking/index.tsx` as `app/(tabs)/items.tsx`
  - [x] TODO: Confirm completed tasks visibility/filter policy is explicit and consistent

- [x] TODO[P1][MOBILE]: Implement `app/picking/new.tsx` end-to-end
  - [x] NOTE: Current screen already supports taking unassigned tasks; remaining gap is real task creation or route/UX clarification
  - [x] TODO: Add form fields (name/source/priority/deadline/items)
  - [x] TODO: Wire create-task API call with validation and user feedback
  - [x] TODO: Add offline fallback behavior for task creation

- [x] TODO[P1][MOBILE]: Implement `app/edit.tsx` item edit/load behavior
  - [x] TODO: Load item by scanned barcode from local cache/API
  - [x] TODO: Support create-vs-edit decision flow
  - [x] TODO: Save updates through API + sync queue

- [x] TODO[P2][MOBILE]: Tighten sync queue semantics in `src/services/sync.ts`
  - [x] FIXME: Local task-status updates no longer enqueue unsupported `task` operations
  - [x] TODO: Add explicit handlers or prevent enqueueing unsupported operation types
  - [x] TODO: Add dead-letter handling for repeatedly failing queue items

- [x] TODO[P2][MOBILE]: Data mapping cleanup
  - [x] FIXME: `database.ts` currently stores `assigned_user_data: null` only
  - [x] TODO: Persist/hydrate assignee metadata when provided by API
  - [x] TODO: Verify category/location field mapping in joined task item rows — fixed aliased column conflict in `database.ts` `getTasks`/`getTaskById`

## OTHER APPS — API + WEB

- [ ] TODO[P0][API]: Expand task domain API beyond read + picked update
  - [x] TODO: Add `POST /tasks` for task creation
  - [ ] TODO: Add task assignment/accept endpoints (`assign`, `accept`, `unassign`)
  - [ ] TODO: Add explicit task status update endpoint with validation/state machine

- [ ] TODO[P0][API]: Fix task visibility contract used by mobile `assignable` UI
  - [ ] BUG: `apps/api/tasks.js` filters `WHERE t.assigned_user = current_user`, so unassigned tasks never reach mobile
  - [ ] TODO: Return task sets by role/use case (assignable + assigned + in_progress + completed)
  - [ ] TODO: Document response contract for mobile sorting buckets

- [ ] TODO[P0][API+DB]: Reconcile schema contract mismatches (critical)
  - [ ] BUG: API categories/locations use `{name, description}` while mobile types expect rich structures (`size_class`, `row_num`, `col_num`, etc.)
  - [ ] TODO: Define single source-of-truth schema and update API/mobile/web to match
  - [ ] TODO: Add migration plan and compatibility layer if legacy data exists

- [ ] TODO[P1][WEB]: Replace placeholder pages with real logic
  - [ ] TODO: Implement `ManageLocationsPage.tsx` CRUD UI
  - [ ] TODO: Implement `QuickActionsPageAdd.tsx` and `QuickActionsPageList.tsx`
  - [ ] TODO: Implement `ManageRentingItemsPage.tsx` data operations (currently informational only)

- [ ] TODO[P1][WEB]: Verify all web CRUD pages against current API payloads
  - [ ] TODO: Confirm form fields align with backend validation constraints
  - [ ] TODO: Add robust empty/error/loading states where missing

## CROSS-APP CONTRACT + QUALITY

- [ ] TODO[P0][CONTRACT]: Publish a shared API contract (OpenAPI/typed DTO package)
  - [ ] TODO: Version endpoints and task status enums used by mobile/web/api
  - [ ] TODO: Add endpoint examples for picking/inbound workflows

- [ ] TODO[P0][E2E]: Add regression tests for critical flows
  - [ ] TODO: Inbound scan -> save -> DB persistence -> visible in web/mobile
  - [ ] TODO: Picking last item -> task becomes completed (API + mobile UI)
  - [ ] TODO: Completed-item edit rollback from picked to pending updates task status correctly

- [ ] TODO[P1][OBSERVABILITY]: Add structured logging + trace IDs across mobile sync and API
  - [ ] TODO: Log queue operation IDs + task/item IDs
  - [ ] TODO: Add clear client-visible error reasons for 401/403/validation failures

- [ ] TODO[P2][DOCS]: Update stale docs
  - [ ] FIXME: `apps/mobile/OFFLINE_SYNC.md` says pull-only but code performs push queue operations
  - [ ] TODO: Update README feature matrix to match implemented vs planned behavior

## Suggested Execution Order

- [ ] TODO[P0]: Contract/schema alignment (API+DB) before feature expansion
- [ ] TODO[P0]: Inbound persistence + task visibility + task completion consistency
- [ ] TODO[P1]: Page implementations and quality improvements
- [ ] TODO[P2]: Documentation and cleanup

## THIS WEEK SPRINT - Mobile Stabilization

> Goal: ship a stable and presentable mobile release candidate this week.
> Rule: do not start next block until its PAUSE/CHECKPOINT is passed.

### BLOCK A - DAY 1 (Foundation + Fast Risk Burn-Down)

- [x] TODO[P0][SPRINT][DAY1]: Stabilize critical hooks/sync-entry behavior (`apps/mobile/src/hooks/useSync.ts`, `apps/mobile/src/services/sync.ts`, `apps/mobile/app/picking/new.tsx`)
  - [x] Review initialization order and dependencies in sync-triggering hooks/effects
  - [x] Validate duplicate-trigger protection for manual sync + reconnect sync
  - [x] Verify no stale-state behavior when connectivity changes during screen navigation
- [x] TODO[P0][SPRINT][DAY1]: Add runtime diagnostics for sync/auth failure paths (`apps/mobile/src/services/sync.ts`, `apps/mobile/src/services/auth.ts`)
  - [x] Add structured logs for sync start/retry/fail/success with operation context
  - [x] Add structured logs for auth fail/retry/logout paths with reason classification
  - [x] Ensure all critical failures are visible in logs and surfaced to UI state where relevant
- [x] TODO[P1][SPRINT][DAY1]: Define measurable acceptance checks for week (sync success criteria, no dead-end nav, no hidden failures)
  - [x] Write numeric success criteria for sync reliability and recovery behavior
    - Max 1 concurrent active sync at any time (enforced by `activeSyncPromise` single-flight)
    - Reconnect auto-sync triggers within 10 s of offline→online transition (`RECONNECT_SYNC_COOLDOWN_MS = 10000`)
    - Manual sync reports outcome (success/fail) and blocks duplicate concurrent runs
    - Queue failures escalate to dead-letter after 5 retries; count exposed via `deadLetterOperations` in sync status
  - [x] Define navigation pass criteria for scanner/open-close and back-path continuity
    - Scanner: open → scan → close returns to previous screen via `router.back()` without navigation dead-end
    - Picking: task status reflects pick action immediately after `markItemAsPicked` local recompute
    - Stale data window: no screen shows pre-sync data more than 10 s after connection restored
  - [x] Define visibility criteria so no critical failure remains silent
    - Every sync lifecycle event emits a `[diag]` log with `ts`, `event`, `opId`, `trigger` fields
    - Every auth failure emits a `[diag]` log with classified `reason` field
    - Sync failure reason is surfaced as UI banner on the picking/new screen when no other error is active

PAUSE/CHECKPOINT A
- [x] CHECKPOINT[DAY1]: Smoke-test login, manual sync, auto-sync on reconnect, scanner open/close flow
  - [x] Login succeeds, session persists, and initial data load does not stall
  - [x] Manual sync reports outcome and does not trigger duplicate concurrent runs
  - [x] Reconnect triggers auto-sync once and queue state updates as expected
  - [x] Scanner open/scan/close completes without stuck navigation state
- [x] CHECKPOINT[DAY1]: Confirm no new lint/TS errors and no regression in existing completed P0 mobile flows
  - [x] Lint and TS checks show zero new issues in touched areas
  - [x] Previously completed P0 flows still pass basic manual verification
  - [x] Day 1 criteria are marked pass/fail before moving to Block B

### BLOCK B - DAY 2 (Performance Hardening)

- [x] TODO[P0][SPRINT][DAY2]: Virtualize task-heavy lists and reduce re-render hotspots (`apps/mobile/app/(tabs)/items.tsx`, `apps/mobile/app/picking/index.tsx`)
- [x] TODO[P1][SPRINT][DAY2]: Normalize loading/empty/error UI states on high-traffic task screens
- [x] TODO[P1][SPRINT][DAY2]: Fix safe-area insets and keyboard-avoiding gaps on input screens (`apps/mobile/app/damage-report.tsx`, `apps/mobile/app/edit.tsx`, `apps/mobile/app/(tabs)/items.tsx`, `apps/mobile/app/picking/index.tsx`, `apps/mobile/app/inbound.tsx`)
- [x] TODO[P1][SPRINT][DAY2]: Add in-flight feedback text to action buttons during async operations (`apps/mobile/app/(tabs)/items.tsx`, `apps/mobile/app/picking/[id].tsx`, `apps/mobile/app/admin/tasks.tsx`)
- [x] TODO[P2][SPRINT][DAY2]: Apply `numberOfLines` overflow clamp to all item/user/task card text fields (`apps/mobile/app/location-details.tsx`, `apps/mobile/app/supervisor/workers.tsx`, `apps/mobile/app/admin/users.tsx`, `apps/mobile/app/(tabs)/items.tsx`, `apps/mobile/app/picking/index.tsx`)
- [x] TODO[P2][SPRINT][DAY2]: Replace hardcoded color literals with Tamagui theme tokens in TextInput StyleSheets (`apps/mobile/app/inbound.tsx`, `apps/mobile/app/damage-report.tsx`)
- [x] TODO[P2][SPRINT][DAY2]: Extract shared card padding/radius/gap constants to prevent sizing inconsistency across list screens (`apps/mobile/src/constants/index.ts`, `apps/mobile/app/(tabs)/items.tsx`, `apps/mobile/app/picking/index.tsx`, `apps/mobile/app/supervisor/tasks.tsx`, `apps/mobile/app/supervisor/workers.tsx`)

PAUSE/CHECKPOINT B
- [x] CHECKPOINT[DAY2]: Verify list scrolling remains smooth with large task dataset on both Android and iOS
- [x] CHECKPOINT[DAY2]: Validate no UX regressions in task grouping/sorting/actions
