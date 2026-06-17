// src/hooks/usePois.ts
// Lädt die OSM-POIs einmalig (gecacht in mapData) und stellt Lade-/Fehlerzustand
// bereit. Bewusst schlank: die Region ist fix, Caching passiert in fetchPois.

import { useEffect, useState } from 'react'
import { fetchPois, type Poi } from '../lib/mapData'

export interface PoiState {
  pois: Poi[]
  loading: boolean
  error: string | null
}

export function usePois(): PoiState {
  const [state, setState] = useState<PoiState>({ pois: [], loading: true, error: null })

  useEffect(() => {
    let alive = true
    fetchPois()
      .then((pois) => alive && setState({ pois, loading: false, error: null }))
      .catch(
        (e) =>
          alive &&
          setState({
            pois: [],
            loading: false,
            error: e instanceof Error ? e.message : 'POIs nicht verfügbar',
          }),
      )
    return () => {
      alive = false
    }
  }, [])

  return state
}
