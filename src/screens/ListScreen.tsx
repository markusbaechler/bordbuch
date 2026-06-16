import { useMemo, useState } from 'react'
import type { Trip } from '../lib/types'
import { byStartDesc, operatingHours, travelHours, type TripConsumption } from '../lib/calc'
import { fmt, formatDateShort } from '../lib/format'
import { IconChevronRight, IconSearch } from '../components/icons'

type Filter = 'all' | 'month' | 'guests'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'month', label: 'Dieser Monat' },
  { key: 'guests', label: 'Mit Crew' },
]

function matchesSearch(t: Trip, q: string): boolean {
  if (!q) return true
  const hay = `${t.harborFrom} ${t.harborTo} ${t.crew} ${formatDateShort(t.startTime)}`.toLowerCase()
  return hay.includes(q.toLowerCase())
}

function inThisMonth(t: Trip): boolean {
  const d = new Date(t.startTime)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export function ListScreen({
  trips,
  consumption,
  onSelect,
}: {
  trips: Trip[]
  consumption: Record<string, TripConsumption>
  onSelect: (t: Trip) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    return trips
      .filter((t) => matchesSearch(t, query))
      .filter((t) => {
        if (filter === 'month') return inThisMonth(t)
        if (filter === 'guests') return Boolean(t.crew && t.crew.trim())
        return true
      })
      .sort(byStartDesc)
  }, [trips, query, filter])

  return (
    <div>
      <Eyebrow>Logbuch</Eyebrow>

      <label className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-ink-3">
        <IconSearch className="shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hafen, Crew oder Datum suchen"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={`min-h-11 rounded-full border px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${
                on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-ink-3">
          {trips.length === 0 ? 'Noch keine Törns erfasst.' : 'Keine Treffer.'}
        </p>
      ) : (
        visible.map((t) => (
          <TripCard
            key={t.id}
            trip={t}
            consumption={consumption[t.id]}
            onClick={() => onSelect(t)}
          />
        ))
      )}
    </div>
  )
}

function TripCard({
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
  // Nur der echte Block-Wert kommt in die Kachel; Saison-Platzhalter → „–".
  const blockLh =
    consumption?.source === 'block' && consumption.lh !== null ? consumption.lh : null
  return (
    <button
      onClick={onClick}
      className="relative mb-2.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
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
      {trip.crew && trip.crew.trim() && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">⚓ {trip.crew}</div>
      )}
      <IconChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </button>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-2">
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
