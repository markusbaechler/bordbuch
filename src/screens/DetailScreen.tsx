import type { Entry } from '../lib/types'
import { fmt, formatDateLong, formatWind, toNum } from '../lib/format'
import { IconChevronLeft, IconEdit } from '../components/icons'
import { Eyebrow } from '../components/Eyebrow'

export function DetailScreen({
  entry,
  hours,
  hoursSinceStart,
  consumptionLh,
  onBack,
  onEdit,
  onDelete,
}: {
  entry: Entry
  /** Stunden dieses Eintrags (number|null) */
  hours: number | null
  /** h seit Start (number|null) */
  hoursSinceStart: number | null
  /** ≈ l/h Block-Wert (number|null) */
  consumptionLh: number | null
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const eh = toNum(entry.engineHours)
  const liters = toNum(entry.fuelLiters)
  const cost = toNum(entry.fuelCostChf)
  const tempC = toNum(entry.weatherTempC)
  const hasTankstop = liters !== null || cost !== null || (entry.paidBy && entry.paidBy.trim())

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-ink-2"
      >
        <IconChevronLeft />
        Logbuch
      </button>

      <div className="mb-1.5 flex flex-wrap items-center gap-2.5 font-display text-3xl font-bold leading-tight text-ink">
        {entry.harborFrom}
        {entry.harborTo && entry.harborTo.trim() && (
          <>
            <span className="text-teal">→</span> {entry.harborTo}
          </>
        )}
      </div>
      <div className="tabnum mb-5 font-mono text-xs font-bold tracking-wide text-accent">
        {formatDateLong(entry.date)}
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Cell k="Zählerstand" v={fmt(eh)} unit="h" />
        <Cell k="Stunden dieser Eintrag" v={fmt(hours)} unit="h" />
        <Cell k="h seit Start" v={fmt(hoursSinceStart)} unit="h" />
        <Cell
          k="Ø Verbrauch (Schätzung)"
          v={consumptionLh === null ? '–' : `≈ ${fmt(consumptionLh)}`}
          unit="l/h"
        />
      </div>

      {hasTankstop && (
        <>
          <Eyebrow>Tankstopp</Eyebrow>
          <div className="mb-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Cell k="Treibstoff" v={liters === null ? '–' : fmt(liters)} unit="l" />
            <Cell k="Kosten" v={cost === null ? '–' : fmt(cost, 2)} unit="CHF" />
            {entry.paidBy && entry.paidBy.trim() && (
              <Cell k="Bezahlt durch" v={entry.paidBy} full />
            )}
          </div>
        </>
      )}

      <Eyebrow>Wetter</Eyebrow>
      <div className="mb-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Cell k="Temperatur" v={tempC === null ? '–' : fmt(tempC)} unit="°C" />
        <Cell k="Wind" v={formatWind(entry.weatherWindKn, entry.weatherWindDir)} />
        <Cell k="Wetterlage" v={entry.weatherDesc?.trim() || '–'} full />
      </div>

      {entry.notes && entry.notes.trim() && (
        <div className="mb-[18px] rounded-xl bg-teal-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-teal">
            Benutzung / Bemerkung
          </div>
          {entry.notes}
        </div>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onEdit}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white"
        >
          <IconEdit />
          Bearbeiten
        </button>
        <button
          onClick={onDelete}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-transparent px-4 py-3.5 text-sm font-semibold text-danger"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}

function Cell({
  k,
  v,
  unit,
  full,
}: {
  k: string
  v: string
  unit?: string
  /** über beide Spalten */
  full?: boolean
}) {
  return (
    <div className={`bg-surface px-4 py-3.5 ${full ? 'col-span-2' : ''}`}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {k}
      </div>
      <div className="tabnum font-mono text-[19px] font-bold text-ink">
        {v}
        {unit && <small className="ml-1 text-[11px] font-medium text-ink-2">{unit}</small>}
      </div>
    </div>
  )
}
