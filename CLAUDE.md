# CLAUDE.md – Bordbuch (Motorboot-Logbuch)  · v6 (Ankerwache/Anker-Alarm)

WICHTIG: Logbuch/CRUD/Dashboard (§1–§11) sind umgesetzt. v3 ergänzt das Feature
**„Vor der Abfahrt"** (Live-Wetter/Pegel/Wassertemperatur, §14), die **History-Modals**
(§14) und die **PWA**-Fähigkeit (§15). v4 ergänzt die **interaktive Seekarte** (§16) mit
weit mehr als nur GPS-Tacho: OSM/OpenSeaMap-Kacheln, kuratierte Boots-POIs über den ganzen
Lago Maggiore, **Fahrtaufzeichnung → Logbuch**, **Wasser-Distanzmessung** (Routing auf dem
See), **Wetter/Wind für den ganzen See** (auch im Wetter-Tab, §14) und **See-Regeln/Zonen**
(150-m-Uferband, Naturschutz). Kopfzeile/Bottom-Nav sind bereichsabhängig (§7). Backend
(Code.gs v2, CRUD) unverändert.

## 1. Ziel
Mobile-first Logbuch für ein Motorboot in **Ascona, Lago Maggiore**. Nutzung am
Steuerstand auf dem Smartphone. Alle Daten in einer Google-Tabelle, Zugriff über eine
bestehende Apps-Script-Web-App. Volles CRUD. (Bootsname = Platzhalter „Regal" in der Topbar,
zentral in `src/components/Topbar.tsx` änderbar.)

## 2. Architektur (verbindlich)
Vite + React + TS + Tailwind, statisch auf GitHub Pages. API = Google Apps Script
(fertig). Speicher = Google Sheets. Auto-Deploy via GitHub Actions auf Push nach `main`.
Keine andere DB, kein Server, kein Firebase. **Keine Foto-Uploads** (vorerst).
Installierbar als **PWA** (Manifest + Service Worker, §15). Live-Conditions (§14) kommen
direkt von keylosen CORS-APIs (Open-Meteo, existenz.ch); die Wassertemperatur (Alplakes,
kein CORS) läuft über einen separaten Apps-Script-Read-Proxy (`Code.proxy.gs`).
**Einzige npm-Ausnahme von „keine neuen Deps": Leaflet** (Seekarte, §16); Karten-Kacheln
(OSM/OpenSeaMap) und Wetter/Wind (Open-Meteo) sind keylos. POIs sind eine kuratierte,
versionierte Liste im Code (kein Live-Fetch, §16) – die See-Geometrie (Seepolygon, §16) wird
einmalig per Skript aus OSM gezogen und als Datei eingecheckt.

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
4. **Dashboard / Auswertung – DREI EBENEN** (Bottom-Nav-Tab heisst **„Bordbuch"**, Komponente
   bleibt `DashboardScreen`; Mockup `bordbuch-dashboard-v2.html` als visuelle Vorlage):
   - **(a) Total** über alle Jahre: 4 Instrument-Kacheln – Gesamt-Betriebsstunden,
     Ø Verbrauch l/h (exakt, OHNE "≈"), Treibstoffkosten CHF, Anzahl Einträge.
   - **(b) Ø pro Jahr**: Ø Stunden/Jahr, Ø Einträge/Jahr, Ø Kosten/Jahr (kleine Box-Reihe).
   - **(c) Pro Jahr**: umschaltbarer Balkenchart (Motor h / Einträge / Treibstoff) über alle
     Jahre, mit Ø-Linie. Der Chart visualisiert nur (Balken bleiben antippbar als Bonus).
   - **(d) Einzeljahr im Detail**: Jahr per **Dropdown** wählbar (§17, nicht mehr Chips/Balken)
     → Betriebsstunden (+Δ gegenüber Ø), Einträge, Liter, CHF, ≈ l/h, CHF/h.
   Reihenfolge/Erweiterung (Tank, Wartung, Reihenfolge) und Boot-Profil siehe **§17**.
5. Status klar: Spinner, Toast bei Erfolg/Fehler.
6. **Vor der Abfahrt (Wetter)** – Live-Conditions für Locarno + seeweiter Wetterbericht
   mit Stunden-/Tagesprognose (Details §14). Das ist der **Start-Screen** der App (erster
   Tab in der Bottom-Nav, Kompass-Icon).
7. **Seekarte (Karte)** – interaktive Karte des ganzen Lago Maggiore: kuratierte Boots-POIs,
   GPS-Tacho + Fahrtaufzeichnung (→ Logbuch-Eintrag vorbefüllen), Wasser-Distanzmessung,
   Wetter/Wind über den ganzen See und See-Regeln/Zonen (Details §16).

UX-Detail: Neuer Eintrag → `harborFrom` mit "Ascona, Porto Patriziale" vorbefüllen,
`engineHours` mit dem letzten (höchsten) Zählerstand als Vorschlag. Eine auf der Karte
aufgezeichnete Fahrt füllt zusätzlich Von/Nach (nächster Hafen) + Eckdaten in die Notizen.

## 7. UX / Design
Beibehalten: Chartplotter-/Instrument-Optik, Tag/Nacht (mit Persistenz, prefers-color-scheme
als Default), mobile-first, full-bleed (KEIN Geräterahmen), grosse Touch-Targets, Quality-Floor
(focus-visible, prefers-reduced-motion, safe-area, responsive ≤360px).

**Kopfzeile & Navigation:** Die `Topbar` zeigt als Titel den **aktuellen Bereich** (`SCREEN_TITLE`
in `App.tsx`): Wetter / Karte / Bordbuch / Logbuch (Detail/Neu zählen zu „Logbuch"); darunter als
Untertitel weiterhin Bootsname · Ort. Die Bottom-Nav heisst entsprechend **Wetter · Karte · Bordbuch
· Logbuch** (+ FAB „Neu") – der frühere „Dashboard"-Tab ist die Bordbuch-Übersicht.

**Responsives Layout (mobile-first):** Das App-Shell in `App.tsx` ist ein flexibler Row-
Container. **Mobil/Tablet (< `lg`):** Telefon-Spalte + **Bottom-Nav** (`BottomNav`, `lg:hidden`),
Topbar mit Boot-Untertitel. **Desktop (≥ `lg` = 1024px):** linke **Navigations-Seitenleiste**
(`SideNav`, `hidden lg:flex`, Marke + Boot + Bereiche + „Neuer Eintrag"); Inhalts-Screens zentriert
auf angenehme Lesebreite (`max-w-[840px]`), die **Karte full-bleed** über die ganze Restfläche.
Boot-Untertitel der Topbar ist auf Desktop ausgeblendet (`lg:hidden`, Seitenleiste zeigt ihn). Das
Nav-Modell ist EINMAL definiert (`src/components/navItems.tsx`: `NAV_ITEMS`, `isNavActive`, Icons)
und von Bottom-Nav + Seitenleiste geteilt. Bordbuch-Kacheln nutzen Desktop-Breite (`sm:grid-cols-4`
für Total).

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
Seekarte-Feinschliff (alle optional): `shop`-POIs noch leer; Werften/Winterlager als eigene
Kategorie (falls „Lagerplätze" so gemeint); Wasser-Routing feiner (200-m-Gitter, Inseln nicht
als Hindernis); exakte 150-m-Offset-Geometrie statt Näherung.
Erledigt: Offline-Cache (PWA-Service-Worker, §15); interaktive Seekarte mit allem Drum und
Dran (§16); seeweiter Wetterbericht (§14).

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

**Seeweiter Wetterbericht (v4):** Abschnitt „Wetter & Wind · ganzer See" über die
wiederverwendbare Komponente `src/components/WeatherReport.tsx` (dieselbe wie im Karten-Modal,
§16). Datenquellen in `liveData.ts`: `fetchLakeConditions()` (6 Punkte Locarno…Stresa in EINER
Open-Meteo-Anfrage, komma-getrennte Koordinaten → Array) und `fetchLakeForecast()` (Stunden-/
Tagesprognose für einen Punkt in Seemitte). `weatherEmoji()` mappt WMO-Codes auf Emojis. Im
Wetter-Tab lädt die Komponente selbst (kein Wind-Toggle, der ist karten­spezifisch).

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
  Bildschirm aus/Hintergrund → Watch stoppt, kommt beim Zurückkehren wieder). **Ausnahme:**
  bei aktiver Ankerwache (§19) hält ein zweites Argument `keepAliveWhenHidden` den Watch
  durchgehend am Laufen. **Tacho** zeigt
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
  zur GPS-Position (Emoji/Temp/Wind/Regen) und **öffnet ein Wetter-Modal** mit der wiederverwendbaren
  Komponente **`src/components/WeatherReport.tsx`**: Jetzt-Tabelle aller 6 Punkte + **Stunden- und
  Tagesprognose** (`fetchLakeForecast()`, repräsentativer Punkt Seemitte). Dieselbe Komponente steht
  auch **im Wetter-Tab** (`ConditionsScreen`, Abschnitt „Wetter & Wind · ganzer See"; lädt dann selbst,
  ohne Wind-Toggle). Im Modal ein Toggle „Wind-Pfeile auf der Karte" → blendet das **Wind-Feld** ein
  (`windIcon` je Punkt) inkl. **Legende** auf der Karte (Pfeil = Richtung, Zahl = kn).
- **Default-Ansicht:** `map.fitBounds(LAKE_OUTLINE)` → die Karte zeigt beim Öffnen den **ganzen Lago
  Maggiore** (nicht den Standort); kein Auto-Folgen (`follow` startet false, erst „Mich zentrieren").
- **See-Regeln/Zonen (nur wenn aktiviert):** Button „See-Regeln" zeichnet die **Uferzone als 150-m-
  Band**: `shoreZoneRing(150)` (`route.ts`) versetzt die Küstenlinie 150 m INS WASSER (Tangenten-
  Normale, Richtung per `inLake`-Test; verifiziert Median 150 m), gefüllt als Polygon mit Loch
  (`[LAKE_OUTLINE, inner]`) + 150-m-Grenzlinie. Dazu das No-Go-Polygon **Bolle di Magadino**
  (`src/lib/zones.ts`, OSM way 160197486) + Legende (`LAKE_RULES`). Default aus → Karte sauber.
  **Bewusst „ohne Gewähr"**: Annäherungen, offizielle Karten massgeblich.
- **Layout:** Die Karte braucht feste Höhe → eigenes, padding-/scrollfreies `<main>` in
  `App.tsx` (`screen === 'map'` rendert full-bleed, unabhängig vom Einträge-Ladezustand).
  `ResizeObserver` ruft `map.invalidateSize()` (mobile URL-Leiste). Popups + Attribution
  sind über CSS-Variablen an Tag/Nacht gekoppelt (`src/index.css`). Karten-Overlays liegen auf
  `z-[900]`/`z-[1000]` → der `Modal` (Wetter/Standort-Hilfe) muss DARÜBER liegen: `z-[1200]`
  (sonst überlagern Tacho/Buttons das Modal inkl. ✕). Standort-Hilfe erkennt installierte PWA
  (`display-mode: standalone`): Bei einem Chrome-**WebAPK** liegt die Geo-Freigabe NICHT in den
  Android-App-Berechtigungen (dort nur „Benachrichtigungen"), sondern in den **Chrome-Website-
  Einstellungen** pro Origin → die Hilfe verweist genau dorthin (inkl. `location.host`).
- **SW/Caching:** Kartenkacheln sind Fremd-Origin → der Service-Worker fängt sie nicht ab
  (direkt ans Netz), wie bei den übrigen Live-Daten.

## 17. Boot-Profil, Tank-/Restreichweite & Wartung (v5)
Im Bordbuch-Screen (`DashboardScreen`) zwei Betriebs-Blöcke – Logik + Boot-Profil in
`src/lib/boat.ts`, getestet in `src/lib/boat.test.ts`. **Reihenfolge:** Tank & Reichweite → Jahr im Detail → Durchschnitt pro
Jahr → Total → **Wartung & Service (zuunterst, default eingeklappt** – seltener gebrauchtes
Werkzeug). **Jahr-Selektor:** natives **Dropdown** („Jahr") neben dem Metrik-Umschalter
(intuitiver als Balken-Antippen, OS-Picker auf Mobile); der Pro-Jahr-Balkenchart visualisiert
nur noch und hebt das gewählte Jahr hervor (Balken bleiben als Bonus antippbar). KEINE
Jahres-Chip-Reihe mehr. **Auch das Logbuch (`ListScreen`) nutzt dasselbe Jahr-Dropdown** statt
der früheren Chip-Reihe.

- **Boot-Profil** `BOAT_PROFILE` (zentrale Single Source, auch von `Topbar` genutzt):
  Regal 2750 Cuddy, Volvo Penta, Bj. 2007, Tank **290 l**, Annahme-Marschfahrt `cruiseKn = 18`
  (NUR für die grobe sm-Angabe).
- **Tank & Reichweite** (`tankRange(entries, avgLh)`): Reichweite ehrlich in **Motorstunden**
  (Liter ÷ exaktem Ø-Verbrauch aus `totalStats`), da das Logbuch keine Distanz/Geschwindigkeit
  speichert; sm nur als grobe Zusatzschätzung („~18 kn", ohne Gewähr). **(a) Statisch:** volle
  Tankfüllung = 290 ÷ Ø l/h. **(b) Aktuell:** seit dem letzten Tankstopp (Eintrag mit
  `fuelLiters>0`) geschätzter Verbrauch von 290 l abgezogen → Restliter/-stunden + Füllstands­-
  balken (grün>50 %, amber 20–50 %, rot<20 %). **Annahme: zuletzt voll getankt**, klar
  ausgewiesen. Ohne Ø-Verbrauch/Tankstopp gibt es nur den statischen Wert.
- **Wartung & Service** (zuunterst, aufklappbar, default EINGEKLAPPT; `maintenanceReport(entries,
  today, overrides)`): Je Position ist das „zuletzt erledigt"-Datum **manuell auf MM.JJ setzbar**
  (`<input type="month">`, „✎ ändern" / „Auto"-Reset) – nötig, weil NICHT alles jährlich gemacht
  wird (Impeller ~2 J., Zündkerzen ~3 J.). Overrides liegen in **localStorage**
  (`useMaintenanceLog`, Key `bordbuch-maintenance-v1`, `key → "YYYY-MM"`); KEIN Backend (Sheet
  fix, §3/§4). Ohne Override = Default „erster Eintrag des jüngsten Jahres" (Winterlager-Annahme).
  Stunden-Baseline zum gesetzten Monat kommt aus dem Logbuch (`engineHoursAtDate`, Stand am
  Monatsende). Bewertung dynamisch gegen Stunden- UND Monatsintervall (`fraction = max`), Ampel
  ok/bald(≥80 %)/fällig; **mehrjährige Posten ohne eigenes Datum bleiben `unknown` → „Datum
  setzen"** (kein falsches „erledigt" für sicherheitskritische Teile wie den Balg). Default ab
  Saisonstart gilt NUR für Jahresarbeiten (`intervalMonths ≤ ANNUAL_MONTHS = 12`).
  `MAINTENANCE_SCHEDULE` = Volvo-Penta-Benzin auf **Süsswasser** (Lago Maggiore, geringere
  Korrosion → Impeller/Anoden/Kerzen grosszügiger): jährlich/100 h → Motoröl, Kraftstofffilter,
  Sterndrive-Getriebeöl; jährliche Kontrollen → Anoden, Balg/U-Gelenke, Winterlager-Service;
  mehrjährig → Impeller (~3 J./200 h), Zündkerzen (~3 J./200 h), Kühlmittel+Kraftstoffleitungen
  (~5 J.), Sterndrive-Balg erneuern (~5–7 J.). `newSeasonPending` markiert „neue Saison ohne
  Service-Eintrag". **Richtwerte, „ohne Gewähr" – offizielles Manual massgeblich.** Status-Farben:
  `--good`/Amber `#E8930C`/`--danger`/`--ink-3` (unknown).

## 18. Tests (Vitest)
`npm test` (= `vitest run`), `npm run test:watch`. Eigene `vitest.config.ts` (node-Env, ohne
React/Tailwind-Plugin); Testdateien aus `tsconfig.app.json` ausgeschlossen → Pages-Build
(`tsc -b`) unberührt. Abgedeckt (reine Logik): `calc.ts` (Stunden/Verbrauch/Aggregate),
`geo.ts` (Haversine/Bearing/Einheiten), `route.ts` (`inLake`/`routeOnWater`/`shoreZoneRing`/
`nearestHarborName`), `boat.ts` (Tank-/Restreichweite, Wartungs-Report), `anchor.ts`
(Ankerwache: `evalAnchor`-Status/Distanz, Entprellung, Radius-Clamp). Vor jedem Deploy
sinnvoll: `npm test` grün halten.

## 19. Ankerwache / Anker-Alarm (v6)
Karten-Werkzeug **„⚓ Ankerwache"** (`MapScreen`, unten links über „Messen"/„See-Regeln").
Schlägt Alarm, wenn das vor Anker liegende Boot den eingestellten Radius verlässt. Reine
Logik + Tests in `src/lib/anchor.ts` / `anchor.test.ts`; Hook `src/hooks/useAnchorWatch.ts`.

- **Bewusst „Bildschirm-an-Wache":** Ein echter Hintergrund-Alarm bei ausgeschaltetem Screen
  ist im Web nicht zuverlässig (dafür braucht es eine native App, vgl. ankeralarm.app). Darum
  hält `src/hooks/useWakeLock.ts` (Screen Wake Lock API) den Bildschirm an, solange die Wache
  läuft (Re-Acquire nach Tab-Wechsel); Hinweis im Panel „Gerät ans Ladegerät". Kein neuer Dep.
- **Logik** (`anchor.ts`): `evalAnchor(anchor, lat, lon, radiusM)` → Distanz (Haversine, §16),
  `fraction` und Status `ok | warn(≥80 %) | breach(≥100 %)`. **Entprellung:** Alarm erst nach
  `BREACH_FIXES = 3` aufeinanderfolgenden Fixes ausserhalb (fängt GPS-Ausreisser ab,
  `nextBreachCount`). Radius `clampRadius` zwischen `MIN_RADIUS_M = 15` und `MAX_RADIUS_M = 120`,
  Default 30 m, Slider-Schritt 5 m.
- **Hook** (`useAnchorWatch`): füttert sich aus dem bestehenden `useGeoPosition`-Fix (KEIN
  eigener Watch). Bei aktiver Wache schaltet `MapScreen` `useGeoPosition(true, keepAlive)` → der
  Watch läuft auch im Hintergrund weiter (sonst Akku-Pause, §16). Hält Anker/Radius/Status/
  Max-Abstand + ausgedünnte **Drift-Spur** (≤240 Punkte). `drop(lat,lon)` setzt den Anker auf die
  aktuelle GPS-Position (und ruft `unlockAlarm()` im Klick, damit Audio freigeschaltet wird),
  `lift()` lichtet, `setRadius()`, `acknowledge()` (Alarm quittieren → still bis zur Rückkehr in
  den Radius). **Persistenz** in localStorage (`bordbuch-anchor-v1`, Anker/Radius/Wache) → ein
  Reload killt die Wache nicht; KEIN Backend (Sheet fix, §3/§4).
- **Alarm** (`src/lib/alarmSound.ts`): durchdringende Web-Audio-Sirene (Frequenz-LFO, KEINE
  Audio-Datei) + `navigator.vibrate` (Android) + vollflächiges rot blinkendes Overlay
  (`anchor-alarm-overlay`, `z-[1300]` über allem; respektiert `prefers-reduced-motion`) mit
  Abstand/Radius und Buttons „Alarm quittieren" / „Anker lichten".
- **Karte:** Anker-Pin (`anchor-pin`), Radiuskreis (`L.circle`, Farbe nach Status: Teal/Amber/
  Rot) und gestrichelte Drift-Spur. Panel: Status, Abstand (+max), Radius-Slider, Setzen/Lichten.
- **„Ohne Gewähr"** – kein Ersatz für eine Ankerwache an Bord; nur solange App offen & Screen an.
