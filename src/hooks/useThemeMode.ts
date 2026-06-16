import { useCallback, useState } from 'react'

export type Mode = 'day' | 'night'
const STORAGE_KEY = 'bordbuch-mode'

/** Aktuellen Modus vom <html> lesen (wird per Inline-Skript früh gesetzt → kein FOUC). */
function currentMode(): Mode {
  return document.documentElement.dataset.mode === 'night' ? 'night' : 'day'
}

/**
 * Tag/Nacht-Umschaltung mit Persistenz.
 * Initialwert kommt aus dem Inline-Skript in index.html (localStorage →
 * prefers-color-scheme). Hier wird nur umgeschaltet und gespeichert.
 */
export function useThemeMode() {
  const [mode, setMode] = useState<Mode>(currentMode)

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: Mode = prev === 'night' ? 'day' : 'night'
      document.documentElement.dataset.mode = next
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* localStorage kann blockiert sein (privater Modus) – Umschalten klappt trotzdem. */
      }
      return next
    })
  }, [])

  return { mode, toggle }
}
