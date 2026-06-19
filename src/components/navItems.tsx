import type { SVGProps, ComponentType } from 'react'
import { IconDashboard, IconList } from './icons'

// Gemeinsames Navigations-Modell für Bottom-Nav (mobil) und Seitenleiste (Desktop).
export type Screen = 'conditions' | 'map' | 'dash' | 'list' | 'detail' | 'new'

/** Kompass-Icon für den „Wetter"-Tab. */
export function IconCompass(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,7 14.5,14.5 12,13 9.5,14.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Karten-Pin-Icon für den „Karte"-Tab. */
export function IconMap(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" {...p}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export interface NavItem {
  screen: Screen
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Weitere Screens, die diesen Tab als aktiv markieren (z. B. Detail → Logbuch). */
  extra?: Screen[]
}

export const NAV_ITEMS: NavItem[] = [
  { screen: 'conditions', label: 'Wetter', Icon: IconCompass },
  { screen: 'map', label: 'Karte', Icon: IconMap },
  { screen: 'dash', label: 'Bordbuch', Icon: IconDashboard },
  { screen: 'list', label: 'Logbuch', Icon: IconList, extra: ['detail'] },
]

export function isNavActive(item: NavItem, active: Screen): boolean {
  return active === item.screen || (item.extra?.includes(active) ?? false)
}
