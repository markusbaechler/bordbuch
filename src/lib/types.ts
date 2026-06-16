/** Datenmodell v2 – exakt die Sheet-Spalten (CLAUDE.md §4). Reihenfolge = Header. */
export interface Entry {
  // Vom Backend vergeben
  id: string
  createdAt: string // ISO-Datetime
  updatedAt: string // ISO-Datetime
  // Vom User erfasst
  date: string // ISO-Datum YYYY-MM-DD (Pflicht)
  harborFrom: string // Pflicht (Default "Ascona, Porto Patriziale")
  harborTo: string // Freitext, optional
  engineHours: number // Zählerstand bei Start, EIN Wert (Pflicht)
  fuelLiters: number | '' // nur bei Tankstopp
  fuelCostChf: number | '' // nur bei Tankstopp
  paidBy: string // "Bezahlt durch"
  notes: string // "Benutzung"
  // Vom Backend automatisch (nur anzeigen)
  weatherTempC: number | ''
  weatherWindKn: number | ''
  weatherWindDir: number | '' // Grad (0–360, meteorologisch: woher der Wind kommt)
  weatherDesc: string
}

/** Felder, die der Client schreiben darf (USER_FIELDS im Backend). */
export type EntryInput = Pick<
  Entry,
  | 'date'
  | 'harborFrom'
  | 'harborTo'
  | 'engineHours'
  | 'fuelLiters'
  | 'fuelCostChf'
  | 'paidBy'
  | 'notes'
>

/** Einheitliches Antwort-Envelope des Backends. */
export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}
