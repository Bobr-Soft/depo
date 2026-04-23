-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Gép: localhost
-- Létrehozás ideje: 2026. Ápr 23. 19:09
-- Kiszolgáló verziója: 11.8.6-MariaDB-0+deb13u1 from Debian
-- PHP verzió: 8.4.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `school_inventory`
--

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `size_class` varchar(100) NOT NULL DEFAULT 'közepes',
  `min_stock_level` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `categories`
--

INSERT INTO `categories` (`id`, `name`, `size_class`, `min_stock_level`) VALUES
(1, 'Elektronikai alkatrészek', 'kicsi', 50),
(2, 'Szerszámok', 'közepes', 5),
(3, 'Fogyóanyagok', 'kicsi', 20),
(4, 'Mérő- és vizsgálóeszközök', 'közepes', 2),
(5, 'Csomagolóanyagok', 'raklapos', 100),
(6, 'Kábelek és vezetékek', 'közepes', 100),
(7, 'Kötőelemek (csavar, anya)', 'kicsi', 1000),
(8, 'Munkavédelmi eszközök', 'közepes', 10),
(9, 'Ragasztók és vegyi anyagok', 'kicsi', 20),
(10, 'Optikai elemek és lencsék', 'kicsi', 5),
(11, 'Akkumulátorok és elemek', 'kicsi', 50),
(12, 'Szenzorok és modulok', 'kicsi', 30);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `damage_reports`
--

CREATE TABLE `damage_reports` (
  `id` int(11) NOT NULL,
  `reported_by` int(11) DEFAULT NULL,
  `item_barcode` varchar(255) DEFAULT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `description` text NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `reported_by`, `item_barcode`, `item_name`, `description`, `status`, `reviewed_by`, `review_note`, `created_at`, `updated_at`) VALUES
(1, 8, 'BC-CS-00001', 'Kartondoboz 400x300x200', 'Nedvességtől megpuhult, egyik saroknál betört az oldalfal. Belső tartalom sértetlen maradt.', 'approved', 6, 'Az érintett köteg megsemmisítve, pótlás rendelve.', '2025-10-08 09:15:00', '2025-10-08 11:30:00'),
(2, 8, 'BC-MV-00002', 'ESD Kesztyű (L)', 'A PU bevonat az ujjbegyek mentén lehámlott, az antistatikus védelem hatékonysága nem biztosított.', 'approved', 6, 'Az érintett 12 pár kiselejtezve, utánpótlás megérkezett.', '2025-11-20 14:00:00', '2025-11-21 10:00:00'),
(3, 1, 'BC-FO-00001', 'Forrasztóón 0.8mm / 250g', 'Az egyik tekercs felcsévélve tárolt állapotban lezuhanhatott a polcról – szétcseveredett, használhatatlan.', 'approved', 7, 'Kiselejtezve, meglévő készletből pótolva.', '2026-01-14 10:30:00', '2026-01-14 13:00:00'),
(4, 8, 'BC-ME-00003', 'Oszcilloszkóp mérőfej 100MHz', 'A BNC csatlakozónál a külső fém és a belső pin közötti kötés meglazult, intermittáló kontaktushibát okoz.', 'pending', NULL, NULL, '2026-03-18 16:00:00', '2026-03-18 16:00:00'),
(5, 1, 'BC-RA-00002', 'Hővezető Ragasztó', 'Az egyik tubuson a kis kupak nem zárt meg rendesen – a belső A-komponens részben kikeményedett.', 'rejected', 6, 'A maradék anyag felhasználható, csak a kivezetési nyílás pár mm-t keményedett meg. Nem selejtes.', '2026-04-10 11:00:00', '2026-04-11 09:00:00');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `inventory_logs`
--

CREATE TABLE `inventory_logs` (
  `id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `change_amount` int(11) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `inventory_logs`
--

INSERT INTO `inventory_logs` (`id`, `item_id`, `user_id`, `action_type`, `change_amount`, `timestamp`) VALUES
(1, 1, 1, 'store', 500, '2025-09-01 10:00:00'),
(2, 2, 1, 'store', 800, '2025-09-01 10:05:00'),
(3, 3, 1, 'store', 80, '2025-09-01 10:10:00'),
(4, 8, 1, 'store', 15, '2025-09-01 10:15:00'),
(5, 9, 1, 'store', 30, '2025-09-01 10:20:00'),
(6, 10, 1, 'store', 35, '2025-09-01 10:25:00'),
(7, 11, 1, 'store', 40, '2025-09-01 10:30:00'),
(8, 22, 1, 'store', 5000, '2025-09-01 10:35:00'),
(9, 12, 1, 'store', 4, '2025-10-10 09:00:00'),
(10, 13, 1, 'store', 2, '2025-10-10 09:05:00'),
(11, 49, 1, 'store', 200, '2025-10-15 11:00:00'),
(12, 50, 1, 'store', 500, '2025-10-15 11:05:00'),
(13, 43, 1, 'store', 50, '2025-11-03 09:30:00'),
(14, 44, 1, 'store', 150, '2025-11-03 09:35:00'),
(15, 8, 8, 'pick', -5, '2025-11-14 15:00:00'),
(16, 9, 8, 'pick', -3, '2025-11-14 15:05:00'),
(17, 10, 8, 'pick', -2, '2025-11-14 15:10:00'),
(18, 11, 8, 'pick', -2, '2025-11-14 15:15:00'),
(19, 12, 6, 'rental_approved', -1, '2025-11-10 09:30:00'),
(20, 12, 6, 'rental_return', 1, '2025-11-17 15:00:00'),
(21, 7, 7, 'rental_approved', -1, '2026-02-01 10:00:00'),
(22, 26, 8, 'pick', -50, '2026-01-22 13:00:00'),
(23, 27, 8, 'pick', -50, '2026-01-22 13:05:00'),
(24, 29, 8, 'pick', -20, '2026-01-22 13:10:00'),
(25, 33, 8, 'pick', -10, '2026-01-22 13:15:00'),
(26, 24, 7, 'transfer', 0, '2026-02-27 10:00:00'),
(27, 25, 7, 'transfer', 0, '2026-02-27 10:05:00'),
(28, 2, 6, 'audit_correction', -7, '2026-03-10 11:00:00'),
(29, 52, 6, 'audit_correction', 4, '2026-03-10 11:15:00'),
(30, 58, 1, 'store', 60, '2026-03-28 09:00:00'),
(31, 60, 1, 'store', 12, '2026-03-28 09:10:00'),
(32, 61, 1, 'store', 20, '2026-03-28 09:15:00');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `items`
--

CREATE TABLE `items` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `user_id` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `items`
--

INSERT INTO `items` (`id`, `name`, `barcode`, `description`, `quantity`, `user_id`, `category_id`, `location_id`, `updated_at`, `created_at`) VALUES
(1, 'SMD Kondenzátor 100µF/16V', 'BC-AL-00001', 'Elektrolit kondenzátor, 100µF 16V, 105°C, RM2.0', 479, NULL, 1, 2, '2026-04-20 14:51:40', '2025-09-01 08:00:00'),
(2, 'SMD Ellenállás 10kΩ 0805', 'BC-AL-00002', '10kΩ ±1%, 0.125W, 0805 méret, fém-film', 793, NULL, 1, 2, '2026-04-20 14:46:34', '2025-09-01 08:05:00'),
(3, 'MOSFET IRF3205', 'BC-AL-00003', 'N-csatornás, 55V 110A, TO-220, RDS(on)=8mΩ', 73, NULL, 1, 9, '2026-03-24 12:01:32', '2025-09-01 08:10:00'),
(4, 'STM32F103C8T6 MCU', 'BC-AL-00004', 'ARM Cortex-M3, 72MHz, 64KB Flash, LQFP-48', 42, NULL, 1, 3, '2026-01-15 11:30:00', '2025-09-01 08:15:00'),
(5, 'Forrasztóállomás Hakko FX-888D', 'BC-SZ-00001', 'Digitális szabályozású, 70W, ESD-biztos, tároló állvánnyal', 7, NULL, 2, 4, '2026-04-20 14:47:38', '2025-09-01 08:20:00'),
(6, 'Csipesztfogó antisztatikus', 'BC-SZ-00002', 'ESD-biztos csipesztfogó, rozsdamentes acél, SS-SA heggyel', 100, NULL, 2, 9, '2026-03-12 12:27:49', '2025-09-01 09:00:00'),
(7, 'Hőlégfúvó állomás 858D', 'BC-SZ-00003', '700W, 100-480°C, digitális, SMD komponens szedéshez', 3, NULL, 2, 9, '2026-01-20 10:05:00', '2025-09-01 09:05:00'),
(8, 'Forrasztóón 0.8mm / 250g', 'BC-FO-00001', 'Sn60Pb40, 0.8mm, 250g tekercsen, gyanta maggal', 9, NULL, 3, 12, '2026-03-16 10:44:28', '2025-09-01 10:00:00'),
(9, 'Folyasztószer (flux) 50ml', 'BC-FO-00002', 'No-clean folyékony flux, fecskendős, RF-800 típus', 27, NULL, 3, 12, '2026-03-16 09:57:45', '2025-09-01 10:05:00'),
(10, 'IPA tisztítószer 1L', 'BC-FO-00003', 'Izopropil-alkohol 99.9%, elektronikai tisztításhoz', 30, NULL, 3, 13, '2026-02-12 13:00:00', '2025-09-01 10:10:00'),
(11, 'Hőpaszta MX-4 / 4g', 'BC-FO-00004', 'Arctic MX-4, 8.5 W/mK, processzor és teljesítményelektronika', 36, NULL, 3, 13, '2026-04-20 13:58:42', '2025-09-01 10:15:00'),
(12, 'Digitális multiméter Fluke 117', 'BC-ME-00001', 'Igaz effektív érték, érintésmentes feszültségmérés, CAT III', 3, NULL, 4, 16, '2026-02-15 14:00:00', '2025-10-10 09:00:00'),
(13, 'Oszcilloszkóp Rigol DS1054Z', 'BC-ME-00002', '4 csatorna, 50MHz, 1GSa/s, USB, LAN', 2, NULL, 4, 16, '2026-02-15 14:00:00', '2025-10-10 09:05:00'),
(22, 'SMD Ellenállás 1kΩ 0805', 'BC-AL-00005', '1kΩ ±1%, 0.125W, 0805 méret', 5000, NULL, 1, 20, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(23, 'SMD Ellenállás 4.7kΩ 0805', 'BC-AL-00006', '4.7kΩ ±1%, 0.125W, 0805 méret', 4500, NULL, 1, 20, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(24, 'Kerámia Kondenzátor 100nF', 'BC-AL-00007', '100nF 50V X7R', 2000, NULL, 1, 21, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(25, 'Kerámia Kondenzátor 10nF', 'BC-AL-00008', '10nF 50V X7R', 1500, NULL, 1, 21, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(26, 'LED Piros 5mm', 'BC-AL-00009', 'THT Piros LED, 20mA, 2.0V', 800, NULL, 1, 22, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(27, 'LED Zöld 5mm', 'BC-AL-00010', 'THT Zöld LED, 20mA, 2.2V', 750, NULL, 1, 22, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(28, 'LED Kék 5mm', 'BC-AL-00011', 'THT Kék LED, 20mA, 3.2V', 600, NULL, 1, 22, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(29, 'Tranzisztor BC547', 'BC-AL-00012', 'NPN Bipoláris Tranzisztor TO-92', 300, NULL, 1, 23, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(30, 'Tranzisztor BC557', 'BC-AL-00013', 'PNP Bipoláris Tranzisztor TO-92', 280, NULL, 1, 23, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(31, 'Feszültségszabályzó 7805', 'BC-AL-00014', '5V 1A Lineáris feszültségszabályzó TO-220', 150, NULL, 1, 24, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(32, 'Feszültségszabályzó 7812', 'BC-AL-00015', '12V 1A Lineáris feszültségszabályzó TO-220', 120, NULL, 1, 24, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(33, 'Opa Amp LM358', 'BC-AL-00016', 'Kettős műveleti erősítő DIP-8', 400, NULL, 1, 25, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(34, 'Timer NE555', 'BC-AL-00017', 'Precöziós időzítő DIP-8', 600, NULL, 1, 25, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(35, 'Microcontroller ATmega328P', 'BC-AL-00018', '8-bit AVR RISC, 32KB Flash, DIP-28', 50, NULL, 1, 26, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(36, 'Microcontroller ESP32', 'BC-AL-00019', 'Wi-Fi & Bluetooth MCU WROOM-32', 80, NULL, 1, 26, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(37, 'Kábelkötegelő 200x4.8mm Fekete', 'BC-KA-00001', 'UV álló kábelkötegelő 100db/csomag', 50, NULL, 6, 27, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(38, 'AWG22 Vezeték Piros', 'BC-KA-00002', 'Szilikon szigetelésű hajlékony vezeték, 100m tekercs', 12, NULL, 6, 28, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(39, 'AWG22 Vezeték Fekete', 'BC-KA-00003', 'Szilikon szigetelésű hajlékony vezeték, 100m tekercs', 10, NULL, 6, 28, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(40, 'M3x10 Belső hatlapfejű csavar', 'BC-KO-00001', 'A2 Rozsdamentes acél, 1000db/doboz', 15, NULL, 7, 29, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(41, 'M3 Anya', 'BC-KO-00002', 'A2 Rozsdamentes acél, 1000db/doboz', 20, NULL, 7, 29, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(42, 'M4x15 Süllyesztett fejű csavar', 'BC-KO-00003', 'Horganyzott, 500db/doboz', 8, NULL, 7, 30, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(43, 'ESD Csuklópánt', 'BC-MV-00001', 'Antisztatikus csuklópánt 1.5m kábellel', 45, NULL, 8, 31, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(44, 'ESD Kesztyű (L)', 'BC-MV-00002', 'PU bevonatú ujjbegy, antisztatikus', 120, NULL, 8, 31, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(45, 'Védőszemüveg', 'BC-MV-00003', 'Karcmentes polikarbonát lencse', 30, NULL, 8, 32, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(46, 'Pillanatragasztó Loctite 401', 'BC-RA-00001', 'Univerzális cianoakrilát, 20g', 25, NULL, 9, 33, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(47, 'Hővezető Ragasztó', 'BC-RA-00002', 'Kétkomponensű, hűtőbordákhoz', 15, NULL, 9, 33, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(48, 'Lencse 50mm fókusztáv', 'BC-OP-00001', 'Plano-konvex üveg lencse', 40, NULL, 10, 34, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(49, 'Li-ion Cella 18650 3200mAh', 'BC-AK-00001', 'Samsung INR18650-32E, 3.7V', 200, NULL, 11, 35, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(50, 'Gombelem CR2032', 'BC-AK-00002', 'Lítium 3V', 500, NULL, 11, 35, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(51, 'Hőmérséklet szenzor DHT11', 'BC-SZ-00005', 'Digitális páratartalom és hőmérséklet szenzor', 85, NULL, 12, 36, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(52, 'Ultrahangos távolságmérő HC-SR04', 'BC-SZ-00006', '2cm - 400cm mérési tartomány', 59, NULL, 12, 36, '2026-04-20 14:10:11', '2026-03-24 10:56:56'),
(53, 'Oszcilloszkóp mérőfej 100MHz', 'BC-ME-00003', '1X/10X kapcsolható, 600V PK, BNC csatlakozó', 15, NULL, 4, 17, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(54, 'Kábelcsupaszító fogó', 'BC-SZ-00007', 'Automatikus AWG24-10 méretekhez', 8, NULL, 2, 4, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(55, 'Kartondoboz 400x300x200', 'BC-CS-00001', '3 rétegű hullámkarton, 50db/köteg', 40, NULL, 5, 5, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(56, 'Térkitöltő chips', 'BC-CS-00002', 'Biológiailag lebomló, 500L zsák', 12, NULL, 5, 9, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(57, 'Ragasztószalag átlátszó', 'BC-CS-00003', 'Akril, 48mm x 66m', 150, NULL, 5, 10, '2026-03-24 10:56:56', '2026-03-24 10:56:56'),
(58, 'DC-DC tápmodul LM2596', 'BC-AL-00020', 'Step-down konverter, 4.5-40V be, 1.25-37V ki, 3A', 60, NULL, 1, 6, '2026-03-28 09:00:00', '2026-03-28 09:00:00'),
(59, 'RS232/USB konverter CP2102', 'BC-AL-00021', 'USB-UART híd, CP2102 chip, 3.3V/5V', 35, NULL, 1, 5, '2026-04-23 19:08:08', '2026-03-28 09:05:00'),
(60, 'Biztonsági relé Pilz PNOZ X3', 'BC-AL-00022', '24VDC, 2 NC + 1 NO érintkezőkkel, vészleállítóhoz', 12, NULL, 1, 7, '2026-03-28 09:10:00', '2026-03-28 09:10:00'),
(61, 'Pt100 hőmérsékletérzékelő', 'BC-SZ-00008', 'Ipari RTD szonda, -50°C…+200°C, SS tokozás', 20, NULL, 12, 8, '2026-03-28 09:15:00', '2026-03-28 09:15:00'),
(62, 'Pákahegy készlet Hakko T18', 'BC-SZ-00004', 'Csere pákahegy forrasztóállomáshoz, 5 db/készlet', 18, NULL, 2, 11, '2026-03-28 09:20:00', '2026-03-28 09:20:00'),
(63, 'Antistatikus tároló doboz ESD', 'BC-CS-00004', 'Osztott tároló doboz, 330x230x50mm, ESD-biztos', 25, NULL, 5, 14, '2026-03-28 09:25:00', '2026-03-28 09:25:00'),
(64, 'Hálózati analizátor mérőkábel SMA', 'BC-ME-00004', 'SMA-SMA koaxiális mérőkábel, 50Ω, 1m, -18GHz', 8, NULL, 4, 15, '2026-03-28 09:30:00', '2026-03-28 09:30:00'),
(65, 'Többeres erőátviteli kábel H07V-K 2.5mm²', 'BC-KA-00004', 'Hajlékony, PVC szigetelés, 100m tekercs, piros', 5, NULL, 6, 19, '2026-03-28 09:35:00', '2026-03-28 09:35:00'),
(66, 'Hallásvédő fülhallgató 3M Peltor', 'BC-MV-00004', '28 dB zajcsökkentés, piros, CE EN352-1', 14, NULL, 8, 37, '2026-03-28 09:40:00', '2026-03-28 09:40:00'),
(67, 'Ragasztóspisztoly 60W', 'BC-SZ-00009', '11mm patron, hőmérséklet-vezérlés nélkül, 60W', 6, NULL, 2, 38, '2026-03-28 09:45:00', '2026-03-28 09:45:00'),
(68, 'M5x20 Belső hatlapfejű csavar', 'BC-KO-00004', 'A2 rozsdamentes acél, 500db/doboz', 10, NULL, 7, 39, '2026-03-28 09:50:00', '2026-03-28 09:50:00'),
(69, 'Li-Po akkumulátor 7.4V 2200mAh', 'BC-AK-00003', '2S1P LiPo, XT60 csatlakozó, 20C kimeneti áram', 30, NULL, 11, 40, '2026-03-28 09:55:00', '2026-03-28 09:55:00'),
(70, 'Szilikon huzal AWG28 Fekete', 'BC-KA-00005', 'Szilikon szigetelés, magas hőálló, 50m tekercs', 8, NULL, 6, 42, '2026-03-28 10:00:00', '2026-03-28 10:00:00');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `locations`
--

CREATE TABLE `locations` (
  `id` int(11) NOT NULL,
  `row_num` int(11) NOT NULL,
  `col_num` int(11) NOT NULL,
  `shelf_level` int(11) NOT NULL DEFAULT 0,
  `is_xl` tinyint(1) NOT NULL DEFAULT 0,
  `location_code` varchar(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `locations`
--

INSERT INTO `locations` (`id`, `row_num`, `col_num`, `shelf_level`, `is_xl`, `location_code`, `is_active`) VALUES
(1, 1, 1, 0, 1, '01-01-00', 1),
(2, 1, 1, 1, 0, '01-01-01', 1),
(3, 1, 1, 2, 0, '01-01-02', 1),
(4, 1, 1, 3, 0, '01-01-03', 1),
(5, 1, 2, 0, 1, '01-02-00', 1),
(6, 1, 2, 1, 0, '01-02-01', 1),
(7, 1, 2, 2, 0, '01-02-02', 1),
(8, 2, 1, 0, 1, '02-01-00', 1),
(9, 2, 2, 0, 1, '02-02-00', 1),
(10, 2, 3, 0, 1, '02-03-00', 1),
(11, 3, 1, 0, 1, '03-01-00', 1),
(12, 3, 1, 1, 0, '03-01-01', 1),
(13, 3, 1, 2, 0, '03-01-02', 1),
(14, 3, 2, 2, 0, '03-02-01', 1),
(15, 3, 2, 2, 0, '03-02-02', 1),
(16, 4, 1, 1, 0, '04-01-01', 1),
(17, 4, 1, 2, 0, '04-01-02', 1),
(18, 4, 2, 1, 0, '04-02-01', 0),
(19, 5, 1, 0, 1, '05-01-00', 1),
(20, 5, 1, 1, 0, '05-01-01', 1),
(21, 5, 1, 2, 0, '05-01-02', 1),
(22, 5, 1, 3, 0, '05-01-03', 1),
(23, 5, 2, 0, 1, '05-02-00', 1),
(24, 5, 2, 1, 0, '05-02-01', 1),
(25, 5, 2, 2, 0, '05-02-02', 1),
(26, 5, 2, 3, 0, '05-02-03', 1),
(27, 5, 3, 0, 1, '05-03-00', 1),
(28, 5, 3, 1, 0, '05-03-01', 1),
(29, 5, 3, 2, 0, '05-03-02', 1),
(30, 5, 3, 3, 0, '05-03-03', 1),
(31, 6, 1, 0, 1, '06-01-00', 1),
(32, 6, 1, 1, 0, '06-01-01', 1),
(33, 6, 1, 2, 0, '06-01-02', 1),
(34, 6, 1, 3, 0, '06-01-03', 1),
(35, 6, 2, 0, 1, '06-02-00', 1),
(36, 6, 2, 1, 0, '06-02-01', 1),
(37, 6, 2, 2, 0, '06-02-02', 1),
(38, 6, 2, 3, 0, '06-02-03', 1),
(39, 7, 1, 0, 1, '07-01-00', 1),
(40, 7, 1, 1, 0, '07-01-01', 1),
(41, 7, 1, 2, 0, '07-01-02', 0),
(42, 7, 1, 3, 0, '07-01-03', 1),
(43, 8, 1, 0, 1, '08-01-00', 1),
(44, 8, 1, 1, 0, '08-01-01', 1),
(45, 8, 2, 0, 1, '08-02-00', 1),
(46, 8, 2, 1, 0, '08-02-01', 1);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `rentals`
--

CREATE TABLE `rentals` (
  `id` int(11) NOT NULL,
  `requester_user_id` int(11) DEFAULT NULL,
  `requester_email` varchar(255) DEFAULT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `purpose` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `returned_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- A tábla adatainak kiíratása `rentals`
--

INSERT INTO `rentals` (`id`, `requester_user_id`, `requester_email`, `item_id`, `quantity`, `purpose`, `status`, `reviewed_by`, `review_note`, `reviewed_at`, `approved_at`, `returned_at`, `created_at`, `updated_at`) VALUES
(1, 8, 'szigeti.szabolcs@petrik.hu', 12, 1, 'Tápegység hálózati ellenőrzése a 3. szereléssornál', 'returned', 6, 'Jóváhagyva, 1 hétre', '2025-11-10 09:30:00', '2025-11-10 09:30:00', '2025-11-17 15:00:00', '2025-11-10 08:45:00', '2025-11-17 15:00:00'),
(2, 8, 'szigeti.szabolcs@petrik.hu', 7, 1, 'SMD átdolgozás – hőlégfúvó szükséges az összeszerelésnél', 'approved', 7, 'Jóváhagyva, 2026-02-15-ig kiadva', '2026-02-01 10:00:00', '2026-02-01 10:00:00', NULL, '2026-02-01 09:30:00', '2026-02-01 10:00:00'),
(3, 1, 'hornyak.tibor@petrik.hu', 53, 2, 'Sávszélesség mérés a prototípus PWM vezérlőkön', 'returned', 6, 'Jóváhagyva', '2026-03-05 11:00:00', '2026-03-05 11:00:00', '2026-03-12 16:00:00', '2026-03-05 10:30:00', '2026-03-12 16:00:00'),
(4, 7, 'kalman.barnabas.mate@petrik.hu', 13, 1, 'Jelalak-ellenőrzés inverter prototípusnál', 'pending', NULL, NULL, NULL, NULL, NULL, '2026-04-18 13:00:00', '2026-04-18 13:00:00'),
(5, 8, 'szigeti.szabolcs@petrik.hu', 5, 1, 'Forrasztási minőségellenőrzés a végső összeszerelésnél', 'approved', 6, 'Max 3 munkanap', '2026-04-21 09:00:00', '2026-04-21 09:00:00', NULL, '2026-04-21 08:30:00', '2026-04-21 09:00:00');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `tasks`
--

CREATE TABLE `tasks` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('inbound','picking','transfer') NOT NULL,
  `source_id` varchar(100) DEFAULT NULL,
  `assigned_user` int(11) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `priority` int(11) NOT NULL DEFAULT 5,
  `deadline` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `tasks`
--

INSERT INTO `tasks` (`id`, `name`, `type`, `source_id`, `assigned_user`, `status`, `priority`, `deadline`, `updated_at`, `created_at`) VALUES
(1, 'Bevételezés - SZÁ-2025-041', 'inbound', 'SZÁ-2025-041', 1, 'completed', 2, NULL, '2025-09-01 12:30:00', '2025-09-01 09:00:00'),
(2, 'Kiadás - WO-2025-118', 'picking', 'WO-2025-118', 8, 'completed', 3, '2025-11-15 16:00:00', '2025-11-14 15:45:00', '2025-11-14 08:00:00'),
(3, 'Kiadás - WO-2026-003', 'picking', 'WO-2026-003', 8, 'completed', 2, '2026-01-22 16:00:00', '2026-01-22 14:10:00', '2026-01-22 07:30:00'),
(4, 'Raktári átrendezés - R-001', 'transfer', 'R-001', 7, 'completed', 3, '2026-02-28 16:00:00', '2026-02-27 13:20:00', '2026-02-27 08:00:00'),
(5, 'Kiadás - WO-2026-021', 'picking', 'WO-2026-021', NULL, 'pending', 2, '2026-04-25 16:00:00', '2026-04-21 08:00:00', '2026-04-21 08:00:00');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `task_items`
--

CREATE TABLE `task_items` (
  `id` int(11) NOT NULL,
  `task_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `requested_quantity` int(11) NOT NULL DEFAULT 1,
  `picked_quantity` int(11) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `task_items`
--

INSERT INTO `task_items` (`id`, `task_id`, `item_id`, `requested_quantity`, `picked_quantity`, `status`) VALUES
(1, 1, 1, 500, 500, 'picked'),
(2, 1, 2, 800, 800, 'picked'),
(3, 1, 3, 80, 80, 'picked'),
(4, 1, 22, 5000, 5000, 'picked'),
(5, 2, 8, 5, 5, 'picked'),
(6, 2, 9, 3, 3, 'picked'),
(7, 2, 10, 2, 2, 'picked'),
(8, 2, 11, 2, 2, 'picked'),
(9, 3, 26, 50, 50, 'picked'),
(10, 3, 27, 50, 50, 'picked'),
(11, 3, 29, 20, 20, 'picked'),
(12, 3, 33, 10, 10, 'picked'),
(13, 4, 24, 1000, 1000, 'picked'),
(14, 4, 25, 800, 800, 'picked'),
(15, 4, 28, 400, 400, 'picked'),
(16, 5, 4, 10, 0, 'pending'),
(17, 5, 60, 5, 0, 'pending'),
(18, 5, 61, 3, 0, 'pending');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `role` enum('admin','worker','supervisor') NOT NULL DEFAULT 'worker',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `users`
--

INSERT INTO `users` (`id`, `email`, `role`, `is_active`, `last_login`) VALUES
(1, 'hornyak.tibor@petrik.hu', 'admin', 1, '2026-02-19 07:45:00'),
(6, 'hidasi.gabriella@petrik.hu', 'supervisor', 1, NULL),
(7, 'kalman.barnabas.mate@petrik.hu', 'admin', 1, NULL),
(8, 'szigeti.szabolcs@petrik.hu', 'worker', 1, NULL);

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_dr_reporter` (`reported_by`),
  ADD KEY `fk_dr_reviewer` (`reviewed_by`);

--
-- A tábla indexei `inventory_logs`
--
ALTER TABLE `inventory_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_logs_item` (`item_id`),
  ADD KEY `idx_inv_logs_user` (`user_id`),
  ADD KEY `idx_inv_logs_timestamp` (`timestamp`);

--
-- A tábla indexei `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_items_barcode` (`barcode`),
  ADD KEY `idx_items_barcode` (`barcode`),
  ADD KEY `idx_items_user` (`user_id`),
  ADD KEY `idx_items_category` (`category_id`),
  ADD KEY `idx_items_location` (`location_id`);

--
-- A tábla indexei `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_locations_code` (`location_code`),
  ADD KEY `idx_locations_code` (`location_code`);

--
-- A tábla indexei `rentals`
--
ALTER TABLE `rentals`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tasks_assigned_user` (`assigned_user`);

--
-- A tábla indexei `task_items`
--
ALTER TABLE `task_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_task_items_task` (`task_id`),
  ADD KEY `idx_task_items_item` (`item_id`);

--
-- A tábla indexei `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT a táblához `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `inventory_logs`
--
ALTER TABLE `inventory_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT a táblához `items`
--
ALTER TABLE `items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=71;

--
-- AUTO_INCREMENT a táblához `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=75;

--
-- AUTO_INCREMENT a táblához `rentals`
--
ALTER TABLE `rentals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `task_items`
--
ALTER TABLE `task_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `fk_dr_reporter` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_dr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Megkötések a táblához `inventory_logs`
--
ALTER TABLE `inventory_logs`
  ADD CONSTRAINT `fk_inv_logs_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_inv_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Megkötések a táblához `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `fk_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_items_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_items_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Megkötések a táblához `tasks`
--
ALTER TABLE `tasks`
  ADD CONSTRAINT `fk_tasks_user` FOREIGN KEY (`assigned_user`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Megkötések a táblához `task_items`
--
ALTER TABLE `task_items`
  ADD CONSTRAINT `fk_task_items_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_task_items_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
