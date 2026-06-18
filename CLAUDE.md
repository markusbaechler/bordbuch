# CLAUDE.md – Bordbuch (Motorboot-Logbuch)  · v4 (Seekarte + GPS-Tacho)

WICHTIG: Logbuch/CRUD/Dashboard (§1–§11) sind umgesetzt. v3 ergänzt das Feature
**„Vor der Abfahrt"** (Live-Wetter/Pegel/Wassertemperatur, §14), die **History-Modals**
(§14) und die **PWA**-Fähigkeit (§15). v4 ergänzt die **interaktive Seekarte + GPS-Tacho**
(§16). Backend (Code.gs v2, CRUD) unverändert.

## 1. Ziel
Mobile-first Logbuch für ein Motorboot in **Ascona, Lago Maggiore**. Nutzung am
Steuerstand auf dem Smartphone. Alle Daten in einer Google-Tabelle, Zugriff über eine
bestehende Apps-Script-Web-App. Volles CRUD. (Bootsname: noch offen → Platzhalter in der Topbar.)

## 2. Architektur (verbindlich)
Vite + React + TS + Tailwind, statisch auf GitHub Pages. API = Google Apps Script
(fertig). Speicher = Google Sheets. Auto-Deploy via GitHub Actions auf Push nach `main`.
Keine andere DB, kein Server, kein Firebase. **Keine Foto-Uploads** (vorerst).
Installierbar als **PWA** (Manifest + Service Worker, §15). Live-Conditions (§14) kommen
direkt von keylosen CORS-APIs (Open-Meteo, existenz.ch); die Wassertemperatur (Alplakes,
kein CORS) läuft über einen separaten Apps-Script-Read-Proxy (`Code.proxy.gs`).

## 3. API-Vertrag (Backend ist fertig, nicht ändern)
Antworten: `{ ok, data?, error? }`.
- Liste: `GET {URL}?action=list&token={TOKEN}` → `{ ok, data: Entry[] }`
- Create/Update/Delete: `POST {URL}` mit `Content-Type: text/plain` (CORS-Trick!),
  Body JSON-String `{ token, action, ...felder }`.
- Kein `no-cors`, keine Zusatz-Header, Redirect folgen lassen.

## 4. Datenmodell (Sheet "Logbuch", exakt diese Reihenfolge)
| Spalte | Typ | Pflicht | Quelle |
|---|---|---|---|
| id | string | – | Backend |
| createdAt | datetime | – | Backend |
| updatedAt | datetime | – | Backend |
| date | ISO-Datum (YYYY-MM-DD) | ja | User |
| harborFrom | string | ja | User (Default "Ascona, Porto Patriziale") |
| harborTo | string (Freitext) | – | User |
| engineHours | number | ja | User (**Zählerstand bei Start**, EIN Wert) |
| fuelLiters | number | – | User (nur bei Tankstopp) |
| fuelCostChf | number | – | User (nur bei Tankstopp) |
| paidBy | string | – | User ("Bezahlt durch") |
| notes | string | – | User ("Benutzung") |
| weatherTempC | number | – | Backend (auto) |
| weatherWindKn | number | – | Backend (auto) |
| weatherWindDir | number (Grad) | – | Backend (auto) |
| weatherDesc | string | – | Backend (auto) |

Keine Start/Ende-Zeiten, keine Distanz, keine Fotos. engineHours ist EIN Zählerstand.

## 5. Berechnungslogik (im Frontend, NICHT gespeichert)
Einträge nach `date` aufsteigend sortieren, dann:
- **Stunden je Eintrag** = `engineHours(dieser) − engineHours(vorheriger)`. Erster = 0.
  Negative/fehlende Werte abfangen (→ "–").
- **h seit Start** = `engineHours − kleinster engineHours`.
- **Verbrauch l/h (Schätzung, "≈")**: Liter nur bei Tankstopps. Tank-Block = Einträge
  seit letztem Tankstopp; Block-l/h = `Liter ÷ Stundendiff im Block`; Wert allen Einträgen
  des Blocks zuweisen. Nach letztem Tankstopp → "–". Div/0 → "–".
- **Jahr-Aggregate** je Kalenderjahr aus `date`:
  - Betriebsstunden/Jahr = Summe der Stundendiffs der Einträge des Jahres.
  - Einträge/Jahr ("Ereignisse").
  - Treibstoff/Jahr = Σ fuelLiters bzw. Σ fuelCostChf.
  - Verbrauch/Jahr l/h = Σ Liter/Jahr ÷ Σ Stunden/Jahr → mit "≈" (jahresweise unpräzise).
  - CHF/h pro Jahr.
- **Total/Gesamt:** Σ Stunden, Σ CHF, Σ Liter, Ø l/h = Σ Liter ÷ Σ Stunden (EXAKT, ohne "≈").
- **Durchschnitt pro Jahr:** Total ÷ Anzahl Jahre (Ø Stunden/Jahr, Ø Einträge/Jahr, Ø Kosten/Jahr).

## 6. Features (MVP)
1. **Liste** aller Einträge, `date` absteigend, mit Suche/Filter (Hafen, paidBy, Jahr).
   Kachel zeigt: Stunden dieses Eintrags, Zählerstand, ≈ l/h (Block, "–" wenn unbekannt).
2. **CRUD**: erfassen / bearbeiten / löschen.
3. **Detailansicht**: alle Felder + Wetter (Temp, Wind kn + Richtung als Kompass, Lage) +
   berechnete Werte (Stunden, h seit Start, ≈ l/h).
4. **Dashboard – DREI EBENEN** (siehe Mockup `bordbuch-dashboard-v2.html` als visuelle Vorlage):
   - **(a) Total** über alle Jahre: 4 Instrument-Kacheln – Gesamt-Betriebsstunden,
     Ø Verbrauch l/h (exakt, OHNE "≈"), Treibstoffkosten CHF, Anzahl Einträge.
   - **(b) Ø pro Jahr**: Ø Stunden/Jahr, Ø Einträge/Jahr, Ø Kosten/Jahr (kleine Box-Reihe).
   - **(c) Pro Jahr**: umschaltbarer Balkenchart (Motor h / Einträge / Treibstoff) über alle
     Jahre, mit Ø-Linie. Balken antippbar → wählt das Jahr für (d).
   - **(d) Einzeljahr im Detail**: Jahr per Chips/Balken wählbar → Betriebsstunden
     (+Δ gegenüber Ø), Einträge, Liter, CHF, ≈ l/h, CHF/h.
5. Status klar: Spinner, Toast bei Erfolg/Fehler.
6. **Vor der Abfahrt (Wetter)** – Live-Conditions für Locarno (Details §14). Das ist
   der **Start-Screen** der App (erster Tab in der Bottom-Nav, Kompass-Icon).

UX-Detail: Neuer Eintrag → `harborFrom` mit "Ascona, Porto Patriziale" vorbefüllen,
`engineHours` mit dem letzten (höchsten) Zählerstand als Vorschlag.

## 7. UX / Design
Beibehalten: Chartplotter-/Instrument-Optik, Tag/Nacht (mit Persistenz, prefers-color-scheme
als Default), mobile-first, full-bleed (KEIN Geräterahmen), grosse Touch-Targets, Quality-Floor
(focus-visible, prefers-reduced-motion, safe-area, responsive ≤360px).

**Farb-Tokens (maritim, KEIN Orange mehr):**
- Tag: bg `#E6EDF2`, surface `#FFFFFF`, surface-2 `#F2F6F9`, ink `#0A2233`, ink-2 `#52708A`,
  line `#D5E0E8`, **Akzent (Primär/CTA) `#1C5C8C` (Marineblau)**, Wasser/aktiv `#0C7C82` (Teal).
- Nacht: bg `#04101A`, surface `#0E2030`, ink `#DCEAF2`, **Akzent `#3E8FC4`**, Teal `#2BC4C4`.
- Akzent (Marineblau) nur für primäre Aktionen, aktive Nav, FAB, „hot"-Kachel-Linie.
  Teal für Wasser/sekundär. (Akzent leicht austauschbar, falls Wahl auf Rot/Messing fällt.)
- Fonts: Barlow Condensed (Display), Inter (UI), JetBrains Mono (Zahlen, tabular-nums).

## 8. Tech / Config
Env: `VITE_API_URL`, `VITE_API_TOKEN` (CRUD-Backend) und `VITE_WATERTEMP_URL`
(Wassertemp-Proxy, §14). `.env` gitignored (echte Werte), `.env.example` NUR Platzhalter.
`vite.config.ts` base `/bordbuch/`. API-Client als dünner Wrapper über das
`{ok,data,error}`-Envelope. Sauberer Code, Kommentare nur an komplexen Stellen.

## 9. Deployment
GitHub Actions → Pages (Source = "GitHub Actions"). Drei Secrets im Build als env
injizieren: `VITE_API_URL`, `VITE_API_TOKEN`, `VITE_WATERTEMP_URL` (`.github/workflows/deploy.yml`).
Der Wassertemp-Proxy (`Code.proxy.gs`) ist ein **separates** Apps Script und wird
eigenständig deployt (nicht Teil des Pages-Builds, §14).

## 10. Refactor-Auftrag
Bestehendes Frontend auf dieses Modell umbauen:
- types.ts: Entry/EntryInput auf die 15 Felder; `engineHours` (single), `paidBy`,
  `harborTo` Freitext, Wetterfelder inkl. `weatherWindDir`.
- calc.ts: Stundendiff (Zählerstand), h-seit-Start, Jahr-Aggregate, Ø-pro-Jahr, Verbrauch.
- FormScreen: date statt Zeiten, ein engineHours (Vorbefüllung letzter Stand),
  harborFrom-Default Ascona, harborTo Freitext, paidBy. Validierung anpassen.
- ListScreen/DetailScreen: neue Felder, Wind (kn + Kompassrichtung).
- DashboardScreen: die DREI Ebenen aus §6.4 (Total → Ø/Jahr → Pro-Jahr-Chart → Einzeljahr-
  Detail mit Δ vs Ø). Mockup `bordbuch-dashboard-v2.html` als Vorlage.
- Distanz/Fahrzeit/Crew/Foto-Reste entfernen. Akzentfarbe auf Marineblau umstellen.

## 11. Constraints & Non-Goals
Nur Sheets, keine Fotos (vorerst), ein Boot. Token im Frontend bewusst akzeptiert.

## 12. Backlog
Foto-Upload via Drive (Stundenzähler + Beleg), PDF-Export, Login-Härtung,
Pegel-Jahresvergleich (`level-year` via existenz InfluxDB, optional).
Erledigt: Offline-Cache (jetzt via PWA-Service-Worker, §15).

## 13. Sicherheit
.env nie committen, echte Werte nur in .env (lokal) + GitHub Secrets.
Der Wassertemp-Proxy bekommt bewusst KEIN Token (read-only, nur öffentliche Seedaten).

## 14. Live-Conditions „Vor der Abfahrt" (v3)
Visuelle Vorlage: Mockup `bordbuch-conditions.html`.
Screen `src/screens/ConditionsScreen.tsx`, Hook `src/hooks/useConditions.ts`,
Daten-Clients `src/lib/liveData.ts` (Wind + Pegel, direkt) und `src/lib/waterTemp.ts`
(Wassertemp, via Proxy). Jede Quelle scheitert unabhängig (`Promise.allSettled` / try-catch).

**Datenquellen:**
- **Wind/Wetter** – Open-Meteo (keylos, CORS), Direktaufruf. Ampel nach **Böen** (nicht
  mittlerem Wind), kn: grün < 16, gelb 16–27, rot ≥ 27 oder Gewitter (WMO 95–99 jetzt
  oder in 12 h). Lokalwinde nach Richtung: Süd 135–225° → „Inverna", Nord ≤45°/≥315° →
  „Tramontana". Ampel-Hintergründe (kein Token!): good `var(--good)`, warn `#E8930C`,
  bad `#D8352A`.
- **Seepegel** – existenz.ch (BAFU), Station 2022 „Lago Maggiore – Locarno", keylos/CORS,
  direkt. Hochwasser-Referenz `HW_LEVEL_MASL = 195.75` m ü.M. (Gefahrenstufe 5).
- **Wassertemperatur** – Alplakes Simstrat-1D (Eawag). **Kein CORS** → nur über den
  Proxy (`VITE_WATERTEMP_URL`). Fallback: saisonaler Monats-Schätzwert. UI-Label
  „● live · Alplakes (Simstrat)" bzw. „✎ Saison-Schätzung".

**History-Modals** (`src/components/Modal.tsx` + selbstgezeichneter `src/components/LineChart.tsx`,
keine Chart-Lib): Kacheln sind antippbar und öffnen je ein Liniendiagramm.
- Wind: Böen −48 h…+48 h, WARN-Linie 16 kn, „jetzt"-Marke.
- Seepegel: 30-Tage-Linie + Hochwasser-Referenzlinie + „Abstand zur Hochwassergrenze".
- Wassertemp: Jahresvergleich (aktuelles Jahr hervorgehoben + Vorjahre je eigene Farbe)
  + Jahres-Höchstwert-Marker.

**Proxy `Code.proxy.gs`** (separates Apps Script „Bordbuch Wassertemp", read-only,
serverseitige Tagesaggregate + Cache). `?type=`-Zweige: `watertemp` (Einzelwert),
`watertemp-series&days=N` (Tagesreihe, Cache 3 h), `watertemp-year` (aktuelles Jahr +
Höchstwert + `PAST_YEARS=3` Vorjahre, Cache 24 h). Nach Änderung als **neue Version**
deployen.

## 15. PWA
Installierbar (Manifest + Service Worker), ohne neue npm-Abhängigkeit.
- `public/manifest.webmanifest` – `display: standalone`, Theme/Background `#04101A`,
  relative Pfade (funktionieren in Dev unter `/` und auf Pages unter `/bordbuch/`).
- `public/sw.js` – network-first für Navigationen (Offline-App-Shell), stale-while-revalidate
  für Assets; Live-Daten/Fonts werden NICHT gecacht. Registrierung in `src/main.tsx`
  nur im Production-Build, base-pfad-bewusst.
- Icons via `scripts/gen-icons.mjs` (dependency-freier PNG-Generator, Kompass-Motiv):
  `node scripts/gen-icons.mjs` schreibt `public/icon-192|512.png`, `maskable-512.png`,
  `apple-touch-icon.png`, `favicon-32.png`.
- Layout ist eine fixe App-Shell (`h-dvh`, `body { overflow:hidden }`); nur `main` scrollt,
  Topbar/Bottom-Nav bleiben immer sichtbar.

## 16. Seekarte + GPS-Tacho (v4)
Neuer Bottom-Nav-Tab **„Karte"** (`Screen 'map'`, Karten-Pin-Icon). Screen
`src/screens/MapScreen.tsx`. **Bewusste Ausnahme von „keine neuen Deps": Leaflet**
(`leaflet` + `@types/leaflet`, via npm). Leaflet-CSS wird in `MapScreen.tsx` importiert.

- **Kacheln:** OpenStreetMap (Basis) + OpenSeaMap-Seamark-Overlay (Seezeichen/Tonnen/
  Untiefen, halbtransparent). Attribution „© OpenStreetMap / © OpenSeaMap" via Leaflet-
  Attribution-Control (Pflicht).
- **POIs: kuratierte, feste Liste** in `src/lib/mapData.ts` (`CURATED_POIS`), KEIN Live-Fetch
  mehr. Die frühere Overpass-Abfrage lieferte zu viel Clutter (hunderte Restaurants, jeder
  Adler der Falconeria als „attraction") → kein Mehrwert ggü. Google Maps. Stattdessen
  handverlesene boots-relevante Ziele über den ganzen Lago Maggiore (Nordbecken dichter,
  Heimatrevier; italienische Seite bis Arona). Kategorien (`CategoryKey`): `harbor`, `anchor`,
  `fuel`, `food`, `shop`, `sights` – Marker = `L.divIcon` mit Emoji+Farbe. `ACTIVE_CATEGORIES`
  blendet leere Kategorien aus den Filter-Chips (aktuell nur `shop` leer).
- **Halb-automatische Kuration:** `node scripts/fetch-poi-candidates.mjs` holt Kandidaten
  (Bootstankstellen, Häfen, Liege-/Ankerplätze) aus OSM/Overpass über den ganzen See (Lago di
  Lugano per Orts-Liste ausgefiltert) und gibt fertige `mapData`-Zeilen aus → sichten und in
  die passende `mk(...)`-Liste einfügen. Bewusst kein Auto-Write: die Liste bleibt kuratiert.
- **Links im Popup:** `website` → klickbarer „🌐 Website"-Link (auf `http(s)://` normalisiert,
  `target=_blank rel=noopener noreferrer`); `phone` → „☎ …" als `tel:`-Link.
- **Fahrtaufzeichnung → Logbuch:** Hook `src/hooks/useTripRecorder.ts` sammelt aus den
  GPS-Fixes einen Track (opt-in Start/Stopp), zeigt live Strecke (km+sm), Dauer, Ø-/Max-kn
  und zeichnet eine Polyline. Bei Stopp → „Ins Logbuch": baut einen `EntryDraft`
  (`FormScreen`) mit nächstgelegenem Hafen (`nearestHarborName`, Haversine) als Von/Nach +
  Eckdaten in den Notizen und springt vorbefüllt ins Formular. **Track wird NICHT persistiert**
  (Backend-Modell ist fix, §3/§4) – nur die Fahrt-Eckdaten landen im Eintrag.
- **GPS & Akku:** Hook `src/hooks/useGeoPosition.ts` (`watchPosition`, `enableHighAccuracy`).
  Der Watch läuft nur, solange der Karten-Tab gemountet UND sichtbar ist (Page-Visibility:
  Bildschirm aus/Hintergrund → Watch stoppt, kommt beim Zurückkehren wieder). **Tacho** zeigt
  km/h (×3.6) und Knoten (×1.94384), `font-mono`+`tabnum`; fehlt `coords.speed` (Desktop),
  Schätzung aus zwei Fixes (Haversine ÷ dt). „Mich zentrieren" schaltet Folgen ein, eine
  Kartengeste beendet es. Geo-Mathematik (Haversine, Bearing, Einheiten) in `src/lib/geo.ts`.
- **POI-Filter:** Button „Filter" (oben links) öffnet ein **Dropdown** mit Häkchen je Kategorie
  (`ACTIVE_CATEGORIES`) – KEIN Querscroll-Chip-Band mehr.
- **Standort-Hilfe (Android/iOS):** `navigator.permissions` liefert den Status; bei `denied`
  zeigt das Tacho-Panel „⚠ Standort blockiert" → Modal mit Schritt-für-Schritt-Anleitung
  (Chrome-Schloss → Berechtigungen → Standort; iOS Safari/Ortungsdienste) + „Seite neu laden".
  Bei `prompt` ein „Standort aktivieren"-Button (`getCurrentPosition` löst den OS-Dialog aus).
- **Mess-/Planungstool MIT Wasser-Routing:** „Messen" → zwei Karten-Taps. Statt Luftlinie
  rechnet `routeOnWater()` (`src/lib/route.ts`) einen Weg, der **im See bleibt**: Punkt-im-See
  (Ray-Casting gegen `src/lib/lake.ts`), ~200-m-Gitter aller Wasserzellen, **A\*** + String-
  Pulling. Panel: Distanz (km/sm, entlang Wasser), Kurs, ETA. Fallback Luftlinie (rot), wenn
  kein Wasserweg. `measuringRef` wird in `toggleMeasure` **synchron** gesetzt (Tap direkt danach
  greift). Seepolygon erzeugt via `scripts/fetch-lake.mjs` (OSM Relation 11758, ~470 Punkte).
- **Wetter & Wind über den ganzen See:** `fetchLakeConditions()` (`liveData.ts`) holt in EINER
  Open-Meteo-Anfrage 6 Punkte (Locarno…Stresa). Badge oben rechts = Conditions am nächsten Punkt
  zur GPS-Position (Emoji/Temp/Wind/Regen) und **öffnet ein Wetter-Modal** (`WeatherReport`):
  Jetzt-Tabelle aller 6 Punkte + **Stunden- und Tagesprognose** (`fetchLakeForecast()`,
  repräsentativer Punkt Seemitte). Im Modal ein Toggle „Wind-Pfeile auf der Karte" → blendet das
  **Wind-Feld** ein (`windIcon` je Punkt) inkl. **Legende** auf der Karte (Pfeil = Richtung, Zahl = kn).
- **See-Regeln/Zonen (nur wenn aktiviert):** Button „See-Regeln" zeichnet die **Uferzone als 150-m-
  Band**: `shoreZoneRing(150)` (`route.ts`) versetzt die Küstenlinie 150 m INS WASSER (Tangenten-
  Normale, Richtung per `inLake`-Test; verifiziert Median 150 m), gefüllt als Polygon mit Loch
  (`[LAKE_OUTLINE, inner]`) + 150-m-Grenzlinie. Dazu das No-Go-Polygon **Bolle di Magadino**
  (`src/lib/zones.ts`, OSM way 160197486) + Legende (`LAKE_RULES`). Default aus → Karte sauber.
  **Bewusst „ohne Gewähr"**: Annäherungen, offizielle Karten massgeblich.
- **Layout:** Die Karte braucht feste Höhe → eigenes, padding-/scrollfreies `<main>` in
  `App.tsx` (`screen === 'map'` rendert full-bleed, unabhängig vom Einträge-Ladezustand).
  `ResizeObserver` ruft `map.invalidateSize()` (mobile URL-Leiste). Popups + Attribution
  sind über CSS-Variablen an Tag/Nacht gekoppelt (`src/index.css`).
- **SW/Caching:** Kartenkacheln sind Fremd-Origin → der Service-Worker fängt sie nicht ab
  (direkt ans Netz), wie bei den übrigen Live-Daten.
