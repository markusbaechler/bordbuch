import { IconPlus } from './icons'
import { BOAT_PROFILE } from '../lib/boat'
import { NAV_ITEMS, isNavActive, type Screen } from './navItems'

/** Navigations-Seitenleiste – nur Desktop (≥ lg). Mobil übernimmt die Bottom-Nav. */
export function SideNav({
  active,
  onNavigate,
}: {
  active: Screen
  onNavigate: (s: Screen) => void
}) {
  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
      {/* Marke + Boot */}
      <div className="mb-7 px-2">
        <div className="font-display text-[22px] font-bold uppercase tracking-[0.14em] text-ink">
          Bordbuch
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] tracking-wide text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_0_3px_var(--teal-soft)]" />
          {BOAT_PROFILE.shortName} · {BOAT_PROFILE.location}
        </div>
      </div>

      {/* Bereiche */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const on = isNavActive(item, active)
          return (
            <button
              key={item.screen}
              onClick={() => onNavigate(item.screen)}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                on ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              <item.Icon />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Neuer Eintrag */}
      <button
        onClick={() => onNavigate('new')}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-accent px-3 py-2.5 text-[14px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        <IconPlus />
        Neuer Eintrag
      </button>
    </aside>
  )
}
