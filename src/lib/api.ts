/**
 * API-Client gegen die Apps-Script-Web-App.
 * Dünner Wrapper über das { ok, data, error }-Envelope (CLAUDE.md §3/§8).
 *
 * CORS-/Apps-Script-Eigenheiten (siehe Vorgaben):
 *  1. KEIN mode:'no-cors' – sonst ist die Antwort opaque und nicht lesbar.
 *  2. POST: einziger Header ist Content-Type: text/plain. Jeder weitere Header
 *     (application/json, Authorization …) löst einen Preflight aus, den Apps
 *     Script nicht beantwortet. Body ist trotzdem ein JSON-String.
 *  3. redirect NICHT auf 'manual' – fetch muss dem 302 → googleusercontent folgen.
 *  4. Antwort immer als { ok, data, error } parsen; bei ok:false werfen.
 *  5. Token: list via Query-Param, Schreib-Aktionen im JSON-Body.
 */

import { env, isConfigured } from './env'
import type { ApiEnvelope, Entry, EntryInput } from './types'

type WriteAction = 'create' | 'update' | 'delete'

/** Wirft, wenn die App ohne Konfiguration läuft – die UI fängt das als Toast ab. */
function assertConfigured() {
  if (!isConfigured) {
    throw new Error('API nicht konfiguriert – VITE_API_URL und VITE_API_TOKEN fehlen.')
  }
}

/** Liest das Envelope aus einer Response; wirft bei HTTP- oder ok:false-Fehlern. */
async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Netzwerkfehler ${res.status} ${res.statusText}`)
  }
  let body: ApiEnvelope<T>
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new Error('Antwort konnte nicht gelesen werden (kein JSON).')
  }
  if (!body.ok) {
    throw new Error(body.error || 'Unbekannter Fehler vom Server.')
  }
  return body.data as T
}

/** String-Feld: nie undefined/Zahl an .trim()/.split() geben. */
function asString(v: unknown): string {
  return String(v ?? '')
}

/** Zahl-Feld: leer/"" → null, sonst Number(v); NaN → null. */
function asNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Sheet liefert Felder mal als Zahl, mal als String, mal leer. Hier konsequent
 * auf den Zieltyp casten, damit die UI nie z. B. .trim() auf einer Zahl aufruft.
 */
function normalizeEntry(raw: Record<string, unknown>): Entry {
  return {
    id: asString(raw.id),
    createdAt: asString(raw.createdAt),
    updatedAt: asString(raw.updatedAt),
    date: asString(raw.date),
    harborFrom: asString(raw.harborFrom),
    harborTo: asString(raw.harborTo),
    engineHours: asNumber(raw.engineHours),
    fuelLiters: asNumber(raw.fuelLiters),
    fuelCostChf: asNumber(raw.fuelCostChf),
    paidBy: asString(raw.paidBy),
    notes: asString(raw.notes),
    weatherTempC: asNumber(raw.weatherTempC),
    weatherWindKn: asNumber(raw.weatherWindKn),
    weatherWindDir: asNumber(raw.weatherWindDir),
    weatherDesc: asString(raw.weatherDesc),
  }
}

/** GET ?action=list&token=… → Entry[] */
export async function list(): Promise<Entry[]> {
  assertConfigured()
  const url = `${env.apiUrl}?action=list&token=${encodeURIComponent(env.apiToken)}`
  const res = await fetch(url, { method: 'GET' })
  const data = await parseEnvelope<Record<string, unknown>[]>(res)
  return data.map(normalizeEntry)
}

/**
 * Gemeinsamer POST für create/update/delete.
 * Body = JSON-String mit token + action + Feldern. Einziger Header: text/plain.
 */
async function post<T>(action: WriteAction, payload: object): Promise<T> {
  assertConfigured()
  const res = await fetch(env.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: env.apiToken, action, ...payload }),
  })
  return parseEnvelope<T>(res)
}

export async function create(input: EntryInput): Promise<Entry> {
  return normalizeEntry(await post<Record<string, unknown>>('create', input))
}

export async function update(id: string, changes: Partial<EntryInput>): Promise<Entry> {
  return normalizeEntry(await post<Record<string, unknown>>('update', { id, ...changes }))
}

export function remove(id: string): Promise<{ id: string; deleted: true }> {
  return post<{ id: string; deleted: true }>('delete', { id })
}

export const api = { list, create, update, remove }
