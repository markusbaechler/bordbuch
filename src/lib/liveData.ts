// src/lib/liveData.ts
// Live-Daten-Client für Lago Maggiore. Keine Keys, kein Proxy nötig:
// beide Quellen sind keylos und liefern CORS:*  → direkter Browser-Fetch.
//
// Quellen (Attribution Pflicht):
//  - Wind/Wetter:  Open-Meteo (https://open-meteo.com)
//  - Pegel:        BAFU/FOEN via existenz.ch (https://api.existenz.ch)
//                  BAFU misst Wassertemperatur nur an Flüssen → für den See
//                  gibt es keinen Live-Sensor (manuelles Feld / Schätzung).

export interface Spot {
  lat: number;
  lon: number;
  hydroStation: string; // BAFU-Stations-ID, Locarno = "2022"
}

export const LOCARNO: Spot = { lat: 46.166, lon: 8.795, hydroStation: "2022" };

// Böen-Schwellen in Knoten für ein Motorboot auf dem See.
export const GUST_WARN = 16;
export const GUST_BAD = 27;

// Hochwasser-Referenz Lago Maggiore (Gefahrenstufe 5), m ü.M.
export const HW_LEVEL_MASL = 195.75;

export type WindLevel = "good" | "warn" | "bad";

export interface WindNow {
  windKn: number;
  gustKn: number;
  beaufort: number;
  directionDeg: number;
  cardinal: string;
  thunder: boolean;       // Gewitter jetzt oder in den nächsten 12 h
  gustForecast: number[]; // Böen kn, stündlich, nächste 12 h
  level: WindLevel;
  headline: string;
  subline: string;
  localContext: string | null; // Inverna / Tramontana-Hinweis
}

export interface LakeNow {
  levelMasl: number | null;   // Seepegel m ü.M.
}

const CARDINALS = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
export const cardinal = (deg: number) => CARDINALS[Math.round(deg / 22.5) % 16];

export function beaufort(kn: number): number {
  const t = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  return t.reduce((b, x) => (kn >= x ? b + 1 : b), 0);
}

const isThunder = (code: number) => code >= 95 && code <= 99; // WMO weather codes

function localContext(deg: number): string | null {
  if (deg >= 135 && deg <= 225) return "Inverna-Lage (baut nachmittags auf)";
  if (deg <= 45 || deg >= 315) return "Tramontana/Maggiore möglich (morgens)";
  return null;
}

export async function fetchWind(spot: Spot = LOCARNO): Promise<WindNow> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&current=weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&hourly=wind_gusts_10m,weather_code&forecast_hours=12&wind_speed_unit=kn&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();

  const windKn = Math.round(d.current.wind_speed_10m);
  const gustKn = Math.round(d.current.wind_gusts_10m);
  const directionDeg = d.current.wind_direction_10m as number;
  const gustForecast: number[] = (d.hourly?.wind_gusts_10m ?? []).slice(0, 12).map(Math.round);
  const thunder =
    isThunder(d.current.weather_code) ||
    (d.hourly?.weather_code ?? []).some(isThunder);

  // Ampel: Böen + Gewitter sind ausschlaggebend, nicht der mittlere Wind.
  let level: WindLevel = "good";
  let headline = "Gute Bedingungen";
  let subline = "Ruhiges Fahrwasser";
  if (gustKn >= GUST_BAD) {
    level = "bad";
    headline = "Warnung";
    subline = "Starke Böen — Ausfahrt prüfen";
  } else if (gustKn >= GUST_WARN) {
    level = "warn";
    headline = "Vorsicht";
    subline = "Auffrischender Wind";
  }
  if (thunder) {
    level = "bad";
    headline = "Gewitter";
    subline = "Gewittergefahr in den nächsten Stunden";
  }

  return {
    windKn, gustKn, beaufort: beaufort(gustKn),
    directionDeg, cardinal: cardinal(directionDeg),
    thunder, gustForecast, level, headline, subline,
    localContext: thunder ? null : localContext(directionDeg),
  };
}

export async function fetchLake(spot: Spot = LOCARNO): Promise<LakeNow> {
  // BAFU misst Wassertemperatur nur an Flüssen → vom See gibt es hier nur den Pegel.
  const url =
    `https://api.existenz.ch/apiv1/hydro/latest?locations=${spot.hydroStation}` +
    `&parameters=height&app=bordbuch&version=1.0`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`existenz.ch ${res.status}`);
  const d = await res.json();

  const pick = (par: string) =>
    (d.payload ?? []).find((p: any) => p.loc === spot.hydroStation && p.par === par)?.val ?? null;

  return { levelMasl: pick("height") ?? pick("level") };
}

// Saison-Schätzwert (Monatsmittel Oberflächentemperatur Lago Maggiore, °C).
export function estimateWaterTemp(date = new Date()): number {
  return [6, 6, 8, 11, 15, 19, 23, 24, 21, 16, 11, 8][date.getMonth()];
}

// ---------------------------------------------------------------------------
// History-Abfragen für die Detail-Modals (Wind direkt, Pegel direkt).
// ---------------------------------------------------------------------------

export interface WindHistory {
  times: Date[];
  gusts: number[]; // kn
  wind: number[];  // kn (mittlerer Wind)
}

// Böen/Wind −48 h … +48 h (past_days=2, forecast_days=2), stündlich.
export async function fetchWindHistory(spot: Spot = LOCARNO): Promise<WindHistory> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=wind_speed_10m,wind_gusts_10m&past_days=2&forecast_days=2` +
    `&wind_speed_unit=kn&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();

  const times: Date[] = (d.hourly?.time ?? []).map((t: string) => new Date(t));
  const gusts: number[] = (d.hourly?.wind_gusts_10m ?? []).map((v: number) => Math.round(v));
  const wind: number[] = (d.hourly?.wind_speed_10m ?? []).map((v: number) => Math.round(v));
  if (!times.length) throw new Error("Open-Meteo: keine Verlaufsdaten");
  return { times, gusts, wind };
}

export interface LevelHistory {
  points: { date: Date; val: number }[]; // Tagesmittel, m ü.M.
}

// Seepegel der letzten N Tage (existenz daterange). Antwort ist ein 10-Minuten-
// Raster → wir mitteln serverfern auf Tageswerte, damit das Chart ruhig bleibt.
export async function fetchLevelHistory(days = 30, spot: Spot = LOCARNO): Promise<LevelHistory> {
  const url =
    `https://api.existenz.ch/apiv1/hydro/daterange?locations=${spot.hydroStation}` +
    `&parameters=height&startdate=${encodeURIComponent(`-${days} days`)}&enddate=now` +
    `&app=bordbuch&version=1.0`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`existenz.ch ${res.status}`);
  const d = await res.json();

  const raw = (d.payload ?? []).filter(
    (p: any) => p.loc === spot.hydroStation && p.par === "height" && typeof p.val === "number",
  );
  if (!raw.length) throw new Error("existenz.ch: keine Pegeldaten");

  // Tagesmittel bilden (Schlüssel = ISO-Datum).
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const p of raw) {
    const key = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    const e = byDay.get(key) ?? { sum: 0, n: 0 };
    e.sum += p.val;
    e.n += 1;
    byDay.set(key, e);
  }

  const points = [...byDay.entries()]
    .map(([key, e]) => ({ date: new Date(`${key}T00:00:00`), val: e.sum / e.n }))
    .sort((a, b) => +a.date - +b.date);

  return { points };
}
