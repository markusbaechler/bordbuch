import { useMemo, useState } from 'react'
import { ToastProvider, useToast } from './components/Toast'
import { Topbar } from './components/Topbar'
import { BottomNav, type Screen } from './components/BottomNav'
import { Spinner } from './components/Spinner'
import { ConditionsScreen } from './screens/ConditionsScreen'
import { ListScreen } from './screens/ListScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { DetailScreen } from './screens/DetailScreen'
import { FormScreen } from './screens/FormScreen'
import { useEntries } from './hooks/useEntries'
import { useThemeMode } from './hooks/useThemeMode'
import {
  consumptionPerEntry,
  hoursPerEntry,
  hoursSinceStart,
  maxEngineHours,
} from './lib/calc'
import type { Entry, EntryInput } from './lib/types'
import { isConfigured } from './lib/env'

// Lago-Maggiore-Häfen als Basis-Vorschläge (ergänzt um real erfasste Werte).
const BASE_HARBORS = [
  'Ascona, Porto Patriziale',
  'Ascona',
  'Locarno',
  'Brissago',
  'Magadino',
  'Cannobio',
  'Luino',
]

function uniqueNonEmpty(values: unknown[]): string[] {
  // defensiv: String(v) statt v.trim(), falls das Sheet doch mal eine Zahl liefert
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0))]
}

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
  const [screen, setScreen] = useState<Screen>('conditions')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [saving, setSaving] = useState(false)

  const { entries, loading, error, reload, createEntry, updateEntry, deleteEntry } = useEntries()

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  )

  // Abgeleitete Maps – einmal für alle Screens berechnen.
  const hours = useMemo(() => hoursPerEntry(entries), [entries])
  const consumption = useMemo(() => consumptionPerEntry(entries), [entries])

  const knownHarbors = useMemo(
    () => uniqueNonEmpty([...BASE_HARBORS, ...entries.flatMap((e) => [e.harborFrom, e.harborTo])]),
    [entries],
  )
  const knownPaidBy = useMemo(
    () => uniqueNonEmpty(entries.map((e) => e.paidBy)),
    [entries],
  )

  // Vorbefüllung/Vorschau: höchster Zählerstand – beim Bearbeiten den eigenen Eintrag ausklammern.
  const lastEngineHours = useMemo(() => {
    const pool = editing ? entries.filter((e) => e.id !== editing.id) : entries
    return maxEngineHours(pool)
  }, [entries, editing])

  function openDetail(e: Entry) {
    setSelectedId(e.id)
    setScreen('detail')
  }
  function openNew() {
    setEditing(null)
    setScreen('new')
  }
  function openEdit(e: Entry) {
    setEditing(e)
    setScreen('new')
  }

  async function handleSubmit(input: EntryInput) {
    setSaving(true)
    try {
      if (editing) {
        await updateEntry(editing.id, input)
        toast.success('Eintrag aktualisiert')
      } else {
        await createEntry(input)
        toast.success('Eintrag gespeichert')
      }
      setEditing(null)
      setScreen('list')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(e: Entry) {
    const target = e.harborTo?.trim() ? `${e.harborFrom} → ${e.harborTo}` : e.harborFrom
    if (!window.confirm(`Eintrag „${target}" wirklich löschen?`)) return
    try {
      await deleteEntry(e.id)
      toast.success('Eintrag gelöscht')
      setScreen('list')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
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

        {loading && <Spinner label="Lade Einträge…" />}

        {!loading && error && <ErrorPanel message={error} onRetry={reload} />}

        {!loading && !error && screen === 'conditions' && <ConditionsScreen />}

        {!loading && !error && screen === 'list' && (
          <ListScreen entries={entries} hours={hours} consumption={consumption} onSelect={openDetail} />
        )}

        {!loading && !error && screen === 'detail' && selected && (
          <DetailScreen
            entry={selected}
            hours={hours[selected.id] ?? null}
            hoursSinceStart={hoursSinceStart(selected, entries)}
            consumptionLh={consumption[selected.id] ?? null}
            onBack={() => setScreen('list')}
            onEdit={() => openEdit(selected)}
            onDelete={() => handleDelete(selected)}
          />
        )}

        {!loading && !error && screen === 'new' && (
          <FormScreen
            editing={editing}
            lastEngineHours={lastEngineHours}
            knownHarbors={knownHarbors}
            knownPaidBy={knownPaidBy}
            saving={saving}
            onCancel={() => {
              setEditing(null)
              setScreen(editing ? 'detail' : 'list')
            }}
            onSubmit={handleSubmit}
          />
        )}

        {!loading && !error && screen === 'dash' && <DashboardScreen entries={entries} />}
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
        className="min-h-11 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
