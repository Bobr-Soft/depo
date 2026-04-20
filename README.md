# Depo — Digital Ecosystem for Parts & Orders

[![CI](https://github.com/Bobr-Soft/depo/actions/workflows/ci.yml/badge.svg)](https://github.com/Bobr-Soft/depo/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Yarn](https://img.shields.io/badge/yarn-4.12.0-blue)](https://yarnpkg.com/)

A full-stack inventory management system built as a Turborepo monorepo. A **REST API** stores data in MySQL, a **React web dashboard** provides admin controls, and an **Expo mobile app** adds barcode scanning with offline-first sync — all sharing code through Yarn workspaces.

## Architecture

```
┌───────────┐      ┌──────────┐
│  Mobile   │      │   Web    │
│ (Expo RN) │      │ (React)  │
└────┬──────┘      └────┬─────┘
     │  HTTP/JWT        │  HTTP/JWT
     │                  │
     ▼                  ▼
┌────────────────────────────┐
│        API (Express)       │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│        MySQL 8 Database    │
└────────────────────────────┘
```

Both the web dashboard and mobile app communicate with the API over HTTP using JWT tokens for authentication. The mobile app additionally maintains a **local SQLite database** that syncs with the server when connectivity is available, allowing full offline operation.

## Apps

| App | Stack | Description |
|---|---|---|
| `apps/api` | Node.js · Express 5 · MySQL | REST API with JWT auth & role-based access control |
| `apps/web` | React 19 · Vite · Material UI | Admin web dashboard with Azure AD login |
| `apps/mobile` | Expo 54 · React Native · Tamagui | iOS & Android app with barcode scanning & offline sync |

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

- **Node.js 18+**
- **Yarn 4** — enabled via corepack (see step 2 below)
- **MySQL 8** — a running instance with an empty database
- **[EAS CLI](https://docs.expo.dev/eas/)** — only needed for mobile builds (`npm i -g eas-cli`)

## Quick start

### 1. Clone the repository

```sh
git clone https://github.com/Bobr-Soft/depo.git
cd depo
```

### 2. Enable Yarn 4 via corepack

```sh
corepack enable
```

> If you see a permissions error, run the command in an elevated terminal (Admin on Windows, `sudo` on macOS/Linux).

### 3. Install dependencies

```sh
yarn install
```

This installs dependencies for all apps and packages in the monorepo.

### 4. Create a MySQL database

Create an empty database — the API will auto-create all tables on first startup:

```sql
CREATE DATABASE depo;
```

### 5. Configure environment variables

**API** — create `apps/api/.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-db-password
DB_NAME=depo
JWT_SECRET=your-strong-random-secret
PORT=4000
CORS_ORIGINS=http://localhost:5173
```

> The API will **refuse to start** if `JWT_SECRET` is not set.

**Web** — create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

**Mobile** — no build-time `.env` required. The API URL is configured at runtime inside the app (stored in `expo-secure-store`). On first launch, enter the URL on the profile/settings screen.

### 6. Start development

```sh
yarn dev
```

This launches both the API (http://localhost:4000) and the web dashboard (http://localhost:5173) in parallel via Turborepo.

To run the mobile app separately:

```sh
yarn workspace mobile start
```

## Azure AD setup

Both the web and mobile apps support Azure AD authentication. To enable it:

1. Register an application in the [Azure Portal](https://portal.azure.com/) → **App registrations**
2. Set **Supported account types** to *Single tenant* (or as needed)
3. Add **Redirect URIs**:
   - Web: `http://localhost:5173` (dev) and your production URL
   - Mobile: the Expo auth session redirect URI
4. Copy the **Application (client) ID** and **Directory (tenant) ID** into the respective `.env` files (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID` for web)

## Scripts reference

All commands are run from the monorepo root:

| Command | Description |
|---|---|
| `yarn dev` | Start API + web in development mode |
| `yarn build` | Build all apps |
| `yarn lint` | Lint all apps |
| `yarn format` | Format all `.ts`, `.tsx`, `.md` files with Prettier |
| `yarn check-types` | Type-check all TypeScript projects |
| `yarn workspace mobile start` | Start Expo dev server for mobile |
| `yarn workspace backend test` | Run API tests (Jest) |

## Testing

The API has a Jest test suite with mocked database connections — no running MySQL instance is needed for tests:

```sh
yarn workspace backend test
```

## Mobile builds

Builds are handled by [EAS Build](https://docs.expo.dev/build/introduction/) (Expo Application Services):

```sh
# Preview build (both platforms)
yarn workspace mobile build:all

# Android only
yarn workspace mobile build:android

# iOS only
yarn workspace mobile build:ios
```

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push / PR | Runs linting and tests |
| `deploy-api.yml` | Push to `main` (api changes) | Runs tests, deploys API to Render |
| `deploy-web.yml` | Push to `main` (web changes) | Deploys web dashboard |
| `release-drafter.yml` | Push to `main` / `dev` | Builds iOS & Android via EAS, attaches APK/IPA to GitHub release; `dev` pushes create a rolling `nightly` pre-release |
| `mobile.yml` | Mobile changes | Builds mobile app via EAS |

## Deployment

The API is deployed on [Render](https://render.com) (free tier). Environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`) are configured in the Render dashboard — there is no `render.yaml` in this repo.

> **Note:** Render's free tier spins down after inactivity. The mobile app handles cold starts automatically with a 90-second timeout and retry logic.

## Project structure

```
depo/
├── apps/
│   ├── api/              # Express REST API (Node.js)
│   ├── mobile/           # Expo React Native app
│   └── web/              # React + Vite web dashboard
├── packages/
│   ├── ui/               # Shared Tamagui components
│   ├── eslint-config/    # Shared ESLint configs
│   └── typescript-config/ # Shared tsconfig bases
├── turbo.json            # Turborepo task pipeline
└── package.json          # Root workspace config (Yarn 4)
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `corepack enable` fails | Run in an elevated terminal (Admin / `sudo`) |
| API exits with "JWT_SECRET is required" | Add `JWT_SECRET` to `apps/api/.env` |
| `ER_ACCESS_DENIED_ERROR` from MySQL | Verify `DB_USER` and `DB_PASSWORD` in `apps/api/.env` |
| API takes 30-90s to respond on first request | Render free tier cold start — the mobile app retries automatically |
| `yarn install` fails with "Invalid authentication" | Run `corepack enable` first, or delete `.yarn/install-state.gz` and retry |

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

## Security

To report a vulnerability, see [SECURITY.md](.github/SECURITY.md).

## License

ISC
