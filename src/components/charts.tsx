import { useState } from 'react'

// Gráficas ligeras en SVG (sin librerías). Marcas delgadas, punta redondeada
// anclada a la base, rejilla recesiva y tooltip al pasar el cursor.

export type BarDatum = { label: string; value: number; hint?: string }

const CHART_INK = '#64748b' // slate-500: etiquetas siempre en tinta, no en color de serie
const GRID = '#e2e8f0' // slate-200

function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`
}

export function BarChart({
  data,
  color = '#db2777',
  height = 190,
  width = 600,
  format,
}: {
  data: BarDatum[]
  color?: string
  height?: number
  width?: number
  format: (v: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = width
  const padL = 8
  const padB = 22
  const padT = 16
  const plotH = height - padB - padT
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length
  const step = (W - padL * 2) / Math.max(1, n)
  const barW = Math.max(3, Math.min(48, step - 4))
  const labelEvery = Math.ceil(n / 8)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto block" role="img">
        {[0.5, 1].map((f) => {
          const y = padT + plotH * (1 - f)
          return (
            <g key={f}>
              <line x1={padL} x2={W - padL} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text
                x={padL + 2}
                y={y - 4}
                textAnchor="start"
                fontSize={11}
                fill={CHART_INK}
                stroke="#ffffff"
                strokeWidth={3.5}
                paintOrder="stroke"
              >
                {format(max * f)}
              </text>
            </g>
          )
        })}
        <line x1={padL} x2={W - padL} y1={padT + plotH} y2={padT + plotH} stroke={GRID} strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.value / max) * plotH
          const x = padL + i * step + (step - barW) / 2
          const y = padT + plotH - h
          return (
            <g key={i}>
              <rect
                x={padL + i * step}
                y={padT}
                width={step}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <path
                d={roundedTopBar(x, y, barW, h, 4)}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
                pointerEvents="none"
              />
              {i % labelEvery === 0 && (
                <text
                  x={padL + i * step + step / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={CHART_INK}
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="absolute -top-1 pointer-events-none bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap z-10"
          style={{
            left: `${((padL + hover * step + step / 2) / W) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-slate-300">{data[hover].hint ?? data[hover].label}:</span>{' '}
          {format(data[hover].value)}
        </div>
      )}
    </div>
  )
}

export type HBarDatum = { label: string; value: number; color?: string }

export function HBarChart({
  data,
  color = '#db2777',
  format,
}: {
  data: HBarDatum[]
  color?: string
  format: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
            <span className="min-w-0 truncate text-slate-700">{d.label}</span>
            <span className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
              {format(d.value)}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ?? color,
                minWidth: d.value > 0 ? 4 : 0,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Paleta categórica validada (validate_palette.js · modo claro):
// rosa (principal), violeta, naranja (Rappi), esmeralda (Uber)
export const SERIES = {
  pink: '#db2777',
  violet: '#7c3aed',
  orange: '#ea580c',
  emerald: '#047857',
}
