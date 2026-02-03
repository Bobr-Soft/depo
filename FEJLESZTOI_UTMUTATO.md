# Depo Projekt - Fejlesztői Útmutató

## 📋 Tartalomjegyzék
- [Mi az a monorepo?](#mi-az-a-monorepo)
- [Projekt struktúra](#projekt-struktúra)
- [Yarn vs NPM - Mi a különbség?](#yarn-vs-npm---mi-a-különbség)
- [Első lépések](#első-lépések)
- [Fejlesztési környezet beállítása](#fejlesztési-környezet-beállítása)
- [Fejlesztési folyamat](#fejlesztési-folyamat)
- [Hasznos parancsok](#hasznos-parancsok)
- [Gyakori hibák és megoldásaik](#gyakori-hibák-és-megoldásaik)
- [Web alkalmazás fejlesztése](#web-alkalmazás-fejlesztése)
- [API fejlesztése](#api-fejlesztése)

---

## 🤔 Mi az a monorepo?

### Hagyományos repo vs Monorepo

**Hagyományos megközelítés** (amit eddig használtál):
```
projekt-api/          (külön repo)
projekt-frontend/     (külön repo)
projekt-mobile/       (külön repo)
```

**Monorepo megközelítés** (amit itt használunk):
```
depo/                 (egy repo mindenhol!)
  ├── apps/
  │   ├── api/        (backend)
  │   ├── web/        (frontend)
  │   └── mobile/     (mobil app)
  └── packages/
      └── ui/         (közös komponensek)
```

### Előnyök

✅ **Egyszerű kód megosztás**: A `packages/ui` mappában lévő komponenseket mind a web, mind a mobile használja  
✅ **Egyetlen verziókezelés**: Egy `git pull` minden projektet frissít  
✅ **Könnyebb refaktorálás**: Ha változtatsz egy közös kódon, azonnal látod minden hatását  
✅ **Egységes tooling**: Egy ESLint, egy TypeScript konfig mindenhol

---

## 📁 Projekt struktúra

```
depo/
├── apps/                          # Alkalmazások
│   ├── api/                       # ⭐ Backend API (Express.js)
│   │   ├── index.js              # Fő API fájl (289 sor)
│   │   ├── db.js                 # MySQL adatbázis kapcsolat
│   │   ├── package.json          # API függőségek
│   │   └── .env.example          # Környezeti változók minta
│   │
│   ├── web/                       # ⭐ Frontend alkalmazás (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/            # React oldalak
│   │   │   ├── components/       # React komponensek
│   │   │   ├── services/         # API hívások (api.ts)
│   │   │   └── authConfig.ts     # Azure AD beállítások
│   │   ├── package.json          # Frontend függőségek
│   │   └── .env.example          # Környezeti változók minta
│   │
│   └── mobile/                    # Mobil alkalmazás (React Native + Expo)
│       ├── app/                   # Expo Router oldalak
│       ├── src/                   # Mobil komponensek
│       └── package.json
│
├── packages/                      # Megosztott csomagok
│   ├── ui/                        # Közös UI komponensek
│   │   └── src/
│   │       └── components/
│   ├── eslint-config/             # ESLint konfigurációk
│   └── typescript-config/         # TypeScript konfigurációk
│
├── package.json                   # Root package.json (monorepo beállítások)
├── turbo.json                     # Turborepo konfiguráció
└── yarn.lock                      # Verziókezelés (NE TÖRÖLD!)
```

---

## � Yarn vs NPM - Mi a különbség?

### Miért Yarn és nem NPM?

Ha eddig NPM-et használtál, lehet, hogy felmerül a kérdés: "Miért kellene váltanom?"  
Ez a projekt **Yarn 4**-et használ (más néven Yarn Berry), ami **sokkal gyorsabb** és **jobban működik monorepo projektekben** mint az NPM.

### Főbb különbségek

| Funkció | NPM | Yarn 4 |
|---------|-----|--------|
| **Sebesség** | Lassabb | ⚡ **3-5x gyorsabb** |
| **Monorepo támogatás** | Alapszintű | 🎯 **Beépített workspace kezelés** |
| **Offline mód** | Korlátozott | ✅ **Teljes offline cache** |
| **Biztonság** | Jó | 🔒 **Checksum ellenőrzés** |
| **Lock fájl** | `package-lock.json` | `yarn.lock` |
| **Függőség tárolás** | `node_modules/` | `.yarn/cache/` (Plug'n'Play) |

### NPM vs Yarn parancsok - Átváltási útmutató

Ha eddig NPM-et használtál, itt az összehasonlítás:

#### 📥 Telepítés

| Mit csinálsz | NPM parancs | Yarn parancs | Magyarázat |
|--------------|-------------|--------------|------------|
| Összes függőség telepítése | `npm install` | `yarn install` vagy csak `yarn` | Telepíti a `package.json`-ban lévő összes csomagot |
| Egy új csomag hozzáadása | `npm install react` | `yarn add react` | Hozzáadja a csomagot a függőségekhez |
| Dev függőség hozzáadása | `npm install -D eslint` | `yarn add -D eslint` | Csak fejlesztéshez szükséges csomag |
| Globális telepítés | `npm install -g typescript` | `yarn global add typescript` | Rendszerszinten telepít |

#### 🗑️ Eltávolítás

| Mit csinálsz | NPM parancs | Yarn parancs |
|--------------|-------------|--------------|
| Csomag eltávolítása | `npm uninstall react` | `yarn remove react` |

#### 🚀 Scriptek futtatása

| Mit csinálsz | NPM parancs | Yarn parancs | Magyarázat |
|--------------|-------------|--------------|------------|
| Script futtatása | `npm run dev` | `yarn dev` | A `package.json` scripts részében definiált parancs futtatása |
| Script futtatása (explicit) | `npm run dev` | `yarn run dev` | Ugyanaz, de explicit módon |

#### 📋 Információk

| Mit csinálsz | NPM parancs | Yarn parancs |
|--------------|-------------|--------------|
| Telepített csomagok listája | `npm list` | `yarn list` |
| Csomag infó | `npm info react` | `yarn info react` |
| Elavult csomagok | `npm outdated` | `yarn upgrade-interactive` |

#### 🧹 Cache kezelés

| Mit csinálsz | NPM parancs | Yarn parancs |
|--------------|-------------|--------------|
| Cache törlése | `npm cache clean --force` | `yarn cache clean` |

### Monorepo specifikus Yarn parancsok

Ezek a parancsok **csak Yarn-ban** léteznek és kifejezetten monorepo projektekhez készültek:

#### `yarn workspace <workspace-név> <parancs>`

Egy adott workspace-ben (app vagy package) futtat parancsot.

**Példák:**
```bash
# API dev mód indítása
yarn workspace backend dev

# Web függőség hozzáadása
yarn workspace web add axios

# Mobile csomag eltávolítása
yarn workspace mobile remove lodash
```

**Miért jó ez?** NPM-nél be kellene menned az adott mappába (`cd apps/web`) és ott futtatnod a parancsot. Yarn-nál a root-ból mindent elérsz!

#### `yarn workspaces foreach <parancs>`

MINDEN workspace-ben futtat egy parancsot egyszerre.

**Példák:**
```bash
# Build minden projektet
yarn workspaces foreach run build

# TypeScript ellenőrzés mindenhol
yarn workspaces foreach run type-check

# Összes teszt futtatása
yarn workspaces foreach run test
```

**Miért jó ez?** NPM-nél egyesével kellene futtatnod mindenhol. Yarn-nál egyetlen parancs!

#### `yarn dlx <csomag>`

Futtat egy csomagot anélkül, hogy telepítené (mint az NPM `npx`).

**Példák:**
```bash
# Create React App futtatása telepítés nélkül
yarn dlx create-react-app my-app

# TypeScript compiler futtatása
yarn dlx tsc --version
```

**NPM megfelelője:** `npx`

### Gyakorlati példák - Napi munkafolyamat

#### 🎯 Első telepítés után

```bash
# 1. Projekt klónozása
git clone https://github.com/Bobr-Soft/depo.git
cd depo

# 2. Függőségek telepítése (csak EGYSZER a root-ból!)
yarn install

# 3. Minden app indítása egyszerre
yarn dev
```

#### 🔧 Új csomag hozzáadása az API-hoz

**NPM-mel régen:**
```bash
cd apps/api
npm install express
cd ../..
```

**Yarn-nal most:**
```bash
# A root-ból egyből!
yarn workspace backend add express
```

#### 🎨 Új csomag hozzáadása a Web-hez

```bash
# A root-ból!
yarn workspace web add axios react-router-dom

# Vagy dev függőség
yarn workspace web add -D @types/react
```

#### 🧪 Build minden projektet

**NPM-mel régen:**
```bash
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
cd apps/mobile && npm run build && cd ../..
```

**Yarn-nal most:**
```bash
# Egy parancs, 3 build párhuzamosan!
yarn workspaces foreach run build
```

### Yarn 4 specialitások - Amit tudnod kell

#### 1. **Plug'n'Play (PnP) mód**

Alapértelmezetten Yarn 4 **NEM hoz létre `node_modules/` mappát**!  
Helyette egy `.yarn/cache/` mappába kerülnek a csomagok és a `.pnp.cjs` fájl kezeli őket.

**Mit jelent ez neked?**
- ⚡ **Gyorsabb telepítés** (nincs sok ezer fájl másolgatás)
- 💾 **Kevesebb lemezterület** (csomagok egyszer vannak letöltve)
- 🔒 **Biztonságosabb** (nem lehet "véletlen" függőséget használni)

**Ha mégis node_modules-t szeretnél:**
Hozz létre egy `.yarnrc.yml` fájlt a root-ban:
```yaml
nodeLinker: node-modules
```

#### 2. **Zero-Install támogatás**

Yarn 4-ben a `.yarn/cache/` mappát **commitolhatod Git-be**!  
Ez azt jelenti, hogy mások `yarn install` **nélkül** is futtathatják a projektet.

**Ebben a projektben:** Nem commitoljuk a cache-t (a `.gitignore` kizárja), mert nagy méretű lenne.

#### 3. **Yarn verzió kezelés**

Ez a projekt **beépített Yarn-t** használ. Ha megnézed a repo-t, látsz egy `.yarn/releases/` mappát.  
Ez azt jelenti, hogy **nem kell globálisan telepítened a Yarn-t** - a projekt magában hordozza!

```bash
# Ez automatikusan a projekt Yarn verzióját használja
yarn --version
```

### Gyakori hibák Yarn-nál (ha NPM-ről jössz)

#### ❌ HIBÁS: `npm install` futtatása

```bash
npm install  # ❌ NE CSINÁLD!
```

Ez létrehoz egy `package-lock.json` fájlt és `node_modules/` mappát, ami **ütközhet** a Yarn `yarn.lock` fájljával!

#### ✅ HELYES:

```bash
yarn install  # ✅ Használd ezt!
```

---

#### ❌ HIBÁS: Workspace-be belépés és ott telepítés

```bash
cd apps/web
yarn add react  # ❌ Működik, de nem ajánlott!
cd ../..
```

#### ✅ HELYES: Root-ból workspace parancs

```bash
yarn workspace web add react  # ✅ Root-ból kezeld!
```

---

#### ❌ HIBÁS: `npm run` használata

```bash
npm run dev  # ❌ Ez NPM scriptet fog hívni!
```

#### ✅ HELYES:

```bash
yarn dev  # ✅ Yarn scriptet hív!
```

### Hasznos Yarn parancsok debug-oláshoz

```bash
# Ellenőrizd a Yarn verziót
yarn --version

# Nézd meg a workspace-ek listáját
yarn workspaces list

# Részletes info egy csomagról
yarn info react

# Dependency fa megjelenítése
yarn why react

# Cache méretének ellenőrzése
yarn cache clean --dry-run
```

### Összefoglalás - Mire emlékezz

1. **NPM helyett mindig Yarn-t használj** ebben a projektben
2. **Csak a root mappából telepíts** (`yarn install`)
3. **Workspace parancsokat használj** ha egy adott app-hoz kell csomag (`yarn workspace backend add express`)
4. **Ne keverd az NPM-et és Yarn-t** - válaszd ki az egyiket!
5. **A `yarn.lock` fájlt mindig commitold** Git-be (verziókezeléshez kell)

---

## �🚀 Első lépések

### 1. Előfeltételek

Győződj meg róla, hogy telepítve van:

- **Node.js** v18 vagy újabb ([letöltés](https://nodejs.org/))
- **Yarn** 4.x (automatikusan települ a projekt használata során)
- **Git** ([letöltés](https://git-scm.com/))

Ellenőrzés:
```bash
node --version    # v18.0.0 vagy újabb
git --version
```

### 2. Projekt klónozása

```bash
git clone https://github.com/Bobr-Soft/depo.git
cd depo
```

### 3. Függőségek telepítése

**FONTOS**: A monorepoban **EGYSZER** kell csak futtatni a telepítést a root mappában!

```bash
yarn install
```

Ez automatikusan telepíti az ÖSSZES projekt függőségeit:
- `apps/api` függőségeit
- `apps/web` függőségeit
- `apps/mobile` függőségeit
- `packages/ui` függőségeit

⚠️ **NE MENJ BE** az egyes app mappákba és **NE FUTTASD** ott a `yarn install`-t!

---

## ⚙️ Fejlesztési környezet beállítása

### API beállítása

1. **Hozz létre `.env` fájlt** az `apps/api/` mappában:

```bash
cd apps/api
cp .env.example .env
```

2. **Állítsd be az adatbázis kapcsolatot** a `.env` fájlban:

```env
HOST=localhost
USER=root
PASSWORD=yourpassword
DB_NAME=school_inventory
```

3. **Győződj meg róla, hogy a MySQL szerver fut** és létezik a `school_inventory` adatbázis.

4. **Teszteld a kapcsolatot**:

```bash
# A root mappából
yarn workspace backend dev
```

Ha minden rendben, látnod kell:
```
✅ Database connection successful
✅ Server running on http://localhost:4000
```

### Web beállítása

1. **Hozz létre `.env` fájlt** az `apps/web/` mappában:

```bash
cd apps/web
cp .env.example .env
```

2. **Állítsd be a környezeti változókat**:

```env
# API endpoint (az API portjával egyező)
VITE_API_URL=http://localhost:4000

# Azure AD Authentication
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

---

## 💻 Fejlesztési folyamat

### Az egész projekt indítása

A **legegyszerűbb módszer** - mindent egyszerre indít (API + Web + Mobile):

```bash
# A root mappából
yarn dev
```

Ez a Turborepo-nak köszönhetően párhuzamosan indítja:
- API-t a `http://localhost:4000` címen
- Web-et a `http://localhost:5173` címen  
- Mobile-t (Expo)

### Csak az API indítása

Ha csak a backend-en dolgozol:

```bash
# A root mappából
yarn workspace backend dev
```

Vagy közvetlenül:

```bash
cd apps/api
yarn dev
```

**Hot reload engedélyezve**: A fájl mentésekor automatikusan újraindul a szerver.

### Csak a Web indítása

Ha csak a frontend-en dolgozol:

```bash
# A root mappából
yarn workspace frontend dev
```

Vagy közvetlenül:

```bash
cd apps/web
yarn dev
```

Böngésző automatikusan megnyílik: `http://localhost:5173`

### Több app egyidejű indítása (filter használat)

```bash
# Csak a web és az API
turbo dev --filter=frontend --filter=backend
```

---

## 📝 Hasznos parancsok

### Monorepo szintű parancsok (root mappából)

```bash
# Minden projekt indítása fejlesztői módban
yarn dev

# Minden projekt buildel
yarn build

# Linting futtatása mindenütt
yarn lint

# TypeScript típusellenőrzés
yarn check-types

# Kód formázás (Prettier)
yarn format
```

### Specifikus workspace parancsok

A `yarn workspace <név> <parancs>` formátumot használd:

```bash
# API parancsok
yarn workspace backend dev          # API indítása
yarn workspace backend start        # API produkciós mód
yarn workspace backend lint         # API linting

# Web parancsok
yarn workspace frontend dev         # Web dev szerver
yarn workspace frontend build       # Produkciós build
yarn workspace frontend preview     # Build preview
yarn workspace frontend lint        # Frontend linting
```

### Turborepo parancsok (haladó)

```bash
# Csak egy specifikus app buildel
turbo build --filter=frontend

# Csak egy specifikus app indul
turbo dev --filter=backend

# Több app egyidejűleg
turbo dev --filter=frontend --filter=backend

# Cache törlés
turbo run build --force
```

### Függőség telepítés

```bash
# Csomag hozzáadása az API-hoz
yarn workspace backend add express-session

# Csomag hozzáadása a Web-hez
yarn workspace frontend add axios

# Csomag hozzáadása a UI package-hez
yarn workspace @repo/ui add react-icons

# Dev dependency hozzáadása
yarn workspace frontend add -D vite-plugin-something
```

---

## 🎨 Web alkalmazás fejlesztése

### Tech stack

- **Framework**: React 19
- **Build tool**: Vite 7
- **UI Library**: Material-UI (MUI) v7
- **Routing**: React Router v7
- **Auth**: Azure AD (MSAL)
- **HTTP Client**: Axios
- **State Management**: React hooks + Context (jelenleg)

### Projekt struktúra

```
apps/web/src/
├── pages/                        # Oldalak
│   ├── Login.tsx                # Bejelentkezés
│   ├── Dashboard.tsx            # Főoldal
│   ├── Items.tsx                # Tételek listája
│   ├── ManageItemsPage.tsx      # Tételek kezelése
│   ├── ManageCategoriesPage.tsx # Kategóriák kezelése
│   ├── ManageLocationsPage.tsx  # Lokációk kezelése
│   └── ManageUsersPage.tsx      # Felhasználók kezelése
│
├── components/                   # Újrafelhasználható komponensek
│   └── Plasma.tsx               # Háttér effekt
│
├── services/
│   └── api.ts                   # ⭐ API hívások központilag
│
├── assets/
│   └── styles/                  # CSS modulok
│
├── authConfig.ts                # Azure AD konfig
├── theme.ts                     # MUI téma
├── App.tsx                      # Fő alkalmazás
└── main.tsx                     # Entry point
```

### API hívások

Minden API hívás a `src/services/api.ts` fájlban van:

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Login
export const login = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/login`, { email, password });
  return response.data;
};

// Items lekérése
export const fetchItems = async (token: string) => {
  const response = await axios.get(`${API_URL}/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

### Új oldal hozzáadása

1. **Hozd létre a komponenst** `src/pages/UjOldal.tsx`:

```tsx
import React from 'react';
import { Container, Typography } from '@mui/material';

export default function UjOldal() {
  return (
    <Container>
      <Typography variant="h4">Új oldal</Typography>
    </Container>
  );
}
```

2. **Add hozzá a route-ot** az `App.tsx`-ben:

```tsx
import UjOldal from './pages/UjOldal';

// ...
<Route path="/uj-oldal" element={<UjOldal />} />
```

### Material-UI használata

```tsx
import { Button, TextField, Box, Typography } from '@mui/material';

function MyComponent() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5">Cím</Typography>
      <TextField label="Név" variant="outlined" />
      <Button variant="contained" color="primary">
        Mentés
      </Button>
    </Box>
  );
}
```

### Environment változók

A `.env` fájlban használj `VITE_` prefixet:

```env
VITE_API_URL=http://localhost:4000
VITE_MY_VARIABLE=value
```

Használat:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## 🔌 API fejlesztése

### Tech stack

- **Framework**: Express.js 5
- **Database**: MySQL2
- **Auth**: JWT (jsonwebtoken)
- **Security**: CORS
- **Environment**: dotenv

### API struktúra

```
apps/api/
├── index.js          # ⭐ Fő API fájl (289 sor)
│                     # - Route-ok
│                     # - Middleware-ek
│                     # - Business logic
│
├── db.js            # MySQL connection pool
├── package.json     # Függőségek
└── .env             # Környezeti változók
```

### Jelenlegi endpoint-ok

```javascript
// Auth
POST   /login                      // Bejelentkezés

// Users
GET    /users                      // Felhasználók listája
POST   /users                      // Új felhasználó
PUT    /users/:id                  // Felhasználó módosítás
DELETE /users/:id                  // Felhasználó törlés

// Items (leltár tételek)
GET    /items                      // Tételek listája
POST   /items                      // Új tétel
PUT    /items/:id                  // Tétel módosítás
DELETE /items/:id                  // Tétel törlés

// Categories
GET    /categories                 // Kategóriák listája
POST   /categories                 // Új kategória
PUT    /categories/:id             // Kategória módosítás
DELETE /categories/:id             // Kategória törlés

// Locations
GET    /locations                  // Lokációk listája
POST   /locations                  // Új lokáció
PUT    /locations/:id              // Lokáció módosítás
DELETE /locations/:id              // Lokáció törlés
```

### Autentikáció

Az API JWT tokeneket használ. Minden védett endpoint-hoz küldened kell:

```javascript
Authorization: Bearer <token>
```

A middleware automatikusan ellenőrzi:

```javascript
async function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}
```

### Új endpoint hozzáadása

1. **Add hozzá a route-ot** az `index.js`-ben:

```javascript
// Példa: Új endpoint a statisztikákhoz
app.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const [items] = await db.query('SELECT COUNT(*) as total FROM items');
    const [categories] = await db.query('SELECT COUNT(*) as total FROM categories');
    
    res.json({
      totalItems: items[0].total,
      totalCategories: categories[0].total
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

2. **Teszteld Postman-nel vagy böngészőből**

```bash
# GET request
curl http://localhost:4000/stats \
  -H "Authorization: Bearer <token>"
```

### Adatbázis lekérdezések

```javascript
const db = require('./db');

// SELECT
const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// INSERT
const [result] = await db.query(
  'INSERT INTO items (name, category_id) VALUES (?, ?)',
  [name, categoryId]
);
console.log('Új ID:', result.insertId);

// UPDATE
const [result] = await db.query(
  'UPDATE items SET name = ? WHERE id = ?',
  [newName, id]
);
console.log('Módosított sorok:', result.affectedRows);

// DELETE
const [result] = await db.query('DELETE FROM items WHERE id = ?', [id]);
```

### Error handling

Mindig használj try-catch blokkot:

```javascript
app.post('/items', authenticateJWT, async (req, res) => {
  try {
    const { name, category_id } = req.body;
    
    if (!name || !category_id) {
      return res.status(400).json({ message: 'Hiányzó mezők' });
    }
    
    const [result] = await db.query(
      'INSERT INTO items (name, category_id) VALUES (?, ?)',
      [name, category_id]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Tétel létrehozva' });
    
  } catch (error) {
    console.error('Insert error:', error);
    res.status(500).json({ message: 'Szerver hiba' });
  }
});
```

### CORS beállítás

Jelenleg engedélyezett origin-ek:

```javascript
app.use(cors({ 
  origin: [
    'http://localhost:5173',           // Local dev
    'https://leltar-app.vercel.app'    // Production
  ] 
}));
```

Új origin hozzáadása:

```javascript
app.use(cors({ 
  origin: [
    'http://localhost:5173',
    'https://leltar-app.vercel.app',
    'http://localhost:3000'  // ← új
  ] 
}));
```

---

## 🐛 Gyakori hibák és megoldásaik

### "Cannot find module 'xyz'"

**Ok**: Hiányzó függőség vagy nem futott le a `yarn install`

**Megoldás**:
```bash
# Root mappából
yarn install

# Ha tovább hibázik, próbáld cache nélkül
yarn install --force
```

### "Port 4000 already in use"

**Ok**: Az API már fut egy másik terminálban

**Megoldás**:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:4000 | xargs kill
```

### "Database connection failed"

**Ok**: MySQL nem fut vagy rossz kapcsolati adatok

**Megoldás**:
1. Ellenőrizd, hogy a MySQL szerver fut
2. Nézd meg a `.env` fájlt az `apps/api/` mappában
3. Teszteld a kapcsolatot:

```bash
mysql -u root -p
USE school_inventory;
SHOW TABLES;
```

### "turbo: command not found"

**Ok**: A Turborepo nincs telepítve globálisan

**Megoldás**:

Nem kell globálisan, használd yarn-nal:
```bash
yarn dev          # működik
yarn build        # működik
```

Ha mégis globálisan szeretnéd:
```bash
npm install -g turbo
```

### Workspace nem található

**Hiba**: `yarn workspace backend dev` → "Workspace 'backend' not found"

**Ok**: A workspace neveket a `package.json`-ből veszi

**Megoldás**: Használd a pontos nevet:
```bash
# Nézd meg a neveket
cat apps/api/package.json     # "name": "backend"
cat apps/web/package.json     # "name": "frontend"

# Helyes parancsok
yarn workspace backend dev
yarn workspace frontend dev
```

### TypeScript hibák a web-ben

**Megoldás**:
```bash
cd apps/web
yarn tsc --noEmit    # Típusellenőrzés build nélkül
```

### Hot reload nem működik

**API esetén**: Az `index.js`-ben a `--watch` flag biztosítja

**Web esetén**: Vite automatikusan figyeli, de ha nem:
```bash
# Újraindítás
Ctrl+C
yarn workspace frontend dev
```

---

## 🔧 Hasznos VS Code beállítások

Ajánlott kiterjesztések (`.vscode/extensions.json`):

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint
    "esbenp.prettier-vscode",           // Prettier
    "bradlc.vscode-tailwindcss",        // Tailwind (ha használjuk)
    "ms-vscode.vscode-typescript-next", // TypeScript
    "formulahendry.auto-rename-tag",    // HTML tag rename
    "streetsidesoftware.code-spell-checker" // Spell check
  ]
}
```

Workspace settings (`.vscode/settings.json`):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.workingDirectories": [
    "./apps/web",
    "./apps/api",
    "./packages/ui"
  ]
}
```

---

## 📚 Hasznos linkek és dokumentáció

### Monorepo & Turborepo
- [Turborepo Docs](https://turbo.build/repo/docs)
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces)

### Frontend (Web)
- [React 19 Docs](https://react.dev/)
- [Vite Docs](https://vite.dev/)
- [Material-UI (MUI)](https://mui.com/)
- [React Router](https://reactrouter.com/)
- [Axios](https://axios-http.com/)

### Backend (API)
- [Express.js](https://expressjs.com/)
- [MySQL2](https://github.com/sidorares/node-mysql2)
- [JWT](https://jwt.io/)

---

## 📞 Segítség kérése

Ha elakadtál:

1. **Ellenőrizd a hibát** a terminál output-ban
2. **Nézd meg a logokat** - az API és Web is ír konzolra
3. **Google/Stack Overflow** - a hiba üzenetre keress rá
4. **Kérdezz** a csapat többi tagjától

---

## ✅ Gyors referencia - Leggyakoribb parancsok

```bash
# Projekt telepítése
yarn install

# Fejlesztés (minden app)
yarn dev

# Csak API
yarn workspace backend dev

# Csak Web
yarn workspace frontend dev

# Build (minden app)
yarn build

# Linting
yarn lint

# Típusellenőrzés
yarn check-types

# Új csomag hozzáadása
yarn workspace backend add <package-name>
yarn workspace frontend add <package-name>
```

---

## 🎯 Összefoglaló - Amit tudnod kell

1. ✅ **Egy git repo** - minden projekt egy helyen
2. ✅ **Yarn workspaces** - közös függőségkezelés
3. ✅ **Turborepo** - gyors build és dev environment
4. ✅ **Megosztott package-ek** - `packages/ui` használható mindenhol
5. ✅ **Környezeti változók** - minden app-nak saját `.env` fájlja van
6. ✅ **API: localhost:4000** - Express backend
7. ✅ **Web: localhost:5173** - React frontend

---

**Készítve**: 2026. február 3.  
**Projekt**: Depo Inventory Management System  
**Csapat**: Bobr-Soft

Sok sikert a fejlesztéshez! 🚀
