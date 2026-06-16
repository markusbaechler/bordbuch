/** Berechnungslogik (CLAUDE.md §5). Ergebnisse werden NICHT gespeichert. */

import type { Trip } from './types'
import { toNum } from './format'

/** Betriebsstunden je Törn = engineHoursEnd − engineHoursStart. */
export function operatingHours(t: Trip): number | null {
  const start = toNum(t.engineHoursStart)
  const end = toNum(t.engineHoursEnd)
  if (start === null || end === null) return null
  const diff = end - start
  return diff >= 0 ? diff : null
}

/** Fahrzeit in Stunden = endTime − startTime. */
export function travelHours(t: Trip): number | null {
  const start = new Date(t.startTime).getTime()
  const end = new Date(t.endTime).getTime()
  if (isNaN(start) || isNaN(end)) return null
  const diff = (end - start) / 3_600_000
  return diff >= 0 ? diff : null
}

/** Törns chronologisch aufsteigend (nach startTime). */
export function byStartAsc(a: Trip, b: Trip): number {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
}

/** Törns chronologisch absteigend (Liste: neueste zuerst). */
export function byStartDesc(a: Trip, b: Trip): number {
  return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
}

export interface SeasonStats {
  tripCount: number
  totalOperatingHours: number
  totalFuelLiters: number
  totalFuelCostChf: number
  avgConsumptionLh: number | null // Σ Liter ÷ Σ Betriebsstunden
  avgPriceChfPerL: number | null // Σ CHF ÷ Σ Liter
  costPerHourChf: number | null // Σ CHF ÷ Σ Betriebsstunden
}

/** Exakte Saison-Aggregate (CLAUDE.md §5). Division durch 0 → null. */
export function seasonStats(trips: Trip[]): SeasonStats {
  let hours = 0
  let liters = 0
  let cost = 0
  for (const t of trips) {
    hours += operatingHours(t) ?? 0
    liters += toNum(t.fuelLiters) ?? 0
    cost += toNum(t.fuelCostChf) ?? 0
  }
  return {
    tripCount: trips.length,
    totalOperatingHours: hours,
    totalFuelLiters: liters,
    totalFuelCostChf: cost,
    avgConsumptionLh: hours > 0 ? liters / hours : null,
    avgPriceChfPerL: liters > 0 ? cost / liters : null,
    costPerHourChf: hours > 0 ? cost / hours : null,
  }
}

export interface TripConsumption {
  /** geschätzter Verbrauch l/h (null = nicht berechenbar, z. B. Block ohne Stunden) */
  lh: number | null
  /** 'block' = aus echtem Tank-Block; 'season' = Saison-Ø-Platzhalter (nach letztem Tankstopp) */
  source: 'block' | 'season'
}

/**
 * Geschätzter Verbrauch (l/h) je Törn über „Tank-Blöcke" (CLAUDE.md §5):
 * Törns chronologisch durchlaufen, Betriebsstunden akkumulieren. Ein Törn mit
 * fuelLiters schliesst den Block → Block-l/h = Liter ÷ Σ Stunden im Block, allen
 * Törns des Blocks zugewiesen. Törns nach dem letzten Tankstopp: Saison-Ø als
 * Platzhalter (source:'season'). Werte sind IMMER Schätzungen (UI mit „≈").
 */
export function consumptionPerTrip(trips: Trip[]): Record<string, TripConsumption> {
  const sorted = [...trips].sort(byStartAsc)
  const seasonAvg = seasonStats(trips).avgConsumptionLh
  const result: Record<string, TripConsumption> = {}

  let blockTrips: Trip[] = []
  let blockHours = 0

  for (const t of sorted) {
    blockHours += operatingHours(t) ?? 0
    blockTrips.push(t)

    const liters = toNum(t.fuelLiters)
    if (liters !== null && liters > 0) {
      const lh = blockHours > 0 ? liters / blockHours : null // Div/0 abfangen
      for (const bt of blockTrips) result[bt.id] = { lh, source: 'block' }
      blockTrips = []
      blockHours = 0
    }
  }
  // Törns nach dem letzten Tankstopp → Saison-Ø als Platzhalter.
  for (const bt of blockTrips) result[bt.id] = { lh: seasonAvg, source: 'season' }
  return result
}
