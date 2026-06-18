import { useCallback, useState } from 'react'

// Manuell gesetzte „zuletzt erledigt"-Daten je Wartungsposition. Schlüssel =
// item.key (siehe MAINTENANCE_SCHEDULE), Wert = "YYYY-MM" (Monat/Jahr-Granularität).
// Bewusst lokal (localStorage), weil das Sheet-Backend fix ist (CLAUDE.md §3/§4) –
// Service-Daten sind Geräte-/Nutzersache, kein Logbuch-Feld.
export type MaintOverrides = Record<string, string>

const STORAGE_KEY = 'bordbuch-maintenance-v1'

function load(): MaintOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw) as unknown
    return obj && typeof obj === 'object' ? (obj as MaintOverrides) : {}
  } catch {
    return {}
  }
}

/** Liest/schreibt die manuellen Service-Daten. `set(key, null)` löscht (→ zurück auf Auto). */
export function useMaintenanceLog() {
  const [overrides, setOverrides] = useState<MaintOverrides>(load)

  const set = useCallback((key: string, value: string | null) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* localStorage kann blockiert sein – Anzeige funktioniert trotzdem für diese Sitzung. */
      }
      return next
    })
  }, [])

  return { overrides, set }
}
