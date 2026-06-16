import { useMemo, useState } from 'react'
import { ToastProvider, useToast } from './components/Toast'
import { Topbar } from './components/Topbar'
import { BottomNav, type Screen } from './components/BottomNav'
import { Spinner } from './components/Spinner'
import { ListScreen } from './screens/ListScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { DetailScreen } from './screens/DetailScreen'
import { FormScreen } from './screens/FormScreen'
import { useTrips } from './hooks/useTrips'
import { useThemeMode } from './hooks/useThemeMode'
import { byStartDesc, consumptionPerTrip } from './lib/calc'
import { toNum } from './lib/format'
import type { Trip, TripInput } from './lib/types'
import { isConfigured } from './lib/env'

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const toast = useToast()
  const { mode, toggle: toggleMode } = useThemeMode()
  const [screen, setScreen] = useState<Screen>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [saving, setSaving] = useState(false)

  const { trips, loading, error, reload, createTrip, updateTrip, deleteTrip } = useTrips()

  const selected = useMemo(
    () => trips.find((t) => t.id === selectedId) ?? null,
    [trips, selectedId],
  )

  // Per-Törn-Verbrauchsschätzung (Block-Algorithmus) einmal für alle berechnen.
  const consumption = useMemo(() => consumptionPerTrip(trips), [trips])

  // Vorbefüllung: letzter engineHoursEnd (neuester Törn) als Start-Vorschlag.
  const lastEngineHoursEnd = useMemo(() => {
    const newest = [...trips].sort(byStartDesc)[0]
    return newest ? toNum(newest.engineHoursEnd) : null
  }, [trips])

  function openDetail(t: Trip) {
    setSelectedId(t.id)
    setScreen('detail')
  }

  function openNew() {
    setEditing(null)
    setScreen('new')
  }

  function openEdit(t: Trip) {
    setEditing(t)
    setScreen('new')
  }

  async function handleSubmit(input: TripInput) {
    setSaving(true)
    try {
      if (editing) {
        await updateTrip(editing.id, input)
        toast.success('Törn aktualisiert')
      } else {
        await createTrip(input)
        toast.success('Törn gespeichert')
      }
      setEditing(null)
      setScreen('list')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(t: Trip) {
    if (!window.confirm(`Törn ${t.harborFrom} → ${t.harborTo} wirklich löschen?`)) return
    try {
      await deleteTrip(t.id)
      toast.success('Törn gelöscht')
      setScreen('list')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    }
  }

  function handleNavigate(s: Screen) {
    if (s === 'new') openNew()
    else setScreen(s)
  }

  return (
    <div className="mx-auto flex h-dvh min-h-screen w-full max-w-[480px] flex-col bg-surface shadow-[var(--shadow)]">
      <Topbar mode={mode} onToggleMode={toggleMode} />

      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-[18px]">
        {!isConfigured && <ConfigWarning />}

          {loading && <Spinner label="Lade Törns…" />}

          {!loading && error && <ErrorPanel message={error} onRetry={reload} />}

          {!loading && !error && screen === 'list' && (
            <ListScreen trips={trips} consumption={consumption} onSelect={openDetail} />
          )}

          {!loading && !error && screen === 'detail' && selected && (
            <DetailScreen
              trip={selected}
              consumptionLh={consumption[selected.id]?.lh ?? null}
              onBack={() => setScreen('list')}
              onEdit={() => openEdit(selected)}
              onDelete={() => handleDelete(selected)}
            />
          )}

          {!loading && !error && screen === 'new' && (
            <FormScreen
              editing={editing}
              lastEngineHoursEnd={lastEngineHoursEnd}
              saving={saving}
              onCancel={() => {
                setEditing(null)
                setScreen(editing ? 'detail' : 'list')
              }}
              onSubmit={handleSubmit}
            />
          )}

          {!loading && !error && screen === 'dash' && (
            <DashboardScreen trips={trips} consumption={consumption} onSelect={openDetail} />
          )}
      </main>

      <BottomNav active={screen} onNavigate={handleNavigate} />
    </div>
  )
}

function ConfigWarning() {
  return (
    <div className="mb-4 rounded-xl border border-accent px-4 py-3 text-[13px] text-accent">
      API nicht konfiguriert – <code>.env</code> mit VITE_API_URL &amp; VITE_API_TOKEN anlegen.
    </div>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-accent bg-surface-2 px-4 py-5 text-center">
      <p className="mb-3 text-[13px] text-accent">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
