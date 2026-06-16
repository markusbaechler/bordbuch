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

/** "SA 14.06.2026" */
export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${WEEKDAYS_SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** "SAMSTAG · 14.06.2026 · 09:40 – 16:20" */
export function formatDetailDate(startIso: string, endIso: string): string {
  const d = new Date(startIso)
  if (isNaN(d.getTime())) return '—'
  const day = `${WEEKDAYS_LONG[d.getDay()]} · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  return `${day} · ${formatTimeRange(startIso, endIso)}`
}

/** "09:40 – 16:20" */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`
}

/** "09:40" */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--:--'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Zahl mit fixen Nachkommastellen, '—' bei null. */
export function fmt(n: number | null, digits = 1): string {
  return n === null ? '—' : n.toFixed(digits)
}

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" in lokaler Zeit (für <input type=datetime-local>). */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (lokal) → ISO (UTC). Leer/ungültig → ''. */
export function localInputToIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}
