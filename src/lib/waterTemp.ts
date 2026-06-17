// src/lib/waterTemp.ts
// Wassertemperatur via Apps-Script-Proxy (eigenes Backend "Bordbuch Wassertemp").
//
// Direktaufruf der Alplakes-API ist im Browser NICHT möglich (kein CORS-Header,
// per Konsole bestätigt). Das Apps Script holt den Wert serverseitig und gibt
// ihn CORS-freundlich zurück: GET <proxy>/exec?type=watertemp
//
// Eigene Env-Variable, getrennt vom CRUD-Backend ("Bordbuch API"):
//   .env  ->  VITE_WATERTEMP_URL=https://script.google.com/macros/s/<id>/exec
//
// Wind (Open-Meteo) und Pegel (existenz.ch) laufen weiterhin direkt.

import { estimateWaterTemp } from "./liveData";

const WATERTEMP_URL = import.meta.env.VITE_WATERTEMP_URL as string;

interface ProxyTemp {
  ok: boolean;
  value?: number;
  unit?: string;
  time?: string;
}

// Aktuelle Oberflächentemperatur (°C) über den Proxy, oder null bei Misserfolg.
export async function fetchWaterTempViaProxy(): Promise<number | null> {
  if (!WATERTEMP_URL) return null;
  try {
    const res = await fetch(`${WATERTEMP_URL}?type=watertemp`);
    if (!res.ok) return null;
    const d: ProxyTemp = await res.json();
    return d.ok && typeof d.value === "number" ? d.value : null;
  } catch {
    return null;
  }
}

// UI-freundlich: Proxy zuerst, sonst Saison-Schätzung. Quelle wird mitgegeben,
// damit das UI "live" vs. "Schätzung" anzeigen kann.
export async function getWaterTemp(): Promise<{ value: number; source: "alplakes" | "estimate" }> {
  const live = await fetchWaterTempViaProxy();
  return live != null
    ? { value: live, source: "alplakes" }
    : { value: estimateWaterTemp(), source: "estimate" };
}

// ---------------------------------------------------------------------------
// History-Abfragen (über den Proxy, weil Alplakes kein CORS sendet).
// Der Proxy rechnet serverseitig auf Tagesaggregate herunter und cacht.
// ---------------------------------------------------------------------------

function requireProxy(): string {
  if (!WATERTEMP_URL) throw new Error("Wassertemp-Proxy fehlt (VITE_WATERTEMP_URL)");
  return WATERTEMP_URL;
}

export interface WaterTempSeries {
  series: { date: string; t: number }[]; // Tagesmittel, °C
}

// Wassertemperatur der letzten N Tage als Tagesreihe.
export async function fetchWaterTempSeries(days = 30): Promise<WaterTempSeries> {
  const res = await fetch(`${requireProxy()}?type=watertemp-series&days=${days}`);
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  const d = await res.json();
  if (!d.ok || !Array.isArray(d.series)) throw new Error(d.error || "keine Daten");
  return { series: d.series };
}

export interface WaterTempYear {
  currentYear: {
    year: number;
    daily: { doy: number; date: string; t: number }[];
    max: { value: number | null; date: string | null };
  };
  pastYears: { year: number; daily: { doy: number; t: number }[] }[];
}

// Jahresvergleich: aktuelles Jahr (mit Höchstwert) + Vorjahre, nach Tag-im-Jahr.
export async function fetchWaterTempYear(): Promise<WaterTempYear> {
  const res = await fetch(`${requireProxy()}?type=watertemp-year`);
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  const d = await res.json();
  if (!d.ok || !d.currentYear) throw new Error(d.error || "keine Daten");
  return { currentYear: d.currentYear, pastYears: d.pastYears ?? [] };
}
