import type { ReactNode } from 'react'
import { IconPlus } from './icons'
import { NAV_ITEMS, isNavActive, type Screen } from './navItems'

export type { Screen }

/** Untere Navigation mit zentralem FAB für „Neu" – nur mobil/Tablet (Desktop: Seitenleiste). */
export function BottomNav({
  active,
  onNavigate,
}: {
  active: Screen
  onNavigate: (s: Screen) => void
}) {
  return (
    <nav className="flex shrink-0 border-t border-line bg-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
      {NAV_ITEMS.map((item) => (
        <NavButton
          key={item.screen}
          label={item.label}
          active={isNavActive(item, active)}
          onClick={() => onNavigate(item.screen)}
          icon={<item.Icon />}
        />
      ))}
      <button
        onClick={() => onNavigate('new')}
        className="mx-1.5 -mt-[22px] flex max-w-[62px] flex-1 flex-col items-center gap-1 rounded-[18px] bg-accent px-0 pb-2 pt-[11px] text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(28,92,140,.4)]"
      >
        <IconPlus className="mb-px" />
        Neu
      </button>
    </nav>
  )
}

function NavButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-[7px] text-[11px] font-semibold ${
        active ? 'text-accent' : 'text-ink-3'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
