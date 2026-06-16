/** SVG-Icons aus dem Mockup, als kleine React-Komponenten. */
import type { SVGProps } from 'react'

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  viewBox: '0 0 24 24',
} as const

export function IconSearch(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  )
}

export function IconChevronRight(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" {...base} {...p}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function IconChevronLeft(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" {...base} strokeWidth={2.2} {...p}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconDashboard(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" {...base} {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

export function IconList(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" {...base} {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export function IconPlus(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" {...base} strokeWidth={2.4} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconEdit(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" {...base} {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function IconSave(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" {...base} {...p}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  )
}

export function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" {...base} strokeWidth={2.5} {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
