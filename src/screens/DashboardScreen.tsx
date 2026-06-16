import { useMemo } from 'react'
import type { Trip } from '../lib/types'
import { byStartDesc, operatingHours, seasonStats, travelHours, type TripConsumption } from '../lib/calc'
import { fmt, formatDateShort } from '../lib/format'
import { IconChevronRight } from '../components/icons'
import { Eyebrow } from './ListScreen'

export function DashboardScreen({
  trips,
  consumption,
  onSelect,
}: {
  trips: Trip[]
  consumption: Record<string, TripConsumption>
  onSelect: (t: Trip) => void
}) {
  const stats = useMemo(() => seasonStats(trips), [trips])
  const latest = useMemo(() => [...trips].sort(byStartDesc)[0] ?? null, [trips])
  const year = new Date().getFullYear()

  return (
    <div>
      <Eyebrow>Saison {year}</Eyebrow>

      <div className="mb-[22px] grid grid-cols-2 gap-[11px]">
        {/* Signature-Kachel: kleines Label, grosse Mono-Zahl, Akzentlinie oben. */}
        <Gauge
          label="Treibstoffkosten"
          value={stats.totalFuelCostChf > 0 ? fmt(stats.totalFuelCostChf, 0) : '0'}
          unit="CHF"
          tick={stats.avgPriceChfPerL !== null ? `Ø ${fmt(stats.avgPriceChfPerL, 2)} CHF/l` : '—'}
          hot
        />
        <Gauge
          label="Betriebsstunden"
          value={fmt(stats.totalOperatingHours)}
          unit="h"
          tick="motor"
        />
        <Gauge
          label="Ø Verbrauch"
          value={stats.avgConsumptionLh === null ? '—' : fmt(stats.avgConsumptionLh)}
          unit="l/h"
          tick="berechnet"
        />
        <Gauge label="Törns" value={String(stats.tripCount)} tick="diese saison" />
      </div>

      {stats.costPerHourChf !== null && (
        <div className="mb-[22px] flex items-center justify-between rounded-xl bg-teal-soft px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal">
            Kosten je Betriebsstunde
          </span>
          <span className="tabnum font-mono text-[17px] font-bold text-ink">
            {fmt(stats.costPerHourChf, 2)} <span className="text-[11px] text-ink-2">CHF/h</span>
          </span>
        </div>
      )}

      {latest && (
        <>
          <Eyebrow>Letzte Fahrt</Eyebrow>
          <LastTrip
            trip={latest}
            consumption={consumption[latest.id]}
            onClick={() => onSelect(latest)}
          />
        </>
      )}
    </div>
  )
}

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
        style={{
          background: `linear-gradient(90deg, var(${hot ? '--accent' : '--teal'}), transparent)`,
        }}
      />
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
        {label}
      </div>
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

function LastTrip({
  trip,
  consumption,
  onClick,
}: {
  trip: Trip
  consumption?: TripConsumption
  onClick: () => void
}) {
  const motor = operatingHours(trip)
  const fahrt = travelHours(trip)
  const blockLh =
    consumption?.source === 'block' && consumption.lh !== null ? consumption.lh : null
  return (
    <button
      onClick={onClick}
      className="relative block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="tabnum mb-1.5 font-mono text-[11px] font-bold tracking-wider text-accent">
        {formatDateShort(trip.startTime)}
      </div>
      <div className="flex items-center gap-2 font-display text-xl font-semibold leading-tight text-ink">
        {trip.harborFrom} <span className="text-[15px] text-teal">→</span> {trip.harborTo}
      </div>
      <div className="tabnum mt-2.5 flex gap-4 font-mono text-xs text-ink-2">
        <span>
          <b className="font-bold text-ink">{fmt(motor)}</b> h Motor
        </span>
        <span>
          <b className="font-bold text-ink">{fmt(fahrt)}</b> h Fahrt
        </span>
        <span>
          <b className="font-bold text-ink">{blockLh === null ? '–' : `≈ ${fmt(blockLh)}`}</b> l/h
        </span>
      </div>
      <IconChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </button>
  )
}
