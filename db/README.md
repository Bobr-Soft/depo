# Adatbázis

A `school_inventory` MariaDB adatbázis sémája és referencia anyagai.

## Fájlok

| Fájl | Leírás |
|------|--------|
| `school_inventory.sql` | Teljes séma + kezdeti (seed) adatok — phpMyAdmin dump, MariaDB 11.8 |
| `DB_Schema.png` | Táblák és kapcsolatok ER-diagramja |

## Visszaállítás

```bash
# Adatbázis létrehozása (ha még nincs)
mysql -u root -p -e "CREATE DATABASE school_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Dump importálása
mysql -u root -p school_inventory < school_inventory.sql
```

> **Megjegyzés:** A `rentals` tábla `utf8mb4_uca1400_ai_ci` sorrendezést használ, ami MariaDB 10.10+ verziót igényel. Régebbi szerveren az importálás előtt ezt a sor végén cseréld le `utf8mb4_unicode_ci`-re.

## Séma

Az adatbázis 9 táblából áll. A kapcsolatokat a `DB_Schema.png` ábrázolja.

### Felhasználók és szerepkörök

- **`users`** — Az alkalmazás felhasználói. Szerepkör lehet `admin`, `worker` vagy `supervisor`. Az azonosítás Azure AD-alapú, a táblában csak az e-mail cím és a szerepkör van tárolva.

### Készletkezelés

- **`items`** — A raktárkészlet alapja. Minden tétel rendelkezik egyedi vonalkóddal (`barcode`), kategóriával, raktárhellyel és aktuális mennyiséggel.
- **`categories`** — Termékkategóriák. A `size_class` mező (`kicsi` / `közepes` / `raklapos`) a szükséges tárolóhely méretét jelzi; a `min_stock_level` a minimális készletküszöb.
- **`locations`** — Raktárhelyek. Minden pozíció sor (`row_num`), oszlop (`col_num`) és szint (`shelf_level`) kombinációjaként van azonosítva, `RR-KK-SS` formátumú kóddal (pl. `03-01-02`). Az `is_xl` flag jelzi a raklapos, nagyméretű helyeket (szint 0).
- **`inventory_logs`** — Készletmozgások auditnaplója. Rögzíti az összes változást (`store`, `pick`, `transfer`, `rental_approved` stb.) tételtől és felhasználótól függően.

### Feladatok

- **`tasks`** — Raktári munkafeladatok három típussal: `inbound` (bevételezés), `picking` (kiadás), `transfer` (átrendezés). Rendelkeznek prioritással, határidővel és hozzárendelt dolgozóval.
- **`task_items`** — Egy feladathoz tartozó tételek. Tárolja a kért (`requested_quantity`) és a ténylegesen szedett (`picked_quantity`) mennyiséget, valamint a tétel státuszát.

### Egyéb folyamatok

- **`rentals`** — Eszközkölcsönzési kérelmek. Állapotok: `pending` → `approved` / `rejected` → `returned`. Tartalmazza a jóváhagyó személyét, megjegyzését és az összes időbélyeget.
- **`damage_reports`** — Kárjelentések. Az `item_barcode` és `item_name` szövegként van tárolva (nem FK), hogy a tétel esetleges törlése esetén is megmaradjon a nyomvonal.

## Megjegyzések

- A fájlok a mappán belüli `.gitignore` felülírás révén verziókövetés alá esnek.
- Éles adatokat és belépési hitelesítő adatokat ne commitolj.
