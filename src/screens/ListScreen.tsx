import { useMemo, useState } from 'react'
import type { Entry } from '../lib/types'
import { byDateDesc } from '../lib/calc'
import { fmt, formatDateShort, toNum } from '../lib/format'
import { IconChevronRight, IconSearch } from '../components/icons'
import { Eyebrow } from '../components/Eyebrow'

export function ListScreen({
  entries,
  hours,
  consumption,
  onSelect,
}: {
  entries: Entry[]
  /** Stunden je Eintrag (id → number|null) */
  hours: Record<string, number | null>
  /** ≈ l/h Block-Wert je Eintrag (id → number|null) */
  consumption: Record<string, number | null>
  onSelect: (e: Entry) => void
}) {
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<number | 'all'>('all')

  // Distinkte Jahre (absteigend) für die Filter-Chips.
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const e of entries) {
      const y = Number(String(e.date).slice(0, 4))
      if (Number.isFinite(y) && y > 0) set.add(y)
    }
    return [...set].sort((a, b) => b - a)
  }, [entries])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => {
        if (!q) return true
        // Suche über Hafen + paidBy + Datum.
        const hay = `${e.harborFrom} ${e.harborTo} ${e.paidBy} ${formatDateShort(e.date)}`.toLowerCase()
        return hay.includes(q)
      })
      .filter((e) => year === 'all' || Number(String(e.date).slice(0, 4)) === year)
      .sort(byDateDesc)
  }, [entries, query, year])

  return (
    <div>
      <Eyebrow>Logbuch</Eyebrow>

      <label className="mb-3.5 flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-ink-3">
        <IconSearch className="shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hafen, Name oder Datum suchen"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        <YearChip label="Alle" on={year === 'all'} onClick={() => setYear('all')} />
        {years.map((y) => (
          <YearChip key={y} label={String(y)} on={year === y} onClick={() => setYear(y)} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-ink-3">
          {entries.length === 0 ? 'Noch keine Einträge erfasst.' : 'Keine Treffer.'}
        </p>
      ) : (
        visible.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            hours={hours[e.id] ?? null}
            consumptionLh={consumption[e.id] ?? null}
            onClick={() => onSelect(e)}
          />
        ))
      )}
    </div>
  )
}

function YearChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 rounded-full border px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${
        on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2'
      }`}
    >
      {label}
    </button>
  )
}

function EntryCard({
  entry,
  hours,
  consumptionLh,
  onClick,
}: {
  entry: Entry
  hours: number | null
  consumptionLh: number | null
  onClick: () => void
}) {
  const eh = toNum(entry.engineHours)
  return (
    <button
      onClick={onClick}
      className="relative mb-2.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="tabnum mb-1.5 font-mono text-[11px] font-bold tracking-wider text-accent">
        {formatDateShort(entry.date)}
      </div>
      <div className="flex items-center gap-2 font-display text-xl font-semibold leading-tight text-ink">
        {entry.harborFrom}
        {entry.harborTo && entry.harborTo.trim() && (
          <>
            <span className="text-[15px] text-teal">→</span> {entry.harborTo}
          </>
        )}
      </div>
      <div className="tabnum mt-2.5 flex gap-4 font-mono text-xs text-ink-2">
        <span>
          <b className="font-bold text-ink">{fmt(hours)}</b> h
        </span>
        <span>
          Stand <b className="font-bold text-ink">{fmt(eh)}</b>
        </span>
        <span>
          <b className="font-bold text-ink">{consumptionLh === null ? '–' : `≈ ${fmt(consumptionLh)}`}</b> l/h
        </span>
      </div>
      <IconChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </button>
  )
}
