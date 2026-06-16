# Bordbuch · Motorboot-Logbuch

Mobile-first Logbuch-App für ein Motorboot in **Ascona, Lago Maggiore**, Bedienung am
Steuerstand. Alle Daten liegen in einer Google-Tabelle; der Zugriff läuft über eine
bestehende Google-Apps-Script-Web-App. Volles CRUD, 3-stufiges Dashboard, Tag-/Nacht-Modus.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · Deploy via GitHub Pages.

---

## 1. Lokal starten

Voraussetzung: Node 20+ und npm.

```bash
npm install
cp .env.example .env      # danach echte Werte eintragen
npm run dev               # läuft auf http://localhost:5173/bordbuch/
```

Die App braucht zwei Umgebungsvariablen (Vite-Konvention `VITE_*`):

| Variable | Bedeutung |
|---|---|
| `VITE_API_URL` | Die `/exec`-URL der Apps-Script-Web-App |
| `VITE_API_TOKEN` | Das Shared Secret (muss mit `API_TOKEN` im Apps Script übereinstimmen) |

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
Zwei Secrets mit exakt diesen Namen anlegen:

- `VITE_API_URL` → die `/exec`-URL
- `VITE_API_TOKEN` → das Shared Secret

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

## 4. Datenmodell & Logik (Kurzfassung)

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
