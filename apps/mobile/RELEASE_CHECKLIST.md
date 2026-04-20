# Release Candidate Checklist — Mobile App

## Pre-release Verification

### Build & Install
- [ ] `eas build --profile preview --platform android` succeeds
- [ ] `eas build --profile preview --platform ios` succeeds
- [ ] APK installs cleanly on physical Android device
- [ ] iOS build installs via TestFlight

### Authentication
- [ ] Azure AD login flow completes (Android)
- [ ] Azure AD login flow completes (iOS)
- [ ] Token refresh works after 30+ min idle
- [ ] Logout clears token and redirects to login

### Offline / Sync
- [ ] App launches fully offline (airplane mode)
- [ ] Items list loads from local cache when offline
- [ ] Tasks list loads from local cache when offline
- [ ] Sync badge shows pending count while offline
- [ ] Going online triggers auto-sync within 30s
- [ ] Dead-letter banner appears on items/picking screens when sync fails
- [ ] Dead-letter clear button works on profile screen
- [ ] Force pull refreshes data from server

### Inbound
- [ ] Barcode scan creates inbound draft
- [ ] Kill app mid-draft → reopen → draft recovered banner shown
- [ ] Dismiss recovered draft clears it
- [ ] Submit inbound → draft cleared, stock updated
- [ ] Location picker shows correct zones/aisles

### Picking / Tasks
- [ ] Task list shows assigned + unassigned tasks for worker
- [ ] "Take" assigns task to current user
- [ ] "Release" unassigns task
- [ ] Picking items updates picked quantity
- [ ] All items picked → task auto-completes
- [ ] Admin/supervisor can assign tasks to other users
- [ ] Admin/supervisor can change task status

### Damage Reports
- [ ] Submit damage report with photo attachment
- [ ] Report appears in supervisor damage list

### Warehouse Map
- [ ] Map renders zones and locations
- [ ] Tapping location shows details

### UI / UX
- [ ] Dark mode renders correctly
- [ ] Landscape orientation doesn't break layout
- [ ] Pull-to-refresh works on main lists
- [ ] No JS yellow-box warnings in release build

## Sign-off

| Platform | Tester | Date | Pass? |
|----------|--------|------|-------|
| Android  |        |      |       |
| iOS      |        |      |       |
