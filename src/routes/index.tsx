import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Battery,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Command,
  Copy,
  Cpu,
  Droplets,
  Filter,
  Gauge,
  Globe2,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Terminal,
  Thermometer,
  Wifi,
  X,
} from 'lucide-react'
import {
  alertService,
  authService,
  defaultUser,
  deviceService,
  mockHistory,
  mockMotionHistory,
  shipmentService,
  getShockPresentation,
  type Alert,
  type Device,
  type RiskLevel,
  type Shipment,
  type User,
  type MovementStatus,
  type MovementData,
} from '@/lib/wanees'
import {
  waneesDataService,
  getTemperatureStatus,
  getHumidityStatus,
  getShockStatus,
  ESP32_THRESHOLDS,
} from '@/lib/dataProvider'
import { activityLogService, type ActivityEvent, type EventSeverity } from '@/lib/activityLog'
import { ShockChart } from '@/components/ShockChart'
import { ActivityLogSection } from '@/components/ActivityLogSection'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'WANEES · Smart shipment monitoring' },
      {
        name: 'description',
        content: 'Monitor environmental conditions, detect shipment risks, and stay informed throughout the journey.',
      },
    ],
  }),
  component: ClientWanees,
})

export function ClientWanees() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-background" aria-label="Loading WANEES" />}>
      <WaneesApp />
    </ClientOnly>
  )
}

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/shipments', label: 'Shipments', icon: Package },
  { href: '/devices', label: 'Devices', icon: Cpu },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const riskStyle: Record<string, string> = {
  SAFE: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  MEDIUM: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  HIGH: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  CRITICAL: 'border-red-400/25 bg-red-400/10 text-red-300',
  RESOLVED: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
}

const riskDot: Record<string, string> = {
  SAFE: 'bg-emerald-400',
  MEDIUM: 'bg-amber-300',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-400',
  RESOLVED: 'bg-slate-400',
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Wanees">
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" role="img" aria-label="Wanees mark">
        <path
          d="M4 9 11 31 20 18 29 31 36 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="18" r="3.1" fill="var(--color-primary)" stroke="var(--background)" strokeWidth="1.3" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <span className="text-[17px] font-bold tracking-[0.18em]">WANEES</span>
          <span className="mt-1 block text-[9px] font-medium tracking-[0.21em] text-muted-foreground">
            SHIPMENT MONITORING
          </span>
        </div>
      )}
    </div>
  )
}

function SourceBadge({ source }: { source?: 'real' | 'simulation' }) {
  if (source === 'real') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold tracking-wider text-emerald-300 shadow-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        REAL ESP32
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-2 py-1 text-[9px] font-medium tracking-wider text-muted-foreground">
      SIMULATION
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.11em] ${
        riskStyle[level] ?? riskStyle.RESOLVED
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${riskDot[level] ?? riskDot.RESOLVED}`} />
      {level}
    </span>
  )
}

export function getCargoCondition(level?: string) {
  const norm = (level || 'SAFE').toUpperCase()
  if (norm === 'CRITICAL') {
    return {
      label: 'CRITICAL' as const,
      symbol: '🔴',
      dotClass: 'bg-red-400',
      badgeClass: 'border-red-400/35 bg-red-400/10 text-red-300',
      textClass: 'text-red-400',
      title: 'CRITICAL',
      note: 'Immediate risk alert — intervention required',
    }
  }
  if (norm === 'HIGH' || norm === 'MEDIUM' || norm === 'WARNING') {
    return {
      label: 'WARNING' as const,
      symbol: '🟡',
      dotClass: 'bg-amber-400',
      badgeClass: 'border-amber-400/35 bg-amber-400/10 text-amber-300',
      textClass: 'text-amber-400',
      title: 'WARNING',
      note: 'Environmental or handling advisory',
    }
  }
  return {
    label: 'SAFE' as const,
    symbol: '🟢',
    dotClass: 'bg-emerald-400',
    badgeClass: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
    textClass: 'text-emerald-400',
    title: 'SAFE',
    note: 'Conditions optimal and secure in transit',
  }
}

export function CargoConditionBadge({ level, size = 'md' }: { level?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cond = getCargoCondition(level)
  const pad =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-xs'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[9px]'
      : 'px-2.5 py-1 text-[10px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wider ${cond.badgeClass} ${pad}`}
    >
      <span className={`h-2 w-2 rounded-full ${cond.dotClass} ${cond.label === 'CRITICAL' ? 'animate-pulse' : ''}`} />
      <span>{cond.label}</span>
    </span>
  )
}

export { getShockPresentation }

const movementStyle: Record<string, string> = {
  NORMAL: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  MOVEMENT_DETECTED: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  SHOCK_DETECTED: 'border-red-400/25 bg-red-400/10 text-red-300',
}

const movementDot: Record<string, string> = {
  NORMAL: 'bg-emerald-400',
  MOVEMENT_DETECTED: 'bg-amber-300',
  SHOCK_DETECTED: 'bg-red-400',
}

function MovementBadge({ status, label }: { status?: string; label?: string }) {
  const normStatus = (status || 'NORMAL').toUpperCase().replace(/\s+/g, '_')
  const displayLabel =
    label ||
    (normStatus === 'SHOCK_DETECTED'
      ? 'Shock detected'
      : normStatus === 'MOVEMENT_DETECTED'
      ? 'Movement detected'
      : 'Normal')
  const styleClass = movementStyle[normStatus] || movementStyle.NORMAL
  const dotClass = movementDot[normStatus] || movementDot.NORMAL

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wide ${styleClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {displayLabel}
    </span>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border/80 bg-card ${className}`}>{children}</section>
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </div>
  )
}

function LiveDot({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-primary">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
  note,
}: {
  label: string
  value: string | number
  icon: typeof Package
  tone: string
  note: string
}) {
  return (
    <Panel className="p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className={`rounded-lg p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="font-mono text-[28px] font-semibold leading-none tracking-tight">{value}</span>
        <span className="text-[10px] text-muted-foreground">{note}</span>
      </div>
    </Panel>
  )
}

function ShipmentRow({ shipment, onOpen }: { shipment: Shipment; onOpen: (id: string) => void }) {
  const shock = getShockPresentation(shipment.reading.shockG, shipment.reading.movementStatus)
  return (
    <button
      onClick={() => onOpen(shipment.id)}
      className="group grid w-full grid-cols-2 gap-x-4 gap-y-3 border-b border-border/60 px-4 py-4 text-left last:border-0 hover:bg-secondary/40 sm:grid-cols-[1.2fr_1.1fr_0.9fr_1fr_0.8fr_0.3fr] sm:items-center sm:gap-3"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-primary">{shipment.id}</span>
          <SourceBadge source={shipment.source} />
        </div>
        <p className="mt-1 truncate text-xs font-medium text-foreground">{shipment.cargo}</p>
      </div>
      <div className="col-span-1 hidden min-w-0 sm:block">
        <p className="truncate text-xs font-medium">
          {shipment.origin.split(',')[0]} <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />{' '}
          {shipment.destination.split(',')[0]}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{shipment.deviceId}</p>
      </div>
      <div className="text-right sm:text-left">
        <span className="font-mono text-xs font-semibold">{shipment.reading.temperature.toFixed(1)}°C</span>
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">{shipment.reading.humidity}% RH</span>
      </div>
      <div className="hidden sm:block">
        <span className="font-mono text-xs font-bold text-foreground">{shock.value}</span>
        <span className="ml-1.5 inline-block text-[10px] text-muted-foreground truncate">{shock.rawStatus}</span>
      </div>
      <div className="justify-self-end sm:justify-self-start">
        <CargoConditionBadge level={shipment.reading.risk} size="sm" />
      </div>
      <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" />
    </button>
  )
}

function SensorChart({ shipment, kind }: { shipment: Shipment; kind: 'temperature' | 'humidity' }) {
  const history = mockHistory(shipment.reading)
  const values = history.map(item => item[kind])
  const min = Math.min(...values) - (kind === 'temperature' ? 2 : 3)
  const max = Math.max(...values) + (kind === 'temperature' ? 2 : 3)
  const points = values
    .map((value, index) => `${index * (100 / (values.length - 1 || 1))},${46 - ((value - min) / (max - min || 1)) * 38}`)
    .join(' ')
  const color = kind === 'temperature' ? 'var(--color-primary)' : 'oklch(0.77 0.15 150)'

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold">{kind === 'temperature' ? 'Temperature History' : 'Humidity History'}</p>
            <SourceBadge source={shipment.source} />
          </div>
          <p className="mt-1 font-mono text-[22px] font-semibold">
            {kind === 'temperature' ? `${shipment.reading.temperature.toFixed(1)}°C` : `${shipment.reading.humidity}%`}
          </p>
        </div>
        <span className="rounded border border-border px-2 py-1 text-[9px] font-medium text-muted-foreground">
          {shipment.source === 'real' ? 'LIVE TELEMETRY' : 'LAST 24 HOURS'}
        </span>
      </div>
      <svg
        viewBox="0 0 100 56"
        preserveAspectRatio="none"
        className="mt-4 h-28 w-full overflow-visible"
        aria-label={`${kind} over the last 24 hours`}
        role="img"
      >
        <path d="M0 48 H100 M0 28 H100 M0 8 H100" stroke="var(--border)" strokeDasharray="1.4 2.2" strokeWidth=".45" fill="none" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy={46 - ((values[values.length - 1] - min) / (max - min || 1)) * 38}
          r="1.8"
          fill={color}
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
        {history.map((point, idx) => (
          <span key={idx}>{point.time}</span>
        ))}
      </div>
    </Panel>
  )
}

function ShockHistoryChart({ shipment }: { shipment: Shipment }) {
  return <ShockChart shipment={shipment} />
}

function TechnicalDetailsSection({
  shipment,
  defaultOpen = false,
}: {
  shipment: Shipment
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const ax = shipment.reading.accelerationX ?? 0.12
  const ay = shipment.reading.accelerationY ?? -0.04
  const az = shipment.reading.accelerationZ ?? 9.81
  const magnitude = shipment.reading.movement?.magnitude ?? Math.sqrt(ax * ax + ay * ay + az * az)

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Technical Details &amp; Raw Sensor Data</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            MPU6050 &amp; Actuators
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <span>{isOpen ? 'Hide technical data' : 'Show technical details'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-border/60 pt-4 animate-fade-in">
          <p className="text-[11px] text-muted-foreground">
            Underlying sensor telemetry retained for engineering inspection, hardware verification, and ESP32 diagnostics.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 font-mono">
              <span className="text-[9px] font-semibold text-muted-foreground">MPU6050 ACCEL X</span>
              <p className="mt-1 text-sm font-bold text-sky-400">{ax.toFixed(2)} m/s²</p>
              <span className="text-[9px] text-muted-foreground">Lateral / side motion axis</span>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 font-mono">
              <span className="text-[9px] font-semibold text-muted-foreground">MPU6050 ACCEL Y</span>
              <p className="mt-1 text-sm font-bold text-purple-400">{ay.toFixed(2)} m/s²</p>
              <span className="text-[9px] text-muted-foreground">Longitudinal / front-back axis</span>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 font-mono">
              <span className="text-[9px] font-semibold text-muted-foreground">MPU6050 ACCEL Z</span>
              <p className="mt-1 text-sm font-bold text-amber-400">{az.toFixed(2)} m/s²</p>
              <span className="text-[9px] text-muted-foreground">Vertical (1G baseline included)</span>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 font-mono">
              <span className="text-[9px] font-semibold text-muted-foreground">ACCEL MAGNITUDE</span>
              <p className="mt-1 text-sm font-bold text-foreground">{magnitude.toFixed(2)} m/s²</p>
              <span className="text-[9px] text-muted-foreground">Square root sum of squares</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 font-mono text-[10px]">
            <div className="rounded-lg border border-border/70 bg-background/45 p-2.5">
              <span className="text-muted-foreground">SIGNAL STRENGTH (RSSI):</span>
              <p className="mt-0.5 font-bold text-foreground">{shipment.reading.signalStrength ?? -65} dBm</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/45 p-2.5">
              <span className="text-muted-foreground">DEVICE ID &amp; FIRMWARE:</span>
              <p className="mt-0.5 font-bold text-foreground">{shipment.deviceId} (ESP32 · v1.4.2)</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/45 p-2.5">
              <span className="text-muted-foreground">INGESTION ENDPOINT:</span>
              <p className="mt-0.5 font-bold text-emerald-400">POST /api/device/data (Active)</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/45 p-3">
            <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              HARDWARE ACTUATOR PIN FEEDBACK:
            </span>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className={`px-2.5 py-1 rounded border ${shipment.actuators?.ledGreen ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-border text-muted-foreground'}`}>
                Green LED: {shipment.actuators?.ledGreen ? 'ACTIVE (SAFE)' : 'STANDBY'}
              </span>
              <span className={`px-2.5 py-1 rounded border ${shipment.actuators?.ledYellow ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-border text-muted-foreground'}`}>
                Yellow LED: {shipment.actuators?.ledYellow ? 'ACTIVE (ADVISORY)' : 'STANDBY'}
              </span>
              <span className={`px-2.5 py-1 rounded border ${shipment.actuators?.ledRed ? 'border-red-500/40 bg-red-500/15 text-red-300' : 'border-border text-muted-foreground'}`}>
                Red LED: {shipment.actuators?.ledRed ? 'ACTIVE (WARNING)' : 'STANDBY'}
              </span>
              <span className={`px-2.5 py-1 rounded border ${shipment.actuators?.buzzer ? 'border-red-500/40 bg-red-500/20 text-red-300 animate-pulse font-bold' : 'border-border text-muted-foreground'}`}>
                Alarm Buzzer: {shipment.actuators?.buzzer ? 'SOUNDING' : 'SILENT'}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Raw 3-Axis Motion Engineering Graph:
            </span>
            <MovementChart shipment={shipment} />
          </div>
        </div>
      )}
    </div>
  )
}

function MovementChart({ shipment }: { shipment: Shipment }) {
  const motionHistory = mockMotionHistory(shipment)
  const xValues = motionHistory.map(m => m.x)
  const yValues = motionHistory.map(m => m.y)
  const zValues = motionHistory.map(m => m.z)

  const allValues = [...xValues, ...yValues, ...zValues]
  const min = Math.min(-2, ...allValues) - 1
  const max = Math.max(13, ...allValues) + 1
  const range = max - min || 1

  const getYCoord = (val: number) => 46 - ((val - min) / range) * 38

  const xPoints = xValues
    .map((v, i) => `${i * (100 / (xValues.length - 1 || 1))},${getYCoord(v)}`)
    .join(' ')
  const yPoints = yValues
    .map((v, i) => `${i * (100 / (yValues.length - 1 || 1))},${getYCoord(v)}`)
    .join(' ')
  const zPoints = zValues
    .map((v, i) => `${i * (100 / (zValues.length - 1 || 1))},${getYCoord(v)}`)
    .join(' ')

  const currX = shipment.reading.accelerationX ?? xValues[xValues.length - 1] ?? 0.12
  const currY = shipment.reading.accelerationY ?? yValues[yValues.length - 1] ?? -0.04
  const currZ = shipment.reading.accelerationZ ?? zValues[zValues.length - 1] ?? 9.81

  return (
    <div className="rounded-xl border border-border/80 bg-background/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold">3-Axis Motion History (X, Y, Z)</p>
            <SourceBadge source={shipment.source} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span>X: <b>{currX.toFixed(2)}</b></span>
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <span>Y: <b>{currY.toFixed(2)}</b></span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Z: <b>{currZ.toFixed(2)}</b></span>
            </span>
            <span className="text-[10px] text-muted-foreground font-sans">(m/s²)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-border bg-card px-2 py-1 text-[9px] font-medium text-muted-foreground">
            {shipment.source === 'real' ? 'LIVE TELEMETRY' : 'RECENT READINGS'}
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 100 56"
        preserveAspectRatio="none"
        className="mt-4 h-28 w-full overflow-visible"
        aria-label="Acceleration X, Y, Z over recent readings"
        role="img"
      >
        <path d="M0 48 H100 M0 28 H100 M0 8 H100" stroke="var(--border)" strokeDasharray="1.4 2.2" strokeWidth=".45" fill="none" />
        
        {/* X axis */}
        <polyline
          points={xPoints}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy={getYCoord(currX)}
          r="1.7"
          fill="#38bdf8"
        />

        {/* Y axis */}
        <polyline
          points={yPoints}
          fill="none"
          stroke="#c084fc"
          strokeWidth="1.3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy={getYCoord(currY)}
          r="1.7"
          fill="#c084fc"
        />

        {/* Z axis */}
        <polyline
          points={zPoints}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy={getYCoord(currZ)}
          r="1.7"
          fill="#fbbf24"
        />
      </svg>

      <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
        {motionHistory.map((point, idx) => (
          <span key={idx}>{point.time}</span>
        ))}
      </div>
    </div>
  )
}

export function WaneesApp() {
  const [path, setPath] = useState('/')
  const [user, setUser] = useState<User | null>(null)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [devicesList, setDevicesList] = useState<Device[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [mobileMenu, setMobileMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [showTestPanel, setShowTestPanel] = useState(false)

  const refreshData = () => {
    setShipments(shipmentService.list())
    setDevicesList(deviceService.list())
    setAlerts(alertService.list())
  }

  useEffect(() => {
    const readLocation = () => {
      setPath(window.location.pathname)
      setMobileMenu(false)
    }
    const sync = () => {
      setUser(authService.currentUser())
      refreshData()
    }

    readLocation()
    sync()

    window.addEventListener('popstate', readLocation)
    window.addEventListener('storage', sync)

    // Subscribe to Wanees Data Layer polling updates (every 2 seconds)
    const unsubscribe = waneesDataService.subscribe(() => {
      refreshData()
    })

    return () => {
      window.removeEventListener('popstate', readLocation)
      window.removeEventListener('storage', sync)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/shipments') ||
      path.startsWith('/devices') ||
      path.startsWith('/alerts') ||
      path.startsWith('/settings')
    ) {
      if (!user) {
        window.history.replaceState({}, '', '/login')
        window.setTimeout(() => setPath('/login'), 0)
      }
    }
  }, [path, user])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const go = (to: string) => {
    window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo(0, 0)
    setMobileMenu(false)
  }

  const openShipment = (id: string) => go(`/shipments/${id}`)
  const openDevice = (id: string) => go(`/devices/${id}`)
  const logout = () => {
    authService.logout()
    setUser(null)
    go('/login')
  }

  const activeShipment = path.startsWith('/shipments/')
    ? shipments.find(item => item.id.toLowerCase() === path.split('/')[2]?.toLowerCase())
    : path.startsWith('/dashboard/shipments/')
    ? shipments.find(item => item.id.toLowerCase() === path.split('/')[3]?.toLowerCase())
    : undefined

  const activeDevice = path.startsWith('/devices/')
    ? devicesList.find(item => item.id.toLowerCase() === path.split('/')[2]?.toLowerCase())
    : undefined

  const filteredShipments = useMemo(
    () =>
      shipments.filter(item =>
        `${item.id} ${item.cargo} ${item.origin} ${item.destination} ${item.deviceId} ${item.source}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [shipments, query]
  )

  const handleSimulation = (shipmentId: string, risk: RiskLevel) => {
    shipmentService.simulate(shipmentId, risk)
    refreshData()
    setNotice(`Simulation updated: ${shipmentId} is now ${risk}.`)
  }

  const handleTriggerTestTelemetry = async (
    temp: number,
    hum: number,
    risk?: RiskLevel,
    ax?: number,
    ay?: number,
    az?: number
  ) => {
    await waneesDataService.triggerTestTelemetry(temp, hum, risk, {
      accelerationX: ax,
      accelerationY: ay,
      accelerationZ: az,
    })
    refreshData()
    setNotice(
      `Test telemetry transmitted: ${temp}°C / ${hum}% (X:${ax !== undefined ? ax.toFixed(2) : '0.12'}, Y:${ay !== undefined ? ay.toFixed(2) : '-0.04'}, Z:${az !== undefined ? az.toFixed(2) : '9.81'}) sent to WN-001 (Physical ESP32).`
    )
  }

  const handleLogin = (email: string, password: string) => {
    try {
      const nextUser = authService.login(email, password)
      setUser(nextUser)
      go('/dashboard')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign in.')
    }
  }

  const handleRegister = (account: User, password: string) => {
    try {
      const nextUser = authService.register(account, password)
      setUser(nextUser)
      go('/dashboard')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to create account.')
    }
  }

  if (path === '/' || path === '/login' || path === '/register') {
    return (
      <PublicPage
        path={path}
        go={go}
        onLogin={handleLogin}
        onRegister={handleRegister}
        notice={notice}
        setNotice={setNotice}
      />
    )
  }

  if (!user) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Opening WANEES…</div>
  }

  const pageTitle = path.startsWith('/dashboard')
    ? 'Overview'
    : path === '/shipments'
    ? 'Shipments'
    : activeShipment
    ? `Shipment #${activeShipment.id}`
    : path === '/devices'
    ? 'Devices'
    : activeDevice
    ? activeDevice.id
    : path === '/alerts'
    ? 'Alerts'
    : 'Settings'

  const pageSubtitle = path.startsWith('/dashboard')
    ? 'Real-time telemetry from physical ESP32 and simulated shipments.'
    : path === '/shipments'
    ? 'Monitor physical sensor and simulated cargo conditions.'
    : path === '/devices'
    ? 'Monitor your physical ESP32 unit and simulated devices.'
    : path === '/alerts'
    ? 'Review conditions that need your attention.'
    : path === '/settings'
    ? 'Manage your account and monitoring preferences.'
    : activeShipment?.cargo ?? 'Device status and current conditions.'

  const isDetail = Boolean(activeShipment || activeDevice)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-[76px] items-center border-b border-sidebar-border px-6 text-primary">
          <Logo />
        </div>
        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[9px] font-bold tracking-[0.17em] text-muted-foreground/70">WORKSPACE</p>
          <nav className="space-y-1">
            {navigation.map(item => (
              <NavItem
                key={item.href}
                item={item}
                active={
                  path === item.href ||
                  (item.href === '/shipments' && Boolean(activeShipment)) ||
                  (item.href === '/devices' && Boolean(activeDevice))
                }
                onClick={() => go(item.href)}
                count={item.href === '/alerts' ? alerts.filter(alert => alert.active).length : undefined}
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="mb-4 flex w-full items-center justify-between rounded-lg border border-primary/25 bg-primary/[0.08] p-3 text-left transition-colors hover:bg-primary/[0.12]"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[10px] font-semibold text-foreground">ESP32 Hardware API</span>
              </div>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">POST /api/device/data</p>
            </div>
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[8px] font-bold text-primary">
              {showTestPanel ? 'HIDE' : 'TEST'}
            </span>
          </button>

          <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
              {user.name
                .split(' ')
                .map(part => part[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.company}</p>
            </div>
            <button
              aria-label="Log out"
              onClick={logout}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="rounded-md border border-border p-2 text-muted-foreground lg:hidden"
              aria-label="Open navigation"
            >
              {mobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="hidden text-primary sm:block">
              <Logo compact />
            </div>
            <span className="hidden h-5 border-l border-border sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{pageTitle}</h1>
              <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{pageSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <label className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 md:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search shipments…"
                className="w-36 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border px-1 text-[9px] text-muted-foreground">⌘ K</kbd>
            </label>

            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-primary hover:bg-primary/20"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ESP32 TESTER</span>
            </button>

            <button
              onClick={() => go('/alerts')}
              className="relative rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
            >
              <Bell className="h-4 w-4" />
              {alerts.filter(alert => alert.active).length > 0 && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-400" />
              )}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
              {user.name
                .split(' ')
                .map(part => part[0])
                .join('')
                .slice(0, 2)}
            </div>
          </div>
        </header>

        {mobileMenu && (
          <div className="fixed inset-x-0 top-[68px] z-40 border-b border-border bg-sidebar p-4 shadow-xl lg:hidden">
            <nav className="space-y-1">
              {navigation.map(item => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={path === item.href}
                  onClick={() => go(item.href)}
                  count={item.href === '/alerts' ? alerts.filter(alert => alert.active).length : undefined}
                />
              ))}
              <button
                onClick={() => {
                  setShowTestPanel(!showTestPanel)
                  setMobileMenu(false)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-primary hover:bg-secondary"
              >
                <Terminal className="h-4 w-4" />
                ESP32 Hardware Test Panel
              </button>
              <button
                onClick={logout}
                className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </nav>
          </div>
        )}

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          {showTestPanel && (
            <Esp32TestPanel
              onClose={() => setShowTestPanel(false)}
              onSendTelemetry={handleTriggerTestTelemetry}
            />
          )}

          {path.startsWith('/dashboard') && (
            <Dashboard
              user={user}
              shipments={shipments}
              devices={devicesList}
              alerts={alerts}
              onOpen={openShipment}
              onGo={go}
              onSimulate={handleSimulation}
              onOpenTester={() => setShowTestPanel(true)}
            />
          )}
          {path === '/shipments' && (
            <ShipmentsPage shipments={filteredShipments} query={query} setQuery={setQuery} onOpen={openShipment} />
          )}
          {activeShipment && (
            <ShipmentDetail
              shipment={activeShipment}
              alerts={alerts}
              onDevice={openDevice}
              onSimulate={handleSimulation}
            />
          )}
          {path === '/devices' && <DevicesPage devices={devicesList} shipments={shipments} onOpen={openDevice} />}
          {activeDevice && (
            <DeviceDetail
              device={activeDevice}
              shipment={shipments.find(
                s => s.deviceId.toLowerCase() === activeDevice.id.toLowerCase() || s.id === activeDevice.shipmentId
              )}
              onShipment={openShipment}
            />
          )}
          {path === '/alerts' && <AlertsPage alerts={alerts} onOpen={openShipment} />}
          {path === '/settings' && <SettingsPage user={user} onLogout={logout} />}
          {!['/dashboard', '/shipments', '/devices', '/alerts', '/settings'].includes(path) && !isDetail && (
            <EmptyPage
              title="Page not found"
              text="That WANEES page could not be found."
              action={() => go('/dashboard')}
            />
          )}

          <footer className="mt-9 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 text-[9px] text-muted-foreground">
            <span>WANEES · SHIPMENT MONITORING ARCHITECTURE</span>
            <span className="font-mono">PHYSICAL ESP32 TELEMETRY (WN-001) + SIMULATED FLEET</span>
          </footer>
        </main>
      </div>

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-xs shadow-lg"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

function NavItem({
  item,
  active,
  onClick,
  count,
}: {
  item: (typeof navigation)[number]
  active: boolean
  onClick: () => void
  count?: number
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
        active
          ? 'bg-primary/10 font-semibold text-primary'
          : 'text-muted-foreground hover:bg-secondary/75 hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{item.label}</span>
      {count ? (
        <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">{count}</span>
      ) : null}
    </button>
  )
}

function Dashboard({
  user,
  shipments,
  devices,
  alerts,
  onOpen,
  onGo,
  onSimulate,
  onOpenTester,
}: {
  user: User
  shipments: Shipment[]
  devices: Device[]
  alerts: Alert[]
  onOpen: (id: string) => void
  onGo: (path: string) => void
  onSimulate: (shipmentId: string, risk: RiskLevel) => void
  onOpenTester: () => void
}) {
  const realShipment = shipments.find(s => s.source === 'real')
  const safe = shipments.filter(shipment => shipment.reading.risk === 'SAFE').length
  const activeAlerts = alerts.filter(alert => alert.active).length
  const greeting =
    new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="animate-fade-in space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-5 bg-primary" />
            <span className="font-mono text-[9px] font-semibold tracking-[0.17em] text-primary">
              COMMAND CENTER · HACKATHON DEMO
            </span>
          </div>
          <h2 className="text-[25px] font-semibold tracking-tight sm:text-[30px]">
            {greeting}, {user.name.split(' ')[0]}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Monitoring physical ESP32 box alongside simulated fleet shipments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot label="ESP32 POLLING (2s)" />
          <span className="hidden text-[10px] text-muted-foreground sm:block">Active pipeline</span>
        </div>
      </div>

      {realShipment && (() => {
        const realShock = getShockPresentation(
          realShipment.reading.shockG,
          realShipment.reading.movementStatus
        )
        const condition = getCargoCondition(realShipment.reading.risk)
        return (
          <Panel className="border-emerald-400/30 bg-gradient-to-r from-emerald-500/[0.07] via-card to-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
              <div className="flex items-center gap-3">
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-emerald-300">
                  <Radio className="h-5 w-5 animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      PHYSICAL SHIPMENT #{realShipment.id}
                    </span>
                    <SourceBadge source="real" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {realShipment.cargo} · Device: <span className="font-mono text-primary">{realShipment.deviceId}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <CargoConditionBadge level={realShipment.reading.risk} size="md" />
                <button
                  onClick={() => onOpen(realShipment.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary hover:text-primary transition-colors"
                >
                  View Shipment #{realShipment.id} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Top 4 Primary Customer Cards */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/80 bg-background/60 p-3.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold tracking-wider uppercase">🌡️ TEMPERATURE</span>
                  <Thermometer className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">
                  {realShipment.reading.temperature.toFixed(1)}°C
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Safe: 10.0–13.0°C</span>
                  <span className={getTemperatureStatus(realShipment.reading.temperature) === 'CRITICAL' ? 'font-bold text-red-400' : getTemperatureStatus(realShipment.reading.temperature) === 'WARNING' ? 'font-bold text-amber-300' : 'text-emerald-400 font-medium'}>
                    {getTemperatureStatus(realShipment.reading.temperature)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-background/60 p-3.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold tracking-wider uppercase">💧 HUMIDITY</span>
                  <Droplets className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">
                  {realShipment.reading.humidity}%
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Safe: 85–95% RH</span>
                  <span className={getHumidityStatus(realShipment.reading.humidity) === 'CRITICAL' ? 'font-bold text-red-400' : getHumidityStatus(realShipment.reading.humidity) === 'WARNING' ? 'font-bold text-amber-300' : 'text-emerald-400 font-medium'}>
                    {getHumidityStatus(realShipment.reading.humidity)}
                  </span>
                </div>
              </div>

              <div className={`rounded-lg border p-3.5 ${
                realShock.level === 'critical'
                  ? 'border-red-400/40 bg-red-400/10'
                  : realShock.level === 'strong'
                  ? 'border-orange-400/40 bg-orange-400/10'
                  : realShock.level === 'moderate'
                  ? 'border-amber-400/35 bg-amber-400/10'
                  : 'border-border/80 bg-background/60'
              }`}>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold tracking-wider uppercase">💥 CURRENT SHOCK</span>
                  <span className={`h-2 w-2 rounded-full ${realShock.dotClass}`} />
                </div>
                <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">
                  {realShock.value}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-foreground truncate">
                    {realShock.status}
                  </span>
                  <span className="text-muted-foreground">Safe: &lt; 1.5 g</span>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-background/60 p-3.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold tracking-wider uppercase">🔋 BATTERY</span>
                  <Battery className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">
                  {realShipment.reading.battery ?? 98}%
                </p>
                <span className="mt-1 block text-[10px] text-emerald-400 font-medium">Monitoring active</span>
              </div>
            </div>

            {/* Secondary Customer Info: Movement, Route, Device Status */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">
                  CARGO MOVEMENT
                </span>
                <p className="mt-1 text-xs font-semibold text-foreground">{realShock.status}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{realShock.description}</p>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">
                  SHIPMENT ROUTE
                </span>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {realShipment.origin.split(',')[0]} → {realShipment.destination.split(',')[0]}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Status: In Transit</p>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">
                  DEVICE STATUS
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Online</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    · Updated {realShipment.reading.updated}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Unit: {realShipment.deviceId}</p>
              </div>
            </div>

            {/* Shock & Impact History Chart */}
            <div className="mt-5">
              <ShockHistoryChart shipment={realShipment} />
            </div>

            {/* Activity Log & Event Timeline */}
            <div className="mt-5">
              <ActivityLogSection shipmentId={realShipment.id} />
            </div>

            {/* Collapsed Technical Details */}
            <div className="mt-4">
              <TechnicalDetailsSection shipment={realShipment} defaultOpen={false} />
            </div>
          </Panel>
        )
      })()}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="ACTIVE SHIPMENTS"
          value={shipments.length}
          icon={Package}
          tone="bg-primary/10 text-primary"
          note="1 real + 3 simulated"
        />
        <Metric
          label="CONNECTED DEVICES"
          value={devices.filter(device => device.status === 'ONLINE').length}
          icon={Cpu}
          tone="bg-sky-400/10 text-sky-300"
          note="ESP32 & simulated"
        />
        <Metric
          label="SAFE SHIPMENTS"
          value={safe}
          icon={ShieldCheck}
          tone="bg-emerald-400/10 text-emerald-300"
          note="within threshold"
        />
        <Metric
          label="ACTIVE ALERTS"
          value={activeAlerts}
          icon={AlertCircle}
          tone="bg-red-400/10 text-red-300"
          note="need attention"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div>
          <SectionHeading
            title="All Monitored Shipments"
            detail="Environmental conditions across physical ESP32 and simulated shipments."
            action={
              <button
                onClick={() => onGo('/shipments')}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80"
              >
                All shipments <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          <Panel className="overflow-hidden">
            <div className="hidden grid-cols-[1.2fr_1.1fr_0.9fr_1fr_0.8fr_0.3fr] gap-3 border-b border-border bg-secondary/40 px-4 py-3 text-[9px] font-semibold tracking-[0.1em] text-muted-foreground sm:grid">
              <span>SHIPMENT / SOURCE</span>
              <span>ROUTE / DEVICE</span>
              <span>TEMP &amp; HUMIDITY</span>
              <span>CURRENT SHOCK</span>
              <span>CARGO CONDITION</span>
              <span />
            </div>
            {shipments.map(shipment => (
              <ShipmentRow key={shipment.id} shipment={shipment} onOpen={onOpen} />
            ))}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <div>
                <h3 className="text-xs font-semibold">Active alerts</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">Attention required</p>
              </div>
              <span className="rounded bg-red-400/10 px-2 py-1 font-mono text-[10px] font-bold text-red-300">
                {activeAlerts.toString().padStart(2, '0')}
              </span>
            </div>
            {alerts
              .filter(alert => alert.active)
              .slice(0, 3)
              .map(alert => (
                <button
                  key={alert.id}
                  onClick={() => onOpen(alert.shipmentId)}
                  className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3.5 text-left last:border-0 hover:bg-secondary/40"
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${riskDot[alert.level]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold tracking-wide">
                        {alert.level} · {alert.shipmentId}
                      </span>
                      <SourceBadge source={alert.source} />
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                      {alert.message}
                    </span>
                  </span>
                </button>
              ))}
            {!activeAlerts && (
              <div className="px-4 py-5 text-xs text-muted-foreground">
                All monitored shipments are operating normally within safety bounds.
              </div>
            )}
            <button
              onClick={() => onGo('/alerts')}
              className="w-full border-t border-border px-4 py-3 text-left text-[10px] font-semibold text-primary hover:bg-secondary/40"
            >
              View alert history →
            </button>
          </Panel>

          <SimulationControl
            shipmentId="WN-003"
            label="Simulated Cargo (WN-003)"
            onSimulate={onSimulate}
          />

          <Panel className="border-primary/30 p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-primary">
                  PHYSICAL ESP32 TEST MODE
                </span>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Transmit test telemetry to verify real device pipeline without hardware.
                </p>
              </div>
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <button
              onClick={onOpenTester}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground hover:brightness-110"
            >
              <Send className="h-3 w-3" />
              Open ESP32 Transmitter Tool
            </button>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function SimulationControl({
  shipmentId,
  label = 'DEMO SIMULATION',
  onSimulate,
}: {
  shipmentId: string
  label?: string
  onSimulate: (shipmentId: string, risk: RiskLevel) => void
}) {
  const options: RiskLevel[] = ['SAFE', 'MEDIUM', 'HIGH', 'CRITICAL']
  return (
    <Panel className="border-border p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-[9px] font-bold tracking-[0.13em] text-primary">{label}</span>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Change conditions for {shipmentId} to demonstrate escalating risk.
          </p>
        </div>
        <Activity className="h-4 w-4 text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map(level => (
          <button
            key={level}
            onClick={() => onSimulate(shipmentId, level)}
            className={`rounded-md border px-2 py-2 text-[9px] font-bold tracking-[0.08em] transition-colors hover:brightness-125 ${riskStyle[level]}`}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[9px] text-muted-foreground">Updates shipment, dashboard, and active alerts.</p>
    </Panel>
  )
}

function Esp32TestPanel({
  onClose,
  onSendTelemetry,
}: {
  onClose: () => void
  onSendTelemetry: (
    temp: number,
    hum: number,
    risk?: RiskLevel,
    ax?: number,
    ay?: number,
    az?: number
  ) => Promise<void>
}) {
  const [customTemp, setCustomTemp] = useState('11.8')
  const [customHum, setCustomHum] = useState('89')
  const [customAx, setCustomAx] = useState('0.05')
  const [customAy, setCustomAy] = useState('-0.02')
  const [customAz, setCustomAz] = useState('9.81')
  const [copied, setCopied] = useState(false)

  const curlCommand = `curl -X POST http://localhost:3000/api/device/data \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId":"WN-001","temperature":${customTemp},"humidity":${customHum},"accelerationX":${customAx},"accelerationY":${customAy},"accelerationZ":${customAz}}'`

  const handleCopy = () => {
    navigator.clipboard?.writeText(curlCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault()
    const t = parseFloat(customTemp)
    const h = parseFloat(customHum)
    const ax = parseFloat(customAx)
    const ay = parseFloat(customAy)
    const az = parseFloat(customAz)
    if (!isNaN(t) && !isNaN(h)) {
      onSendTelemetry(t, h, undefined, isNaN(ax) ? 0.05 : ax, isNaN(ay) ? -0.02 : ay, isNaN(az) ? 9.81 : az)
    }
  }

  const applyPreset = (t: number, h: number, ax: number, ay: number, az: number, r?: RiskLevel) => {
    setCustomTemp(t.toString())
    setCustomHum(h.toString())
    setCustomAx(ax.toString())
    setCustomAy(ay.toString())
    setCustomAz(az.toString())
    onSendTelemetry(t, h, r, ax, ay, az)
  }

  return (
    <Panel className="mb-7 border-primary/40 bg-card p-5 shadow-2xl">
      <div className="flex items-start justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/20 p-1 text-primary">
              <Terminal className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold">ESP32 Hardware Telemetry Test Transmitter</h3>
            <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              DHT22 + MPU6050 TESTER
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Test the live physical device pipeline with the active ESP32 thresholds. Transmits real JSON to{' '}
            <code className="rounded bg-secondary px-1 text-primary font-mono text-[10px]">POST /api/device/data</code>.
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            ESP32 THRESHOLD PRESETS (TEMP: 10–13°C · HUM: 85–95% · SHOCK: &lt;1.5g)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => applyPreset(11.8, 89, 0.05, -0.02, 9.81, 'SAFE')}
              className="flex flex-col items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-center transition hover:bg-emerald-400/20"
            >
              <span className="font-mono text-[11px] font-bold text-emerald-300">11.8°C / 89%</span>
              <span className="mt-0.5 font-mono text-[9px] text-emerald-400 font-semibold">0.98 g · Normal</span>
              <span className="mt-1 text-[8px] font-bold text-emerald-400">● SAFE</span>
            </button>
            <button
              onClick={() => applyPreset(14.2, 83, 1.85, -1.20, 10.45, 'WARNING')}
              className="flex flex-col items-center rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-center transition hover:bg-amber-400/20"
            >
              <span className="font-mono text-[11px] font-bold text-amber-200">14.2°C / 83%</span>
              <span className="mt-0.5 font-mono text-[9px] text-amber-300 font-semibold">1.75 g · Warning</span>
              <span className="mt-1 text-[8px] font-bold text-amber-300">⚠️ WARNING</span>
            </button>
            <button
              onClick={() => applyPreset(14.8, 96, 2.20, -1.50, 11.80, 'WARNING')}
              className="flex flex-col items-center rounded-lg border border-orange-400/30 bg-orange-400/10 p-2 text-center transition hover:bg-orange-400/20"
            >
              <span className="font-mono text-[11px] font-bold text-orange-200">14.8°C / 96%</span>
              <span className="mt-0.5 font-mono text-[9px] text-orange-300 font-semibold">2.20 g · Moderate</span>
              <span className="mt-1 text-[8px] font-bold text-orange-300">⚠️ WARNING</span>
            </button>
            <button
              onClick={() => applyPreset(16.5, 76, 4.80, -2.10, 14.50, 'CRITICAL')}
              className="flex flex-col items-center rounded-lg border border-red-400/30 bg-red-400/10 p-2 text-center transition hover:bg-red-400/20"
            >
              <span className="font-mono text-[11px] font-bold text-red-300">16.5°C / 76%</span>
              <span className="mt-0.5 font-mono text-[9px] text-red-400 font-semibold">3.40 g · Critical</span>
              <span className="mt-1 text-[8px] font-bold text-red-400">🔴 CRITICAL</span>
            </button>
          </div>

          <form onSubmit={handleCustomSubmit} className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label>
                <span className="text-[9px] font-semibold text-muted-foreground">TEMP (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  value={customTemp}
                  onChange={e => setCustomTemp(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-[9px] font-semibold text-muted-foreground">HUMIDITY (%)</span>
                <input
                  type="number"
                  step="0.1"
                  value={customHum}
                  onChange={e => setCustomHum(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-[9px] font-semibold text-muted-foreground">ACCEL X</span>
                <input
                  type="number"
                  step="0.01"
                  value={customAx}
                  onChange={e => setCustomAx(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-[9px] font-semibold text-muted-foreground">ACCEL Y</span>
                <input
                  type="number"
                  step="0.01"
                  value={customAy}
                  onChange={e => setCustomAy(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-[9px] font-semibold text-muted-foreground">ACCEL Z</span>
                <input
                  type="number"
                  step="0.01"
                  value={customAz}
                  onChange={e => setCustomAz(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-bold text-primary-foreground hover:brightness-110"
              >
                <Send className="h-3.5 w-3.5" /> Send Telemetry to API
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground">
              TEST FROM TERMINAL OR REAL ESP32
            </p>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[9px] font-semibold text-primary hover:underline"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy cURL'}
            </button>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-[10px] leading-relaxed text-foreground">
            {curlCommand}
          </pre>
          <p className="mt-2 text-[9px] text-muted-foreground">
            Expected JSON format: <code className="font-mono text-primary">&#123;&quot;deviceId&quot;:&quot;WN-001&quot;,&quot;temperature&quot;:11.8,&quot;humidity&quot;:89.0,&quot;accelerationX&quot;:0.05,&quot;accelerationY&quot;:-0.02,&quot;accelerationZ&quot;:9.81&#125;</code>
          </p>
        </div>
      </div>
    </Panel>
  )
}

function ShipmentsPage({
  shipments,
  query,
  setQuery,
  onOpen,
}: {
  shipments: Shipment[]
  query: string
  setQuery: (value: string) => void
  onOpen: (id: string) => void
}) {
  const [filter, setFilter] = useState('ALL')
  const filters = ['ALL', 'REAL_DEVICE', 'SIMULATION', 'SAFE', 'MEDIUM', 'HIGH', 'CRITICAL']

  const visible = shipments.filter(shipment => {
    if (filter === 'ALL') return true
    if (filter === 'REAL_DEVICE') return shipment.source === 'real'
    if (filter === 'SIMULATION') return shipment.source === 'simulation'
    return shipment.reading.risk === filter
  })

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Shipments</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Monitor real physical ESP32 and simulated cargo conditions.
          </p>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-2 font-mono text-[10px] text-muted-foreground">
          {visible.length} RECORDS
        </span>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {filters.map(value => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[9px] font-semibold tracking-wide ${
                  filter === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                {value.replace('_', ' ')}
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search cargo, ID, route…"
              className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground sm:w-56"
            />
          </label>
        </div>

        {visible.length ? (
          <>
            <div className="hidden grid-cols-[1.3fr_0.8fr_1.2fr_0.9fr_1fr_0.8fr] gap-3 border-b border-border bg-secondary/35 px-4 py-3 text-[9px] font-semibold tracking-[0.09em] text-muted-foreground xl:grid">
              <span>SHIPMENT / CARGO</span>
              <span>DATA SOURCE</span>
              <span>ROUTE</span>
              <span>TEMP &amp; HUMIDITY</span>
              <span>CURRENT SHOCK</span>
              <span>CARGO CONDITION</span>
            </div>
            {visible.map(shipment => {
              const shock = getShockPresentation(shipment.reading.shockG, shipment.reading.movementStatus)
              return (
                <button
                  key={shipment.id}
                  onClick={() => onOpen(shipment.id)}
                  className="grid w-full grid-cols-2 gap-3 border-b border-border/70 px-4 py-4 text-left transition-colors hover:bg-secondary/35 last:border-0 xl:grid-cols-[1.3fr_0.8fr_1.2fr_0.9fr_1fr_0.8fr] xl:items-center"
                >
                  <div>
                    <span className="font-mono text-[10px] font-bold text-primary">{shipment.id}</span>
                    <p className="mt-1 text-xs font-medium">{shipment.cargo}</p>
                  </div>
                  <div>
                    <SourceBadge source={shipment.source} />
                  </div>
                  <span className="hidden text-[10px] text-muted-foreground xl:block">
                    {shipment.origin.split(',')[0]} → {shipment.destination.split(',')[0]}
                  </span>
                  <div>
                    <span className="font-mono text-xs font-semibold">{shipment.reading.temperature.toFixed(1)}°C</span>
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{shipment.reading.humidity}%</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="font-mono text-xs font-bold text-foreground">{shock.value}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground truncate">{shock.rawStatus}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between xl:col-span-1">
                    <CargoConditionBadge level={shipment.reading.risk} size="sm" />
                    <span className="text-[9px] text-muted-foreground">{shipment.reading.updated}</span>
                  </div>
                </button>
              )
            })}
          </>
        ) : (
          <EmptyPage
            title="No shipments found"
            text="Try another search or filter, or clear the search to see all shipments."
          />
        )}
      </Panel>
    </div>
  )
}

function ShipmentDetail({
  shipment,
  alerts,
  onDevice,
  onSimulate,
}: {
  shipment: Shipment
  alerts: Alert[]
  onDevice: (id: string) => void
  onSimulate: (shipmentId: string, risk: RiskLevel) => void
}) {
  const isCritical = shipment.reading.risk === 'CRITICAL'
  const otherAlerts = alerts.filter(alert => alert.shipmentId === shipment.id && alert.active)

  const currentShock = shipment.reading.shockG ?? shipment.reading.movement?.shockG ?? 0.2
  const movementStatus = shipment.reading.movementStatus ?? shipment.reading.movement?.userStatus ?? 'Normal handling'
  const shockInfo = getShockPresentation(currentShock, movementStatus)
  const condition = getCargoCondition(shipment.reading.risk)
  const battery = shipment.reading.battery ?? 98

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Header: Shipment ID, Cargo Condition, Source */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[9px] tracking-[0.13em] text-muted-foreground">
            <span>SHIPMENTS</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-primary font-bold">{shipment.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Shipment #{shipment.id}
            </h2>
            <CargoConditionBadge level={shipment.reading.risk} size="lg" />
            <SourceBadge source={shipment.source} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {shipment.cargo} · Active Logistics Monitoring
          </p>
        </div>

        {/* Cargo Status Badge / Integrity Indicator */}
        <div className="rounded-xl border border-border/80 bg-card px-4 py-2.5 text-right">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            CARGO SAFETY STATUS
          </span>
          <span className={`font-mono text-xs font-bold ${condition.textClass}`}>
            {condition.symbol} {condition.title}
          </span>
        </div>
      </div>

      {/* Critical Alert Notice (if applicable) */}
      {isCritical && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/[0.09] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md border border-red-400/30 bg-red-400/20 p-2 text-red-300">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-extrabold tracking-wider text-red-300">
                  CRITICAL CARGO RISK DETECTED
                </span>
                <span className="text-[10px] text-muted-foreground">Immediate action advised</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">
                Environmental conditions or physical impact have exceeded safe operational thresholds.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-red-400/20 pt-2.5 font-mono text-[11px]">
                <span>Temperature: <b className="text-red-300">{shipment.reading.temperature.toFixed(1)}°C</b></span>
                <span>Humidity: <b className="text-red-300">{shipment.reading.humidity}%</b></span>
                <span>Shock: <b className="text-red-300">{shockInfo.value}</b></span>
                <span className="text-muted-foreground">{otherAlerts[0]?.time ?? 'Just now'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Main Dashboard Cards: Temperature, Humidity, Current Shock, Battery */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Temperature Card */}
        <Panel className="p-4 sm:p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              🌡️ TEMPERATURE
            </span>
            <Thermometer className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {shipment.reading.temperature.toFixed(1)}°C
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Safe: 10.0–13.0°C</span>
            <span className={getTemperatureStatus(shipment.reading.temperature) === 'CRITICAL' ? 'font-bold text-red-400' : getTemperatureStatus(shipment.reading.temperature) === 'WARNING' ? 'font-bold text-amber-300' : 'text-emerald-400 font-medium'}>
              {getTemperatureStatus(shipment.reading.temperature)}
            </span>
          </div>
        </Panel>

        {/* Humidity Card */}
        <Panel className="p-4 sm:p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              💧 HUMIDITY
            </span>
            <Droplets className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {shipment.reading.humidity}%
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Safe: 85–95% RH</span>
            <span className={getHumidityStatus(shipment.reading.humidity) === 'CRITICAL' ? 'font-bold text-red-400' : getHumidityStatus(shipment.reading.humidity) === 'WARNING' ? 'font-bold text-amber-300' : 'text-emerald-400 font-medium'}>
              {getHumidityStatus(shipment.reading.humidity)}
            </span>
          </div>
        </Panel>

        {/* Current Shock Card */}
        <Panel className={`p-4 sm:p-5 transition-colors ${
          shockInfo.level === 'critical'
            ? 'border-red-400/40 bg-red-400/[0.05]'
            : shockInfo.level === 'strong'
            ? 'border-orange-400/40 bg-orange-400/[0.05]'
            : shockInfo.level === 'moderate'
            ? 'border-amber-400/35 bg-amber-400/[0.05]'
            : 'hover:border-primary/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              💥 CURRENT SHOCK
            </span>
            <span className={`h-2 w-2 rounded-full ${shockInfo.dotClass}`} />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {shockInfo.value}
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-foreground truncate">{shockInfo.status}</span>
            <span className="text-muted-foreground">Safe: &lt; 1.5 g</span>
          </div>
        </Panel>

        {/* Battery Card */}
        <Panel className="p-4 sm:p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              🔋 BATTERY
            </span>
            <Battery className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {battery}%
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Continuous monitoring</span>
            <span className="text-emerald-400 font-medium">Healthy</span>
          </div>
        </Panel>
      </div>

      {/* 2. Secondary Overview Row: Cargo Movement + Shipment Route + Device Status */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Cargo Movement */}
        <Panel className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              CARGO MOVEMENT
            </span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${shockInfo.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${shockInfo.dotClass}`} />
              {shockInfo.rawStatus}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {shockInfo.description}
          </p>
        </Panel>

        {/* Shipment Route */}
        <Panel className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              SHIPMENT ROUTE
            </span>
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">
            {shipment.origin.split(',')[0]} → {shipment.destination.split(',')[0]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {shipment.origin} to {shipment.destination}
          </p>
          <span className="mt-2 inline-block rounded bg-secondary px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
            Status: IN TRANSIT
          </span>
        </Panel>

        {/* Device */}
        <Panel className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              MONITORING DEVICE
            </span>
            <Wifi className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
            <span className="text-xs text-muted-foreground">
              · Updated {shipment.reading.updated}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Unit ID: <span className="font-mono font-medium text-foreground">{shipment.deviceId}</span>
          </p>
          <button
            onClick={() => onDevice(shipment.deviceId)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            Inspect device unit <ArrowRight className="h-3 w-3" />
          </button>
        </Panel>
      </div>

      {/* 3. Shock / Impact History (Time -> Shock in g) */}
      <ShockHistoryChart shipment={shipment} />

      {/* 4. Activity Log & Event Timeline */}
      <ActivityLogSection shipmentId={shipment.id} />

      {/* 5. Historical Environmental Conditions Charts */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Environmental Conditions History
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Historical temperature and humidity progression throughout transit.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SensorChart shipment={shipment} kind="temperature" />
          <SensorChart shipment={shipment} kind="humidity" />
        </div>
      </div>

      {/* 6. Cargo Safety Evaluation & Simulation Control */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel className="p-5">
          <SectionHeading title="Cargo Safety Evaluation" detail="Overall status evaluated against transit threshold standards." />
          <div className="grid gap-3 sm:grid-cols-3">
            <AnalysisItem
              label="Temperature Condition"
              value={getTemperatureStatus(shipment.reading.temperature)}
              color={getTemperatureStatus(shipment.reading.temperature) === 'CRITICAL' ? 'text-red-300' : getTemperatureStatus(shipment.reading.temperature) === 'WARNING' ? 'text-amber-300' : 'text-emerald-300'}
            />
            <AnalysisItem
              label="Physical Shock Condition"
              value={getShockStatus(currentShock) === 'CRITICAL' ? 'CRITICAL IMPACT' : getShockStatus(currentShock) === 'WARNING' ? 'WARNING' : 'SAFE'}
              color={getShockStatus(currentShock) === 'CRITICAL' ? 'text-red-300' : getShockStatus(currentShock) === 'WARNING' ? 'text-amber-300' : 'text-emerald-300'}
            />
            <AnalysisItem
              label="Humidity Condition"
              value={getHumidityStatus(shipment.reading.humidity)}
              color={getHumidityStatus(shipment.reading.humidity) === 'CRITICAL' ? 'text-red-300' : getHumidityStatus(shipment.reading.humidity) === 'WARNING' ? 'text-amber-300' : 'text-emerald-300'}
            />
          </div>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {isCritical
              ? 'Critical condition detected. Inspection of cargo is advised upon arrival.'
              : shipment.reading.risk === 'SAFE'
              ? 'Shipment is traveling under verified optimal conditions with safe temperature, humidity, and handling.'
              : 'Environmental or handling readings are approaching advisory limits. Continue monitoring closely.'}
          </p>
        </Panel>
        <SimulationControl
          shipmentId={shipment.id}
          label={shipment.source === 'real' ? 'Test Physical Device State' : 'Simulation Control'}
          onSimulate={onSimulate}
        />
      </div>

      {/* 7. Collapsed Technical Details Section */}
      <TechnicalDetailsSection shipment={shipment} defaultOpen={false} />
    </div>
  )
}

function ConditionCard({
  label,
  value,
  icon: Icon,
  foot,
  risk,
}: {
  label: string
  value: string
  icon: typeof Thermometer
  foot: string
  risk?: string
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold tracking-[0.11em] text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${risk ? 'text-amber-200' : 'text-primary'}`} />
      </div>
      <p className="mt-3 font-mono text-[23px] font-semibold">{value}</p>
      <p className="mt-2 text-[9px] text-muted-foreground">{foot}</p>
    </Panel>
  )
}

function AnalysisItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-[10px] font-bold tracking-wide ${color}`}>{value}</p>
    </div>
  )
}

function DevicesPage({ devices, shipments, onOpen }: { devices: Device[]; shipments: Shipment[]; onOpen: (id: string) => void }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Devices</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Monitor your connected physical ESP32 sensor unit and simulated devices.
          </p>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-2 font-mono text-[10px] text-muted-foreground">
          {devices.length} UNITS REGISTERED
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {devices.map(device => {
          const shipment = shipments.find(item => item.deviceId.toLowerCase() === device.id.toLowerCase() || item.id === device.shipmentId)
          return (
            <button
              key={device.id}
              onClick={() => onOpen(device.id)}
              className="rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/35 hover:bg-secondary/20 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-primary/15 bg-primary/10 p-2.5 text-primary">
                    <Cpu className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{device.id}</span>
                      <SourceBadge source={device.source} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {device.source === 'real'
                        ? 'Physical ESP32 environmental unit'
                        : 'Simulated ESP32 virtual unit'}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold tracking-wide text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {device.status}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-[9px] text-muted-foreground">ASSIGNED SHIPMENT</p>
                  <p className="mt-1.5 font-mono text-[11px] font-semibold">{shipment?.id ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">TEMPERATURE</p>
                  <p className="mt-1.5 font-mono text-[11px] font-semibold">
                    {shipment ? `${shipment.reading.temperature.toFixed(1)}°C` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">HUMIDITY</p>
                  <p className="mt-1.5 font-mono text-[11px] font-semibold">
                    {shipment ? `${shipment.reading.humidity}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[9px] text-muted-foreground">
                <span>Last telemetry: {device.lastSeen}</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  Inspect Unit <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DeviceDetail({
  device,
  shipment,
  onShipment,
}: {
  device: Device
  shipment?: Shipment
  onShipment: (id: string) => void
}) {
  const currentShock = shipment?.reading.shockG ?? shipment?.reading.movement?.shockG ?? 0.2
  const movementStatus = shipment?.reading.movementStatus ?? shipment?.reading.movement?.userStatus ?? 'Normal handling'
  const shockInfo = getShockPresentation(currentShock, movementStatus)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-[0.13em] text-primary">MONITORING UNIT</span>
            <SourceBadge source={device.source} />
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{device.id}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {device.source === 'real'
              ? 'Physical Wanees sensor device connected via Wi-Fi'
              : 'Virtual simulated telemetry device'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <CargoConditionBadge level={shipment?.reading.risk || 'SAFE'} size="md" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold tracking-wider uppercase">CONNECTION</span>
            <Wifi className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">Online</p>
          <span className="mt-1 block text-[10px] text-muted-foreground">Updated {device.lastSeen}</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold tracking-wider uppercase">BATTERY</span>
            <Battery className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">{device.battery}%</p>
          <span className="mt-1 block text-[10px] text-emerald-400">Normal reserve</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold tracking-wider uppercase">CARGO SHOCK</span>
            <span className={`h-2 w-2 rounded-full ${shockInfo.dotClass}`} />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">{shockInfo.value}</p>
          <span className="mt-1 block text-[10px] text-muted-foreground truncate">{shockInfo.status}</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold tracking-wider uppercase">CARGO CONDITION</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-foreground">
            {getCargoCondition(shipment?.reading.risk).title}
          </p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {shipment ? `${shipment.reading.temperature.toFixed(1)}°C · ${shipment.reading.humidity}% RH` : 'In transit'}
          </span>
        </Panel>
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            ASSIGNED SHIPMENT &amp; ROUTE
          </p>
          {shipment ? (
            <>
              <p className="mt-1.5 text-sm font-bold text-foreground">
                {shipment.id} · {shipment.cargo}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {shipment.origin.split(',')[0]} → {shipment.destination.split(',')[0]} ({shipment.origin} to {shipment.destination})
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">No active shipment assigned.</p>
          )}
        </div>
        {shipment && (
          <button
            onClick={() => onShipment(shipment.id)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
          >
            Open Shipment Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </Panel>

      {shipment && (
        <>
          <ShockHistoryChart shipment={shipment} />
          <TechnicalDetailsSection shipment={shipment} defaultOpen={false} />
        </>
      )}
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/45 p-3">
      <p className="text-[9px] tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xs font-medium">{value}</p>
    </div>
  )
}

function AlertsPage({ alerts, onOpen }: { alerts: Alert[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState('ALL')
  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'RESOLVED']
  const visible = alerts.filter(alert => filter === 'ALL' || alert.level === filter)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Alerts</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Review conditions requiring immediate operator attention across devices.
          </p>
        </div>
        <span className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 font-mono text-[10px] font-bold text-red-300">
          {alerts.filter(alert => alert.active).length} ACTIVE
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {filters.map(value => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-md border px-3 py-2 text-[9px] font-semibold ${
              filter === value
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-[9px] font-bold tracking-[0.12em] text-muted-foreground">
          {filter === 'ALL' ? 'ALL ACTIVE ALERTS & HISTORY' : `${filter} ALERTS`}
        </div>
        {visible.length ? (
          visible.map(alert => (
            <button
              key={alert.id}
              onClick={() => onOpen(alert.shipmentId)}
              className="flex w-full items-start gap-4 border-b border-border/70 px-4 py-4 text-left transition-colors hover:bg-secondary/35 last:border-0 sm:items-center"
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 ${riskDot[alert.level]}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={alert.level} />
                  <SourceBadge source={alert.source} />
                  <span className="font-mono text-[10px] font-semibold">Shipment #{alert.shipmentId}</span>
                </span>
                <span className="mt-2 block text-xs">{alert.message}</span>
                <span className="mt-1.5 block text-[10px] text-muted-foreground">{alert.time}</span>
              </span>
              <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground sm:mt-0" />
            </button>
          ))
        ) : (
          <EmptyPage title="No active alerts" text="Your shipments are currently operating normally." />
        )}
      </Panel>
    </div>
  )
}

function SettingsPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [saved, setSaved] = useState(false)
  const toggle = (name: string) => (
    <button
      key={name}
      onClick={() => setSaved(true)}
      aria-label={`Toggle ${name}`}
      className="relative h-5 w-9 rounded-full border border-primary/25 bg-primary/70 transition-colors after:absolute after:right-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-primary-foreground after:content-['']"
    >
      <span className="sr-only">{name}</span>
    </button>
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">Manage your account and monitoring preferences.</p>
      </div>

      {saved && (
        <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-300">
          Preference saved for this demo session.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel className="p-5">
          <SectionHeading title="Account" detail="Your WANEES demo profile." />
          <div className="space-y-3">
            <InfoLine label="OPERATOR NAME" value={user.name} />
            <InfoLine label="ORGANIZATION" value={user.company} />
            <InfoLine label="EMAIL ADDRESS" value={user.email} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeading title="Telemetry Ingestion Architecture" detail="Endpoint for physical ESP32 box." />
          <div className="space-y-3">
            <InfoLine label="INGESTION URL" value="/api/device/data (HTTP POST)" />
            <InfoLine label="POLLING FREQUENCY" value="2 seconds" />
            <InfoLine label="SUPPORTED SENSORS" value="Hardware-agnostic (DHT11, DHT22, SHT31, etc.)" />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeading title="Notification Preferences" detail="Choose which shipment events trigger alerts." />
          <div className="space-y-1">
            {['Critical temperature alerts', 'Humidity threshold alerts', 'Physical ESP32 connection drops'].map(name => (
              <div key={name} className="flex items-center justify-between border-b border-border/70 py-3 last:border-0">
                <span className="text-xs">{name}</span>
                {toggle(name)}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between gap-4 border-red-400/15 p-5">
          <div>
            <SectionHeading title="Demo Session" detail="Local in-browser prototype." />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Demo accounts, physical sensor state, and settings are stored locally in this browser.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:border-red-400/30 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </Panel>
      </div>
    </div>
  )
}

function EmptyPage({ title, text, action }: { title: string; text: string; action?: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-5 py-9 text-center">
      <span className="mb-3 rounded-full border border-border bg-secondary/50 p-3 text-muted-foreground">
        <Package className="h-4 w-4" />
      </span>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1.5 max-w-xs text-[10px] leading-relaxed text-muted-foreground">{text}</p>
      {action && (
        <button
          onClick={action}
          className="mt-4 rounded-md bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground"
        >
          Back to overview
        </button>
      )}
    </div>
  )
}

function PublicPage({
  path,
  go,
  onLogin,
  onRegister,
  notice,
  setNotice,
}: {
  path: string
  go: (path: string) => void
  onLogin: (email: string, password: string) => void
  onRegister: (user: User, password: string) => void
  notice: string
  setNotice: (val: string) => void
}) {
  const isLogin = path === '/login'
  const isRegister = path === '/register'

  if (!isLogin && !isRegister) {
    return (
      <div className="min-h-dvh overflow-hidden bg-background text-foreground">
        <header className="relative z-10 mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <button onClick={() => go('/')} className="text-primary">
            <Logo />
          </button>
          <nav className="hidden items-center gap-8 text-[11px] text-muted-foreground md:flex">
            <a href="#platform" className="hover:text-foreground">
              Platform
            </a>
            <a href="#workflow" className="hover:text-foreground">
              How it works
            </a>
            <button onClick={() => go('/login')} className="hover:text-foreground">
              Log in
            </button>
          </nav>
          <button
            onClick={() => go('/register')}
            className="rounded-md bg-primary px-4 py-2.5 text-[10px] font-bold tracking-wide text-primary-foreground transition hover:brightness-110"
          >
            Create account <ArrowRight className="ml-1 inline h-3 w-3" />
          </button>
        </header>
        <main>
          <section className="relative mx-auto grid min-h-[610px] max-w-[1280px] items-center gap-10 px-5 pb-14 pt-10 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:pb-20 md:pt-14">
            <div className="relative z-10 max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded border border-primary/20 bg-primary/[0.07] px-3 py-2 font-mono text-[9px] font-semibold tracking-[0.12em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                SHIPMENT INTELLIGENCE · IOT PROTOTYPE
              </div>
              <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[58px]">
                Wanees watches
                <br />
                over your <span className="text-primary">shipment.</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
                Smart monitoring for every shipment. Stream real-time environmental data from physical ESP32 boxes and
                manage simulated fleets across land, sea, and air.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => go('/login')}
                  className="rounded-md bg-primary px-5 py-3 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                >
                  Enter Dashboard <ArrowRight className="ml-2 inline h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => go('/register')}
                  className="rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold hover:border-primary/40"
                >
                  Create demo account
                </button>
              </div>
              <div className="mt-8 flex items-center gap-4 text-[9px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-300" />
                  Physical ESP32 & Simulated devices
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-300" />
                  Automatic risk thresholds
                </span>
              </div>
            </div>
            <ProductVisual />
          </section>
          <section id="platform" className="border-y border-border/70 bg-card/50">
            <div className="mx-auto grid max-w-[1280px] gap-7 px-5 py-9 sm:grid-cols-3 sm:px-8">
              {[
                {
                  icon: Thermometer,
                  title: 'Environmental telemetry',
                  copy: 'Direct HTTP ingestion from ESP32 sensor units over Wi-Fi.',
                },
                {
                  icon: Activity,
                  title: 'Early risk detection',
                  copy: 'Automated modular classification of temperature and humidity bounds.',
                },
                {
                  icon: Bell,
                  title: 'Mission-control alerts',
                  copy: 'Real-time incident detection with instant operator visibility.',
                },
              ].map((item, index) => (
                <div key={item.title} className="flex gap-4">
                  <span className="font-mono text-[10px] text-primary">0{index + 1}</span>
                  <div>
                    <item.icon className="mb-3 h-4 w-4 text-primary" />
                    <h2 className="text-xs font-semibold">{item.title}</h2>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[1fr_0.88fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex xl:p-14">
        <div className="relative z-10 text-primary">
          <Logo />
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.15em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            WANEES MONITORING NETWORK
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em]">
            Every shipment.
            <br />
            <span className="text-primary">In your field of view.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
            Connect physical ESP32 environmental sensors and monitor virtual fleets from one dashboard.
          </p>
          <div className="mt-10 max-w-[440px]">
            <ProductVisual compact />
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>HACKATHON BUILD · WANEES 01</span>
          <span>PHYSICAL & SIMULATED PIPELINE</span>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <button onClick={() => go('/')} className="mb-10 text-primary lg:hidden">
            <Logo />
          </button>
          <div className="mb-8">
            <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-primary">
              {isLogin ? 'OPERATOR ACCESS' : 'NEW WORKSPACE'}
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {isLogin
                ? 'Sign in to access your Wanees command center.'
                : 'Set up a local operator profile for this demo.'}
            </p>
          </div>
          {isLogin ? (
            <LoginForm onSubmit={onLogin} notice={notice} setNotice={setNotice} />
          ) : (
            <RegisterForm onSubmit={onRegister} notice={notice} />
          )}
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            {isLogin ? 'Don’t have an account?' : 'Already registered?'}{' '}
            <button
              onClick={() => go(isLogin ? '/register' : '/login')}
              className="font-semibold text-primary hover:underline"
            >
              {isLogin ? 'Create one' : 'Log in'}
            </button>
          </p>
          <button
            onClick={() => go('/')}
            className="mx-auto mt-8 flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to WANEES
          </button>
        </div>
      </section>
    </div>
  )
}

function ProductVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative ${
        compact ? 'h-[230px]' : 'h-[380px]'
      } w-full overflow-hidden rounded-xl border border-border/80 bg-[#0d1828] p-4 sm:p-6`}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(75,140,175,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(75,140,175,.08) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[8px] tracking-[0.14em] text-slate-400">WANEES SENSOR NETWORK</span>
        <LiveDot label="ESP32 LINK ACTIVE" />
      </div>
      <div className="relative mt-5 grid h-[calc(100%-44px)] grid-cols-[0.85fr_1fr] gap-3">
        <div className="flex flex-col justify-between rounded-lg border border-slate-700/70 bg-slate-900/75 p-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[8px] text-slate-300">WN-001 (ESP32)</span>
          </div>
          <div>
            <p className="font-mono text-[8px] text-slate-400">PHYSICAL SHIPMENT</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-100">Fresh mango export</p>
            <div className="mt-4 h-px bg-slate-700" />
            <div className="mt-3 flex justify-between">
              <span className="text-[8px] text-slate-400">Cairo</span>
              <span className="text-primary">········→</span>
              <span className="text-[8px] text-slate-400">Rotterdam</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-slate-700/70 bg-slate-900/75 p-3">
          <span className="font-mono text-[8px] text-slate-400">ENVIRONMENTAL TELEMETRY</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-slate-800/70 p-2">
              <Thermometer className="h-3 w-3 text-primary" />
              <p className="mt-2 font-mono text-sm font-semibold text-slate-100">27.4°</p>
              <p className="mt-0.5 text-[7px] text-slate-400">TEMPERATURE</p>
            </div>
            <div className="rounded-md bg-slate-800/70 p-2">
              <Globe2 className="h-3 w-3 text-emerald-300" />
              <p className="mt-2 font-mono text-sm font-semibold text-slate-100">53%</p>
              <p className="mt-0.5 text-[7px] text-slate-400">HUMIDITY</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-2">
            <span className="text-[8px] text-slate-300">SHIPMENT RISK</span>
            <span className="text-[8px] font-bold tracking-wider text-emerald-300">● SAFE</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginForm({
  onSubmit,
  notice,
  setNotice,
}: {
  onSubmit: (email: string, password: string) => void
  notice: string
  setNotice: (val: string) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit(String(data.get('email')), String(data.get('password')))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-[10px] font-semibold">Email address</span>
        <input
          name="email"
          required
          type="email"
          defaultValue="demo@wanees.com"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-11 w-full rounded-md border border-border bg-card px-3 text-xs outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-[10px] font-semibold">Password</span>
        <input
          name="password"
          required
          type="password"
          defaultValue="wanees123"
          autoComplete="current-password"
          placeholder="Enter your password"
          className="h-11 w-full rounded-md border border-border bg-card px-3 text-xs outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <input type="checkbox" defaultChecked className="accent-[var(--primary)]" />
          Remember me
        </label>
        <button
          type="button"
          onClick={() => setNotice('Demo accounts use demo@wanees.com / wanees123.')}
          className="text-[10px] text-primary hover:underline"
        >
          Forgot password?
        </button>
      </div>
      {notice && (
        <p role="alert" className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[10px] leading-relaxed text-red-300">
          {notice}
        </p>
      )}
      <button
        type="submit"
        className="h-11 w-full rounded-md bg-primary text-xs font-bold text-primary-foreground transition hover:brightness-110"
      >
        Log in <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
      </button>
      <div className="rounded-md border border-primary/15 bg-primary/[0.05] p-3">
        <p className="text-[9px] font-bold tracking-wide text-primary">DEMO CREDENTIALS</p>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
          demo@wanees.com <span className="mx-1 text-border">/</span> wanees123
        </p>
      </div>
    </form>
  )
}

function RegisterForm({ onSubmit, notice }: { onSubmit: (user: User, password: string) => void; notice: string }) {
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password'))
    if (password !== String(data.get('confirmPassword'))) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.')
      return
    }
    setError('')
    onSubmit(
      {
        name: String(data.get('name')),
        company: String(data.get('company')),
        email: String(data.get('email')),
      },
      password
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold">Full name</span>
        <input
          name="name"
          required
          autoComplete="name"
          placeholder="Ahmed Hassan"
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-primary/60"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold">Company name</span>
        <input
          name="company"
          required
          autoComplete="organization"
          placeholder="Company Ltd."
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-primary/60"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold">Email address</span>
        <input
          name="email"
          required
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-primary/60"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-semibold">Password</span>
          <input
            name="password"
            required
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 chars"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-primary/60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-semibold">Confirm password</span>
          <input
            name="confirmPassword"
            required
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-primary/60"
          />
        </label>
      </div>
      {(error || notice) && (
        <p role="alert" className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[10px] text-red-300">
          {error || notice}
        </p>
      )}
      <button
        type="submit"
        className="mt-1 h-11 w-full rounded-md bg-primary text-xs font-bold text-primary-foreground hover:brightness-110"
      >
        Create account <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
      </button>
      <p className="text-center text-[9px] leading-relaxed text-muted-foreground">
        Demo profiles are stored locally in this browser.
      </p>
    </form>
  )
}
