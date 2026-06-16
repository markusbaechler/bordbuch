import type { Trip } from '../lib/types'
import { operatingHours, travelHours } from '../lib/calc'
import { fmt, formatDetailDate, toNum } from '../lib/format'
import { IconChevronLeft, IconEdit } from '../components/icons'

export function DetailScreen({
  trip,
  consumptionLh,
  onBack,
  onEdit,
  onDelete,
}: {
  trip: Trip
  /** geschätzter Verbrauch l/h aus dem Tank-Block (kann null sein) */
  consumptionLh: number | null
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const motor = operatingHours(trip)
  const fahrt = travelHours(trip)
  const liters = toNum(trip.fuelLiters)
  const cost = toNum(trip.fuelCostChf)
  const tempC = toNum(trip.weatherTempC)
  const windKn = toNum(trip.weatherWindKn)

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"
      >
        <IconChevronLeft />
        Logbuch
      </button>

      <div className="mb-1.5 flex flex-wrap items-center gap-2.5 font-display text-3xl font-bold leading-tight text-ink">
        {trip.harborFrom} <span className="text-teal">→</span> {trip.harborTo}
      </div>
      <div className="tabnum mb-5 font-mono text-xs font-bold tracking-wide text-accent">
        {formatDetailDate(trip.startTime, trip.endTime)}
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Cell k="Fahrzeit" v={fmt(fahrt)} unit="h" />
        <Cell k="Betriebsstunden" v={fmt(motor)} unit="h" />
        <Cell k="Betriebsst. Start" v={fmt(toNum(trip.engineHoursStart))} unit="h" />
        <Cell k="Betriebsst. Ende" v={fmt(toNum(trip.engineHoursEnd))} unit="h" />
        <Cell k="Treibstoff" v={liters === null ? '—' : fmt(liters)} unit="l" />
        <Cell k="Kosten" v={cost === null ? '—' : fmt(cost, 2)} unit="CHF" />
        <Cell
          k="Ø Verbrauch (Schätzung)"
          v={consumptionLh === null ? '—' : `≈ ${fmt(consumptionLh)}`}
          unit="l/h"
        />
        <Cell
          k="Wetter"
          v={tempC === null ? '—' : fmt(tempC)}
          unit="°C"
          sub={
            trip.weatherDesc || windKn !== null
              ? `${trip.weatherDesc}${windKn !== null ? ` · ${fmt(windKn)} kn` : ''}`
              : undefined
          }
        />
      </div>

      {trip.crew && trip.crew.trim() && (
        <div className="mb-3 flex items-center gap-1.5 text-[12px] text-ink-3">⚓ {trip.crew}</div>
      )}

      {trip.notes && trip.notes.trim() && (
        <div className="mb-[18px] rounded-xl bg-teal-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-teal">
            Bemerkung
          </div>
          {trip.notes}
        </div>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white"
        >
          <IconEdit />
          Bearbeiten
        </button>
        <button
          onClick={onDelete}
          className="flex flex-1 items-center justify-center rounded-xl border border-line bg-transparent px-4 py-3.5 text-sm font-semibold text-danger"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}

function Cell({ k, v, unit, sub }: { k: string; v: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {k}
      </div>
      <div className="tabnum font-mono text-[19px] font-bold text-ink">
        {v}
        {unit && <small className="ml-1 text-[11px] font-medium text-ink-2">{unit}</small>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}
