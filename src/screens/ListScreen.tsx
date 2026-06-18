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

  // Distinkte Jahre (absteigend) für den Jahr-Filter.
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

      <div className="mb-4 flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
            Jahr
          </span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Nach Jahr filtern"
            className="tabnum min-h-9 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[13px] font-bold text-ink"
          >
            <option value="all">Alle</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <span className="tabnum font-mono text-[11px] text-ink-3">
          {visible.length} {visible.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
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
