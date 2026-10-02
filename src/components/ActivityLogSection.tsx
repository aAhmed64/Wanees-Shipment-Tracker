import { useState, useEffect } from 'react'
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  Filter,
  PlusCircle,
  Radio,
  Zap,
  MapPin,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { activityLogService, type ActivityEvent, type EventSeverity } from '@/lib/activityLog'

interface ActivityLogSectionProps {
  shipmentId: string
}

export function ActivityLogSection({ shipmentId }: ActivityLogSectionProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(() =>
    activityLogService.getEvents(shipmentId)
  )
  const [filter, setFilter] = useState<'ALL' | 'WARNINGS_CRITICAL'>('ALL')
  const [showSimMenu, setShowSimMenu] = useState(false)

  useEffect(() => {
    const update = () => {
      setEvents(activityLogService.getEvents(shipmentId))
    }
    update()
    const unsubscribe = activityLogService.subscribe(update)
    return () => unsubscribe()
  }, [shipmentId])

  const visibleEvents = events.filter(e => {
    if (filter === 'WARNINGS_CRITICAL') {
      return e.severity === 'WARNING' || e.severity === 'CRITICAL'
    }
    return true
  })

  const warningCriticalCount = events.filter(
    e => e.severity === 'WARNING' || e.severity === 'CRITICAL'
  ).length

  // Quick simulation options for testing / demo
  const handleSimulateEvent = (type: string, message: string, severity: EventSeverity, metric?: string) => {
    activityLogService.logEvent(shipmentId, type, message, severity, metric)
    setShowSimMenu(false)
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                Activity Log &amp; Event Timeline
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological audit trail of environmental alerts, shock impacts, and device events
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="flex rounded-lg border border-border bg-secondary/30 p-0.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filter === 'ALL'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setFilter('WARNINGS_CRITICAL')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filter === 'WARNINGS_CRITICAL'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span>Warnings &amp; Critical</span>
              {warningCriticalCount > 0 && (
                <span className="rounded-full bg-red-400/20 px-1.5 py-0.2 text-[10px] font-bold text-red-300">
                  {warningCriticalCount}
                </span>
              )}
            </button>
          </div>

          {/* Test Event Simulator Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Simulate Event</span>
            </button>

            {showSimMenu && (
              <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-popover p-2 shadow-2xl backdrop-blur-md">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Test Event Triggers
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() =>
                      handleSimulateEvent(
                        'Shock detected',
                        'Shock detected (1.8 g) - Cargo bumped during transport transfer',
                        'WARNING',
                        '1.8 g'
                      )
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Shock Warning (1.8 g)</span>
                      <p className="text-[10px] text-muted-foreground">Cargo bump during forklift transfer</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSimulateEvent(
                        'Critical impact detected',
                        'Critical impact detected (3.4 g) - Severe physical shock during vessel berthing',
                        'CRITICAL',
                        '3.4 g'
                      )
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Critical Impact (3.4 g)</span>
                      <p className="text-[10px] text-muted-foreground">Exceeds 3.0 g threshold alert</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSimulateEvent(
                        'Temperature entered WARNING',
                        'Temperature entered WARNING (14.2°C) - Reefer ambient drift (threshold: 10–13°C)',
                        'WARNING',
                        '14.2°C'
                      )
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Temp Warning (14.2°C)</span>
                      <p className="text-[10px] text-muted-foreground">Reefer compartment temperature rise</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSimulateEvent(
                        'Cargo condition changed',
                        'Cargo condition updated to SAFE - Environmental parameters nominal',
                        'INFO'
                      )
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Cargo Condition: SAFE</span>
                      <p className="text-[10px] text-muted-foreground">Restored to nominal limits</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSimulateEvent(
                        'GPS/location updated',
                        'GPS location updated: Transit checkpoint passed at Port Said Canal entry',
                        'INFO'
                      )
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">GPS Location Updated</span>
                      <p className="text-[10px] text-muted-foreground">Waypoint check passed</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Events List */}
      <div className="mt-5">
        {visibleEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No events match the selected filter.
          </div>
        ) : (
          <div className="relative space-y-3 pl-4 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-[2px] before:bg-border/70">
            {visibleEvents.map((evt, idx) => {
              const isCrit = evt.severity === 'CRITICAL'
              const isWarn = evt.severity === 'WARNING'

              const icon = isCrit ? (
                <AlertCircle className="h-4 w-4 text-red-400" />
              ) : isWarn ? (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              ) : (
                <Info className="h-4 w-4 text-sky-400" />
              )

              const badgeStyle = isCrit
                ? 'border-red-400/40 bg-red-400/15 text-red-300'
                : isWarn
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                : 'border-sky-400/30 bg-sky-400/10 text-sky-300'

              return (
                <div key={evt.id || idx} className="relative flex items-start gap-3 group">
                  {/* Timeline node icon */}
                  <div
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card ${
                      isCrit
                        ? 'border-red-400/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                        : isWarn
                        ? 'border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'border-border/80'
                    }`}
                  >
                    {icon}
                  </div>

                  {/* Event content box */}
                  <div className="flex-1 rounded-lg border border-border/70 bg-background/50 p-3 text-xs transition-colors group-hover:border-primary/40 group-hover:bg-background/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {evt.timestamp}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="font-semibold text-foreground">
                          {evt.eventType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {evt.metric && (
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                            {evt.metric}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider ${badgeStyle}`}
                        >
                          {evt.severity === 'CRITICAL' ? '🔴 CRITICAL' : evt.severity === 'WARNING' ? '⚠️ WARNING' : 'ℹ️ INFO'}
                        </span>
                      </div>
                    </div>

                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {evt.message}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
