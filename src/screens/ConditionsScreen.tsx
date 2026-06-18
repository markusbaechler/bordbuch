// src/screens/ConditionsScreen.tsx
// "Vor der Abfahrt" – Live-Conditions für Locarno: Wind-Ampel mit Kompass,
// Böen-12h-Grafik, Seepegel + Wassertemperatur. Alle Farben über Tokens/
// CSS-Variablen, damit Tag/Nacht automatisch mitziehen. Einzige Ausnahme:
// die Ampel-Hintergründe warn/bad (gibt es nicht als Token).

import { useEffect, useRef, useState } from 'react'
import { useConditions } from '../hooks/useConditions'
import {
  GUST_WARN,
  GUST_BAD,
  HW_LEVEL_MASL,
  fetchWindHistory,
  fetchLevelHistory,
  type WindLevel,
} from '../lib/liveData'
import { fetchWaterTempYear } from '../lib/waterTemp'
import { Eyebrow } from '../components/Eyebrow'
import { Spinner } from '../components/Spinner'
import { Modal } from '../components/Modal'
import { WeatherReport } from '../components/WeatherReport'
import { LineChart, type ChartSeries, type ChartXTick } from '../components/LineChart'

const COND = "'Barlow Condensed', sans-serif"

type ModalKind = 'wind' | 'level' | 'water' | null

/** Tap-/Tastatur-Handler für antippbare Kacheln. */
function tapProps(onOpen: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen()
      }
    },
  }
}

// Ampel-Hintergründe. good kommt aus dem Token, warn/bad existieren nicht als Token.
const AMPEL_BG: Record<WindLevel, string> = {
  good: 'var(--good)',
  warn: '#E8930C',
  bad: '#D8352A',
}

export function ConditionsScreen() {
  const c = useConditions(undefined, 15 * 60 * 1000) // alle 15 min auffrischen
  const [modal, setModal] = useState<ModalKind>(null)

  const stamp = c.fetchedAt
    ? c.fetchedAt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    : '–'

  return (
    <div>
      {/* Kopfzeile + Live-Status */}
      <div className="mb-3 flex items-baseline justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-2"
          style={{ fontFamily: COND }}
        >
          Vor der Abfahrt · Locarno
        </span>
        <span className="tabnum font-mono text-[11px] text-ink-3">
          {c.loading ? 'lädt…' : c.error ? 'offline' : `live · ${stamp}`}
        </span>
      </div>

      {/* Wind-Ampel (antippbar → Verlaufs-Modal) */}
      {c.wind ? (
        <div
          {...tapProps(() => setModal('wind'))}
          aria-label="Wind-Verlauf öffnen"
          className="mb-3 cursor-pointer rounded-2xl px-4 py-4 text-white"
          style={{ background: AMPEL_BG[c.wind.level] }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[26px] font-bold leading-none"
                style={{ fontFamily: COND }}
              >
                {c.wind.headline}
              </div>
              <div className="mt-1.5 text-[13px] opacity-90">{c.wind.subline}</div>
            </div>
            <Compass deg={c.wind.directionDeg} cardinal={c.wind.cardinal} />
          </div>

          <div className="mt-4 flex gap-6">
            <Metric label="Wind" value={c.wind.windKn} unit="kn" />
            <Metric label="Böen" value={c.wind.gustKn} unit="kn" />
            <Metric label="Bft" value={c.wind.beaufort} />
          </div>

          {/* Hinweis-Banner: Gewitter hat Vorrang vor Inverna/Tramontana. */}
          {c.wind.thunder ? (
            <Banner>⛈ Gewittergefahr in den nächsten Stunden</Banner>
          ) : (
            c.wind.localContext && <Banner>🧭 {c.wind.localContext}</Banner>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-2xl border border-line bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-3">
          {c.loading ? 'Winddaten werden geladen…' : 'Winddaten nicht verfügbar'}
        </div>
      )}

      {/* Böen-Vorschau 12 h */}
      {c.wind && c.wind.gustForecast.length > 0 && (
        <>
          <Eyebrow>Böen · nächste 12 h</Eyebrow>
          <GustChart gusts={c.wind.gustForecast} />
        </>
      )}

      {/* Seepegel + Wassertemperatur */}
      <Eyebrow>See</Eyebrow>
      <div className="mb-[22px] grid grid-cols-2 gap-[11px]">
        <Gauge
          label="Seepegel"
          value={c.levelMasl != null ? c.levelMasl.toFixed(2) : '–'}
          unit="m ü.M."
          tick="BAFU · Lago Maggiore – Locarno"
          onOpen={() => setModal('level')}
        />
        <Gauge
          label="Wassertemp."
          value={c.waterTempC != null ? c.waterTempC.toFixed(1) : '–'}
          unit="°C"
          tick={
            c.waterTempSource === 'alplakes'
              ? '● live · Alplakes (Simstrat)'
              : '✎ Saison-Schätzung'
          }
          onOpen={() => setModal('water')}
        />
      </div>

      {/* Wetter & Wind über den ganzen See (+ Prognose) */}
      <Eyebrow>Wetter & Wind · ganzer See</Eyebrow>
      <div className="mb-[22px]">
        <WeatherReport />
      </div>

      {/* Aktualisieren */}
      <button
        onClick={c.reload}
        disabled={c.loading}
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] font-semibold text-ink-2 disabled:opacity-60"
      >
        {c.loading ? 'Lädt…' : '↻ Aktualisieren'}
      </button>

      {/* Quellen */}
      <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-3">
        Quellen: Open-Meteo (Wind) · existenz.ch / BAFU (Pegel) · Alplakes / Eawag (Wassertemp.)
      </p>

      {/* Verlaufs-Modals */}
      {modal === 'wind' && (
        <Modal title="Wind & Böen · 48 h" onClose={() => setModal(null)}>
          <WindHistory />
        </Modal>
      )}
      {modal === 'level' && (
        <Modal title="Seepegel · 30 Tage" onClose={() => setModal(null)}>
          <LevelHistory />
        </Modal>
      )}
      {modal === 'water' && (
        <Modal title="Wassertemperatur · Jahresvergleich" onClose={() => setModal(null)}>
          <WaterHistory />
        </Modal>
      )}
    </div>
  )
}

/* ----------------------------- History-Modals ----------------------------- */

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

// Lädt einmalig beim Mount (Modal wird nur bei Bedarf gerendert).
function useAsync<T>(fn: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let alive = true
    setState({ data: null, loading: true, error: null })
    fnRef
      .current()
      .then((d) => alive && setState({ data: d, loading: false, error: null }))
      .catch(
        (e) =>
          alive &&
          setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Fehler' }),
      )
    return () => {
      alive = false
    }
  }, [])
  return state
}

function ChartState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <Spinner label="Lade Verlauf…" />
  return (
    <div className="py-8 text-center text-[13px] text-ink-2">
      {error ?? 'Daten nicht verfügbar'}
    </div>
  )
}

function ChartFoot({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-3">{children}</p>
}

// Knappe x-Achsen-Ticks (Datum) aus einem Zeitbereich.
function timeTicks(dates: Date[], count = 4): ChartXTick[] {
  if (dates.length < 2) return dates.map((d) => ({ x: +d, label: fmtDay(d) }))
  const min = +dates[0]
  const max = +dates[dates.length - 1]
  return Array.from({ length: count }, (_, i) => {
    const x = min + ((max - min) * i) / (count - 1)
    return { x, label: fmtDay(new Date(x)) }
  })
}

const fmtDay = (d: Date) => d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
const fmtDayStr = (s: string) => fmtDay(new Date(s))

// Monats-Ticks für den Jahresvergleich (Tag-im-Jahr).
const MONTH_TICKS: ChartXTick[] = [
  { x: 1, label: 'Jan' },
  { x: 60, label: 'Mär' },
  { x: 121, label: 'Mai' },
  { x: 182, label: 'Jul' },
  { x: 244, label: 'Sep' },
  { x: 305, label: 'Nov' },
]

// Unterscheidbare (aber gedämpfte) Farben für die Vorjahre – damit die Legende
// den Linien zuordenbar ist. Funktionieren in Tag und Nacht.
const PAST_COLORS = ['var(--teal)', '#D99441', '#B98AE0', '#7FB069']
const pastColor = (i: number) => PAST_COLORS[i % PAST_COLORS.length]

function doyOf(dateStr: string): number {
  const d = new Date(dateStr)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000)
}

function WindHistory() {
  const { data, loading, error } = useAsync(() => fetchWindHistory())
  if (!data) return <ChartState loading={loading} error={error} />

  const series: ChartSeries[] = [
    { points: data.times.map((t, i) => ({ x: +t, y: data.gusts[i] })), color: 'var(--accent)', emphasized: true },
  ]
  return (
    <div>
      <LineChart
        series={series}
        refLine={{ y: GUST_WARN, label: `WARN ${GUST_WARN} kn`, color: '#E8930C' }}
        nowX={Date.now()}
        xTicks={timeTicks(data.times)}
        formatY={(v) => `${Math.round(v)}`}
      />
      <ChartFoot>Böen in kn · −48 h … +48 h · Open-Meteo · „jetzt" markiert</ChartFoot>
    </div>
  )
}

function LevelHistory() {
  const { data, loading, error } = useAsync(() => fetchLevelHistory(30))
  if (!data || !data.points.length) return <ChartState loading={loading} error={error} />

  const latest = data.points[data.points.length - 1].val
  const distance = HW_LEVEL_MASL - latest
  const series: ChartSeries[] = [
    { points: data.points.map((p) => ({ x: +p.date, y: p.val })), color: 'var(--teal)', emphasized: true },
  ]
  return (
    <div>
      <LineChart
        series={series}
        refLine={{ y: HW_LEVEL_MASL, label: `HW ${HW_LEVEL_MASL}`, color: '#D8352A' }}
        xTicks={timeTicks(data.points.map((p) => p.date))}
        formatY={(v) => v.toFixed(2)}
      />
      <div className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">
          Abstand zur Hochwassergrenze
        </div>
        <div className="tabnum font-mono text-[22px] font-bold leading-none text-ink">
          {distance.toFixed(2)}
          <span className="ml-1 font-sans text-xs font-medium text-ink-2">m</span>
        </div>
      </div>
      <ChartFoot>m ü.M. · existenz.ch / BAFU · HW-Grenze {HW_LEVEL_MASL} m (Stufe 5)</ChartFoot>
    </div>
  )
}

function WaterHistory() {
  const { data, loading, error } = useAsync(() => fetchWaterTempYear())
  if (!data) return <ChartState loading={loading} error={error} />

  const { currentYear: cur, pastYears: past } = data
  const series: ChartSeries[] = [
    ...past.map((py, i) => ({
      points: py.daily.map((d) => ({ x: d.doy, y: d.t })),
      color: pastColor(i),
      emphasized: false,
    })),
    {
      points: cur.daily.map((d) => ({ x: d.doy, y: d.t })),
      color: 'var(--accent)',
      emphasized: true,
    },
  ]
  const marker =
    cur.max.value != null && cur.max.date
      ? { x: doyOf(cur.max.date), y: cur.max.value, label: `max ${cur.max.value.toFixed(1)}°C · ${fmtDayStr(cur.max.date)}` }
      : undefined

  return (
    <div>
      <LineChart series={series} marker={marker} xTicks={MONTH_TICKS} formatY={(v) => v.toFixed(0)} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <LegendItem color="var(--accent)" label={`${cur.year} (aktuell)`} />
        {past.map((py, i) => (
          <LegendItem key={py.year} color={pastColor(i)} label={String(py.year)} />
        ))}
      </div>
      <ChartFoot>°C Oberfläche · Alplakes (Simstrat) · Jahres-Höchstwert markiert</ChartFoot>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
      <span className="tabnum font-mono">{label}</span>
    </span>
  )
}

/* ----------------------------- Kompass ----------------------------- */

function Compass({ deg, cardinal }: { deg: number; cardinal: string }) {
  return (
    <svg width="56" height="56" viewBox="0 0 100 100" className="shrink-0" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="3" />
      {/* N-Marke oben */}
      <text x="50" y="16" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,.75)" fontFamily="Inter, sans-serif">
        N
      </text>
      {/* Nadel zeigt in die Richtung, AUS der der Wind weht (meteorologisch). */}
      <g transform={`rotate(${deg} 50 50)`}>
        <polygon points="50,20 44,54 56,54" fill="#fff" />
        <polygon points="50,80 44,54 56,54" fill="rgba(255,255,255,.4)" />
      </g>
      <circle cx="50" cy="54" r="4" fill="#fff" />
      <text
        x="50"
        y="96"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#fff"
        fontFamily="'JetBrains Mono', monospace"
      >
        {cardinal}
      </text>
    </svg>
  )
}

/* ----------------------------- Metrik (Ampel) ----------------------------- */

function Metric({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] opacity-85">{label}</div>
      <div className="tabnum font-mono text-[26px] font-bold leading-none">
        {value}
        {unit && <span className="ml-0.5 font-sans text-xs font-medium opacity-85">{unit}</span>}
      </div>
    </div>
  )
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-[12px] font-medium">{children}</div>
  )
}

/* ----------------------------- Böen-Chart ----------------------------- */

function GustChart({ gusts }: { gusts: number[] }) {
  // Skala bis mindestens GUST_BAD, damit die WARN-Linie sinnvoll sitzt.
  const max = Math.max(...gusts, GUST_BAD)
  const warnPct = (GUST_WARN / max) * 100

  return (
    <div className="mb-[22px] rounded-2xl border border-line bg-surface-2 px-3.5 pb-3 pt-3.5">
      <div className="relative flex h-[92px] items-end gap-1.5 pt-1">
        {/* WARN-Linie (gestrichelt) */}
        <div
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-ink-3 opacity-70"
          style={{ bottom: `${warnPct}%` }}
        >
          <span className="absolute right-0 -top-4 bg-surface-2 px-1 font-mono text-[9px] font-bold text-ink-2">
            {GUST_WARN} kn
          </span>
        </div>
        {gusts.map((g, i) => {
          const h = Math.max((g / max) * 100, 3)
          const color = g >= GUST_BAD ? '#D8352A' : g >= GUST_WARN ? '#E8930C' : 'var(--teal)'
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`+${i + 1} h: ${g} kn`}
            >
              <i className="block w-full max-w-3 rounded-t" style={{ height: `${h}%`, background: color }} />
              <em className="tabnum font-mono text-[8px] not-italic text-ink-3">{i + 1}</em>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------- Gauge (See) ----------------------------- */

function Gauge({
  label,
  value,
  unit,
  tick,
  onOpen,
}: {
  label: string
  value: string
  unit: string
  tick: string
  onOpen?: () => void
}) {
  const tap = onOpen ? tapProps(onOpen) : {}
  return (
    <div
      {...tap}
      aria-label={onOpen ? `${label} – Verlauf öffnen` : undefined}
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface-2 px-3.5 pb-3 pt-3.5 ${
        onOpen ? 'cursor-pointer' : ''
      }`}
    >
      <span
        className="absolute left-3.5 right-3.5 top-0 h-0.5 rounded"
        style={{ background: 'linear-gradient(90deg, var(--teal), transparent)' }}
      />
      {onOpen && <span className="absolute right-3 top-2.5 text-[12px] leading-none text-ink-3">›</span>}
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">{label}</div>
      <div className="tabnum font-mono text-[30px] font-bold leading-none text-ink">
        {value}
        <span className="ml-0.5 font-sans text-xs font-medium text-ink-2">{unit}</span>
      </div>
      <div className="tabnum mt-2 font-mono text-[10px] leading-tight text-ink-3">{tick}</div>
    </div>
  )
}
