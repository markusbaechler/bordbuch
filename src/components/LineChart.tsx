// src/components/LineChart.tsx
// Schlanker SVG-Linienchart ohne Fremd-Bibliothek. Tag/Nacht über CSS-Variablen.
// Unterstützt mehrere Serien (überlagert), eine horizontale Referenzlinie,
// einen Punkt-Marker, eine vertikale „jetzt"-Markierung und knappe Achsen.

export interface ChartSeries {
  points: { x: number; y: number }[]
  color?: string // CSS-Farbe, Default var(--accent)
  emphasized?: boolean // dünn+gedämpft (false) vs. kräftig (true)
}

export interface ChartRefLine {
  y: number
  label?: string
  color?: string
}

export interface ChartMarker {
  x: number
  y: number
  label?: string
}

export interface ChartXTick {
  x: number
  label: string
}

interface Props {
  series: ChartSeries[]
  refLine?: ChartRefLine
  marker?: ChartMarker
  nowX?: number // vertikale „jetzt"-Linie
  xTicks?: ChartXTick[]
  height?: number
  formatY?: (v: number) => string
}

const W = 320
const PAD = { l: 38, r: 10, t: 16, b: 22 }

export function LineChart({
  series,
  refLine,
  marker,
  nowX,
  xTicks = [],
  height = 180,
  formatY = (v) => String(Math.round(v)),
}: Props) {
  const H = height
  const allPoints = series.flatMap((s) => s.points)

  if (allPoints.length === 0) {
    return <div className="py-10 text-center text-[13px] text-ink-3">Keine Daten</div>
  }

  const xs = [
    ...allPoints.map((p) => p.x),
    ...(nowX != null ? [nowX] : []),
    ...(marker ? [marker.x] : []),
    ...xTicks.map((t) => t.x),
  ]
  const ys = [
    ...allPoints.map((p) => p.y),
    ...(refLine ? [refLine.y] : []),
    ...(marker ? [marker.y] : []),
  ]

  let minX = Math.min(...xs)
  let maxX = Math.max(...xs)
  const dataMinY = Math.min(...allPoints.map((p) => p.y))
  const dataMaxY = Math.max(...allPoints.map((p) => p.y))
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  if (minX === maxX) maxX = minX + 1
  const yPad = (maxY - minY || 1) * 0.08
  minY -= yPad
  maxY += yPad

  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = (x: number) => PAD.l + ((x - minX) / (maxX - minX)) * plotW
  const sy = (y: number) => PAD.t + (1 - (y - minY) / (maxY - minY)) * plotH

  // Gedämpfte Serien zuerst, hervorgehobene oben drauf.
  const ordered = [...series].sort((a, b) => Number(a.emphasized) - Number(b.emphasized))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-auto w-full font-mono tabnum"
      role="img"
    >
      {/* Achsenrahmen (links + unten) */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* y-Beschriftung: tatsächliches Min/Max */}
      <text x={PAD.l - 4} y={sy(dataMaxY)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="var(--ink-3)">
        {formatY(dataMaxY)}
      </text>
      <text x={PAD.l - 4} y={sy(dataMinY)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="var(--ink-3)">
        {formatY(dataMinY)}
      </text>

      {/* Referenzlinie (gestrichelt) */}
      {refLine && (
        <g>
          <line
            x1={PAD.l}
            y1={sy(refLine.y)}
            x2={W - PAD.r}
            y2={sy(refLine.y)}
            stroke={refLine.color ?? 'var(--ink-3)'}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {refLine.label && (
            <text x={W - PAD.r} y={sy(refLine.y) - 3} textAnchor="end" fontSize={8} fontWeight={700} fill={refLine.color ?? 'var(--ink-2)'}>
              {refLine.label}
            </text>
          )}
        </g>
      )}

      {/* „jetzt"-Markierung (vertikal) */}
      {nowX != null && (
        <g>
          <line
            x1={sx(nowX)}
            y1={PAD.t}
            x2={sx(nowX)}
            y2={H - PAD.b}
            stroke="var(--ink-2)"
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          <text x={sx(nowX)} y={PAD.t - 5} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--ink-2)">
            jetzt
          </text>
        </g>
      )}

      {/* Serien */}
      {ordered.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          fill="none"
          stroke={s.color ?? 'var(--accent)'}
          strokeWidth={s.emphasized ? 2 : 1.3}
          strokeOpacity={s.emphasized ? 1 : 0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Punkt-Marker (z. B. Jahres-Höchstwert) */}
      {marker && (
        <g>
          <circle cx={sx(marker.x)} cy={sy(marker.y)} r={3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
          {marker.label && (
            <text
              x={Math.min(sx(marker.x), W - PAD.r)}
              y={sy(marker.y) - 6}
              textAnchor={sx(marker.x) > W / 2 ? 'end' : 'start'}
              fontSize={8}
              fontWeight={700}
              fill="var(--ink)"
            >
              {marker.label}
            </text>
          )}
        </g>
      )}

      {/* x-Beschriftung */}
      {xTicks.map((t, i) => (
        <text key={i} x={sx(t.x)} y={H - 6} textAnchor="middle" fontSize={8} fill="var(--ink-3)">
          {t.label}
        </text>
      ))}
    </svg>
  )
}
