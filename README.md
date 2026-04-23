# Depo — Digitális Alkatrész- és Rendeléskezelő Rendszer

[![CI](https://github.com/Bobr-Soft/depo/actions/workflows/ci.yml/badge.svg)](https://github.com/Bobr-Soft/depo/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Yarn](https://img.shields.io/badge/yarn-4.12.0-blue)](https://yarnpkg.com/)

Teljes veremű leltárkezelő rendszer, Turborepo monorepo struktúrában megvalósítva. Egy **REST API** tárolja az adatokat MySQL adatbázisban, egy **React webes dashboard** biztosítja az adminisztrációs felületet, egy **Expo mobilalkalmazás** pedig vonalkód-olvasást és offline-első szinkronizációt tesz lehetővé — mindezt Yarn workspaceken keresztül megosztott kódbázissal.

## Architektúra

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

Mind a webes dashboard, mind a mobilalkalmazás HTTP-n keresztül kommunikál az API-val, JWT tokenek segítségével hitelesítve. A mobilalkalmazás emellett egy **helyi SQLite adatbázist** tart fenn, amely internetkapcsolat esetén szinkronizálódik a szerverrel, lehetővé téve a teljes offline működést.

## Alkalmazások

| Alkalmazás | Technológia | Leírás |
|---|---|---|
| `apps/api` | Node.js · Express 5 · MySQL | REST API JWT hitelesítéssel és szerepkör-alapú hozzáférésvezérléssel |
| `apps/web` | React 19 · Vite · Material UI | Adminisztrációs webes dashboard Azure AD bejelentkezéssel |
| `apps/mobile` | Expo 54 · React Native · Tamagui | iOS és Android alkalmazás vonalkód-olvasással és offline szinkronizációval |

## Funkciók

### Webes dashboard (`apps/web`)
- Leltárkezelés: tételek böngészése, keresése, hozzáadása, szerkesztése és törlése vonalkód-támogatással
- Kategóriák, helyszínek és felhasználók kezelése (csak adminisztrátoroknak)
- Kölcsönzési munkafolyamat
- Gyorsműveletek (tömeges hozzáadás és listázás)
- CSV exportálás
- Áttekintő és összefoglaló oldalak
- Azure AD / MSAL hitelesítés

### Mobilalkalmazás (`apps/mobile`)
- Vonalkód-olvasó a gyors tételt-kereséshez
- Komissiózási munkafolyamat (feladatok létrehozása, listázása és befejezése)
- Offline-első működés: az adatok helyi SQLite adatbázisban kerülnek gyorsítótárba, és visszatérő internetkapcsolat esetén szinkronizálódnak
- Automatikus újrapróbálkozás exponenciális visszalépéssel Render cold startok esetén (legfeljebb 90 másodperces időtúllépés, 3 kísérlet)
- Biztonságos tokentárolás `expo-secure-store` segítségével
- Sötét/világos témamód (automatikus)

### API (`apps/api`)
- JWT-alapú hitelesítés (1 órás token-élettartam)
- Szerepkör-alapú hozzáférésvezérlés (`admin` / `user`)
- Végpontok: `/auth`, `/items`, `/categories`, `/locations`, `/users`, `/tasks`
- Graceful degradation elérhetetlen adatbázis esetén
- Bemeneti érvényesítés minden írási végponton

## Csomagok

| Csomag | Leírás |
|---|---|
| `@repo/ui` | Megosztott Tamagui komponenskönyvtár, amelyet a mobilalkalmazás használ |
| `@repo/eslint-config` | Megosztott ESLint konfigurációk |
| `@repo/typescript-config` | Megosztott `tsconfig.json` alápkonfigurációk |

## Előfeltételek

- **Node.js 18+**
- **Yarn 4** — corepacken keresztül aktiválható (lásd 2. lépés)
- **MySQL 8** — futó példány üres adatbázissal
- **[EAS CLI](https://docs.expo.dev/eas/)** — csak mobilos buildekhez szükséges (`npm i -g eas-cli`)

## Gyors kezdés

### 1. A repository klónozása

```sh
git clone https://github.com/Bobr-Soft/depo.git
cd depo
```

### 2. A Yarn 4 aktiválása corepacken keresztül

```sh
corepack enable
```

> Jogosultsági hiba esetén futtasd a parancsot emelt szintű terminálban (Windows: Rendszergazdaként, macOS/Linux: `sudo`).

### 3. Függőségek telepítése

```sh
yarn install
```

Ez a monorepo összes alkalmazásának és csomagjának függőségeit telepíti.

### 4. MySQL adatbázis létrehozása

Hozz létre egy üres adatbázist — az API az első indításkor automatikusan létrehozza az összes táblát:

```sql
CREATE DATABASE depo;
```

### 5. Környezeti változók konfigurálása

**API** — hozd létre az `apps/api/.env` fájlt:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-db-password
DB_NAME=depo
JWT_SECRET=your-strong-random-secret
PORT=4000
CORS_ORIGINS=http://localhost:5173
```

> Az API **megtagadja az indítást**, ha a `JWT_SECRET` nincs beállítva.

**Web** — hozd létre az `apps/web/.env` fájlt:

```env
VITE_API_URL=http://localhost:4000
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

**Mobile** — az API URL-je az `EXPO_PUBLIC_API_URL` változón keresztül kerül beállításra az `apps/mobile/.env` fájlban, build időben. Ha az `expo-secure-store`-ba korábban el lett mentve egy érték (pl. korábbi felülírásból), az elsőbbséget élvez; egyébként a build idejű `.env` érték érvényes.

### 6. Fejlesztői szerver indítása

```sh
yarn dev
```

Ez párhuzamosan elindítja az API-t (http://localhost:4000) és a webes dashboardot (http://localhost:5173) Turborepon keresztül.

A mobilalkalmazás önállóan is indítható:

```sh
yarn workspace mobile start
```

### 7. A webes dashboard megnyitása

Nyisd meg a webes felületet:

- http://localhost:5173

Bejelentkezési szabályok:

- Csak `@petrik.hu` végű e-mail-cím használható a bejelentkezéshez.
- Ezen felül a felhasználónak szerepelnie kell az adatbázis `users` táblájában (engedélyezőlista). Ha az e-mail-cím nem található az adatbázisban, az API megtagadja a bejelentkezést (HTTP 403).

Demo fiókok (csak fejlesztői környezetben):

- `bogyo@petrik.hu` / `Kortefa123` (adminisztrátor)
- `mez@petrik.hu` / `Almafa123` (alkalmazott)



## Azure AD konfiguráció

Mind a webes, mind a mobilalkalmazás támogatja az Azure AD hitelesítést. Az engedélyezéshez:

1. Regisztrálj egy alkalmazást az [Azure Portalon](https://portal.azure.com/) → **Alkalmazásregisztrációk** menüpontban
2. Állítsd be a **Támogatott fióktípusokat**: *Egybérlős* (vagy igény szerint)
3. Add meg az **Átirányítási URI-kat**:
   - Web: `http://localhost:5173` (fejlesztés) és az éles környezet URL-je
   - Mobile: az Expo auth session átirányítási URI-ja
4. Másold az **Alkalmazás (kliens) azonosítóját** és a **Könyvtár (bérlő) azonosítóját** a megfelelő `.env` fájlokba (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID` a web esetén)

## Parancsok referenciája

Minden parancs a monorepo gyökérkönyvtárából futtatandó:

| Parancs | Leírás |
|---|---|
| `yarn dev` | API + web indítása fejlesztői módban |
| `yarn build` | Összes alkalmazás buildelése |
| `yarn lint` | Összes alkalmazás lintolása |
| `yarn format` | Összes `.ts`, `.tsx`, `.md` fájl formázása Prettierrel |
| `yarn check-types` | Összes TypeScript projekt típusellenőrzése |
| `yarn workspace mobile start` | Expo fejlesztői szerver indítása a mobilhoz |
| `yarn workspace backend test` | API tesztek futtatása (Jest, terminál kimenet) |
| `yarn workspace backend test:report` | API tesztek futtatása + HTML riport generálása (`apps/api/test-reports/test-results.html`) |

## Tesztelés

Az API Jest tesztcsomaggal rendelkezik, amelynek adatbázis-kapcsolatai mock-olva vannak — a tesztek futtatásához nincs szükség működő MySQL példányra:

```sh
# Tesztek futtatása (terminál kimenet)
yarn workspace backend test

# Tesztek futtatása + HTML riport generálása
yarn workspace backend test:report
```

### HTML tesztriport

A `test:report` parancs lefuttatja az összes tesztet, és egy önálló HTML fájlt generál:

```
apps/api/test-reports/test-results.html
```

A riport tartalmazza az összes tesztcsoportot és tesztet egyenként, a futási időkkel és pass/fail státusszal — böngészőben közvetlenül megnyitható, és offline megosztható külső érintettekkel.

**Automatikus frissítés CI-ban:** minden `dev` vagy `main` ágra való push után a GitHub Actions automatikusan lefuttatja a teszteket, és egy `docs: update API test report [skip ci]` committal visszatölti a frissített riportot a repóba.

## Mobilos buildek

A buildeket az [EAS Build](https://docs.expo.dev/build/introduction/) kezeli (Expo Application Services):

```sh
# Preview build (mindkét platform)
yarn workspace mobile build:all

# Csak Android
yarn workspace mobile build:android

# Csak iOS
yarn workspace mobile build:ios
```

## CI/CD

GitHub Actions workflow-ok a `.github/workflows/` könyvtárban:

| Workflow | Esemény | Feladat |
|---|---|---|
| `ci.yml` | Push / PR | Lintolás és tesztek futtatása |
| `deploy-api.yml` | Push `main` ágra (API módosítások) | Tesztek futtatása, API deploy |
| `deploy-web.yml` | Push `main` ágra (webes módosítások) | Webes dashboard deployolása |
| `release-drafter.yml` | Push `main` / `dev` ágra | iOS és Android build EAS-en keresztül, APK/IPA csatolása a GitHub release-hez; `dev` ágra való push `nightly` pre-release-t hoz létre |
| `mobile.yml` | Mobilos módosítások | Mobilalkalmazás buildelése EAS-en keresztül |

## Projektstruktúra

```
depo/
├── apps/
│   ├── api/              # Express REST API (Node.js)
│   ├── mobile/           # Expo React Native alkalmazás
│   └── web/              # React + Vite webes dashboard
├── packages/
│   ├── ui/               # Megosztott Tamagui komponensek
│   ├── eslint-config/    # Megosztott ESLint konfigurációk
│   └── typescript-config/ # Megosztott tsconfig alapok
├── turbo.json            # Turborepo feladatfolyamat
└── package.json          # Gyökér workspace konfiguráció (Yarn 4)
```

## Hibaelhárítás

| Probléma | Megoldás |
|---|---|
| `corepack enable` sikertelen | Futtasd emelt szintű terminálban (Rendszergazda / `sudo`) |
| Az API „JWT_SECRET is required" hibával leáll | Add hozzá a `JWT_SECRET` változót az `apps/api/.env` fájlhoz |
| `ER_ACCESS_DENIED_ERROR` MySQL-től | Ellenőrizd a `DB_USER` és `DB_PASSWORD` értékeket az `apps/api/.env` fájlban |
| Az API 30–90 másodpercet vesz igénybe az első kérésre | Render ingyenes csomag cold start — a mobilalkalmazás automatikusan újrapróbálkozik |
| `yarn install` „Invalid authentication" hibával sikertelen | Futtasd előbb a `corepack enable` parancsot, vagy töröld a `.yarn/install-state.gz` fájlt és próbáld újra |

## Közreműködés

Az irányelvekért lásd a [CONTRIBUTING.md](.github/CONTRIBUTING.md) fájlt.

## Biztonság

Biztonsági rés bejelentéséhez lásd a [SECURITY.md](.github/SECURITY.md) fájlt.

## Licenc

ISC
