import { useState, useId } from 'react'
import { Activity, AlertTriangle, AlertCircle, ShieldCheck, Info } from 'lucide-react'
import type { Shipment, HistoricalMotionReading } from '@/lib/wanees'
import { mockMotionHistory, getShockPresentation } from '@/lib/wanees'

interface ShockChartProps {
  shipment: Shipment
  motionHistory?: HistoricalMotionReading[]
}

export function ShockChart({ shipment, motionHistory: propHistory }: ShockChartProps) {
  const gradientId = useId()
  const history = propHistory ?? mockMotionHistory(shipment)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Extract shockG values (fallback to 0.98 for standard baseline gravity)
  const shockValues = history.map(item =>
    typeof item.shockG === 'number' && !isNaN(item.shockG) ? item.shockG : 0.98
  )

  const currentShock = shipment.reading.shockG ?? shockValues[shockValues.length - 1] ?? 0.98
  const currentStatus =
    shipment.reading.movementStatus ??
    history[history.length - 1]?.status ??
    'Normal handling'
  const shockPres = getShockPresentation(currentShock, currentStatus)

  // Sensible dynamic scaling:
  // Must be at least 3.8 g so both 1.5 g (Warning) and 3.0 g (Critical) references fit comfortably
  // without squashing the normal ~1.0 g baseline.
  const rawMax = Math.max(...shockValues, currentShock, 1.0)
  const yCeiling = Math.max(3.8, Math.ceil((rawMax * 1.2) * 10) / 10)
  const yFloor = 0
  const ySpan = yCeiling - yFloor

  // SVG viewBox geometry: 800 x 300
  const width = 800
  const height = 300
  const paddingLeft = 58
  const paddingRight = 32
  const paddingTop = 36
  const paddingBottom = 48

  const chartW = width - paddingLeft - paddingRight
  const chartH = height - paddingTop - paddingBottom

  // Coordinates helper
  const getY = (val: number) => {
    const clamped = Math.max(yFloor, Math.min(yCeiling, val))
    const ratio = (clamped - yFloor) / ySpan
    return paddingTop + chartH - ratio * chartH
  }

  const getX = (index: number, total: number) => {
    if (total <= 1) return paddingLeft + chartW / 2
    return paddingLeft + (index / (total - 1)) * chartW
  }

  // Pre-calculate data points
  const points = shockValues.map((val, idx) => ({
    x: getX(idx, shockValues.length),
    y: getY(val),
    val,
    raw: history[idx],
  }))

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const polygonPoints = `${points[0]?.x ?? paddingLeft},${getY(0)} ${polylinePoints} ${
    points[points.length - 1]?.x ?? width - paddingRight
  },${getY(0)}`

  // Threshold Y coordinates
  const yWarn = getY(1.5)
  const yCrit = getY(3.0)
  const yNominal = getY(1.0)

  // Stroke color for the series
  const seriesColor =
    currentShock >= 3.0
      ? '#ef4444' // red-500
      : currentShock >= 1.5
      ? '#f59e0b' // amber-500
      : '#10b981' // emerald-500

  // Active point for tooltip
  const activePt = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null
  const activePres = activePt
    ? getShockPresentation(activePt.val, activePt.raw?.status)
    : null

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                Shock / Impact History
              </h3>
              <p className="text-xs text-muted-foreground">
                Time-series physical shock readings from MPU6050 accelerometer (g-force)
              </p>
            </div>
          </div>
        </div>

        {/* Current Shock Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${shockPres.badgeClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${shockPres.dotClass} animate-pulse`} />
            <span className="font-mono text-xs font-bold text-foreground">
              Current: {shockPres.value}
            </span>
            <span className="text-[11px] opacity-90">({shockPres.status})</span>
          </div>
        </div>
      </div>

      {/* Threshold Reference Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/40" />
            <span>Normal Handling: &lt; 1.5 g</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-amber-400">
            <span className="h-2 w-3 rounded-sm bg-amber-500/50" />
            <span>Warning Threshold: 1.5 g</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-red-400">
            <span className="h-2 w-3 rounded-sm bg-red-500/60" />
            <span>Critical Threshold: 3.0 g</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          Y-Axis: 0 to {yCeiling.toFixed(1)} g (Dynamic)
        </div>
      </div>

      {/* Main Responsive Chart Container */}
      <div className="relative mt-4 w-full select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-64 sm:h-72 w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Shock / Impact History time-series chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor} stopOpacity={0.35} />
              <stop offset="60%" stopColor={seriesColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={seriesColor} stopOpacity={0.0} />
            </linearGradient>

            {/* Threshold line filters */}
            <linearGradient id={`${gradientId}-warn`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id={`${gradientId}-crit`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Background Band: Critical Zone (> 3.0g) */}
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={chartW}
            height={Math.max(0, yCrit - paddingTop)}
            fill="rgba(239, 68, 68, 0.05)"
          />

          {/* Background Band: Warning Zone (1.5g to 3.0g) */}
          <rect
            x={paddingLeft}
            y={yCrit}
            width={chartW}
            height={Math.max(0, yWarn - yCrit)}
            fill="rgba(245, 158, 11, 0.05)"
          />

          {/* Background Band: Normal Zone (0 to 1.5g) */}
          <rect
            x={paddingLeft}
            y={yWarn}
            width={chartW}
            height={Math.max(0, getY(0) - yWarn)}
            fill="rgba(16, 185, 129, 0.03)"
          />

          {/* Grid lines and Y-axis labels */}
          {/* Baseline 0 g */}
          <line
            x1={paddingLeft}
            y1={getY(0)}
            x2={width - paddingRight}
            y2={getY(0)}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 10}
            y={getY(0) + 4}
            textAnchor="end"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            0.0 g
          </text>

          {/* 1.0 g Nominal baseline */}
          <line
            x1={paddingLeft}
            y1={yNominal}
            x2={width - paddingRight}
            y2={yNominal}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 10}
            y={yNominal + 4}
            textAnchor="end"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            1.0 g
          </text>

          {/* 1.5 g Warning threshold line */}
          <line
            x1={paddingLeft}
            y1={yWarn}
            x2={width - paddingRight}
            y2={yWarn}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            strokeWidth="1.5"
            strokeOpacity="0.85"
          />
          <text
            x={width - paddingRight + 6}
            y={yWarn + 4}
            textAnchor="start"
            className="fill-amber-400 font-mono text-[10px] font-bold"
          >
            1.5 g (Warning)
          </text>
          <text
            x={paddingLeft - 10}
            y={yWarn + 4}
            textAnchor="end"
            className="fill-amber-400 font-mono text-[10px] font-bold"
          >
            1.5 g
          </text>

          {/* 3.0 g Critical threshold line */}
          <line
            x1={paddingLeft}
            y1={yCrit}
            x2={width - paddingRight}
            y2={yCrit}
            stroke="#ef4444"
            strokeDasharray="5 3"
            strokeWidth="1.75"
            strokeOpacity="0.9"
          />
          <text
            x={width - paddingRight + 6}
            y={yCrit + 4}
            textAnchor="start"
            className="fill-red-400 font-mono text-[10px] font-extrabold"
          >
            3.0 g (Critical)
          </text>
          <text
            x={paddingLeft - 10}
            y={yCrit + 4}
            textAnchor="end"
            className="fill-red-400 font-mono text-[10px] font-bold"
          >
            3.0 g
          </text>

          {/* Top dynamic max label if high */}
          {yCeiling > 3.8 && (
            <>
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={width - paddingRight}
                y2={paddingTop}
                stroke="var(--border)"
                strokeDasharray="2 2"
                strokeWidth="0.8"
              />
              <text
                x={paddingLeft - 10}
                y={paddingTop + 4}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {yCeiling.toFixed(1)} g
              </text>
            </>
          )}

          {/* Area under line */}
          <polygon points={polygonPoints} fill={`url(#${gradientId})`} />

          {/* Time-series polyline */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={seriesColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data Points with interactive hover targets */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx
            const isLatest = idx === points.length - 1
            const isCrit = pt.val >= 3.0
            const isWarn = pt.val >= 1.5 && pt.val < 3.0

            const ptColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981'
            const radius = isHovered ? 6 : isLatest ? 5 : isCrit ? 5.5 : 4

            return (
              <g
                key={idx}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Glow ring for spikes or latest */}
                {(isCrit || isHovered) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={radius + 5}
                    fill={ptColor}
                    fillOpacity="0.25"
                    className="animate-pulse"
                  />
                )}

                {/* Visible Data Point */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={radius}
                  fill={ptColor}
                  stroke="var(--card)"
                  strokeWidth="2"
                />

                {/* Invisible large hit target for touch / mouse */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill="transparent"
                />

                {/* X-axis tick & label */}
                <line
                  x1={pt.x}
                  y1={getY(0)}
                  x2={pt.x}
                  y2={getY(0) + 6}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text
                  x={pt.x}
                  y={getY(0) + 20}
                  textAnchor="middle"
                  className={`font-mono text-[10px] transition-colors ${
                    isHovered
                      ? 'fill-foreground font-bold'
                      : isLatest
                      ? 'fill-primary font-bold'
                      : 'fill-muted-foreground'
                  }`}
                >
                  {pt.raw?.time ?? `T${idx}`}
                </text>
              </g>
            )
          })}

          {/* Vertical guide line on active point */}
          {activePt && (
            <line
              x1={activePt.x}
              y1={paddingTop}
              x2={activePt.x}
              y2={getY(0)}
              stroke="var(--foreground)"
              strokeDasharray="2 2"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
          )}
        </svg>

        {/* Interactive Floating Tooltip */}
        {activePt && activePres && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full transform rounded-lg border border-border/90 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md transition-all"
            style={{
              left: `${(activePt.x / width) * 100}%`,
              top: `${Math.max(10, (activePt.y / height) * 100 - 6)}%`,
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-border/60 pb-1 font-mono text-[10px] text-muted-foreground">
              <span>Time: <b className="text-foreground">{activePt.raw?.time}</b></span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${activePres.dotClass}`} />
              <span className="font-mono text-sm font-extrabold text-foreground">
                {activePres.value}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${activePres.badgeClass}`}>
                {activePres.rawStatus}
              </span>
            </div>
            <p className="mt-1 max-w-[200px] text-[10px] leading-tight text-muted-foreground">
              {activePres.description}
            </p>
          </div>
        )}
      </div>

      {/* Cargo Impact & Handling Log Table */}
      <div className="mt-6 border-t border-border/80 pt-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Recent Shock &amp; Physical Handling Events
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {history.length} recorded readings
          </span>
        </div>

        <div className="divide-y divide-border/60 rounded-lg border border-border/80 bg-background/50 overflow-hidden">
          {[...history].reverse().map((evt, idx) => {
            const pres = getShockPresentation(evt.shockG, evt.status)
            return (
              <div
                key={idx}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors hover:bg-secondary/40"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground w-14">
                    {evt.time}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {pres.value}
                    </span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      ({evt.shockG && evt.shockG >= 3.0 ? 'Exceeds 3.0g' : evt.shockG && evt.shockG >= 1.5 ? 'Warning range' : 'Nominal limits'})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${pres.badgeClass}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${pres.dotClass}`} />
                    {pres.rawStatus}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
