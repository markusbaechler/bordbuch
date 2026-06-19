// src/hooks/useWakeLock.ts
// Hält den Bildschirm wach (Screen Wake Lock API), solange `active` true ist –
// nötig für die Ankerwache: GPS + Alarm laufen im Web nur zuverlässig, solange
// der Bildschirm an bleibt. Das Lock geht beim Wegschalten verloren → beim
// Zurückkehren neu anfordern. Ohne Wake-Lock-API ist es ein No-op (die Wache
// läuft trotzdem, nur ohne Bildschirm-an-Garantie).

import { useEffect } from 'react'

type WakeLockSentinelLike = { release: () => Promise<void> }

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen')
      } catch {
        // z. B. wenn der Tab gerade nicht sichtbar ist – beim Re-Show erneut.
      }
    }
    const onVisibility = () => {
      if (!cancelled && !document.hidden) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => undefined)
      sentinel = null
    }
  }, [active])
}
