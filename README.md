# Bordbuch · Motorboot-Logbuch

Mobile-first Logbuch-App für ein Motorboot in **Ascona, Lago Maggiore**, Bedienung am
Steuerstand. Alle Daten liegen in einer Google-Tabelle; der Zugriff läuft über eine
bestehende Google-Apps-Script-Web-App. Volles CRUD, mehrstufige Auswertung (Tab „Bordbuch"),
Tag-/Nacht-Modus.

Die App hat vier Bereiche: **Wetter · Karte · Bordbuch · Logbuch** (+ „Neu"). Das Layout ist
**voll responsiv** – mobil mit Bottom-Nav, ab Desktop (≥ 1024 px) mit Navigations-Seitenleiste,
breiterem Inhalt und einer bildschirmfüllenden Karte.

- **Wetter** („Vor der Abfahrt"): Live-Wind/Böen mit Ampel, Seepegel und Wassertemperatur für
  Locarno (mit antippbaren Verlaufs-Diagrammen) **plus** ein seeweiter Wetterbericht mit
  Stunden-/Tagesprognose.
- **Karte:** interaktive Seekarte des ganzen Lago Maggiore – kuratierte Boots-POIs (Häfen,
  Tankstellen, Ankerplätze, Ausflugsziele …), GPS-Tacho + Fahrtaufzeichnung (→ Logbuch),
  Distanzmessung **auf dem Wasser**, Wetter/Wind über den ganzen See und See-Regeln/Zonen.
- **Bordbuch:** Tank-/Restreichweite, Volvo-Penta-Service-/Wartungsplan (Süsswasser) und
  mehrstufige Auswertung (Jahr im Detail → Ø/Jahr → Total). Siehe §7.
- **Logbuch:** Liste, Detail und Erfassen/Bearbeiten der Fahrten (Jahr-Filter als Dropdown).

Installierbar als **PWA**.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · Leaflet (Karte) · Vitest (Tests) ·
PWA · Deploy via GitHub Pages. Karten-Kacheln (OpenStreetMap/OpenSeaMap) und Wetter
(Open-Meteo) sind keylos.

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
npm run build       # Production-Build nach dist/
npm run preview     # gebautes dist/ lokal testen
npm test            # Vitest einmalig (reine Logik: calc, geo, route, boat)
npm run test:watch  # Vitest im Watch-Modus
```

> Tests laufen separat (`vitest.config.ts`, node-Env) und sind aus dem Pages-Build
> ausgeschlossen – `npm run build` bleibt davon unberührt.

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

Der Start-Tab zeigt Live-Daten für Locarno (Wind-Ampel, Pegel, Wassertemperatur) und – im
Abschnitt **„Wetter & Wind · ganzer See"** – den seeweiten Wetterbericht mit Stunden- und
Tagesprognose (dieselbe Ansicht wie im Wetter-Modal der Karte). Quellen:

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

Der Tab **„Karte"** zeigt eine interaktive Seekarte für den Lago Maggiore auf Basis von
[Leaflet](https://leafletjs.com/) – beim Öffnen ist standardmässig der **ganze See** im Bild
(nicht der Standort):

- **Kacheln:** OpenStreetMap als Basis, darüber das halbtransparente
  OpenSeaMap-Seezeichen-Overlay (Tonnen, Untiefen, Fährlinien).
- **POIs:** eine **kuratierte, feste Liste** boots-relevanter Ziele über den ganzen Lago
  Maggiore – Häfen/Anlegestellen (auch italienische Seite bis Arona), Bootstankstellen,
  Anker-/Bojenfelder, Ausflugsziele (Isole di Brissago, Castelli di Cannero) und Strandbäder,
  filterbar nach Kategorie. Bewusst keine Live-OSM-Abfrage mehr: die lieferte vor allem Clutter
  (hunderte Restaurants, jede Statue) und keinen Mehrwert gegenüber Google Maps. Wo bekannt,
  zeigt das Popup einen klickbaren **Website-/Telefon-Link**.
  - **Liste ergänzen (halb-automatisch):** `node scripts/fetch-poi-candidates.mjs` holt
    Kandidaten (Tankstellen, Häfen, Liege-/Ankerplätze) aus OpenStreetMap und gibt sie als
    fertige Code-Zeilen aus – sichten und in `src/lib/mapData.ts` einfügen.
- **GPS-Tacho:** Bei freigegebenem Standort zeigt ein Overlay die aktuelle Geschwindigkeit
  in **km/h und Knoten**; die eigene Position erscheint als Marker. Ist der Standort blockiert
  (z. B. auf Android), führt eine **Schritt-für-Schritt-Hilfe** durch die Freigabe.
- **Fahrtaufzeichnung → Logbuch:** „Fahrt aufzeichnen" zeichnet den GPS-Track auf und zeigt
  live **Strecke (km/sm), Dauer und Ø-/Max-Tempo**. Mit „Ins Logbuch" wird daraus ein neuer
  Logbuch-Eintrag **vorbefüllt** (Start-/Zielhafen automatisch erkannt, Eckdaten in den
  Notizen) – Betriebsstunden trägst du noch selbst ein. Die Aufzeichnung ist bewusst opt-in
  und pausiert bei ausgeschaltetem Bildschirm, um Akku zu sparen.
- **Mess-/Planungstool (auf dem Wasser):** „Messen" antippen, dann zwei Punkte – der angezeigte
  Weg **folgt dem Wasser** (kein Geradeaus durch die Berge) und nennt **Distanz, Kurs und ETA**.
- **Wetter & Wind über den ganzen See:** Das Badge oben rechts zeigt **Wetter, Temperatur, Regen
  und Wind** für deine Gegend und öffnet ein **Wetter-Modal** mit den aktuellen Werten an mehreren
  Punkten (Locarno bis Stresa) sowie **Stunden- und Tagesprognose**. Dort lässt sich auch das
  **Wind-Feld** (Pfeile mit Legende) auf der Karte einblenden (Open-Meteo).
- **See-Regeln & Zonen:** „See-Regeln" markiert die **Uferzone** als 150-m-Band (innerhalb gilt
  Langsamfahrt) und das Naturschutzgebiet **Bolle di Magadino** als No-Go-Fläche und blendet die
  wichtigsten Regeln ein. **Annäherungen ohne Gewähr** – massgeblich bleiben die offiziellen
  Schifffahrtskarten.

Quellen-Attribution (© OpenStreetMap / © OpenSeaMap) wird in der Karte angezeigt. Es sind
keine Keys oder zusätzliche Secrets nötig; die Standortfreigabe erfolgt im Browser.

## 7. Bordbuch: Tank, Wartung & Auswertung

Das **Boot-Profil** (Regal 2750 Cuddy, Volvo Penta, Bj. 2007, Tank **290 l**) ist zentral in
`src/lib/boat.ts` hinterlegt (Single Source, auch von der Topbar/Seitenleiste genutzt). Der
Bordbuch-Tab ist von oben nach unten gegliedert:

- **Tank & Reichweite:** Reichweite einer vollen Tankfüllung (`290 l ÷ Ø-Verbrauch`) sowie eine
  aktuelle Schätzung seit dem letzten Tankstopp (Annahme: voll getankt) inkl. Füllstandsbalken.
  Reichweiten werden ehrlich in **Motorstunden** angegeben – das Logbuch speichert keine Distanz
  oder Geschwindigkeit; sm-Werte sind nur grobe Zusatzschätzungen (~18 kn Marsch, ohne Gewähr).
- **Auswertung:** **Jahr im Detail** (Jahr per **Dropdown** wählbar, der Balkenchart visualisiert)
  → **Ø pro Jahr** → **Total** über alle Jahre. Auch das Logbuch nutzt dasselbe Jahr-Dropdown.
- **Wartung & Service** (zuunterst, aufklappbar, default eingeklappt): Volvo-Penta-Serviceplan auf
  **Süsswasser**. Der „zuletzt erledigt"-Stand jeder Position ist auf **MM.JJ** setzbar (lokal im
  Browser gespeichert, kein Backend). Jahresarbeiten werden sonst ab Saisonstart angenommen;
  mehrjährige Posten (Impeller, Zündkerzen, Balg erneuern …) verlangen ein eigenes Datum, statt
  fälschlich „erledigt" zu zeigen. Ampel ok/bald/fällig dynamisch gegen Stunden- **und**
  Monatsintervall. **Richtwerte ohne Gewähr – offizielles Manual massgeblich.**

### Datenmodell & Rechenlogik (Kurzfassung)

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
- **Tank-/Restreichweite & Wartungsfälligkeit** in `src/lib/boat.ts`.

Diese reine Logik (`calc.ts`, `geo.ts`, `route.ts`, `boat.ts`) ist mit **Vitest** abgedeckt
(`npm test`).
