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
 * Serviceplan Volvo Penta Benzin-Z-Antrieb, auf **Süsswasser** (Lago Maggiore)
 * angepasst – Korrosion deutlich geringer, daher Impeller/Anoden/Kerzen grosszügiger
 * als bei Salzwasser. Jahresarbeiten (≤ 12 Mt.) werden bei fehlendem eigenen Datum
 * ab Saisonstart abgeleitet; mehrjährige Posten (> 12 Mt.) verlangen ein manuelles
 * Datum (sonst keine Annahme „erledigt"). Richtwerte – offizielles Manual massgeblich.
 */
export const MAINTENANCE_SCHEDULE: MaintenanceItem[] = [
  // Jährlich oder 100 h – sehr wichtig.
  { key: 'engine-oil', label: 'Motoröl & Ölfilter', intervalHours: 100, intervalMonths: 12, note: 'jährlich oder 100 h' },
  { key: 'fuel-filter', label: 'Kraftstofffilter', intervalHours: 100, intervalMonths: 12, note: 'jährlich oder 100 h' },
  { key: 'drive-oil', label: 'Sterndrive-Getriebeöl', intervalHours: 100, intervalMonths: 12, note: 'jährlich – schützt vor Feuchtigkeit' },
  // Jährliche Kontrollen.
  { key: 'anodes', label: 'Anoden prüfen', intervalHours: null, intervalMonths: 12, note: 'Süsswasser hält länger, bei >50 % wechseln' },
  { key: 'bellows-check', label: 'Balg & U-Gelenke prüfen', intervalHours: null, intervalMonths: 12, note: 'jährlich auf Risse/Falten · Nippel fetten' },
  { key: 'winter-service', label: 'Winterlager-Komplettservice', intervalHours: null, intervalMonths: 12, note: 'Saisonende: Motor foggen, Batterie pflegen' },
  // Mehrjährig – brauchen ein manuelles „zuletzt"-Datum (✎).
  { key: 'impeller', label: 'Impeller wechseln', intervalHours: 200, intervalMonths: 36, note: 'Süsswasser ~2–3 J. (jährlich prüfen)' },
  { key: 'spark-plugs', label: 'Zündkerzen & -kabel', intervalHours: 200, intervalMonths: 36, note: 'alle 2–3 J. bzw. 200 h' },
  { key: 'coolant-fuel', label: 'Kühlmittel & Kraftstoffleitungen', intervalHours: null, intervalMonths: 60, note: 'alle ~5 J. (Frischwasserkühlung)' },
  { key: 'bellows-replace', label: 'Sterndrive-Balg erneuern', intervalHours: null, intervalMonths: 72, note: 'alle 5–7 J. – sicherheitskritisch' },
]

/** Jahresarbeit (≤ 12 Mt.) → wird ohne eigenes Datum ab Saisonstart abgeleitet. */
const ANNUAL_MONTHS = 12

export type MaintStatus = 'ok' | 'soon' | 'due' | 'unknown'
export type MaintSource = 'override' | 'derived' | 'none'

/** Manuell gesetzte „zuletzt erledigt"-Daten je Position (key → "YYYY-MM"). */
export type MaintOverrides = Record<string, string>

export interface MaintenanceResult extends MaintenanceItem {
  status: MaintStatus
  hoursSince: number | null
  monthsSince: number | null
  fraction: number | null // 0..>1 (Anteil des erreichten Intervalls, max aus h/Monaten)
  dueInHours: number | null // intervalHours − hoursSince (negativ = überfällig)
  lastDone: string | null // "YYYY-MM" (override) bzw. Eintrags-Datum (abgeleitet)
  lastDoneSource: MaintSource
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

/** "YYYY-MM" → Monats-Eckdaten (Anfang/Ende); ungültig → null. */
function monthBounds(ym: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym))
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return { start: new Date(y, mo - 1, 1), end: new Date(y, mo, 0) } // Tag 0 = letzter Tag des Monats
}

/** "2026-04" oder "2026-04-15" → "04.26" (Anzeige). */
export function formatMonthYY(value: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(value))
  return m ? `${m[2]}.${m[1].slice(2)}` : value
}

/** Höchster Zählerstand aller Einträge mit Datum ≤ `date` (Baseline zu einem Service-Datum). */
export function engineHoursAtDate(entries: Entry[], date: Date): number | null {
  let best: number | null = null
  for (const e of entries) {
    const d = parseDate(e.date)
    const eh = toNum(e.engineHours)
    if (d != null && eh != null && d.getTime() <= date.getTime()) {
      best = best == null ? eh : Math.max(best, eh)
    }
  }
  return best
}

/** Erster Eintrag (chronologisch) eines bestimmten Jahres mit gültigem Datum + Zähler. */
function firstServiceEntryOfYear(entries: Entry[], year: number): Entry | null {
  const inYear = entries
    .filter((e) => parseDate(e.date)?.getFullYear() === year && toNum(e.engineHours) != null)
    .sort(byDateAsc)
  return inYear[0] ?? null
}

/**
 * Wartungs-Report. Pro Position ist das „zuletzt erledigt"-Datum entweder manuell
 * gesetzt (`overrides[key]` = "YYYY-MM") oder wird aus dem ersten Eintrag des
 * jüngsten Jahres abgeleitet (Annahme: Service beim Saisonstart/Winterlager).
 * Die Stunden-Baseline zum Datum kommt aus dem Logbuch (`engineHoursAtDate`).
 * Bewertet wird dynamisch gegen Stunden- UND Monatsintervall.
 */
export function maintenanceReport(
  entries: Entry[],
  today: Date,
  overrides: MaintOverrides = {},
): MaintenanceReport {
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

  const items: MaintenanceResult[] = MAINTENANCE_SCHEDULE.map((item) => {
    // 1) Letztes Service-Datum + Stunden-Baseline bestimmen.
    let lastDone: string | null = null
    let lastDoneSource: MaintSource = 'none'
    let baseDate: Date | null = null
    let baseHours: number | null = null

    const override = overrides[item.key]
    const bounds = override ? monthBounds(override) : null
    const isAnnual = item.intervalMonths != null && item.intervalMonths <= ANNUAL_MONTHS
    if (bounds) {
      lastDone = override
      lastDoneSource = 'override'
      baseDate = bounds.start
      baseHours = engineHoursAtDate(entries, bounds.end) // Stand am Monatsende
    } else if (serviceDate && isAnnual) {
      // Nur Jahresarbeiten ab Saisonstart annehmen. Mehrjährige Posten bleiben
      // „unbekannt", bis ein Datum gesetzt wird (kein falsches „erledigt").
      lastDone = serviceDate
      lastDoneSource = 'derived'
      baseDate = parseDate(serviceDate)
      baseHours = serviceHours
    }

    // 2) Verstrichene Stunden/Monate.
    const hoursSince =
      currentHours != null && baseHours != null ? Math.max(0, currentHours - baseHours) : null
    const monthsSince =
      baseDate != null ? Math.max(0, (today.getTime() - baseDate.getTime()) / MS_PER_MONTH) : null

    // 3) Anteil des Intervalls (max aus Stunden/Monaten) → Ampel.
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

    return {
      ...item,
      status,
      hoursSince,
      monthsSince,
      fraction,
      dueInHours,
      lastDone,
      lastDoneSource,
    }
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
