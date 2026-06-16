import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Entry, EntryInput } from '../lib/types'

interface UseEntries {
  entries: Entry[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  createEntry: (input: EntryInput) => Promise<Entry>
  updateEntry: (id: string, changes: Partial<EntryInput>) => Promise<Entry>
  deleteEntry: (id: string) => Promise<void>
}

/** Lädt die Einträge und kapselt die CRUD-Mutationen mit lokalem State-Update. */
export function useEntries(): UseEntries {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await api.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const createEntry = useCallback(async (input: EntryInput) => {
    const created = await api.create(input)
    setEntries((prev) => [created, ...prev])
    return created
  }, [])

  const updateEntry = useCallback(async (id: string, changes: Partial<EntryInput>) => {
    const updated = await api.update(id, changes)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    await api.remove(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, loading, error, reload, createEntry, updateEntry, deleteEntry }
}
