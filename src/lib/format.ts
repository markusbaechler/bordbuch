/** Anzeige-Formatierung (de-CH). Nichts hiervon wird gespeichert. */

const WEEKDAYS_SHORT = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']
const WEEKDAYS_LONG = [
  'SONNTAG',
  'MONTAG',
  'DIENSTAG',
  'MITTWOCH',
  'DONNERSTAG',
  'FREITAG',
  'SAMSTAG',
]

/** Robuste Zahl-Konvertierung – Sheet liefert mal number, mal string, mal ''. */
export function toNum(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** YYYY-MM-DD → lokales Date (Mitternacht). Ungültig → null. */
function parseLocalDate(date: string): Date | null {
  const s = String(date).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/** "SA 14.06.2026" */
export function formatDateShort(date: string): string {
  const d = parseLocalDate(date)
  if (!d) return '—'
  return `${WEEKDAYS_SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** "SAMSTAG · 14.06.2026" */
export function formatDateLong(date: string): string {
  const d = parseLocalDate(date)
  if (!d) return '—'
  return `${WEEKDAYS_LONG[d.getDay()]} · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** Zahl mit fixen Nachkommastellen, '–' bei null. */
export function fmt(n: number | null, digits = 1): string {
  return n === null ? '–' : n.toFixed(digits)
}

/** Windrichtung Grad → 8-Punkt-Kompass. Leer/ungültig → ''. */
export function compass(dir: unknown): string {
  const n = toNum(dir)
  if (n === null) return ''
  const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return pts[((Math.round(n / 45) % 8) + 8) % 8]
}

/** Wind als "8 kn SW" bzw. "8 kn" (ohne Richtung) bzw. "–" (kein Wert). */
export function formatWind(kn: unknown, dir: unknown): string {
  const k = toNum(kn)
  if (k === null) return '–'
  const c = compass(dir)
  return c ? `${fmt(k, 0)} kn ${c}` : `${fmt(k, 0)} kn`
}
