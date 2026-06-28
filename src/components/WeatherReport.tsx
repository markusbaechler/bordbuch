// src/components/WeatherReport.tsx
// Wetter- & Windbericht für den ganzen Lago Maggiore: aktuelle Werte an mehreren
// Punkten (Locarno…Stresa) + Stunden- und Tagesprognose (Open-Meteo). Wird sowohl
// im Karten-Modal als auch im Wetter-Tab verwendet.
//
// `conditions` kann übergeben werden (Karte hat sie schon für das Wind-Feld) –
// sonst lädt die Komponente sie selbst. `onToggleWind` ist optional: nur die
// Karte bietet das Einblenden der Wind-Pfeile an.

import { useEffect, useState } from 'react'
import { cardinal8 } from '../lib/geo'
import {
  fetchLakeConditions,
  fetchLakeForecast,
  weatherEmoji,
  WIND_WARN,
  WIND_BAD,
  type LakeCondition,
  type LakeForecast,
} from '../lib/liveData'

// Pfeilfarbe nach MITTELWIND: Teal ruhig, Amber auffrischend, Rot kräftig.
// Böen werden bewusst nicht zur Einfärbung genommen (sonst wirkt alles „offensiv").
function windColor(windKn: number): string {
  if (windKn >= WIND_BAD) return '#D8352A'
  if (windKn >= WIND_WARN) return '#E8930C'
  return 'var(--teal)'
}

// Windpfeil als SVG: zeigt die Fluss­richtung (woher → wohin), Länge & Strichstärke
// skalieren mit dem mittleren Wind, die Farbe folgt ebenfalls dem Mittelwind. Flaute → Ring.
function WindArrow({ windKn, dirDeg }: { windKn: number; dirDeg: number }) {
  if (windKn < 2) {
    return (
      <svg width="34" height="28" viewBox="0 0 34 28" aria-hidden className="shrink-0">
        <circle cx="17" cy="14" r="4" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" />
      </svg>
    )
  }
  const v = Math.min(windKn, 25)
  const len = 7 + v * (12 / 25)
  const sw = 1.6 + v * (1.4 / 25)
  const color = windColor(windKn)
  const top = 14 - len / 2
  const bot = 14 + len / 2
  return (
    <svg width="34" height="28" viewBox="0 0 34 28" aria-hidden className="shrink-0">
      {/* Default-Pfeil zeigt nach oben (Norden); rotate = Flussrichtung (dir + 180). */}
      <g transform={`rotate(${dirDeg + 180} 17 14)`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
        <line x1="17" y1={bot} x2="17" y2={top} />
        <path d={`M17 ${top} l-4 5 M17 ${top} l4 5`} />
      </g>
    </svg>
  )
}

export function WeatherReport({
  conditions: condProp,
  windOn,
  onToggleWind,
}: {
  conditions?: LakeCondition[] | null
  windOn?: boolean
  onToggleWind?: () => void
}) {
  const [condFetched, setCondFetched] = useState<LakeCondition[] | null>(null)
  const conditions = condProp ?? condFetched
  const [fc, setFc] = useState<LakeForecast | null>(null)
  const [fcErr, setFcErr] = useState(false)

  // Conditions nur selbst laden, wenn nicht übergeben.
  useEffect(() => {
    if (condProp) return
    let alive = true
    fetchLakeConditions()
      .then((c) => alive && setCondFetched(c))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [condProp])

  useEffect(() => {
    let alive = true
    fetchLakeForecast()
      .then((f) => alive && setFc(f))
      .catch(() => alive && setFcErr(true))
    return () => {
      alive = false
    }
  }, [])

  const hourFmt = (t: string) =>
    new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  const dayFmt = (t: string) =>
    new Date(t).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div>
      {onToggleWind && (
        <button
          onClick={onToggleWind}
          className={`mb-3 w-full rounded-xl border px-3 py-2 text-[12px] font-semibold ${
            windOn ? 'border-transparent bg-accent text-white' : 'border-line text-ink-2'
          }`}
        >
          {windOn ? '✓ Wind-Pfeile auf der Karte' : 'Wind-Pfeile auf der Karte zeigen'}
        </button>
      )}

      {/* Jetzt · alle Punkte über den See */}
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">
        Jetzt · ganzer See
      </div>
      <div className="mb-2 overflow-hidden rounded-xl border border-line">
        {conditions?.length ? (
          conditions.map((c, i) => (
            <div
              key={c.name}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] ${
                i % 2 ? 'bg-surface-2' : ''
              }`}
            >
              <span className="flex-1 font-semibold text-ink">{c.name}</span>
              <span className="text-[16px]">{weatherEmoji(c.weatherCode)}</span>
              <span className="tabnum w-10 text-right font-mono text-ink">{c.tempC}°</span>
              <span className="flex items-center gap-1.5">
                <WindArrow windKn={c.windKn} dirDeg={c.dirDeg} />
                <span className="tabnum w-14 text-right font-mono leading-tight text-ink-2">
                  <span className="block">{cardinal8(c.dirDeg)}</span>
                  <span className="block">{c.windKn}/{c.gustKn} kn</span>
                </span>
              </span>
              <span className="tabnum w-12 text-right font-mono text-teal">
                {c.precipMm > 0 ? `${c.precipMm}mm` : '–'}
              </span>
            </div>
          ))
        ) : (
          <div className="px-3 py-3 text-[13px] text-ink-3">Conditions werden geladen…</div>
        )}
      </div>
      <p className="mb-4 text-[10px] text-ink-3">
        Pfeil = Windrichtung & -stärke · Zahlen = Mittel/Böen kn · letzte Spalte = Niederschlag
      </p>

      {/* Stundenprognose */}
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">
        Nächste Stunden
      </div>
      {fc?.hourly.length ? (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {fc.hourly.map((h) => (
            <div
              key={h.time}
              className="flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg border border-line px-1.5 py-1.5"
            >
              <span className="tabnum font-mono text-[10px] text-ink-3">{hourFmt(h.time)}</span>
              <span className="text-[15px]">{weatherEmoji(h.weatherCode)}</span>
              <span className="tabnum font-mono text-[12px] font-bold text-ink">{h.tempC}°</span>
              <span className="tabnum font-mono text-[9px] text-ink-2">{h.windKn}kn</span>
              <span className="tabnum font-mono text-[9px] text-teal">{h.precipProb}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-[12px] text-ink-3">{fcErr ? 'Prognose nicht verfügbar.' : 'Lädt…'}</div>
      )}

      {/* Tagesprognose */}
      {fc?.daily.length ? (
        <>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">Tage</div>
          <div className="overflow-hidden rounded-xl border border-line">
            {fc.daily.map((day, i) => (
              <div
                key={day.date}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] ${
                  i % 2 ? 'bg-surface-2' : ''
                }`}
              >
                <span className="w-24 font-semibold text-ink">{dayFmt(day.date)}</span>
                <span className="text-[16px]">{weatherEmoji(day.weatherCode)}</span>
                <span className="tabnum w-16 text-right font-mono text-ink">
                  {day.tMax}°<span className="text-ink-3">/{day.tMin}°</span>
                </span>
                <span className="tabnum w-16 text-right font-mono text-ink-2">max {day.windMaxKn}kn</span>
                <span className="tabnum w-10 text-right font-mono text-teal">{day.precipProb}%</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-3 text-center text-[10px] text-ink-3">Quelle: Open-Meteo · Prognose für die Seemitte</p>
    </div>
  )
}
