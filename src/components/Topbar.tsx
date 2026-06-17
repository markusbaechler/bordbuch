/** Bootsname + Standort – hier zentral änderbar. */
const BOAT = { name: 'Regal', location: 'Ascona · Lago Maggiore' } as const

/** Kopfzeile: Markenname + Tag/Nacht-Umschalter (echtes Feature, CLAUDE.md §7). */
export function Topbar({
  mode,
  onToggleMode,
}: {
  mode: 'day' | 'night'
  onToggleMode: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-[18px] pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex-1 leading-none">
        <div className="font-display text-[21px] font-bold tracking-[0.14em] text-ink">
          BORDBUCH
        </div>
        <div className="mt-[3px] flex items-center gap-1.5 text-[11px] tracking-wide text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_0_3px_var(--teal-soft)]" />
          {BOAT.name} · {BOAT.location}
        </div>
      </div>
      <button
        onClick={onToggleMode}
        className="flex gap-0.5 rounded-full border border-line bg-surface-2 p-1.5"
        aria-label={`Auf ${mode === 'night' ? 'Tag' : 'Nacht'} umschalten`}
        aria-pressed={mode === 'night'}
      >
        <span
          className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold ${
            mode === 'day' ? 'bg-accent text-white' : 'text-ink-3'
          }`}
        >
          ☀ Tag
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold ${
            mode === 'night' ? 'bg-teal text-[#04101A]' : 'text-ink-3'
          }`}
        >
          ☾ Nacht
        </span>
      </button>
    </div>
  )
}
