/** Berechnungslogik v2 (CLAUDE.md §5). Ergebnisse werden NICHT gespeichert. */

import type { Entry } from './types'
import { toNum } from './format'

/* ----------------------------- Sortierung ----------------------------- */

/** Chronologisch: nach date, dann engineHours (monoton), dann id (stabil). */
function chrono(a: Entry, b: Entry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ha = toNum(a.engineHours) ?? 0
  const hb = toNum(b.engineHours) ?? 0
  if (ha !== hb) return ha - hb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Aufsteigend (älteste zuerst). */
export function byDateAsc(a: Entry, b: Entry): number {
  return chrono(a, b)
}
/** Absteigend (neueste zuerst – Liste). */
export function byDateDesc(a: Entry, b: Entry): number {
  return -chrono(a, b)
}

/* ----------------------------- Zählerstand ----------------------------- */

function engineValues(entries: Entry[]): number[] {
  return entries
    .map((e) => toNum(e.engineHours))
    .filter((n): n is number => n !== null)
}

function minEngineHours(entries: Entry[]): number | null {
  const v = engineValues(entries)
  return v.length ? Math.min(...v) : null
}

/** Höchster Zählerstand overall – Vorbefüllung im Formular. */
export function maxEngineHours(entries: Entry[]): number | null {
  const v = engineValues(entries)
  return v.length ? Math.max(...v) : null
}

/**
 * Stunden je Eintrag = engineHours(dieser) − engineHours(vorheriger chronologisch).
 * Erster Eintrag = 0. Negative/fehlende Differenz → null ("–"), niemals NaN.
 */
export function hoursPerEntry(entries: Entry[]): Record<string, number | null> {
  const sorted = [...entries].sort(chrono)
  const res: Record<string, number | null> = {}
  let prev: number | null = null

  sorted.forEach((e, i) => {
    const cur = toNum(e.engineHours)
    if (i === 0) {
      res[e.id] = 0
      if (cur !== null) prev = cur
      return
    }
    if (cur === null || prev === null) {
      res[e.id] = null
      if (cur !== null) prev = cur
      return
    }
    const diff = cur - prev
    res[e.id] = diff >= 0 ? diff : null
    prev = cur
  })
  return res
}

/** h seit Start = engineHours − kleinster engineHours overall. Fehlend/negativ → null. */
export function hoursSinceStart(entry: Entry, entries: Entry[]): number | null {
  const cur = toNum(entry.engineHours)
  const min = minEngineHours(entries)
  if (cur === null || min === null) return null
  const d = cur - min
  return d >= 0 ? d : null
}

/* ----------------------------- Verbrauch ----------------------------- */

/**
 * Geschätzter Verbrauch l/h je Eintrag über „Tank-Blöcke" (CLAUDE.md §5):
 * Block = Einträge seit letztem Tankstopp; Block-l/h = Liter ÷ Stundendiff im Block,
 * allen Einträgen des Blocks zugewiesen. Nach dem letzten Tankstopp → null ("–").
 * Division durch 0 / fehlende Werte → null ("–"). Werte sind Schätzungen ("≈").
 */
export function consumptionPerEntry(entries: Entry[]): Record<string, number | null> {
  const sorted = [...entries].sort(chrono)
  const hp = hoursPerEntry(entries)
  const res: Record<string, number | null> = {}

  let blockIds: string[] = []
  let blockHours = 0

  for (const e of sorted) {
    blockIds.push(e.id)
    blockHours += hp[e.id] ?? 0

    const liters = toNum(e.fuelLiters)
    if (liters !== null && liters > 0) {
      const lh = blockHours > 0 ? liters / blockHours : null // Div/0 → null
      for (const id of blockIds) res[id] = lh
      blockIds = []
      blockHours = 0
    }
  }
  // Einträge nach dem letzten Tankstopp → "–".
  for (const id of blockIds) res[id] = null
  return res
}

/* ----------------------------- Aggregate ----------------------------- */

function yearOf(date: string): number | null {
  const y = Number(String(date).slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

function sumNum(vals: (number | null)[]): number {
  return vals.reduce<number>((acc, n) => acc + (n ?? 0), 0)
}

export interface YearStats {
  year: number
  operatingHours: number | null // max(Jahr) − max(Vorjahr) bzw. Baseline
  entryCount: number
  fuelLiters: number
  fuelCostChf: number
  consumptionLh: number | null // ≈ (jahresweise unpräzise)
  costPerHourChf: number | null
}

/**
 * Jahr-Aggregate je Kalenderjahr (CLAUDE.md §5, Regel 3):
 * Betriebsstunden/Jahr = max(engineHours im Jahr) − max(engineHours im Vorjahr mit
 * Einträgen). Erstes Jahr: max(Jahr) − kleinster engineHours overall (Baseline).
 * Telekopiert exakt zur Gesamt-Stundenspanne und zur Summe der Eintrags-Differenzen.
 */
export function yearStatsAll(entries: Entry[]): YearStats[] {
  const byYear = new Map<number, Entry[]>()
  for (const e of entries) {
    const y = yearOf(e.date)
    if (y === null) continue
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(e)
  }

  const years = [...byYear.keys()].sort((a, b) => a - b)
  const minOverall = minEngineHours(entries)
  const result: YearStats[] = []
  let prevMax: number | null = null

  years.forEach((y, i) => {
    const ents = byYear.get(y)!
    const maxY = maxEngineHours(ents)
    const baseline = i === 0 ? minOverall : prevMax

    let hours: number | null
    if (maxY === null || baseline === null) hours = null
    else {
      const d = maxY - baseline
      hours = d >= 0 ? d : null
    }

    const liters = sumNum(ents.map((e) => toNum(e.fuelLiters)))
    const cost = sumNum(ents.map((e) => toNum(e.fuelCostChf)))
    const hasHours = hours !== null && hours > 0

    result.push({
      year: y,
      operatingHours: hours,
      entryCount: ents.length,
      fuelLiters: liters,
      fuelCostChf: cost,
      consumptionLh: hasHours ? liters / hours! : null,
      costPerHourChf: hasHours ? cost / hours! : null,
    })

    if (maxY !== null) prevMax = maxY
  })

  return result
}

export interface TotalStats {
  totalOperatingHours: number
  totalFuelLiters: number
  totalFuelCostChf: number
  avgConsumptionLh: number | null // EXAKT, ohne "≈"
  entryCount: number
  yearCount: number // distinkte Jahre mit Einträgen
  avgHoursPerYear: number | null
  avgEntriesPerYear: number | null
  avgCostPerYear: number | null
}

/**
 * Total über alle Jahre + Ø pro Jahr (CLAUDE.md §5, Regeln 5/6).
 * Gesamt-Stunden = Σ der Jahres-Stunden (konsistent mit dem Pro-Jahr-Chart).
 * Ø pro Jahr = Total ÷ Anzahl distinkter Jahre mit Einträgen.
 */
export function totalStats(entries: Entry[]): TotalStats {
  const years = yearStatsAll(entries)
  const yearCount = years.length
  const totalHours = sumNum(years.map((y) => y.operatingHours))
  const liters = sumNum(entries.map((e) => toNum(e.fuelLiters)))
  const cost = sumNum(entries.map((e) => toNum(e.fuelCostChf)))

  return {
    totalOperatingHours: totalHours,
    totalFuelLiters: liters,
    totalFuelCostChf: cost,
    avgConsumptionLh: totalHours > 0 ? liters / totalHours : null,
    entryCount: entries.length,
    yearCount,
    avgHoursPerYear: yearCount > 0 ? totalHours / yearCount : null,
    avgEntriesPerYear: yearCount > 0 ? entries.length / yearCount : null,
    avgCostPerYear: yearCount > 0 ? cost / yearCount : null,
  }
}
