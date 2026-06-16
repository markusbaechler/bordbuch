/** Datenmodell – exakt die Sheet-Spalten (CLAUDE.md §4). Reihenfolge = Header. */
export interface Trip {
  // Vom Backend vergeben
  id: string
  createdAt: string // ISO-Datetime
  updatedAt: string // ISO-Datetime
  // Vom User erfasst
  startTime: string // ISO-Datetime (Pflicht)
  endTime: string // ISO-Datetime (Pflicht)
  harborFrom: string // Pflicht
  harborTo: string // Pflicht
  engineHoursStart: number // Pflicht
  engineHoursEnd: number // Pflicht
  fuelLiters: number | '' // nur bei Tankstopp
  fuelCostChf: number | '' // nur bei Tankstopp
  crew: string // kommagetrennt
  notes: string
  // Vom Backend automatisch (nur anzeigen)
  weatherTempC: number | ''
  weatherWindKn: number | ''
  weatherDesc: string
}

/** Felder, die der Client schreiben darf (USER_FIELDS im Backend). */
export type TripInput = Pick<
  Trip,
  | 'startTime'
  | 'endTime'
  | 'harborFrom'
  | 'harborTo'
  | 'engineHoursStart'
  | 'engineHoursEnd'
  | 'fuelLiters'
  | 'fuelCostChf'
  | 'crew'
  | 'notes'
>

/** Einheitliches Antwort-Envelope des Backends. */
export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}
