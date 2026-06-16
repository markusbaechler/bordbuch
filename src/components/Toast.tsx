import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { IconCheck } from './icons'

type ToastKind = 'success' | 'error'
interface ToastState {
  msg: string
  kind: ToastKind
  shown: boolean
}

interface ToastApi {
  success: (msg: string) => void
  error: (msg: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Globaler Toast: Erfolg (grün) / Fehler (orange), auto-hide nach 2.4 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ msg: '', kind: 'success', shown: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback((msg: string, kind: ToastKind) => {
    setState({ msg, kind, shown: true })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState((s) => ({ ...s, shown: false })), 2400)
  }, [])

  const api = useRef<ToastApi>({
    success: (m) => fire(m, 'success'),
    error: (m) => fire(m, 'error'),
  }).current

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={`pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-[360px] items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition-all duration-300 ${
          state.shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
        style={{ background: state.kind === 'error' ? 'var(--accent)' : 'var(--good)' }}
        role="alert"
      >
        {state.kind === 'success' && <IconCheck className="shrink-0" />}
        <span>{state.msg}</span>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast muss innerhalb von ToastProvider verwendet werden')
  return ctx
}
