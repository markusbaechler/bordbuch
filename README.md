# Bordbuch · Motorboot-Logbuch

Mobile-first Logbuch-App für ein Motorboot in **Ascona, Lago Maggiore**, Bedienung am
Steuerstand. Alle Daten liegen in einer Google-Tabelle; der Zugriff läuft über eine
bestehende Google-Apps-Script-Web-App. Volles CRUD, 3-stufiges Dashboard, Tag-/Nacht-Modus.

Dazu **„Vor der Abfahrt"** (Start-Tab): Live-Wind/Böen mit Ampel, Seepegel und
Wassertemperatur für Locarno, mit antippbaren Verlaufs-Diagrammen (Wind ±48 h,
Pegel 30 Tage, Wassertemp-Jahresvergleich). Installierbar als **PWA**.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · PWA · Deploy via GitHub Pages.

---

## 1. Lokal starten

Voraussetzung: Node 20+ und npm.

```bash
npm install
cp .env.example .env      # danach echte Werte eintragen
npm run dev               # läuft auf http://localhost:5173/bordbuch/
```

Die App nutzt diese Umgebungsvariablen (Vite-Konvention `VITE_*`):

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `VITE_API_URL` | ja | Die `/exec`-URL der Apps-Script-Web-App (CRUD) |
| `VITE_API_TOKEN` | ja | Das Shared Secret (muss mit `API_TOKEN` im Apps Script übereinstimmen) |
| `VITE_WATERTEMP_URL` | optional | `/exec`-URL des Wassertemp-Proxys (siehe §4). Fehlt sie, fällt die Wassertemperatur auf eine Saison-Schätzung zurück. |

> ⚠️ Die `.env` ist über `.gitignore` ausgeschlossen und darf **niemals** committet
> werden. Im Repo liegt nur `.env.example` mit Platzhaltern.

Weitere Skripte:

```bash
npm run build     # Production-Build nach dist/
npm run preview   # gebautes dist/ lokal testen
```

---

## 2. Auf GitHub Pages deployen

### 2.1 Repo anlegen

Das Repository **muss `bordbuch` heissen**, weil der Pages-Pfad in
`vite.config.ts` fest auf `base: '/bordbuch/'` gesetzt ist. Anderer Name →
`base` entsprechend anpassen.

```bash
# nachdem das leere Repo im Browser angelegt wurde:
git remote add origin https://github.com/<dein-user>/bordbuch.git
git branch -M main
git push -u origin main
```

### 2.2 Secrets setzen

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Diese Secrets mit exakt diesen Namen anlegen:

- `VITE_API_URL` → die `/exec`-URL
- `VITE_API_TOKEN` → das Shared Secret
- `VITE_WATERTEMP_URL` → `/exec`-URL des Wassertemp-Proxys (optional, siehe §4)

Diese werden im Workflow zur **Build-Zeit** in das Frontend eingebacken.

### 2.3 Pages aktivieren

Repo → **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.

### 2.4 Deploy auslösen

Jeder Push auf `main` baut und deployt automatisch (Workflow
`.github/workflows/deploy.yml`). Alternativ unter **Actions → Deploy to
GitHub Pages → Run workflow** manuell starten.

Die Seite erscheint anschliessend unter:

```
https://<dein-user>.github.io/bordbuch/
```

---

## 3. Sicherheit

- `.env` und alle echten Tokens/URLs werden **nie** committet (siehe `.gitignore`).
- Echte Werte ausschliesslich als **GitHub-Repo-Secrets** hinterlegen.
- Das Token im Frontend ist bewusst akzeptiert (Obscurity, keine echte Sicherheit) –
  es schützt nur grob den Schreibzugriff auf das Sheet.

---

## 4. Live-Conditions „Vor der Abfahrt"

Der Start-Tab zeigt Live-Daten für Locarno. Quellen:

| Kennzahl | Quelle | Zugriff |
|---|---|---|
| Wind / Böen | Open-Meteo | direkt im Browser (keylos, CORS) |
| Seepegel | existenz.ch / BAFU (Station 2022) | direkt im Browser (keylos, CORS) |
| Wassertemperatur | Alplakes / Eawag (Simstrat-1D) | **nur über Proxy** (kein CORS) |

Wind und Pegel funktionieren ohne weitere Einrichtung. Die Wassertemperatur (inkl.
Jahresvergleich-Diagramm) braucht den **Wassertemp-Proxy** – ein eigenständiges
Apps Script (`Code.proxy.gs` im Repo, Projekt „Bordbuch Wassertemp"):

1. Script-Inhalt von `Code.proxy.gs` ins Apps-Script-Projekt übernehmen.
2. Als **neue Version** deployen (Ausführen als: ich · Zugriff: Jeder, auch anonym).
3. Die `/exec`-URL als `VITE_WATERTEMP_URL` in `.env` **und** als GitHub-Secret setzen.

Endpunkte: `?type=watertemp` (Einzelwert), `?type=watertemp-series&days=N` (Tagesreihe),
`?type=watertemp-year` (Jahresvergleich). Aggregate werden serverseitig gebildet und
gecacht. Ohne diesen Proxy zeigt die App eine Saison-Schätzung statt Live-Werten.

> Hinweis: Nach jeder `.env`-Änderung den Dev-Server neu starten.

---

## 5. PWA (installierbar)

Die App ist eine Progressive Web App und lässt sich auf dem Homescreen installieren:

- **Android/Chrome:** Menü → „App installieren".
- **iOS/Safari:** Teilen → „Zum Home-Bildschirm".

Sie startet dann im Vollbild mit eigenem Icon. Ein Service Worker (`public/sw.js`)
cached die App-Shell (Offline-Start), lädt Live-Daten aber immer frisch. Der Service
Worker ist nur im Production-Build aktiv (nicht im `npm run dev`).

App-Icons neu erzeugen (dependency-frei, Kompass-Motiv):

```bash
node scripts/gen-icons.mjs   # schreibt nach public/
```

---

## 6. Seekarte & GPS-Tacho

Der Tab **„Karte"** zeigt eine interaktive Seekarte für den nördlichen Lago Maggiore
(Locarno/Ascona) auf Basis von [Leaflet](https://leafletjs.com/):

- **Kacheln:** OpenStreetMap als Basis, darüber das halbtransparente
  OpenSeaMap-Seezeichen-Overlay (Tonnen, Untiefen, Fährlinien).
- **POIs** kommen **live aus OpenStreetMap** über die keylose
  [Overpass-API](https://wiki.openstreetmap.org/wiki/Overpass_API) – also keine gepflegte
  eigene Liste, sondern selbst-aktualisierend. Sie sind nach Kategorie filterbar (Häfen &
  Stege, Ankerplätze, Tankstellen, Gastro & Bäder, Einkauf, Ausflugsziele). Das Ergebnis
  wird pro Sitzung gecacht (12 h), um Overpass zu schonen.
- **Fokus auf boots-relevante Ziele:** Häfen, Stege, Ankerplätze, Bojen und Bootstankstellen
  werden im ganzen Seegebiet gesucht; Gastronomie, Einkauf und Ausflugsziele dagegen nur in
  einem schmalen **Uferband** rund um den See – so erscheinen nur Ziele am bzw. nahe am
  Wasser und nicht die ganze Orts-Clutter im Landesinneren. (Ein echtes „nur per Boot
  erreichbar"-Merkmal gibt es in den OSM-Daten nicht; das Uferband ist der beste Näherungswert.)
- **Links:** Wo OSM eine Website oder Telefonnummer kennt, zeigt das Marker-Popup einen
  klickbaren Link (🌐 Website / ☎ Telefon).
- **GPS-Tacho:** Bei freigegebenem Standort zeigt ein Overlay die aktuelle Geschwindigkeit
  in **km/h und Knoten**; die eigene Position erscheint als Marker. Ein Button zentriert
  die Karte auf die eigene Position.

Quellen-Attribution (© OpenStreetMap / © OpenSeaMap) wird in der Karte angezeigt. Es sind
keine Keys oder zusätzliche Secrets nötig; die Standortfreigabe erfolgt im Browser.

## 7. Datenmodell & Logik (Kurzfassung)

Ein Eintrag (`Entry`) entspricht einer Zeile im Tabellenblatt `Logbuch`. `engineHours`
ist **ein** Zählerstand (Betriebsstundenzähler bei Start), `harborTo` ist Freitext.
Es gibt **keine Zeiten und keine Distanz**. Wetter (`weatherTempC`, `weatherWindKn`,
`weatherWindDir` in Grad, `weatherDesc`) wird vom Backend automatisch ergänzt.

Im Frontend berechnet (nicht gespeichert):

- **Stunden je Eintrag** = `engineHours − engineHours(vorheriger)`; erster = 0; negativ/fehlend → „–".
- **h seit Start** = `engineHours − kleinster engineHours overall`.
- **Verbrauch/Eintrag** (Schätzung ≈): über „Tank-Blöcke" – Liter eines Tankstopps
  werden auf die Stunden seit dem letzten Stopp verteilt. Nach dem letzten Tankstopp → „–".
- **Jahr-Aggregate** je Kalenderjahr: Betriebsstunden = `max(Jahr) − max(Vorjahr)`,
  Einträge, Liter, CHF, ≈ l/h, CHF/h.
- **Total** über alle Jahre: Σ Stunden, Σ CHF, Σ Liter, Ø l/h (**exakt, ohne ≈**);
  sowie Ø pro Jahr = Total ÷ Anzahl Jahre.

Dashboard in drei Ebenen: Total → Ø/Jahr → Pro-Jahr-Chart (antippbar) → Einzeljahr-Detail.
