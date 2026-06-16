/**
 * Zentrales, getyptes Env-Handling.
 * Werte kommen aus VITE_*-Variablen (lokal .env, im Build GitHub-Secrets).
 * Niemals hartkodieren – siehe CLAUDE.md §8/§13.
 */

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? ''
const API_TOKEN = import.meta.env.VITE_API_TOKEN?.trim() ?? ''

/** true, wenn beide Pflicht-Variablen gesetzt sind. */
export const isConfigured = Boolean(API_URL && API_TOKEN)

export const env = {
  apiUrl: API_URL,
  apiToken: API_TOKEN,
} as const
