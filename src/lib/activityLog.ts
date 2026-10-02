export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ActivityEvent {
  id: string;
  shipmentId: string;
  timestamp: string;
  date?: string;
  eventType: string;
  message: string;
  severity: EventSeverity;
  metric?: string;
}

const STORAGE_KEY = 'wanees_activity_log_v2';

const initialEvents: ActivityEvent[] = [
  {
    id: 'evt-007',
    shipmentId: 'WN-001',
    timestamp: '10:42:31',
    eventType: 'Shock detected',
    message: 'Shock detected (1.8 g) - Cargo bumped during transport transfer at Alexandria port',
    severity: 'WARNING',
    metric: '1.8 g',
  },
  {
    id: 'evt-006',
    shipmentId: 'WN-001',
    timestamp: '10:35:10',
    eventType: 'GPS/location updated',
    message: 'GPS coordinates updated: Vessel en route Mediterranean shipping lane (31.24°N, 29.98°E)',
    severity: 'INFO',
  },
  {
    id: 'evt-005',
    shipmentId: 'WN-001',
    timestamp: '10:20:00',
    eventType: 'Humidity entered WARNING',
    message: 'Humidity dropped to 83% during reefer door inspection test (threshold: 85% - 95%)',
    severity: 'WARNING',
    metric: '83%',
  },
  {
    id: 'evt-004',
    shipmentId: 'WN-001',
    timestamp: '10:12:15',
    eventType: 'Cargo condition changed',
    message: 'Cargo condition evaluated SAFE · Reefer container stabilized at 11.8°C / 89% RH',
    severity: 'INFO',
    metric: '11.8°C',
  },
  {
    id: 'evt-003',
    shipmentId: 'WN-001',
    timestamp: '09:45:00',
    eventType: 'GPS route started',
    message: 'GPS route initiated: Cairo Agricultural Depot departure to Rotterdam Port',
    severity: 'INFO',
  },
  {
    id: 'evt-002',
    shipmentId: 'WN-001',
    timestamp: '09:30:00',
    eventType: 'Device connected',
    message: 'Device connected: Wanees-001 ESP32 sensor unit online and transmitting via Wi-Fi',
    severity: 'INFO',
  },
  {
    id: 'evt-001',
    shipmentId: 'WN-001',
    timestamp: '09:15:00',
    eventType: 'Shipment started',
    message: 'Shipment started: Fresh Mango Export loaded, sealed, and assigned to Wanees-001',
    severity: 'INFO',
  },
];

class ActivityLogService {
  private events: ActivityEvent[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') {
      this.events = [...initialEvents];
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.events = JSON.parse(stored);
      } else {
        this.events = [...initialEvents];
        this.save();
      }
    } catch {
      this.events = [...initialEvents];
    }
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      /* ignore */
    }
  }

  public getEvents(shipmentId?: string): ActivityEvent[] {
    if (shipmentId) {
      return this.events.filter(e => e.shipmentId === shipmentId);
    }
    return [...this.events];
  }

  public logEvent(
    shipmentId: string,
    eventType: string,
    message: string,
    severity: EventSeverity,
    metric?: string
  ): ActivityEvent {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const event: ActivityEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      shipmentId,
      timestamp,
      date: now.toLocaleDateString(),
      eventType,
      message,
      severity,
      metric,
    };

    // Prepend new event
    this.events.unshift(event);
    // Keep last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }
    this.save();
    this.notify();
    return event;
  }

  public clear(shipmentId?: string) {
    if (shipmentId) {
      this.events = this.events.filter(e => e.shipmentId !== shipmentId);
    } else {
      this.events = [...initialEvents];
    }
    this.save();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

export const activityLogService = new ActivityLogService();
