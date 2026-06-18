// src/lib/boat.ts
// Boot-Profil + abgeleitete Betriebs-Kennzahlen: Tank-/Restreichweite und
// Wartungsfälligkeit. Bewusst reine Funktionen (kein State, kein Backend) – alles
// wird aus den Logbuch-Einträgen + festen Konstanten hergeleitet und ist getestet.
//
// Reichweite: Das Logbuch speichert Motorstunden + Verbrauch (l/h), aber KEINE
// Distanz/Geschwindigkeit. Die ehrliche Grösse ist darum die Motorlaufzeit
// (Liter ÷ Ø l/h). Die sm-Angabe ist eine GROBE Zusatzschätzung mit fixer
// Marschgeschwindigkeit – klar als solche markiert.
//
// Wartung: Die Arbeiten werden beim ersten Gebrauch pro Jahr ausgeführt (Werft/
// Winterlager). Der „letzte Service" ist daher der erste Logbuch-Eintrag des
// (jüngsten) Jahres; Fälligkeit = aktueller Zählerstand/Datum gegen die
// Volvo-Penta-Richtintervalle. Intervalle sind Richtwerte (Benzin-Z-Antrieb,
// Süsswasser) – das offizielle Manual ist massgeblich („ohne Gewähr").

import type { Entry } from './types'
import { byDateAsc, maxEngineHours } from './calc'
import { toNum } from './format'

export const KN_TO_KMH = 1.852

/** Zentrales Boot-Profil – hier ändern, nicht verstreut im Code. */
export const BOAT_PROFILE = {
  name: 'Regal 2750 Cuddy',
  shortName: 'Regal 2750',
  location: 'Ascona · Lago Maggiore',
  engine: 'Volvo Penta',
  year: 2007,
  tankLiters: 290,
  cruiseKn: 18, // Annahme Marschfahrt, NUR für die grobe sm/km-Reichweite
} as const

/* ----------------------------- Tank & Reichweite ----------------------------- */

export interface TankRange {
  avgConsumptionLh: number | null
  // Statisch: ganze Tankfüllung (immer gültig, nur vom Ø-Verbrauch abhängig).
  fullTankHours: number | null
  fullTankNm: number | null
  // Aktuell: Schätzung seit letztem Tankstopp (Annahme: voll getankt).
  hasCurrent: boolean
  currentLiters: number | null
  currentPct: number | null // 0–100
  currentHours: number | null
  currentNm: number | null
  hoursSinceFill: number | null
}

/**
 * Tank-/Restreichweite. `avgLh` = exakter Ø-Verbrauch (aus totalStats), damit der
 * Wert konsistent zum Dashboard ist. „Aktuell" nimmt an, dass beim letzten
 * Tankstopp voll getankt wurde, und zieht den seither geschätzten Verbrauch ab.
 */
export function tankRange(entries: Entry[], avgLh: number | null): TankRange {
  const tank = BOAT_PROFILE.tankLiters
  const usable = avgLh != null && avgLh > 0
  const fullTankHours = usable ? tank / avgLh! : null
  const fullTankNm = fullTankHours != null ? fullTankHours * BOAT_PROFILE.cruiseKn : null

  const curHours = maxEngineHours(entries)

  // Zählerstand beim letzten Tankstopp (chronologisch letzter Eintrag mit Litern).
  let lastFillHours: number | null = null
  for (const e of [...entries].sort(byDateAsc)) {
    const liters = toNum(e.fuelLiters)
    const eh = toNum(e.engineHours)
    if (liters != null && liters > 0 && eh != null) lastFillHours = eh
  }

  const base: TankRange = {
    avgConsumptionLh: avgLh,
    fullTankHours,
    fullTankNm,
    hasCurrent: false,
    currentLiters: null,
    currentPct: null,
    currentHours: null,
    currentNm: null,
    hoursSinceFill: null,
  }

  if (!usable || curHours == null || lastFillHours == null || curHours < lastFillHours) {
    return base
  }

  const hoursSinceFill = curHours - lastFillHours
  const consumed = hoursSinceFill * avgLh!
  const currentLiters = Math.max(0, Math.min(tank, tank - consumed))
  const currentHours = currentLiters / avgLh!

  return {
    ...base,
    hasCurrent: true,
    currentLiters,
    currentPct: (currentLiters / tank) * 100,
    currentHours,
    currentNm: currentHours * BOAT_PROFILE.cruiseKn,
    hoursSinceFill,
  }
}

/* ----------------------------- Wartung / Service ----------------------------- */

export interface MaintenanceItem {
  key: string
  label: string
  intervalHours: number | null
  intervalMonths: number | null
  note?: string
}

/**
 * Richtintervalle Volvo Penta Benzin-Z-Antrieb (Süsswasser). Jahres-Kadenz führt
 * (jährlicher Service im Winterlager); Stunden-Caps greifen als Frühwarnung in
 * stundenintensiven Saisons. Richtwerte – offizielles Manual massgeblich.
 */
export const MAINTENANCE_SCHEDULE: MaintenanceItem[] = [
  { key: 'engine-oil', label: 'Motoröl & Ölfilter', intervalHours: 100, intervalMonths: 12, note: 'jährlich oder 100 h' },
  { key: 'drive-oil', label: 'Z-Antrieb-Öl', intervalHours: 200, intervalMonths: 12, note: 'jährlich' },
  { key: 'fuel-filter', label: 'Kraftstofffilter / Wasserabscheider', intervalHours: 100, intervalMonths: 12, note: 'jährlich oder 100 h' },
  { key: 'impeller', label: 'Seewasser-Impeller', intervalHours: 200, intervalMonths: 24, note: 'Kontrolle jährlich, Wechsel ~2 J.' },
  { key: 'spark-plugs', label: 'Zündkerzen', intervalHours: 200, intervalMonths: 24, note: 'Original VP bis 3 J.' },
  { key: 'bellows', label: 'Faltenbälge & Kardanlager', intervalHours: null, intervalMonths: 12, note: 'Kontrolle/Schmierung jährlich' },
  { key: 'anodes', label: 'Opferanoden', intervalHours: null, intervalMonths: 12, note: 'Süsswasser – jährlich prüfen' },
  { key: 'belt', label: 'Keilrippenriemen & Schläuche', intervalHours: null, intervalMonths: 12, note: 'Sichtkontrolle jährlich' },
  { key: 'coolant', label: 'Kühlmittel (bei Frischwasserkühlung)', intervalHours: null, intervalMonths: 24, note: 'nur Modelle mit FWC' },
]

export type MaintStatus = 'ok' | 'soon' | 'due' | 'unknown'

export interface MaintenanceResult extends MaintenanceItem {
  status: MaintStatus
  hoursSince: number | null
  monthsSince: number | null
  fraction: number | null // 0..>1 (Anteil des erreichten Intervalls, max aus h/Monaten)
  dueInHours: number | null // intervalHours − hoursSince (negativ = überfällig)
}

export interface MaintenanceReport {
  serviceYear: number | null
  serviceDate: string | null
  serviceHours: number | null
  currentHours: number | null
  newSeasonPending: boolean // jüngster Service liegt vor dem laufenden Jahr
  items: MaintenanceResult[]
}

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000
const SOON_FRACTION = 0.8 // ab 80 % des Intervalls „bald fällig"

function parseDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/** Erster Eintrag (chronologisch) eines bestimmten Jahres mit gültigem Datum + Zähler. */
function firstServiceEntryOfYear(entries: Entry[], year: number): Entry | null {
  const inYear = entries
    .filter((e) => parseDate(e.date)?.getFullYear() === year && toNum(e.engineHours) != null)
    .sort(byDateAsc)
  return inYear[0] ?? null
}

/**
 * Wartungs-Report: leitet den „letzten Service" aus dem ersten Eintrag des
 * jüngsten Jahres mit Einträgen her und bewertet jede Position dynamisch gegen
 * Stunden- und Monatsintervall.
 */
export function maintenanceReport(entries: Entry[], today: Date): MaintenanceReport {
  const currentHours = maxEngineHours(entries)
  const currentYear = today.getFullYear()

  // Jahre mit verwertbaren Einträgen, absteigend.
  const years = [
    ...new Set(
      entries
        .map((e) => parseDate(e.date)?.getFullYear())
        .filter((y): y is number => y != null),
    ),
  ].sort((a, b) => b - a)

  const serviceYear = years.find((y) => y <= currentYear) ?? years[0] ?? null
  const serviceEntry = serviceYear != null ? firstServiceEntryOfYear(entries, serviceYear) : null
  const serviceDate = serviceEntry?.date ?? null
  const serviceHours = serviceEntry ? toNum(serviceEntry.engineHours) : null
  const newSeasonPending = serviceYear != null && currentYear > serviceYear

  const serviceDateObj = serviceDate ? parseDate(serviceDate) : null
  const monthsSinceService =
    serviceDateObj != null ? (today.getTime() - serviceDateObj.getTime()) / MS_PER_MONTH : null

  const items: MaintenanceResult[] = MAINTENANCE_SCHEDULE.map((item) => {
    const hoursSince =
      currentHours != null && serviceHours != null ? Math.max(0, currentHours - serviceHours) : null
    const monthsSince = monthsSinceService != null ? Math.max(0, monthsSinceService) : null

    const fracH =
      item.intervalHours != null && hoursSince != null ? hoursSince / item.intervalHours : null
    const fracM =
      item.intervalMonths != null && monthsSince != null ? monthsSince / item.intervalMonths : null
    const parts = [fracH, fracM].filter((x): x is number => x != null)
    const fraction = parts.length ? Math.max(...parts) : null

    let status: MaintStatus = 'unknown'
    if (fraction != null) status = fraction >= 1 ? 'due' : fraction >= SOON_FRACTION ? 'soon' : 'ok'

    const dueInHours =
      item.intervalHours != null && hoursSince != null ? item.intervalHours - hoursSince : null

    return { ...item, status, hoursSince, monthsSince, fraction, dueInHours }
  })

  return { serviceYear, serviceDate, serviceHours, currentHours, newSeasonPending, items }
}

/** Zusammenfassung für den Accordion-Header: Anzahl fällig/bald. */
export function maintenanceSummary(items: MaintenanceResult[]): { due: number; soon: number } {
  return {
    due: items.filter((i) => i.status === 'due').length,
    soon: items.filter((i) => i.status === 'soon').length,
  }
}
