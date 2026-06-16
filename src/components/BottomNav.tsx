import { IconDashboard, IconList, IconPlus } from './icons'

export type Screen = 'dash' | 'list' | 'detail' | 'new'

/** Untere Navigation mit zentralem FAB für „Neu". */
export function BottomNav({
  active,
  onNavigate,
}: {
  active: Screen
  onNavigate: (s: Screen) => void
}) {
  return (
    <nav className="flex border-t border-line bg-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <NavButton
        label="Dashboard"
        active={active === 'dash'}
        onClick={() => onNavigate('dash')}
        icon={<IconDashboard />}
      />
      <NavButton
        label="Logbuch"
        active={active === 'list' || active === 'detail'}
        onClick={() => onNavigate('list')}
        icon={<IconList />}
      />
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
  icon: React.ReactNode
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
