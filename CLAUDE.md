# CLAUDE.md – Bordbuch (Motorboot-Logbuch)

Dieser Brief ist der vollständige Kontext für den Bau des Frontends. Das Backend
(Google Apps Script API) **existiert bereits und funktioniert** – nicht neu bauen.
Aufgabe: das React-Frontend gemäss diesem Brief erstellen und auf GitHub Pages deployen.

---

## 1. Ziel

Mobile-first Logbuch-App für ein Motorboot (Zürichsee), Nutzung am Steuerstand auf
dem Smartphone. Alle Daten liegen ausschliesslich in einer Google-Tabelle, Zugriff
über eine bestehende Apps-Script-Web-App. Volles CRUD.

## 2. Architektur (verbindlich)

| Teil | Technologie |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind (jeweils aktuelle Version, offizielle Integrationen) |
| API / Backend | Google Apps Script Web-App (**fertig**) |
| Datenspeicher | Google Sheets (**fertig**) |
| Deployment | GitHub Pages via GitHub Actions, Auto-Deploy bei Push auf `main` |

Datenfluss: React → `fetch` → Apps-Script-URL → Sheet → JSON.

**Keine andere DB, kein eigener Server, kein Firebase.**

## 3. API-Vertrag (so antwortet das bestehende Backend)

Alle Antworten haben die Form `{ ok: boolean, data?: any, error?: string }`.

- **Liste:** `GET  {URL}?action=list&token={TOKEN}` → `{ ok, data: Trip[] }`
- **Create:** `POST {URL}` Body (JSON-String) `{ token, action:"create", ...felder }` → `{ ok, data: Trip }`
- **Update:** `POST {URL}` Body `{ token, action:"update", id, ...geänderteFelder }` → `{ ok, data: Trip }`
- **Delete:** `POST {URL}` Body `{ token, action:"delete", id }` → `{ ok, data:{ id, deleted:true } }`

**CORS-Trick (zwingend):** POST mit `Content-Type: text/plain` senden (KEIN
`application/json`), um den Preflight zu vermeiden. Der Body ist trotzdem ein
JSON-String. `fetch` muss Redirects folgen (Standard bei `fetch`).

**Token:** Liegt zur Laufzeit in einer Env-Variable (siehe §8). Niemals hartkodieren.

## 4. Datenmodell (Spalten im Sheet, exakt diese Reihenfolge)

| Spalte | Typ | Pflicht | Quelle |
|---|---|---|---|
| `id` | string | – | Backend |
| `createdAt` | ISO-Datetime | – | Backend |
| `updatedAt` | ISO-Datetime | – | Backend |
| `startTime` | ISO-Datetime | ja | User |
| `endTime` | ISO-Datetime | ja | User |
| `harborFrom` | string | ja | User |
| `harborTo` | string | ja | User |
| `engineHoursStart` | number | ja | User |
| `engineHoursEnd` | number | ja | User |
| `fuelLiters` | number | – | User (nur bei Tankstopp) |
| `fuelCostChf` | number | – | User (nur bei Tankstopp) |
| `crew` | string (kommagetrennt) | – | User |
| `notes` | string | – | User |
| `weatherTempC` | number | – | Backend (auto) |
| `weatherWindKn` | number | – | Backend (auto) |
| `weatherDesc` | string | – | Backend (auto) |

**Es gibt KEINE Distanz** (Boot hat nur einen Betriebsstunden-Zähler).
Wetter wird vom Backend automatisch befüllt – Frontend nur anzeigen.

## 5. Berechnungslogik (im Frontend, NICHT gespeichert)

- **Betriebsstunden je Törn** = `engineHoursEnd − engineHoursStart`
- **Fahrzeit** = `endTime − startTime`
- **Saison-Aggregate (exakt):**
  - Ø Verbrauch l/h = `Σ fuelLiters ÷ Σ Betriebsstunden`
  - Ø CHF/l = `Σ fuelCostChf ÷ Σ fuelLiters`
  - CHF/h = `Σ fuelCostChf ÷ Σ Betriebsstunden`
  - Gesamtkosten = `Σ fuelCostChf`
- **Verbrauch pro Törn (Schätzung, ⚠️ nicht exakt):**
  Liter werden nur bei Tankstopps erfasst, Volltanken ist NICHT garantiert.
  Vorgehen: Törns chronologisch durchlaufen, Betriebsstunden akkumulieren. Trifft man
  auf einen Törn mit `fuelLiters`, schliesst das einen „Tank-Block": Block-l/h =
  `Liter ÷ Σ Betriebsstunden im Block`. Dieser Wert wird allen Törns des Blocks
  zugewiesen. Törns nach dem letzten Tankstopp: Saison-Ø als Platzhalter.
  Per-Törn-Werte immer als Schätzung kennzeichnen (z. B. „≈ 13.0 l/h").
  Wenn ein Block keine Stunden hat, Division durch 0 abfangen.

## 6. Features (MVP)

1. **Liste** aller Törns, sortiert nach `startTime` absteigend, mit Suche/Filter
   (Hafen, Crew, Zeitraum).
2. **CRUD**: Törn erfassen / bearbeiten / löschen.
3. **Detailansicht** eines Eintrags (alle Felder + Wetter + berechnete Werte).
4. **Dashboard** mit Statistik-Kacheln: **Treibstoffkosten CHF**, Gesamt-Betriebsstunden,
   Ø Verbrauch l/h, Anzahl Törns. (Kein „Gesamtdistanz" – existiert nicht.)
5. **Status klar anzeigen**: Spinner beim Laden, Toast bei Erfolg/Fehler.

UX-Detail: Beim Neuanlegen den letzten `engineHoursEnd` als Vorschlag für
`engineHoursStart` vorbefüllen (schnelle Erfassung).

## 7. UX / Design

Visueller Referenz-Stil: **Chartplotter / Instrumenten-Display**, nicht Leder-Logbuch.
Mobile-first, grosse Touch-Targets (nasse Hände, Bewegung), hoher Kontrast für Sonne.

**Design-Tokens (aus dem freigegebenen Mockup):**

- **Tag-Modus:** bg `#E6EDF2`, surface `#FFFFFF`, ink `#0A2233`, ink-2 `#52708A`,
  Linie `#D5E0E8`, Akzent/CTA `#FF5A1F` (Signal-Orange), Wasser/aktiv `#0C7C82` (Teal).
- **Nacht-Modus:** bg `#04101A`, surface `#0E2030`, ink `#DCEAF2`, Akzent `#FF6A35`,
  Teal `#2BC4C4`. Tag/Nacht-Umschalter ist ein **echtes Feature** (wie auf jedem Plotter).
- **Typografie:** Display/Überschriften `Barlow Condensed`; UI/Body `Inter`;
  Zahlen/Daten `JetBrains Mono` (tabellarische Ziffern, `font-variant-numeric: tabular-nums`).
- **Signature:** Statistik-Kacheln als Instrumenten-Anzeigen (kleines Label oben,
  grosse Mono-Zahl, dünne Akzentlinie oben). Orange nur für primäre Aktionen.

Eine lauffähige HTML-Mockup-Datei (`bordbuch-mockup.html`) dient als visuelle Vorlage –
Layout, Farben, Kachel-Stil, Liste, Detail, Formular und Tag/Nacht dort übernehmen.

## 8. Tech-Stack & Konventionen

- Vite + React + TS + Tailwind. Sauberer Code, Kommentare nur an komplexen Stellen.
- **Env-Variablen** (Vite-Konvention `VITE_*`):
  - `VITE_API_URL` – die `/exec`-URL der Apps-Script-Web-App
  - `VITE_API_TOKEN` – das Shared Secret
- **`.env.example` mitliefern** (mit Platzhaltern, ohne echte Werte).
- Echte Werte: lokal in `.env` (gitignored!), für Deploy in GitHub Actions Secrets.
- `vite.config.ts`: `base: '/<repo-name>/'` setzen (Repo-Name = Pages-Pfad).
- API-Client als dünner Wrapper kapseln: `list()`, `create()`, `update()`, `delete()`,
  inkl. einheitlicher Lade-/Fehlerbehandlung über das `{ ok, data, error }`-Envelope.

## 9. Deployment

- GitHub Actions Workflow `.github/workflows/deploy.yml`: bei Push auf `main`
  Build + Deploy auf GitHub Pages.
- `VITE_API_URL` und `VITE_API_TOKEN` als **GitHub Secrets** in den Build injizieren.
- README mit Schritten: Secrets setzen, Pages aktivieren, lokal starten.

## 10. Constraints & Non-Goals

- Ausschliesslich Google Sheets als Speicher. Kein eigener Server, kein Firebase.
- MVP: ein Boot, ein Tabellenblatt, keine Foto-Uploads.
- Token im Frontend = bewusst akzeptiert (Obscurity, nicht echte Sicherheit).

## 11. Backlog (NICHT jetzt)

Offline-Cache + Nachsync; Wartungs-Log mit Betriebsstunden-Erinnerung; Dashboard-Ausbau
(Verbrauchs-/Preis-Trend, Saison-Fortschritt, Top-Hafen); PDF-Export; Google-Login-Härtung.

## 12. Build-Reihenfolge

1. Vite-Projekt + Tailwind + Env-Handling, `base`-Pfad.
2. API-Client (`list/create/update/delete`) gegen das Envelope.
3. Liste + Formular (Create/Edit/Delete) + Detailansicht.
4. Dashboard-Statistiken (aus geladenen Zeilen berechnet).
5. Design gemäss Mockup + Tag/Nacht.
6. GitHub-Actions-Deployment + README.

## 13. Sicherheit

- `.env` und alle echten Tokens/URLs **niemals committen** (in `.gitignore`).
- Im Repo nur `.env.example` mit Platzhaltern.
- Secrets ausschliesslich über die GitHub-Repo-Settings setzen.
