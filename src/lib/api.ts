/**
 * API-Client gegen die Apps-Script-Web-App.
 * Dünner Wrapper über das { ok, data, error }-Envelope (CLAUDE.md §3/§8).
 *
 * CORS-/Apps-Script-Eigenheiten (siehe Vorgaben):
 *  1. KEIN mode:'no-cors' – sonst ist die Antwort opaque und nicht lesbar.
 *  2. POST: einziger Header ist Content-Type: text/plain. Jeder weitere Header
 *     (application/json, Authorization …) löst einen Preflight aus, den Apps
 *     Script nicht beantwortet. Body ist trotzdem ein JSON-String.
 *  3. redirect NICHT auf 'manual' – fetch muss dem 302 → googleusercontent folgen
 *     (Standardverhalten, daher hier nicht überschrieben).
 *  4. Antwort immer als { ok, data, error } parsen; bei ok:false werfen.
 *  5. Token: list via Query-Param, Schreib-Aktionen im JSON-Body.
 */

import { env, isConfigured } from './env'
import type { ApiEnvelope, Trip, TripInput } from './types'

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

/** id kommt aus dem Sheet mal als Zahl, mal als String → immer auf String normalisieren. */
function normalizeTrip(t: Trip): Trip {
  return { ...t, id: String(t.id) }
}

/** GET ?action=list&token=… → Trip[] */
export async function list(): Promise<Trip[]> {
  assertConfigured()
  const url = `${env.apiUrl}?action=list&token=${encodeURIComponent(env.apiToken)}`
  const res = await fetch(url, { method: 'GET' })
  const data = await parseEnvelope<Trip[]>(res)
  return data.map(normalizeTrip)
}

/**
 * Gemeinsamer POST für create/update/delete.
 * Body = JSON-String mit token + action + Feldern. Einziger Header: text/plain.
 */
async function post<T>(action: WriteAction, payload: Record<string, unknown>): Promise<T> {
  assertConfigured()
  const res = await fetch(env.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: env.apiToken, action, ...payload }),
  })
  return parseEnvelope<T>(res)
}

export async function create(input: TripInput): Promise<Trip> {
  return normalizeTrip(await post<Trip>('create', input))
}

export async function update(id: string, changes: Partial<TripInput>): Promise<Trip> {
  return normalizeTrip(await post<Trip>('update', { id, ...changes }))
}

export function remove(id: string): Promise<{ id: string; deleted: true }> {
  return post<{ id: string; deleted: true }>('delete', { id })
}

export const api = { list, create, update, remove }
