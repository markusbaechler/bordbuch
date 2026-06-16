/**
 * Datenmodell v2 – exakt die Sheet-Spalten (CLAUDE.md §4), nach `normalizeEntry`.
 * String-Felder sind IMMER string, Zahl-Felder IMMER number|null (nie "" oder string).
 * Damit sind .trim()/.split()/Arithmetik in der UI sicher, egal was das Sheet liefert.
 */
export interface Entry {
  // Vom Backend vergeben
  id: string
  createdAt: string // ISO-Datetime
  updatedAt: string // ISO-Datetime
  // Vom User erfasst
  date: string // ISO-Datum YYYY-MM-DD
  harborFrom: string
  harborTo: string // Freitext, optional
  engineHours: number | null // Zählerstand bei Start
  fuelLiters: number | null // nur bei Tankstopp
  fuelCostChf: number | null // nur bei Tankstopp
  paidBy: string // "Bezahlt durch"
  notes: string // "Benutzung"
  // Vom Backend automatisch (nur anzeigen)
  weatherTempC: number | null
  weatherWindKn: number | null
  weatherWindDir: number | null // Grad (0–360)
  weatherDesc: string
}

/**
 * Felder, die der Client schreiben darf (USER_FIELDS im Backend).
 * Eigenständig getypt: Tank-Felder dürfen "" sein (= „nicht erfasst" ans Backend).
 */
export interface EntryInput {
  date: string
  harborFrom: string
  harborTo: string
  engineHours: number
  fuelLiters: number | ''
  fuelCostChf: number | ''
  paidBy: string
  notes: string
}

/** Einheitliches Antwort-Envelope des Backends. */
export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}
