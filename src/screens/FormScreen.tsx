import { useMemo, useState } from 'react'
import type { Entry, EntryInput } from '../lib/types'
import { fmt, toNum } from '../lib/format'
import { IconChevronLeft, IconSave } from '../components/icons'
import { useToast } from '../components/Toast'
import { Eyebrow } from '../components/Eyebrow'

const DEFAULT_HARBOR_FROM = 'Ascona, Porto Patriziale'

/** YYYY-MM-DD in lokaler Zeit (für <input type=date> und Default „heute"). */
function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

interface FormState {
  date: string
  harborFrom: string
  harborTo: string
  engineHours: string
  fuelLiters: string
  fuelCostChf: string
  paidBy: string
  notes: string
}

/**
 * Vorbefüllung für einen NEUEN Eintrag (z. B. aus einer aufgezeichneten Fahrt
 * auf der Karte). Nur gesetzte Felder überschreiben die Defaults.
 */
export interface EntryDraft {
  date?: string
  harborFrom?: string
  harborTo?: string
  notes?: string
}

function emptyState(prefillHours: number | null, draft?: EntryDraft): FormState {
  const base: FormState = {
    date: todayLocal(),
    harborFrom: DEFAULT_HARBOR_FROM,
    harborTo: '',
    engineHours: prefillHours !== null ? String(prefillHours) : '',
    fuelLiters: '',
    fuelCostChf: '',
    paidBy: '',
    notes: '',
  }
  if (!draft) return base
  return {
    ...base,
    ...(draft.date ? { date: draft.date } : {}),
    ...(draft.harborFrom ? { harborFrom: draft.harborFrom } : {}),
    ...(draft.harborTo ? { harborTo: draft.harborTo } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
  }
}

function fromEntry(e: Entry): FormState {
  return {
    date: e.date,
    harborFrom: e.harborFrom,
    harborTo: e.harborTo,
    engineHours: e.engineHours === null ? '' : String(e.engineHours),
    fuelLiters: e.fuelLiters === null ? '' : String(e.fuelLiters),
    fuelCostChf: e.fuelCostChf === null ? '' : String(e.fuelCostChf),
    paidBy: e.paidBy,
    notes: e.notes,
  }
}

export function FormScreen({
  editing,
  draft,
  lastEngineHours,
  knownHarbors,
  knownPaidBy,
  saving,
  onCancel,
  onSubmit,
}: {
  /** vorhandener Eintrag = Bearbeiten, null = Neu */
  editing: Entry | null
  /** Vorbefüllung für einen neuen Eintrag (z. B. aus einer Kartenfahrt) */
  draft?: EntryDraft
  /** höchster Zählerstand bisher (ohne den bearbeiteten Eintrag): Vorbefüllung + Vorschau */
  lastEngineHours: number | null
  knownHarbors: string[]
  knownPaidBy: string[]
  saving: boolean
  onCancel: () => void
  onSubmit: (input: EntryInput) => void | Promise<void>
}) {
  const toast = useToast()
  const [s, setS] = useState<FormState>(() =>
    editing ? fromEntry(editing) : emptyState(lastEngineHours, draft),
  )
  const [showPrefillHint] = useState(() => !editing && lastEngineHours !== null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setS((prev) => ({ ...prev, [key]: value }))
  }

  const engineNum = toNum(s.engineHours)
  const liters = toNum(s.fuelLiters)
  const cost = toNum(s.fuelCostChf)

  // Stunden seit letztem Eintrag (live).
  const hoursSince = useMemo(() => {
    if (engineNum === null || lastEngineHours === null) return null
    return engineNum - lastEngineHours
  }, [engineNum, lastEngineHours])

  // Grobe ≈ l/h nur, wenn Liter erfasst und Stunden positiv.
  const previewLh = useMemo(() => {
    if (liters === null || hoursSince === null || hoursSince <= 0) return null
    return liters / hoursSince
  }, [liters, hoursSince])

  // Sanfte Warnung: Zählerstand kleiner als letzter Stand (läuft nur vorwärts).
  const counterWarning = engineNum !== null && lastEngineHours !== null && engineNum < lastEngineHours

  // Sanfter Hinweis, wenn nur eines der Tank-Felder gefüllt ist.
  const fuelLonely =
    (liters !== null && cost === null) || (liters === null && cost !== null)

  function validate(): EntryInput {
    if (!s.date) throw new Error('Datum fehlt.')
    if (!s.harborFrom.trim()) throw new Error('Abfahrtshafen fehlt.')
    if (engineNum === null) throw new Error('Zählerstand (Betriebsstunden) fehlt oder ist keine Zahl.')

    return {
      date: s.date,
      harborFrom: s.harborFrom.trim(),
      harborTo: s.harborTo.trim(),
      engineHours: engineNum,
      fuelLiters: liters === null ? '' : liters,
      fuelCostChf: cost === null ? '' : cost,
      paidBy: s.paidBy.trim(),
      notes: s.notes.trim(),
    }
  }

  function handleSubmit() {
    let input: EntryInput
    try {
      input = validate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eingabe ungültig.')
      return
    }
    // counterWarning blockiert NICHT – der Eintrag wird trotzdem gespeichert.
    void onSubmit(input)
  }

  return (
    <div>
      <button
        onClick={onCancel}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-ink-2"
      >
        <IconChevronLeft />
        Abbrechen
      </button>
      <Eyebrow>{editing ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</Eyebrow>

      <Field label="Datum">
        <input
          type="date"
          value={s.date}
          onChange={(e) => set('date', e.target.value)}
          className={monoCls}
        />
      </Field>

      <Field label="Von">
        <TextInput
          list="harbors"
          value={s.harborFrom}
          onChange={(v) => set('harborFrom', v)}
          placeholder="Abfahrtshafen…"
        />
      </Field>
      <Field label="Nach (optional)">
        <TextInput
          list="harbors"
          value={s.harborTo}
          onChange={(v) => set('harborTo', v)}
          placeholder="Zielhafen / Freitext…"
        />
      </Field>
      <datalist id="harbors">
        {knownHarbors.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <Field
        label="Zählerstand (Betriebsstunden)"
        hint={showPrefillHint ? '↺ Letzter Stand' : undefined}
      >
        <NumberInput value={s.engineHours} onChange={(v) => set('engineHours', v)} step="0.1" />
      </Field>

      {counterWarning && (
        <div className="-mt-2 mb-3.5 rounded-lg border border-accent px-3 py-2 text-[12px] text-accent">
          ⚠ Zählerstand kleiner als letzter Stand ({fmt(lastEngineHours)} h) – Betriebsstundenzähler
          läuft nur vorwärts. Bitte prüfen (Speichern bleibt möglich).
        </div>
      )}

      {/* Live-Vorschau: Stunden seit letztem Eintrag (+ grobe ≈ l/h falls getankt). */}
      {hoursSince !== null && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-teal-soft px-3.5 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal">
            Stunden seit letztem Eintrag
          </span>
          <span className="tabnum font-mono text-[17px] font-bold text-ink">
            {fmt(hoursSince)} h
            {previewLh !== null && (
              <span className="ml-2 text-[12px] font-medium text-ink-2">≈ {fmt(previewLh)} l/h</span>
            )}
          </span>
        </div>
      )}

      <Eyebrow>Tankstopp (optional)</Eyebrow>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Treibstoff (l)">
          <NumberInput value={s.fuelLiters} onChange={(v) => set('fuelLiters', v)} step="0.1" />
        </Field>
        <Field label="Kosten (CHF)">
          <NumberInput value={s.fuelCostChf} onChange={(v) => set('fuelCostChf', v)} step="0.05" />
        </Field>
      </div>
      {fuelLonely && (
        <div className="-mt-2 mb-3.5 text-[11px] text-ink-3">
          Tipp: bei einem Tankstopp gern Liter <em>und</em> Kosten erfassen – beides bleibt optional.
        </div>
      )}

      <Field label="Bezahlt durch (optional)">
        <TextInput
          list="paidby"
          value={s.paidBy}
          onChange={(v) => set('paidBy', v)}
          placeholder="Name…"
        />
      </Field>
      <datalist id="paidby">
        {knownPaidBy.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <Field label="Benutzung / Bemerkung (optional)">
        <textarea
          value={s.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Wer, Zweck, Wartung, Notizen…"
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-teal"
        />
      </Field>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <IconSave />
        {saving ? 'Speichert…' : 'Eintrag speichern'}
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
  'w-full min-h-11 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-teal'
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
  step,
}: {
  value: string
  onChange: (v: string) => void
  step?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={monoCls}
    />
  )
}
