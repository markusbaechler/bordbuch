# CLAUDE.md – Bordbuch (Motorboot-Logbuch)  · v2 (aktualisiert: Dashboard 3-stufig, Akzent Marineblau)

WICHTIG: Dies ersetzt die alte Spec. Das Frontend existiert teilweise schon und muss
auf dieses Modell **refactored** werden. Das Backend (Code.gs v2) ist fertig.

## 1. Ziel
Mobile-first Logbuch für ein Motorboot in **Ascona, Lago Maggiore**. Nutzung am
Steuerstand auf dem Smartphone. Alle Daten in einer Google-Tabelle, Zugriff über eine
bestehende Apps-Script-Web-App. Volles CRUD. (Bootsname: noch offen → Platzhalter in der Topbar.)

## 2. Architektur (verbindlich)
Vite + React + TS + Tailwind, statisch auf GitHub Pages. API = Google Apps Script
(fertig). Speicher = Google Sheets. Auto-Deploy via GitHub Actions auf Push nach `main`.
Keine andere DB, kein Server, kein Firebase. **Keine Foto-Uploads** (vorerst).

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
Env: `VITE_API_URL`, `VITE_API_TOKEN`. `.env` gitignored (echte Werte), `.env.example`
NUR Platzhalter. `vite.config.ts` base `/bordbuch/`. API-Client als dünner Wrapper über
das `{ok,data,error}`-Envelope. Sauberer Code, Kommentare nur an komplexen Stellen.

## 9. Deployment
GitHub Actions → Pages (Source = "GitHub Actions"). Secrets im Build als env injizieren.

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
Foto-Upload via Drive (Stundenzähler + Beleg), Offline-Cache, PDF-Export, Login-Härtung.

## 13. Sicherheit
.env nie committen, echte Werte nur in .env (lokal) + GitHub Secrets.
