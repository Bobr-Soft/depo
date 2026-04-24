# Felhasználói Kézikönyv – Depo Raktárkezelő Rendszer

> **Verzió**: 1.0 · **Dátum**: 2026. április · **Nyelv**: Magyar

---

## Tartalomjegyzék

1. [Bevezetés](#1-bevezetés)
2. [Szerepkörök és jogosultságok](#2-szerepkörök-és-jogosultságok)
3. [Bejelentkezés](#3-bejelentkezés)
   - 3.1 [Mobil alkalmazásba](#31-mobil-alkalmazásba)
   - 3.2 [Webes alkalmazásba](#32-webes-alkalmazásba)
4. [Mobil alkalmazás](#4-mobil-alkalmazás)
   - 4.1 [Navigáció áttekintése](#41-navigáció-áttekintése)
   - 4.2 [Worker – Feladatok kezelése](#42-worker--feladatok-kezelése)
   - 4.3 [Worker – Kiszedési feladat végrehajtása](#43-worker--kiszedési-feladat-végrehajtása)
   - 4.4 [Worker – Beérkeztetés (Inbound)](#44-worker--beérkeztetés-inbound)
   - 4.5 [Worker – Kárjelentés](#45-worker--kárjelentés)
   - 4.6 [Worker – Raktártérkép](#46-worker--raktártérkép)
   - 4.7 [Worker – Profil és szinkronizáció](#47-worker--profil-és-szinkronizáció)
   - 4.8 [Supervisor – Irányítópult és munkavállalók](#48-supervisor--irányítópult-és-munkavállalók)
   - 4.9 [Supervisor – Kárjelentések elbírálása](#49-supervisor--kárjelentések-elbírálása)
   - 4.10 [Supervisor – Statisztikák](#410-supervisor--statisztikák)
   - 4.11 [Admin – Felhasználók kezelése](#411-admin--felhasználók-kezelése)
   - 4.12 [Admin – Feladatok kezelése](#412-admin--feladatok-kezelése)
   - 4.13 [Admin – Készlet és kategóriák kezelése](#413-admin--készlet-és-kategóriák-kezelése)
5. [Webes alkalmazás](#5-webes-alkalmazás)
   - 5.1 [Navigáció áttekintése](#51-navigáció-áttekintése)
   - 5.2 [Worker – Áttekintés (Dashboard)](#52-worker--áttekintés-dashboard)
   - 5.3 [Worker – Kölcsönzési kérés benyújtása](#53-worker--kölcsönzési-kérés-benyújtása)
   - 5.4 [Worker – Picking feladatok](#54-worker--picking-feladatok)
   - 5.5 [Supervisor – Kölcsönzési kérelmek elbírálása](#55-supervisor--kölcsönzési-kérelmek-elbírálása)
   - 5.6 [Admin – Elemek kezelése](#56-admin--elemek-kezelése)
   - 5.7 [Admin – Kategóriák kezelése](#57-admin--kategóriák-kezelése)
   - 5.8 [Admin – Helyszínek kezelése](#58-admin--helyszínek-kezelése)
   - 5.9 [Admin – Felhasználók kezelése (web)](#59-admin--felhasználók-kezelése-web)
6. [Hibaelhárítás és GYIK](#6-hibaelhárítás-és-gyik)

---

## 1. Bevezetés

A **Depo** rendszer egy raktárkezelő szoftver, amely egy mobilalkalmazásból és egy böngészős webes felületből áll. A két felület kiegészíti egymást:

| Felület | Elérhetőség | Fő felhasználási terület |
|---------|-------------|--------------------------|
| **Mobil alkalmazás** | Android telefon / táblagép | Kiszedés, beérkeztetés, vonalkód-olvasás, raktártérkép |
| **Webes alkalmazás** | Böngésző (asztali számítógép, laptop) | Kölcsönzés, készletkezelés, felhasználó- és helyszínkezelés |

A rendszer **internet-kapcsolat nélkül is részben működik** (mobil alkalmazáson): a feladatok és a kiszedési műveletek offline is elvégezhetők, majd a kapcsolat helyreállásakor a rendszer automatikusan szinkronizál.

---

## 2. Szerepkörök és jogosultságok

A rendszerben három szerepkör létezik. Az adminisztrátor osztja ki a szerepköröket.

### Összefoglaló táblázat

| Funkció | Worker | Supervisor | Admin |
|---------|:------:|:----------:|:-----:|
| Bejelentkezés (Azure AD) | ✓ | ✓ | ✓ |
| Feladat megtekintése és átvétele | ✓ | ✓ | ✓ |
| Kiszedési feladat végrehajtása | ✓ | ✓ | ✓ |
| Beérkeztetés (inbound) | ✓ | ✓ | ✓ |
| Kárjelentés benyújtása | ✓ | ✓ | ✓ |
| Raktártérkép megtekintése | ✓ | ✓ | ✓ |
| Kölcsönzési kérés benyújtása (web) | ✓ | ✓ | ✓ |
| Kárjelentések jóváhagyása / elutasítása | — | ✓ | ✓ |
| Kölcsönzési kérelmek jóváhagyása / elutasítása | — | ✓ | ✓ |
| Munkavállalók aktivitásának megtekintése | — | ✓ | ✓ |
| Feladatok kiosztása munkavállalóknak | — | ✓ | ✓ |
| Műszak KPI-ok és statisztikák | — | ✓ | ✓ |
| Felhasználók létrehozása / törlése | — | — | ✓ |
| Feladatok létrehozása / törlése | — | — | ✓ |
| Elemek / kategóriák kezelése | — | — | ✓ |
| Raktárhelyszínek kezelése | — | — | ✓ |

> **Megjegyzés**: Ha valamelyik menüpont nem jelenik meg a képernyőn, az azt jelenti, hogy az adott funkcióhoz nincs jogosultsága az aktuális szerepköre alapján.

---

## 3. Bejelentkezés

A bejelentkezés mindkét felületen a szervezeti Microsoft-fiókkal (Azure AD / Entra ID) történik. Személyes Microsoft-fiókok nem használhatók.

### 3.1 Mobil alkalmazásba

1. Nyissa meg a **Depo** alkalmazást a telefonján.
2. Az első indításkor a rendszer megkérdezi az **API URL-t** (a szerver elérhetőségét). Ezt az adminisztrátortól kapja meg. Írja be és érintse meg a **Mentés** gombot.
3. Az üdvözlőképernyőn érintse meg a **Bejelentkezés** gombot.
4. A megjelenő böngészőablakban adja meg a szervezeti e-mail-címét és jelszavát.
5. Ha a szervezet kétfaktoros hitelesítést (MFA) alkalmaz, erősítse meg a belépést az Authenticator alkalmazásban vagy SMS-kóddal.
6. Sikeres belépés után az alkalmazás automatikusan visszatér, és betölti a szerepkörének megfelelő főoldalt.

> **Hiba esetén**: Ha az „Authorization failed" hibaüzenet jelenik meg, kérje meg az adminisztrátort, hogy ellenőrizze, be van-e állítva az e-mail-címe a rendszerben.

### 3.2 Webes alkalmazásba

1. Nyisson meg egy böngészőt, és navigáljon a rendszer webes URL-jére.
2. Kattintson a **Bejelentkezés** gombra.
3. Egy felugró ablakban adja meg a szervezeti e-mail-címét és jelszavát.
4. Ha szükséges, erősítse meg az MFA-kérést.
5. Sikeres bejelentkezés után az oldal automatikusan a szerepkörének megfelelő irányítópultra navigál.

**Kijelentkezés (web):** A bal oldali navigációs sávban kattintson a neve / profilfotója melletti menüre, majd válassza a **Kijelentkezés** lehetőséget.

**Kijelentkezés (mobil):** Nyissa meg a **Profil** fület, majd érintse meg a **Kijelentkezés** gombot.

---

## 4. Mobil alkalmazás

### 4.1 Navigáció áttekintése

Az alkalmazás alján három fül (tab) található:

| Fül | Leírás |
|-----|--------|
| **Főoldal** | Szerepkörre szabott gyorsműveletek és irányítópult |
| **Feladatok** | Az összes elérhető és hozzárendelt feladat listája |
| **Profil** | Felhasználói adatok, szinkronizáció, beállítások |

A **Főoldal** tartalma szerepkörtől függ:
- **Worker**: Kiszedés, Beérkeztetés, Vonalkód-olvasó, Kárjelentés, Raktártérkép gombok
- **Supervisor**: Supervisor panel megnyitása + Worker gombok
- **Admin**: Admin panel megnyitása + összes gomb

---

### 4.2 Worker – Feladatok kezelése

A **Feladatok** fülön láthatók az összes elérhető, folyamatban lévő és befejezett feladat.

#### Feladat átvétele

1. Érintse meg a **Feladatok** fület.
2. A listában megjelennek az elérhető feladatok (státusz: **Elérhető**). Minden kártyán látható a feladat neve, típusa (Kiszedés / Beérkeztetés / Átrakás), prioritása és határideje.
3. Érintse meg a kívánt feladatot a részletek megtekintéséhez.
4. A részletoldalon érintse meg az **Átvétel** gombot. A feladat státusza **Folyamatban**-ra vált, és az Ön nevéhez kerül.

#### Feladat visszaadása

1. Keresse meg a **Folyamatban** státuszú feladatot a listában.
2. Nyissa meg a feladat részleteit.
3. Érintse meg a **Visszaadás** gombot. A feladat visszakerül az elérhető feladatok közé.

> **Tipp**: A lista tetején lévő szűrőgombokkal szűkítheti a megjelenített feladatokat státusz szerint (Elérhető, Folyamatban, Befejezett).

---

### 4.3 Worker – Kiszedési feladat végrehajtása

A kiszedési (picking) feladat célja, hogy a raktárból meghatározott elemeket gyűjtsön össze egy megrendeléshez.

1. Vegyen át egy **Kiszedés** típusú feladatot (lásd [4.2](#42-worker--feladatok-kezelése)).
2. A Főoldalon érintse meg a **Kiszedés** gombot, vagy menjen a **Feladatok** fülre és érintse meg a feladatát.
3. A kiszedési képernyőn megjelenik az **aktuálisan kiszedendő elem** (cikkszám, helyszín, szükséges mennyiség).
4. Menjen el a megjelölt helyszínre (a rendszer S-alakú optimális útvonalat ajánl).
5. Érintse meg a **Beolvasás** gombot, majd irányítsa a kamerát az elem vonalkódjára.
6. Sikeres beolvasáskor a rendszer növeli a cikkszámhoz tartozó számlálót, és vizuálisan (zöld jelzés) illetve hangjelzéssel visszajelez.
7. Ismételje a beolvasást, amíg el nem éri a szükséges mennyiséget.
8. Ha az összes elem kiszedésre került, a feladat automatikusan **Befejezett** státuszra vált.

> **Hiányos készlet esetén**: Ha az adott helyszínen nincs elegendő árukészlet, érintse meg az **Átugrás** lehetőséget, és folytassa a következő elemmel. Az adminisztrátor értesítést kap a hiányról.

---

### 4.4 Worker – Beérkeztetés (Inbound)

A beérkeztetés funkció az újonnan érkező áruk raktárba való regisztrálására szolgál.

1. A Főoldalon érintse meg a **Beérkeztetés** gombot.
2. Érintse meg a **Beolvasás** gombot, és olvassa be az első érkező elem vonalkódját.
3. A rendszer felismeri az elemet (kód, megnevezés). Ha az elem ismeretlen, megjelenít egy kézi beviteli mezőt.
4. Adja meg a beérkező **mennyiséget**.
5. Opcionálisan adjon meg egy **helyszínt** (ha nincs megadva, a rendszer automatikusan foglal helyszínt).
6. Szükség esetén jelölje be az **XL raklap** jelölőnégyzetet, ha az elem nagyméretű tárolóhelyet igényel.
7. Érintse meg a **Hozzáadás** gombot. Az elem felkerül a beérkezési listára.
8. Ismételje a 2–7. lépéseket minden beérkező cikkhez.
9. Ha az összes elemet felvette, érintse meg a **Mentés** gombot. A rendszer rögzíti a beérkező tételeket, és – ha van internetkapcsolat – azonnal szinkronizál.

> **Offline mód**: Ha az alkalmazás internet nélkül működik, a beérkezési adatok lokálisan mentésre kerülnek, és a következő sikeres szinkronizáláskor automatikusan feltöltődnek. Az alkalmazás újraindítása esetén a félbehagyott beérkezési tételek visszaállnak (**„Félig kész beérkeztetés visszaállítva"** felirat jelenik meg).

---

### 4.5 Worker – Kárjelentés

Ha egy raktárban lévő elem sérült, a kárjelentő funkcióval rögzítheti az esetet.

1. A Főoldalon érintse meg a **Kárjelentés** gombot.
2. Opcionálisan érintse meg a **Vonalkód beolvasása** gombot, és olvassa be a sérült elem kódját. (Ha nem áll rendelkezésre vonalkód, kézzel is megadható a cikkszám.)
3. Töltse ki az **Elem neve** és a **Leírás** mezőket. A leírásban adja meg röviden a kár jellegét (pl. „törött burkolat", „hiányos mennyiség").
4. Érintse meg a **Beküldés** gombot.
5. A jelentés azonnal elküldésre kerül a szerverre. A supervisor vagy az admin a webes felületen (vagy a mobil supervisor panelen) látni fogja a beküldött kárjelentést.

> **Állapotkövetés**: A korábban beküldött kárjelentések jelenlegi státuszát (Függőben, Jóváhagyva, Elutasítva) nem lehet a mobilon megtekinteni – ezt a supervisor kezeli.

---

### 4.6 Worker – Raktártérkép

A raktártérkép vizuálisan jeleníti meg az összes raktárhelyszín állapotát.

1. A Főoldalon érintse meg a **Raktártérkép** gombot.
2. A térkép rácsszerű elrendezésben mutatja az összes polcot és állványt.

#### Nézeti módok

A térkép tetején lévő gombokkal válthat a nézetek között:

| Mód | Leírás |
|-----|--------|
| **Státusz** | Szín alapján mutatja a polcok töltöttségét (üres, részben teli, teli) |
| **Típus** | Szín alapján mutatja az elemek kategóriáját az adott helyszínen |
| **Struktúra** | Mutatja, hogy standard vagy XL raklapos helyszínről van-e szó |

#### Szűrők

- **Helyszín kód szerinti keresés**: Írja be a helyszín kódjának egy részét a keresőmezőbe.
- **Csak aktív helyszínek**: Kizárja a inaktív (nem elérhető) polcokat.
- **Csak XL**: Csak a nagyméretű tárolóhelyeket mutatja.

#### Helyszín részletei

Érintsen meg egy helyszínt a térképen a részletek megtekintéséhez: az adott polcon tárolt elemek, mennyiségek és helyszín-kód láthatók.

---

### 4.7 Worker – Profil és szinkronizáció

1. Érintse meg a **Profil** fület.
2. Megjelenik a nevé, e-mail-cím és a szerepköre.

#### Szinkronizáció állapota

A Profil oldalon látható:
- **Utolsó szinkronizálás ideje**
- **Függő műveletek száma** (azok a helyi változtatások, amelyek még nem jutottak fel a szerverre)
- **Sikertelen műveletek (dead-letter)** száma – ha van ilyen, forduljon az adminisztrátorhoz

A **„Szinkronizálás most"** gombbal kézzel is elindíthat egy azonnali szinkronizálást.

#### Beállítások

| Beállítás | Leírás |
|-----------|--------|
| **Hangjelzés** | Vonalkód-olvasáskor legyen-e hangjelzés |
| **Rezgés (haptics)** | Vonalkód-olvasáskor rezegjen-e a telefon |

#### Szerver-kapcsolat tesztelése

A **„Kapcsolat tesztelése"** gomb ellenőrzi, hogy az alkalmazás eléri-e a konfigurált API szervert. Ezt érdemes megnyomni, ha hibás szinkronizálást tapasztal.

---

### 4.8 Supervisor – Irányítópult és munkavállalók

A Supervisor panelt a Főoldalon a **Supervisor panel** gombbal nyithatja meg.

#### Irányítópult

Az irányítópulton (narancssárga témájú felület) egyszerre látható:
- **Aktív munkavállalók száma** (azok, akiknek éppen van folyamatban lévő feladatuk)
- **Sürgős feladatok száma** (magas prioritású, határidőhöz közeledő feladatok)
- **Ma kiszedett elemek száma** (összesített teljesítménymutató)

#### Munkavállalók listája

1. A Supervisor panelen érintse meg a **Munkavállalók** gombot.
2. Megjelenik az összes aktív munkavállaló listája, az utolsó bejelentkezés idejével és az aktuális aktivitási státuszával.
3. Az egyes munkavállalókra érintve megtekintheti a hozzájuk rendelt feladatokat.

#### Feladat kiosztása

1. Menjen a **Feladatok** aloldalra (Supervisor panelen belül).
2. Érintsen meg egy elérhető feladatot.
3. Érintse meg a **Kiosztás** gombot, majd válasszon egy munkavállalót a listából.
4. A feladat az adott munkavállaló nevéhez kerül.

---

### 4.9 Supervisor – Kárjelentések elbírálása

1. A Supervisor panelen érintse meg a **Kárjelentések** gombot.
2. Megjelennek a **Függőben** státuszú kárjelentések (beküldő neve, elem leírása, kár leírása).
3. Olvassa el az egyes kárjelentések részleteit.
4. **Jóváhagyás**: Érintse meg a **Jóváhagyás** gombot. Az elem károsnak minősül, és adminisztrátori beavatkozást igényel (pl. kivonás a készletből).
5. **Elutasítás**: Érintse meg az **Elutasítás** gombot, ha a jelzés téves vagy nem indokolt.
6. A beküldő munkavállaló ezt követően nem kapja meg a visszajelzést mobilon – az adminisztrátor kezeli a szükséges készletkorrekciót.

---

### 4.10 Supervisor – Statisztikák

1. A Supervisor panelen érintse meg a **Statisztikák** gombot.
2. Megjelennek a műszak KPI-ok:
   - Befejezett / folyamatban lévő / várakozó feladatok száma
   - Összesen kiszedett elemek száma az adott napra
   - Aktív munkavállalók száma

Ezek az adatok valós időben frissülnek (internet-kapcsolat szükséges).

---

### 4.11 Admin – Felhasználók kezelése

Az Admin panelt a Főoldalon az **Admin panel** gombbal nyithatja meg. Az **Admin panel** piros témájú felületen jelenik meg.

#### Új felhasználó létrehozása

1. Az Admin panelen érintse meg a **Felhasználók** gombot.
2. Érintse meg a **+ Új felhasználó** gombot.
3. Töltse ki a szükséges mezőket:
   - **E-mail-cím**: A felhasználó szervezeti e-mail-cím (Azure AD-ban is ez szerepel)
   - **Név**: Megjelenítési név
   - **Szerepkör**: Worker / Supervisor / Admin
4. Érintse meg a **Mentés** gombot.

#### Felhasználó szerkesztése

1. Érintse meg a módosítani kívánt felhasználót a listában.
2. Módosítsa a szükséges mezőket (pl. szerepkör megváltoztatása).
3. Érintse meg a **Mentés** gombot.

#### Felhasználó törlése

1. Érintse meg a törölni kívánt felhasználót.
2. Érintse meg a **Törlés** gombot.
3. Erősítse meg a megerősítő párbeszédablakban.

> **Figyelem**: A törölt felhasználó azonnal elveszíti a rendszerhez való hozzáférését.

---

### 4.12 Admin – Feladatok kezelése

#### Új feladat létrehozása

1. Az Admin panelen érintse meg a **Feladatok** gombot.
2. Érintse meg a **+ Új feladat** gombot.
3. Adja meg:
   - **Feladat neve**
   - **Típus**: Kiszedés / Beérkeztetés / Átrakás
   - **Prioritás**: Kritikus (1) / Magas (2) / Normál (3) / Alacsony (4)
   - **Határidő** (opcionális)
   - **Elemek**: Adja hozzá a feladat részét képező raktári elemeket és a kívánt mennyiségeket
4. Érintse meg a **Mentés** gombot. A feladat megjelenik az elérhető feladatok listájában.

#### Feladat szerkesztése / törlése

1. Érintse meg a feladatot a listában.
2. Módosítsa a szükséges adatokat, majd érintse meg a **Mentés** gombot.  
   – vagy –  
   Érintse meg a **Törlés** gombot, majd erősítse meg.

---

### 4.13 Admin – Készlet és kategóriák kezelése

#### Elemek listája

1. Az Admin panelen érintse meg a **Készlet** gombot.
2. Látható az összes raktárban nyilvántartott elem, mennyiséggel és kategóriával együtt.

#### Új elem felvétele

1. Érintse meg a **+ Új elem** gombot.
2. Töltse ki a mezőket: **Megnevezés**, **Vonalkód**, **Kategória**, **Mennyiség**, **Leírás** (opcionális).
3. Érintse meg a **Mentés** gombot.

#### Elem módosítása / törlése

1. Érintsen meg egy elemet a listában.
2. Módosítsa az adatokat és érintse meg a **Mentés** gombot, vagy érintse meg a **Törlés** gombot.

#### Kategóriák kezelése

1. Az Admin panelen érintse meg a **Kategóriák** gombot.
2. A listában láthatók a meglévő kategóriák megnevezéssel és méretosztállyal (kicsi / közepes / raklapos).
3. Új kategória hozzáadásához érintse meg a **+ Új kategória** gombot, adja meg a nevet és a méretosztályt, majd mentse.

---

## 5. Webes alkalmazás

### 5.1 Navigáció áttekintése

A webes felületen a bal oldali navigációs sáv tartalmazza az elérhető oldalakat. A megjelenő menüpontok a bejelentkezett felhasználó szerepkörétől függnek:

| Menüpont (Magyar) | Szerepkörök | Leírás |
|-------------------|-------------|--------|
| Áttekintés | Mindenki | Összesített irányítópult |
| Kölcsönzés | Worker | Kölcsönzési kérelem benyújtása |
| Kölcsönzések kezelése | Supervisor, Admin | Kölcsönzési kérelmek elbírálása |
| Elemek kezelése | Admin | Készlet CRUD |
| Kategóriák kezelése | Admin | Kategória CRUD |
| Helyszínek kezelése | Admin | Raktárhelyszín CRUD |
| Felhasználók kezelése | Admin | Felhasználó CRUD |
| Picking | Mindenki | Picking feladatok |

---

### 5.2 Worker – Áttekintés (Dashboard)

Az **Áttekintés** oldal az összes felhasználó számára elérhető belépési pont.

Egy oldalon látható:
- **Összesítő kártyák**: Összes elem, kategória, helyszín és felhasználó száma
- **Alacsony készlet figyelmeztetések**: Azok az elemek, amelyek mennyisége a minimális szint alá csökkent (piros jelzéssel)
- **Diagramok**:
  - Oszlopdiagram: elemek száma kategóriánként
  - Kördiagram: kategóriák megoszlása

> **Tipp**: Ha alacsony készlet figyelmeztetést lát, értesítse az adminisztrátort, hogy új rendelést adjon le.

---

### 5.3 Worker – Kölcsönzési kérés benyújtása

Kölcsönzési kérelmet adhat be, ha valamilyen eszközre, anyagra vagy felszerelésre van szüksége egy adott feladathoz.

1. Kattintson a bal oldali menüben a **Kölcsönzés** menüpontra.
2. Keresse meg a kölcsönözni kívánt elemet a kereső segítségével (cikkszám vagy megnevezés alapján).
3. Adja meg a szükséges **mennyiséget**.
4. Töltse ki a **Cél / Indoklás** mezőt (pl. „Labor 3 – projektmunka", „Szoba 12 – javítás").
5. Kattintson a **Kérelem benyújtása** gombra.
6. A kérelem **Függőben** státuszban megjelenik a supervisornál / adminnál jóváhagyásra.

#### Korábbi kérelmek megtekintése

A Kölcsönzés oldalon alul látható a korábbi kérelmeinek listája, állapotukkal együtt:

| Állapot | Leírás |
|---------|--------|
| **Függőben** | Jóváhagyásra vár |
| **Jóváhagyva** | Supervisor / admin engedélyezte, az elem az Önéé |
| **Visszaadva** | Az elemet visszahozta |
| **Elutasítva** | A kérelmet elutasították (megjegyzés olvasható) |

#### Visszaadás

Ha már nincs szüksége a kölcsönzött elemre, kattintson a kérelem sorában a **Visszaadás** gombra. A rendszer visszakönyveli az elemet a készletbe.

---

### 5.4 Worker – Picking feladatok

1. Kattintson a bal oldali menüben a **Picking** menüpontra.
2. Megjelennek az elérhető picking feladatok.
3. Kattintson egy feladatra a részletek megtekintéséhez (elemek listája, mennyiségek, státus).
4. A feladatok elvégzése elsősorban a mobilalkalmazáson keresztül történik (vonalkód-olvasóval) – a webes felület főként az áttekintést szolgálja.

---

### 5.5 Supervisor – Kölcsönzési kérelmek elbírálása

1. Kattintson a bal oldali menüben a **Kölcsönzések kezelése** menüpontra.
2. A lista tetején a **Függőben** lévő kérelmek jelennek meg (kérelmező neve, elem, mennyiség, cél).
3. Kattintson egy kérelemre a részletek megtekintéséhez.
4. **Jóváhagyás**:
   - Kattintson a **Jóváhagyás** gombra.
   - A rendszer automatikusan csökkenti a raktárkészletet a megadott mennyiséggel.
   - A kérelmező e-mailben is értesítést kaphat (a rendszer konfigurációjától függően).
5. **Elutasítás**:
   - Kattintson az **Elutasítás** gombra.
   - Opcionálisan adjon meg egy megjegyzést az elutasítás okáról.
   - Ez a megjegyzés látható lesz a kérelmező számára is.
6. A már elbírált kérelmek az oldal alján listázva maradnak az audit-trail részeként.

---

### 5.6 Admin – Elemek kezelése

1. Kattintson a bal oldali menüben az **Elemek kezelése** menüpontra.
2. Megjelenik az összes nyilvántartott elem táblázatban (megnevezés, vonalkód, kategória, helyszín, mennyiség).

#### Elem keresése és szűrése

- A keresőmezőbe írjon megnevezést vagy vonalkódot.
- A **Kategória** legördülő szűrővel szűkítheti a listát.
- A **Helyszín** szűrővel megtekintheti egy adott raktárhelyen lévő elemeket.

#### Új elem felvétele

1. Kattintson az **+ Új elem** gombra.
2. Töltse ki a mezőket:
   - **Megnevezés** (kötelező)
   - **Vonalkód** (kötelező, egyedi)
   - **Kategória** (legördülő lista)
   - **Helyszín** (legördülő lista)
   - **Mennyiség**
   - **Leírás** (opcionális)
3. Kattintson a **Mentés** gombra.

#### Elem módosítása

1. Kattintson a táblázatban a módosítani kívánt elem sorára (vagy a szerkesztés ikonra).
2. Módosítsa a szükséges mezőket.
3. Kattintson a **Mentés** gombra.

#### Elem törlése

1. Jelölje be a törölni kívánt elem(ek) jelölőnégyzetét.
2. Kattintson a **Törlés** gombra.
3. Erősítse meg a megerősítő párbeszédablakban.

#### Exportálás

A táblázat fejlécében lévő **CSV exportálás** gombbal letöltheti az összes elem adatát táblázatkezelőhöz (Excel, LibreOffice stb.).

---

### 5.7 Admin – Kategóriák kezelése

1. Kattintson a bal oldali menüben a **Kategóriák kezelése** menüpontra.
2. Látható az összes kategória nevével és méretosztályával.

#### Méretosztályok

| Méretosztály | Leírás |
|--------------|--------|
| **Kicsi** | Kis méretű elemek (pl. elektronikai alkatrészek, csavarok) |
| **Közepes** | Közepes méretű eszközök (pl. szerszámok, mérőeszközök) |
| **Raklapos** | Nagy, raklapon tárolt áruk |

#### Új kategória / Módosítás / Törlés

A folyamat megegyezik az elemek kezeléséhez leírtakkal (lásd [5.6](#56-admin--elemek-kezelése)).

> **Figyelem**: Kategória csak akkor törölhető, ha egyetlen elem sem tartozik hozzá.

---

### 5.8 Admin – Helyszínek kezelése

A raktárhelyszínek fizikai tárolóhelyeket (polcokat, állványokat) jelölnek.

1. Kattintson a bal oldali menüben a **Helyszínek kezelése** menüpontra.
2. Megjelenik az összes helyszín a koordinátájával és állapotával.

#### Helyszín-koordináták értelmezése

Minden raktárhelyszínt három koordináta azonosít:

| Mező | Leírás |
|------|--------|
| **Sor (Row)** | Raktársorok száma (1-től) |
| **Oszlop (Col)** | Oszlopsorszám az adott soron belül |
| **Polcszint** | Polcszint az állványon belül (1 = alap, magasabb = felsőbb polc) |

#### Új helyszín felvétele

1. Kattintson az **+ Új helyszín** gombra.
2. Adja meg a **Sor**, **Oszlop** és **Polcszint** értékeket.
3. Jelölje be az **XL raklap** jelölőnégyzetet, ha nagyméretű elemek tárolására is alkalmas a helyszín.
4. Ellenőrizze, hogy az **Aktív** jelölőnégyzet be van jelölve (inaktív helyszínre nem rendelhető elem).
5. Kattintson a **Mentés** gombra. A rendszer automatikusan generálja a helyszín kódját (pl. `R1-C2-S3`).

#### Helyszín deaktiválása

Ha egy polchelyszín ideiglenesen nem elérhető (pl. karbantartás miatt):
1. Kattintson a helyszín sorára.
2. Vegye ki a pipát az **Aktív** jelölőnégyzetből.
3. Kattintson a **Mentés** gombra.

---

### 5.9 Admin – Felhasználók kezelése (web)

1. Kattintson a bal oldali menüben a **Felhasználók kezelése** menüpontra.
2. Megjelenik az összes regisztrált felhasználó neve, e-mail-cím, szerepköre és aktív státusza.

#### Új felhasználó felvétele

1. Kattintson az **+ Új felhasználó** gombra.
2. Adja meg az **E-mail-cím**, **Név** és **Szerepkör** mezőket.
3. Kattintson a **Mentés** gombra.

> **Fontos**: Az e-mail-cím pontosan egyezzen meg azzal, amellyel a felhasználó az Azure AD-ban be fog lépni.

#### Szerepkör módosítása

1. Kattintson a felhasználó sorára.
2. Változtassa meg a **Szerepkör** legördülőt.
3. Kattintson a **Mentés** gombra. A változás azonnal érvényes – a felhasználónak újra be kell jelentkeznie, hogy az új jogosultságok érvénybe lépjenek.

#### Felhasználó törlése

1. Jelölje be a törölni kívánt felhasználót.
2. Kattintson a **Törlés** gombra, majd erősítse meg.

---

## 6. Hibaelhárítás és GYIK

### „Nem tudok bejelentkezni"

| Tünet | Lehetséges ok | Megoldás |
|-------|---------------|---------|
| „Authorization failed" / „Hozzáférés megtagadva" | Az e-mail-cím nincs felvéve a Depo rendszerbe | Kérje meg az adminisztrátort, hogy adja hozzá a fiókot |
| A bejelentkezési ablak nem nyílik meg (mobilon) | Kimutatés-engedély hiányzik az alkalmazástól | Eszközbeállításokban adjon engedélyt a böngésző megnyitásához |
| A bejelentkezési ablak megnyílik, de felhasználónév/jelszó nem működik | Rossz Azure AD-fiók használata | Győződjön meg arról, hogy szervezeti fiókot használ, nem személyes Microsoft-fiókot |
| Webes felületen végtelen töltés | Cookie / böngészőcache probléma | Törölje a böngésző cache-jét és sütiket, majd próbálja újra |

---

### „A szinkronizálás nem működik" (mobil)

1. Ellenőrizze, hogy telefona csatlakozik-e az internethez (Wi-Fi vagy mobiladat).
2. A **Profil** fülön ellenőrizze a **„Szinkronizáció állapota"** részt – látható-e hibaüzenet.
3. Érintse meg a **„Kapcsolat tesztelése"** gombot – ha „Sikertelen" feliratot kap, a szerver nem elérhető. Értesítse az adminisztrátort.
4. Ha a függő műveletek száma nullánál nagyobb, és több mint 5 perce nem csökken, érintse meg a **„Szinkronizálás most"** gombot.
5. Ha **dead-letter** (sikertelen) műveletek is megjelennek, forduljon az adminisztrátorhoz – ezeket manuálisan kell kezelni.

---

### „A vonalkód-olvasó nem ismer fel egy kódot"

1. Ellenőrizze, hogy a kamera engedélyt kapott-e az alkalmazásban (Eszközbeállítások → Alkalmazások → Depo → Engedélyek → Kamera).
2. Győződjön meg arról, hogy megfelelő megvilágításban van – sötétben a leolvasás megbízhatatlan.
3. Tartsa egyenletesen és közel a kamerát a vonalkódhoz (10–25 cm).
4. Ha a vonalkód sérült vagy elmosódott, kézzel is beírhatja a kódot.
5. Ha az elem kódja nem ismert a rendszernek, forduljon az adminisztrátorhoz, hogy rögzítse az elemet.

---

### „Offline módban vagyok – mi fog történni az adataimmal?"

- Az alkalmazás automatikusan elmenti a helyi módosításokat (kiszedés, beérkeztetés).
- Amint az internetkapcsolat helyreáll, a rendszer automatikusan feltölti a függő műveleteket (legfeljebb 10 másodperces késéssel).
- A **Profil** oldalon mindig látható, hogy hány művelet vár szinkronizálásra.
- Kiszedési feladatokat offline is be lehet fejezni – a számlálók lokálisan frissülnek.
- Kárjelentést **nem** lehet offline beküldeni – a beküldés azonnali internet-kapcsolatot igényel.

---

### „Egy kölcsönzési kérelmet elutasítottak – miért?"

Az elutasítás okát a supervisor / admin megadhatta megjegyzésként. A webes **Kölcsönzés** oldalon az adott kérelem sorában kattintson a kérelemre – a megjegyzés megjelenik a részletmezőben.

---

### „Hiányzik egy menüpont, amelyre szükségem lenne"

A menüpontok a bejelentkezett felhasználó szerepköre alapján jelennek meg. Ha egy funkcióra van szüksége, de nem látja a menüben, kérje meg az adminisztrátort, hogy ellenőrizze a szerepkörét, és szükség esetén módosítsa.

---

### Technikai segítségkérés

Ha a fenti megoldások nem segítenek, vegye fel a kapcsolatot a rendszergazdával az alábbi adatokkal:

- Melyik felületen (mobil / web) tapasztalta a hibát?
- Pontosan mit próbált tenni?
- Milyen hibaüzenet jelent meg (képernyőkép, ha van)?
- Mikor fordult elő először a probléma?

---

*Ez a dokumentum a Depo raktárkezelő rendszer végfelhasználóinak szól. Technikai dokumentációért (telepítés, konfiguráció, API-referencia) forduljon a fejlesztői csapathoz.*
