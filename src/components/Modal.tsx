// src/components/Modal.tsx
// Wiederverwendbares Overlay (Backdrop + Schliessen). Tag/Nacht über Tokens.
// Schliessbar per Backdrop-Klick und Escape; sperrt den Body-Scroll solange offen.

import { useEffect, type ReactNode } from 'react'

const COND = "'Barlow Condensed', sans-serif"

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold leading-tight text-ink" style={{ fontFamily: COND }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Schliessen"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] text-ink-2 hover:bg-surface-2"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
