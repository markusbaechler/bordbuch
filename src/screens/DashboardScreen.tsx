import { useMemo, useState } from 'react'
import type { Entry } from '../lib/types'
import { totalStats, yearStatsAll, type YearStats } from '../lib/calc'
import { fmt } from '../lib/format'
import { Eyebrow } from '../components/Eyebrow'
import {
  BOAT_PROFILE,
  tankRange,
  maintenanceReport,
  maintenanceSummary,
  formatMonthYY,
  type TankRange,
  type MaintStatus,
  type MaintenanceResult,
  type MaintenanceReport,
  type MaintOverrides,
} from '../lib/boat'
import { useMaintenanceLog } from '../hooks/useMaintenanceLog'

// Status-Farben der Wartungs-Ampel (Amber wie im Wetter-Tab, kein eigenes Token).
const STATUS_COLOR: Record<MaintStatus, string> = {
  ok: 'var(--good)',
  soon: '#E8930C',
  due: 'var(--danger)',
  unknown: 'var(--ink-3)',
}
const STATUS_LABEL: Record<MaintStatus, string> = {
  ok: 'ok',
  soon: 'bald',
  due: 'fällig',
  unknown: '–',
}

type ChartMetric = 'hours' | 'entries' | 'fuel'

const METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'hours', label: 'Motor h' },
  { key: 'entries', label: 'Einträge' },
  { key: 'fuel', label: 'Treibstoff' },
]

function metricValue(y: YearStats, m: ChartMetric): number {
  if (m === 'hours') return y.operatingHours ?? 0
  if (m === 'entries') return y.entryCount
  return y.fuelCostChf
}

export function DashboardScreen({ entries }: { entries: Entry[] }) {
  const total = useMemo(() => totalStats(entries), [entries])
  const years = useMemo(() => yearStatsAll(entries), [entries]) // aufsteigend
  const range = useMemo(() => tankRange(entries, total.avgConsumptionLh), [entries, total])
  const { overrides, set: setOverride } = useMaintenanceLog()
  const maint = useMemo(() => maintenanceReport(entries, new Date(), overrides), [entries, overrides])
  const [metric, setMetric] = useState<ChartMetric>('hours')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  // Default-Jahr = letztes Jahr (höchstes), reaktiv falls noch nichts gewählt.
  const activeYear = useMemo(() => {
    if (selectedYear !== null && years.some((y) => y.year === selectedYear)) return selectedYear
    return years.length ? years[years.length - 1].year : null
  }, [selectedYear, years])

  const detail = years.find((y) => y.year === activeYear) ?? null

  // Reihenfolge: handlungsrelevant oben (Wartung → Tank), Auswertung von speziell
  // (Jahr) zu allgemein (Ø/Jahr → Total) darunter.
  return (
    <div>
      {/* WARTUNG / SERVICE – zuoberst, manuell editierbar */}
      <Eyebrow>Wartung &amp; Service</Eyebrow>
      <MaintenancePanel report={maint} overrides={overrides} onSet={setOverride} />

      {/* TANK & REICHWEITE */}
      <Eyebrow>Tank &amp; Reichweite</Eyebrow>
      <TankPanel range={range} />

      {years.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-3">Noch keine Einträge erfasst.</p>
      ) : (
        <>
          {/* JAHR IM DETAIL – Chart dient als Jahr-Selektor (keine Chip-Reihe mehr) */}
          <Eyebrow>Jahr im Detail</Eyebrow>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                    metric === m.key
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-surface text-ink-2'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {activeYear !== null && (
              <span className="tabnum shrink-0 font-mono text-[11px] text-ink-3">
                {activeYear} · Balken tippen
              </span>
            )}
          </div>
          <YearChart
            years={years}
            metric={metric}
            activeYear={activeYear}
            onPick={(y) => setSelectedYear(y)}
          />
          {detail && <YearDetail year={detail} avgHoursPerYear={total.avgHoursPerYear} />}

          {/* Ø PRO JAHR */}
          <Eyebrow>Durchschnitt pro Jahr</Eyebrow>
          <div className="mb-[22px] grid grid-cols-3 gap-[11px]">
            <MiniBox label="Stunden/J" value={fmt(total.avgHoursPerYear)} />
            <MiniBox label="Einträge/J" value={fmt(total.avgEntriesPerYear)} />
            <MiniBox label="CHF/Jahr" value={fmt(total.avgCostPerYear, 0)} />
          </div>

          {/* TOTAL über alle Jahre */}
          <Eyebrow>Total · alle Jahre</Eyebrow>
          <div className="mb-2 grid grid-cols-2 gap-[11px]">
            <Gauge label="Betriebsstunden" value={fmt(total.totalOperatingHours)} unit="h" tick="motor" />
            <Gauge label="Ø Verbrauch" value={fmt(total.avgConsumptionLh)} unit="l/h" tick="exakt" hot />
            <Gauge
              label="Treibstoffkosten"
              value={total.totalFuelCostChf > 0 ? fmt(total.totalFuelCostChf, 0) : '0'}
              unit="CHF"
              tick="gesamt"
            />
            <Gauge label="Einträge" value={String(total.entryCount)} tick="gesamt" />
          </div>
        </>
      )}
    </div>
  )
}

/* ----------------------------- (a) Gauge ----------------------------- */

function Gauge({
  label,
  value,
  unit,
  tick,
  hot,
}: {
  label: string
  value: string
  unit?: string
  tick?: string
  hot?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 px-3.5 pb-3 pt-3.5">
      <span
        className="absolute left-3.5 right-3.5 top-0 h-0.5 rounded"
        style={{ background: `linear-gradient(90deg, var(${hot ? '--accent' : '--teal'}), transparent)` }}
      />
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">{label}</div>
      <div className="tabnum font-mono text-[30px] font-bold leading-none text-ink">
        {value}
        {unit && <span className="ml-0.5 font-sans text-xs font-medium text-ink-2">{unit}</span>}
      </div>
      {tick && (
        <div className="tabnum absolute bottom-2.5 right-3 font-mono text-[10px] tracking-wide text-ink-3">
          {tick}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- (b) MiniBox ----------------------------- */

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-2">{label}</div>
      <div className="tabnum font-mono text-[17px] font-bold leading-none text-ink">{value}</div>
    </div>
  )
}

/* ----------------------------- (c) YearChart ----------------------------- */

function YearChart({
  years,
  metric,
  activeYear,
  onPick,
}: {
  years: YearStats[]
  metric: ChartMetric
  activeYear: number | null
  onPick: (year: number) => void
}) {
  const values = years.map((y) => metricValue(y, metric))
  const max = Math.max(...values, 0)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const avgPct = max > 0 ? (avg / max) * 100 : 0
  const digits = metric === 'fuel' ? 0 : metric === 'entries' ? 0 : 1

  return (
    <div className="mb-[22px] rounded-2xl border border-line bg-surface-2 px-3.5 pb-3 pt-3.5">
      <div className="relative flex h-[92px] items-end gap-1.5 pt-1">
        {avg > 0 && (
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-accent opacity-70"
            style={{ bottom: `${avgPct}%` }}
          >
            <span className="absolute right-0 -top-4 bg-surface-2 px-1 font-mono text-[9px] font-bold text-accent">
              Ø {fmt(avg, digits)}
            </span>
          </div>
        )}
        {years.map((y, i) => {
          const h = max > 0 ? Math.max((values[i] / max) * 100, 3) : 0
          const on = y.year === activeYear
          return (
            <button
              key={y.year}
              onClick={() => onPick(y.year)}
              aria-pressed={on}
              aria-label={`Jahr ${y.year}: ${fmt(values[i], digits)}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <i
                className="block w-full max-w-4 rounded-t"
                style={{
                  height: `${h}%`,
                  background: on ? 'var(--accent)' : 'var(--teal)',
                }}
              />
              <em className="tabnum font-mono text-[8px] not-italic text-ink-3">
                {String(y.year).slice(2)}
              </em>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------- (d) YearDetail ----------------------------- */

function YearDetail({ year, avgHoursPerYear }: { year: YearStats; avgHoursPerYear: number | null }) {
  const delta =
    year.operatingHours !== null && avgHoursPerYear !== null
      ? year.operatingHours - avgHoursPerYear
      : null

  return (
    <div className="mb-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
      <DCell
        k="Betriebsstunden"
        v={fmt(year.operatingHours)}
        unit="h"
        sub={
          delta === null
            ? undefined
            : `${delta >= 0 ? '+' : ''}${fmt(delta)} h vs Ø`
        }
        subColor={delta === null ? undefined : delta >= 0 ? 'good' : 'accent'}
      />
      <DCell k="Einträge" v={String(year.entryCount)} />
      <DCell k="Treibstoff" v={fmt(year.fuelLiters)} unit="l" />
      <DCell k="Kosten" v={fmt(year.fuelCostChf, 0)} unit="CHF" />
      <DCell
        k="Ø Verbrauch (Schätzung)"
        v={year.consumptionLh === null ? '–' : `≈ ${fmt(year.consumptionLh)}`}
        unit="l/h"
      />
      <DCell k="Kosten/Stunde" v={fmt(year.costPerHourChf, 2)} unit="CHF/h" />
    </div>
  )
}

function DCell({
  k,
  v,
  unit,
  sub,
  subColor,
}: {
  k: string
  v: string
  unit?: string
  sub?: string
  subColor?: 'good' | 'accent'
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">{k}</div>
      <div className="tabnum font-mono text-[19px] font-bold text-ink">
        {v}
        {unit && <small className="ml-1 text-[11px] font-medium text-ink-2">{unit}</small>}
      </div>
      {sub && (
        <div className={`tabnum mt-1 font-mono text-[11px] font-bold ${subColor === 'good' ? 'text-good' : 'text-accent'}`}>
          {sub}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Tank & Reichweite ----------------------------- */

// Farbe der Füllstands-Anzeige: grün > 50 %, amber 20–50 %, rot < 20 %.
function fuelColor(pct: number): string {
  return pct < 20 ? 'var(--danger)' : pct < 50 ? '#E8930C' : 'var(--good)'
}

function TankPanel({ range }: { range: TankRange }) {
  if (range.fullTankHours === null) {
    return (
      <p className="mb-[22px] rounded-2xl border border-line bg-surface-2 px-4 py-5 text-center text-[13px] text-ink-3">
        Noch kein Ø-Verbrauch bekannt – erfasse einen Tankstopp (Liter), dann erscheint die
        Reichweite.
      </p>
    )
  }

  const nm = (n: number | null) => (n === null ? '–' : fmt(n, 0))

  return (
    <div className="mb-[22px] rounded-2xl border border-line bg-surface-2 px-3.5 pb-3.5 pt-3.5">
      {range.hasCurrent && range.currentPct !== null ? (
        <>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              Aktuell im Tank (Schätzung)
            </span>
            <span className="tabnum font-mono text-[13px] font-bold text-ink">
              ≈ {fmt(range.currentLiters, 0)} l
              <span className="ml-1 font-sans text-[11px] font-medium text-ink-2">
                / {BOAT_PROFILE.tankLiters} l
              </span>
            </span>
          </div>
          {/* Füllstandsbalken */}
          <div className="mb-2.5 h-2.5 overflow-hidden rounded-full bg-line">
            <i
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(range.currentPct, 2)}%`,
                background: fuelColor(range.currentPct),
              }}
            />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-[11px]">
            <RangeCell
              label="Restreichweite"
              value={nm(range.currentHours)}
              unit="h"
              sub={`≈ ${nm(range.currentNm)} sm`}
            />
            <RangeCell
              label="Seit Tankstopp"
              value={nm(range.hoursSinceFill)}
              unit="h"
              sub="gefahren"
            />
          </div>
          <p className="text-[10px] leading-snug text-ink-3">
            Annahme: zuletzt voll getankt. Schätzung aus Ø-Verbrauch ≈ {fmt(range.avgConsumptionLh)}{' '}
            l/h · ohne Gewähr.
          </p>
        </>
      ) : (
        <p className="mb-3 text-[11px] leading-snug text-ink-3">
          Für die aktuelle Tankfüllung fehlt ein Tankstopp mit Litern + Zählerstand. Unten die
          Reichweite einer vollen Tankfüllung.
        </p>
      )}

      {/* Statisch: ganze Tankfüllung */}
      <div className="mt-1 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">
          Volle Tankfüllung
        </span>
        <span className="tabnum font-mono text-[13px] font-bold text-ink">
          ≈ {nm(range.fullTankHours)} h
          <span className="ml-1.5 font-sans text-[11px] font-medium text-ink-2">
            · {nm(range.fullTankNm)} sm bei ~{BOAT_PROFILE.cruiseKn} kn
          </span>
        </span>
      </div>
    </div>
  )
}

function RangeCell({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-2">
        {label}
      </div>
      <div className="tabnum font-mono text-[22px] font-bold leading-none text-ink">
        {value}
        {unit && <span className="ml-0.5 font-sans text-[11px] font-medium text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="tabnum mt-1 font-mono text-[10px] text-ink-3">{sub}</div>}
    </div>
  )
}

/* ----------------------------- Wartung / Service ----------------------------- */

function MaintenancePanel({
  report,
  overrides,
  onSet,
}: {
  report: MaintenanceReport
  overrides: MaintOverrides
  onSet: (key: string, value: string | null) => void
}) {
  const [open, setOpen] = useState(true) // zuoberst & handlungsrelevant → offen
  const summary = maintenanceSummary(report.items)
  const headColor = summary.due > 0 ? 'var(--danger)' : summary.soon > 0 ? '#E8930C' : 'var(--good)'
  const customCount = Object.keys(overrides).length

  const badge =
    report.serviceYear === null
      ? 'keine Daten'
      : summary.due > 0
        ? `${summary.due} fällig`
        : summary.soon > 0
          ? `${summary.soon} bald`
          : 'alles ok'

  return (
    <div className="mb-[22px] overflow-hidden rounded-2xl border border-line bg-surface-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: headColor }} />
        <span className="flex-1">
          <span className="block text-[13px] font-bold text-ink">Wartung &amp; Service</span>
          <span className="block text-[10px] text-ink-2">
            {BOAT_PROFILE.engine} · {BOAT_PROFILE.year}
            {report.currentHours !== null && (
              <> · aktuell {fmt(report.currentHours, 0)} h</>
            )}
          </span>
        </span>
        <span className="tabnum font-mono text-[11px] font-bold" style={{ color: headColor }}>
          {badge}
        </span>
        <span className={`text-[11px] text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-3.5 pb-3.5 pt-3">
          {report.serviceYear === null ? (
            <p className="py-3 text-center text-[12px] text-ink-3">
              Noch keine Einträge – sobald die Saison startet, wird der Service abgeleitet.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[11px] leading-snug text-ink-2">
                Stand je Position antippbar (✎) und auf <b className="text-ink">MM.JJ</b> setzbar.
                Ohne eigenes Datum wird der Saisonstart{' '}
                <b className="tabnum font-mono text-ink">{formatMonthYY(report.serviceDate ?? '')}</b>{' '}
                angenommen ({customCount > 0 ? `${customCount} manuell gesetzt` : 'alle automatisch'}).
                {report.newSeasonPending && (
                  <span className="text-[#E8930C]"> · Neue Saison – Service vor erstem Start fällig.</span>
                )}
              </p>
              <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line">
                {report.items.map((it) => (
                  <MaintRow key={it.key} item={it} onSet={onSet} />
                ))}
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-ink-3">
                Richtwerte Volvo Penta Benzin-Z-Antrieb (Süsswasser, jährlicher Winterlager-Service).
                Ohne Gewähr – offizielles Wartungsmanual massgeblich.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MaintRow({
  item,
  onSet,
}: {
  item: MaintenanceResult
  onSet: (key: string, value: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const color = STATUS_COLOR[item.status]

  // Rechte Spalte: knappster aussagekräftiger Hinweis.
  let detail = ''
  if (item.status === 'due') {
    detail =
      item.dueInHours !== null && item.dueInHours < 0
        ? `${fmt(-item.dueInHours, 0)} h drüber`
        : 'fällig'
  } else if (item.dueInHours !== null) {
    detail = `noch ${fmt(item.dueInHours, 0)} h`
  } else if (item.intervalMonths !== null) {
    detail = `alle ${item.intervalMonths} Mt.`
  }

  // "zuletzt erledigt"-Anzeige + Vorbelegung des Monatsfelds (YYYY-MM).
  const lastLabel = item.lastDone ? formatMonthYY(item.lastDone) : '–'
  const inputValue = item.lastDone ? item.lastDone.slice(0, 7) : ''
  const isCustom = item.lastDoneSource === 'override'

  return (
    <div className="bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-ink">{item.label}</span>
          {item.note && <span className="block truncate text-[10px] text-ink-3">{item.note}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span
            className="tabnum block font-mono text-[10px] font-bold uppercase tracking-wide"
            style={{ color }}
          >
            {STATUS_LABEL[item.status]}
          </span>
          {detail && <span className="tabnum block font-mono text-[10px] text-ink-3">{detail}</span>}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 pl-5">
        <span className="text-[10px] text-ink-3">
          zuletzt <b className="tabnum font-mono text-ink-2">{lastLabel}</b>
          {!isCustom && item.lastDone && <span className="text-ink-3"> (Auto)</span>}
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            aria-label={`${item.label}: Service-Datum bearbeiten`}
            className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-2 hover:bg-surface-2"
          >
            ✎ ändern
          </button>
        ) : (
          <span className="flex items-center gap-1.5">
            <input
              type="month"
              defaultValue={inputValue}
              onChange={(e) => onSet(item.key, e.target.value || null)}
              className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink"
            />
            {isCustom && (
              <button
                onClick={() => {
                  onSet(item.key, null)
                  setEditing(false)
                }}
                className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-2 hover:bg-surface-2"
              >
                Auto
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              aria-label="Bearbeiten schliessen"
              className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-2 hover:bg-surface-2"
            >
              ✓
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
