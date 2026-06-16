import { useMemo, useState } from 'react'
import type { Trip, TripInput } from '../lib/types'
import { fmt, isoToLocalInput, localInputToIso, toNum } from '../lib/format'
import { IconChevronLeft, IconSave } from '../components/icons'
import { useToast } from '../components/Toast'
import { Eyebrow } from './ListScreen'

/** Bekannte Häfen (aus dem Backend) – als Vorschlagsliste, freie Eingabe bleibt erlaubt. */
const HARBORS = [
  'Wollishofen',
  'Zürich',
  'Thalwil',
  'Horgen',
  'Wädenswil',
  'Au',
  'Meilen',
  'Stäfa',
  'Pfäffikon',
  'Rapperswil',
]

interface FormState {
  startTime: string // datetime-local
  endTime: string
  harborFrom: string
  harborTo: string
  engineHoursStart: string
  engineHoursEnd: string
  fuelLiters: string
  fuelCostChf: string
  crew: string
  notes: string
}

function emptyState(prefillStart: number | null): FormState {
  return {
    startTime: '',
    endTime: '',
    harborFrom: 'Wollishofen',
    harborTo: '',
    engineHoursStart: prefillStart !== null ? String(prefillStart) : '',
    engineHoursEnd: '',
    fuelLiters: '',
    fuelCostChf: '',
    crew: '',
    notes: '',
  }
}

function fromTrip(t: Trip): FormState {
  return {
    startTime: isoToLocalInput(t.startTime),
    endTime: isoToLocalInput(t.endTime),
    harborFrom: t.harborFrom,
    harborTo: t.harborTo,
    engineHoursStart: String(toNum(t.engineHoursStart) ?? ''),
    engineHoursEnd: String(toNum(t.engineHoursEnd) ?? ''),
    fuelLiters: t.fuelLiters === '' ? '' : String(toNum(t.fuelLiters) ?? ''),
    fuelCostChf: t.fuelCostChf === '' ? '' : String(toNum(t.fuelCostChf) ?? ''),
    crew: t.crew ?? '',
    notes: t.notes ?? '',
  }
}

export function FormScreen({
  editing,
  lastEngineHoursEnd,
  saving,
  onCancel,
  onSubmit,
}: {
  /** vorhandener Törn = Bearbeiten, null = Neu */
  editing: Trip | null
  /** letzter engineHoursEnd zur Vorbefüllung beim Neuanlegen */
  lastEngineHoursEnd: number | null
  saving: boolean
  onCancel: () => void
  /** wirft bei Validierungsfehler mit lesbarer Meldung */
  onSubmit: (input: TripInput) => void | Promise<void>
}) {
  const toast = useToast()
  const [s, setS] = useState<FormState>(() =>
    editing ? fromTrip(editing) : emptyState(lastEngineHoursEnd),
  )
  const [showPrefillHint] = useState(() => !editing && lastEngineHoursEnd !== null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setS((prev) => ({ ...prev, [key]: value }))
  }

  // Sofort-Vorschau Verbrauch dieses Törns (nur grobe Kontrolle, kein Block-Wert).
  const previewLh = useMemo(() => {
    const liters = toNum(s.fuelLiters)
    const start = toNum(s.engineHoursStart)
    const end = toNum(s.engineHoursEnd)
    if (liters === null || start === null || end === null) return null
    const hours = end - start
    return hours > 0 ? liters / hours : null
  }, [s.fuelLiters, s.engineHoursStart, s.engineHoursEnd])

  function validate(): TripInput {
    const startIso = localInputToIso(s.startTime)
    const endIso = localInputToIso(s.endTime)
    const ehStart = toNum(s.engineHoursStart)
    const ehEnd = toNum(s.engineHoursEnd)

    if (!startIso) throw new Error('Startzeit fehlt.')
    if (!endIso) throw new Error('Endzeit fehlt.')
    if (new Date(endIso).getTime() < new Date(startIso).getTime())
      throw new Error('Endzeit liegt vor der Startzeit.')
    if (!s.harborFrom.trim()) throw new Error('Abfahrtshafen fehlt.')
    if (!s.harborTo.trim()) throw new Error('Zielhafen fehlt.')
    if (ehStart === null) throw new Error('Betriebsstunden Start fehlen.')
    if (ehEnd === null) throw new Error('Betriebsstunden Ende fehlen.')
    if (ehEnd < ehStart) throw new Error('Betriebsstunden Ende ist kleiner als Start.')

    const liters = toNum(s.fuelLiters)
    const cost = toNum(s.fuelCostChf)

    return {
      startTime: startIso,
      endTime: endIso,
      harborFrom: s.harborFrom.trim(),
      harborTo: s.harborTo.trim(),
      engineHoursStart: ehStart,
      engineHoursEnd: ehEnd,
      fuelLiters: liters === null ? '' : liters,
      fuelCostChf: cost === null ? '' : cost,
      crew: s.crew.trim(),
      notes: s.notes.trim(),
    }
  }

  function handleSubmit() {
    let input: TripInput
    try {
      input = validate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eingabe ungültig.')
      return
    }
    void onSubmit(input)
  }

  return (
    <div>
      <button
        onClick={onCancel}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"
      >
        <IconChevronLeft />
        Abbrechen
      </button>
      <Eyebrow>{editing ? 'Törn bearbeiten' : 'Neuer Törn'}</Eyebrow>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Von">
          <TextInput
            list="harbors"
            value={s.harborFrom}
            onChange={(v) => set('harborFrom', v)}
            placeholder="Abfahrtshafen…"
          />
        </Field>
        <Field label="Nach">
          <TextInput
            list="harbors"
            value={s.harborTo}
            onChange={(v) => set('harborTo', v)}
            placeholder="Zielhafen…"
          />
        </Field>
      </div>
      <datalist id="harbors">
        {HARBORS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Start">
          <DateTimeInput value={s.startTime} onChange={(v) => set('startTime', v)} />
        </Field>
        <Field label="Ende">
          <DateTimeInput value={s.endTime} onChange={(v) => set('endTime', v)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Betriebsst. Start" hint={showPrefillHint ? '↺ Letzter Stand übernommen' : undefined}>
          <NumberInput value={s.engineHoursStart} onChange={(v) => set('engineHoursStart', v)} step="0.1" />
        </Field>
        <Field label="Betriebsst. Ende">
          <NumberInput value={s.engineHoursEnd} onChange={(v) => set('engineHoursEnd', v)} step="0.1" />
        </Field>
      </div>

      <div className="my-1.5 mb-4 flex items-center justify-between rounded-xl bg-teal-soft px-3.5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal">
          Verbrauch dieser Törn
        </span>
        <span className="tabnum font-mono text-[17px] font-bold text-ink">
          {previewLh === null ? '—' : fmt(previewLh)} l/h
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Treibstoff (l)">
          <NumberInput value={s.fuelLiters} onChange={(v) => set('fuelLiters', v)} step="0.1" placeholder="nur bei Tankstopp" />
        </Field>
        <Field label="Kosten (CHF)">
          <NumberInput value={s.fuelCostChf} onChange={(v) => set('fuelCostChf', v)} step="0.05" placeholder="nur bei Tankstopp" />
        </Field>
      </div>

      <Field label="Crew">
        <TextInput value={s.crew} onChange={(v) => set('crew', v)} placeholder="Namen, kommagetrennt" />
      </Field>

      <Field label="Bemerkung">
        <textarea
          value={s.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Wetter, Wartung, Notizen…"
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-teal"
        />
      </Field>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <IconSave />
        {saving ? 'Speichert…' : 'Törn speichern'}
      </button>
      <p className="mt-3.5 text-center text-[11px] text-ink-3">
        Gespeichert in Google Sheets · Wetter wird automatisch ergänzt
      </p>
    </div>
  )
}

/* ---------- kleine Feld-Bausteine ---------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {label}
      </label>
      {children}
      {hint && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-teal">{hint}</div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-teal'
const monoCls = `${inputCls} tabnum font-mono font-semibold`

function TextInput({
  value,
  onChange,
  placeholder,
  list,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  list?: string
}) {
  return (
    <input
      type="text"
      list={list}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  )
}

function NumberInput({
  value,
  onChange,
  placeholder,
  step,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  step?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={monoCls}
    />
  )
}

function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={monoCls}
    />
  )
}
