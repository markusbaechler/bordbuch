import type { ReactNode } from 'react'

/** Abschnitts-Überschrift im Instrument-Look: Label + dünne Linie. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-2">
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
