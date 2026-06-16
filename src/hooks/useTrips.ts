import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Trip, TripInput } from '../lib/types'

interface UseTrips {
  trips: Trip[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  createTrip: (input: TripInput) => Promise<Trip>
  updateTrip: (id: string, changes: Partial<TripInput>) => Promise<Trip>
  deleteTrip: (id: string) => Promise<void>
}

/** Lädt die Törns und kapselt die CRUD-Mutationen mit lokalem State-Update. */
export function useTrips(): UseTrips {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTrips(await api.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const createTrip = useCallback(async (input: TripInput) => {
    const created = await api.create(input)
    setTrips((prev) => [created, ...prev])
    return created
  }, [])

  const updateTrip = useCallback(async (id: string, changes: Partial<TripInput>) => {
    const updated = await api.update(id, changes)
    setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const deleteTrip = useCallback(async (id: string) => {
    await api.remove(id)
    setTrips((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { trips, loading, error, reload, createTrip, updateTrip, deleteTrip }
}
