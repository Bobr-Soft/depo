# Depo — Digital Ecosystem for Parts & Orders

A full-stack inventory management system built as a monorepo. Includes a web dashboard, a mobile app with barcode scanning and offline support, and a REST API backend.

## Apps

| App | Stack | Description |
|---|---|---|
| `apps/api` | Node.js · Express · MySQL | REST API with JWT authentication, deployed on Render |
| `apps/web` | React 19 · Vite · Material UI | Admin web dashboard |
| `apps/mobile` | Expo · React Native · Tamagui | Mobile app for iOS & Android with offline-first sync |

## Features

### Web dashboard (`apps/web`)
- Inventory: browse, search, add, edit, delete items with barcode support
- Manage categories, locations, users (admin-only)
- Renting items workflow
- Quick actions (batch add/list)
- CSV export
- Overview and dashboard pages
- Azure AD / MSAL authentication

### Mobile app (`apps/mobile`)
- Barcode scanner for fast item lookup
- Picking workflow (create, list, and complete picking tasks)
- Offline-first: data is cached in a local SQLite database and synced when back online
- Automatic retry with exponential backoff for Render cold starts (up to 90s timeout, 3 attempts)
- Secure token storage via `expo-secure-store`
- Dark/light mode (automatic)

### API (`apps/api`)
- JWT-based authentication (1h token expiry)
- Role-based access control (`admin` / `user`)
- Endpoints: `/auth`, `/items`, `/categories`, `/locations`, `/users`, `/tasks`
- Graceful degradation when DB is unreachable
- Input validation on all write endpoints

## Packages

| Package | Description |
|---|---|
| `@repo/ui` | Shared Tamagui component library used by the mobile app |
| `@repo/eslint-config` | Shared ESLint configs |
| `@repo/typescript-config` | Shared `tsconfig.json` bases |

## Prerequisites

- Node.js 18+
- Yarn 4 (`corepack enable`)
- A MySQL 8 database
- [EAS CLI](https://docs.expo.dev/eas/) for mobile builds (`npm i -g eas-cli`)

## Getting started

```sh
# Install all dependencies
yarn install

# Run everything in development (web + api)
yarn dev

# Build all apps
yarn build

# Lint all apps
yarn lint
```

### API environment variables

Create `apps/api/.env`:

```env
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
JWT_SECRET=your-strong-random-secret
PORT=4000
CORS_ORIGINS=http://localhost:5173,https://your-web-app.com
```

> The API will **refuse to start** if `JWT_SECRET` is not set.

### Web environment variables

Create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:4000
```

### Mobile

The API URL is configured at runtime inside the app (stored in `expo-secure-store`), so no build-time env var is required. On first launch, enter the API URL on the profile/settings screen.

## Mobile builds

Builds are handled by [EAS Build](https://docs.expo.dev/build/introduction/) (Expo Application Services):

```sh
# Preview build (both platforms)
yarn workspace depo-mobile build:all

# Android only
yarn workspace depo-mobile build:android

# iOS only
yarn workspace depo-mobile build:ios
```

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy-api.yml` | Push to `main` (api changes) | Runs tests, deploys API to Render |
| `release-drafter.yml` | Push to `main` / `dev` | Builds iOS & Android via EAS, attaches APK/IPA to GitHub release; `dev` pushes create a rolling `nightly` pre-release |

## Deployment

The API is deployed on [Render](https://render.com) (free tier). Environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`) are configured in the Render dashboard — there is no `render.yaml` in this repo.

> **Note:** Render's free tier spins down after inactivity. The mobile app handles cold starts automatically with a 90-second timeout and retry logic.

## Project structure

```
depo/
├── apps/
│   ├── api/          # Express REST API
│   ├── mobile/       # Expo React Native app
│   └── web/          # React + Vite web dashboard
└── packages/
    ├── ui/           # Shared Tamagui components
    ├── eslint-config/
    └── typescript-config/
```
