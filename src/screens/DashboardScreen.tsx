import { useMemo, useState } from 'react'
import type { Entry } from '../lib/types'
import { totalStats, yearStatsAll, type YearStats } from '../lib/calc'
import { fmt } from '../lib/format'
import { Eyebrow } from '../components/Eyebrow'

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
  const [metric, setMetric] = useState<ChartMetric>('hours')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  // Default-Jahr = letztes Jahr (höchstes), reaktiv falls noch nichts gewählt.
  const activeYear = useMemo(() => {
    if (selectedYear !== null && years.some((y) => y.year === selectedYear)) return selectedYear
    return years.length ? years[years.length - 1].year : null
  }, [selectedYear, years])

  const detail = years.find((y) => y.year === activeYear) ?? null

  return (
    <div>
      {/* (a) TOTAL über alle Jahre */}
      <Eyebrow>Total · alle Jahre</Eyebrow>
      <div className="mb-[22px] grid grid-cols-2 gap-[11px]">
        <Gauge label="Betriebsstunden" value={fmt(total.totalOperatingHours)} unit="h" tick="motor" />
        <Gauge
          label="Ø Verbrauch"
          value={fmt(total.avgConsumptionLh)}
          unit="l/h"
          tick="exakt"
          hot
        />
        <Gauge
          label="Treibstoffkosten"
          value={total.totalFuelCostChf > 0 ? fmt(total.totalFuelCostChf, 0) : '0'}
          unit="CHF"
          tick="gesamt"
        />
        <Gauge label="Einträge" value={String(total.entryCount)} tick="gesamt" />
      </div>

      {/* (b) Ø PRO JAHR */}
      <Eyebrow>Ø pro Jahr</Eyebrow>
      <div className="mb-[22px] grid grid-cols-3 gap-[11px]">
        <MiniBox label="Stunden/J" value={fmt(total.avgHoursPerYear)} />
        <MiniBox label="Einträge/J" value={fmt(total.avgEntriesPerYear)} />
        <MiniBox label="CHF/Jahr" value={fmt(total.avgCostPerYear, 0)} />
      </div>

      {years.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-3">Noch keine Einträge erfasst.</p>
      ) : (
        <>
          {/* (c) PRO-JAHR-CHART */}
          <Eyebrow>Pro Jahr</Eyebrow>
          <div className="mb-2 flex gap-2">
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
          <YearChart
            years={years}
            metric={metric}
            activeYear={activeYear}
            onPick={(y) => setSelectedYear(y)}
          />

          {/* (d) EINZELJAHR-DETAIL */}
          <Eyebrow>Jahr im Detail</Eyebrow>
          <div className="mb-3 flex flex-wrap gap-2">
            {years
              .slice()
              .reverse()
              .map((y) => (
                <button
                  key={y.year}
                  onClick={() => setSelectedYear(y.year)}
                  aria-pressed={y.year === activeYear}
                  className={`min-h-11 rounded-full border px-4 py-2.5 text-xs font-semibold tabnum ${
                    y.year === activeYear
                      ? 'border-ink bg-ink text-surface'
                      : 'border-line bg-surface text-ink-2'
                  }`}
                >
                  {y.year}
                </button>
              ))}
          </div>
          {detail && <YearDetail year={detail} avgHoursPerYear={total.avgHoursPerYear} />}
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
