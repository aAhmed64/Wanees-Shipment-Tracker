/**
 * WANEES Data Provider Architecture
 * 
 * Provides a normalized data layer for both physical ESP32 devices and
 * simulated shipments.
 * 
 * Hierarchy:
 * Real ESP32 -> /api/device/data -> RealDeviceProvider -> Normalized Wanees Data -> Dashboard
 * Simulation Engine             -> SimulationProvider -> Normalized Wanees Data -> Dashboard
 */

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type DataSource = 'real' | 'simulation';

/**
 * Normalized Wanees Device Data Model
 * Unified structure consumed by the dashboard regardless of whether
 * telemetry originated from physical hardware or the simulation engine.
 */
export interface NormalizedDeviceData {
  deviceId: string;
  temperature: number;
  humidity: number;
  risk: RiskLevel;
  deviceStatus: DeviceStatus;
  timestamp: string;
  source: DataSource;
  battery?: number;
  shipmentId?: string;
  cargo?: string;
  origin?: string;
  destination?: string;
  firmware?: string;
  lastSeen?: string;
  latitude?: number;
  longitude?: number;
  signalStrength?: number;
}

export interface HistoricalReading {
  time: string;
  temperature: number;
  humidity: number;
}

/**
 * Modular Risk Classification
 * Preserves Wanees threshold logic:
 * - SAFE: Temp < 29°C and Humidity < 71%
 * - MEDIUM: Temp 29–31.9°C or Humidity 71–75%
 * - HIGH: Temp 32–34.9°C or Humidity 76–79%
 * - CRITICAL: Temp >= 35°C or Humidity >= 80%
 */
export function calculateRisk(temperature: number, humidity: number): RiskLevel {
  if (temperature >= 35 || humidity >= 80) return 'CRITICAL';
  if (temperature >= 32 || humidity >= 76) return 'HIGH';
  if (temperature >= 29 || humidity >= 71) return 'MEDIUM';
  return 'SAFE';
}

/**
 * Common Data Provider Interface
 */
export interface WaneesDataProvider {
  getDevice(deviceId: string): Promise<NormalizedDeviceData | null>;
  getAllDevices(): Promise<NormalizedDeviceData[]>;
}

// Keys for persistence
const REAL_STORAGE_KEY = 'wanees_real_device_telemetry';
const SIM_STORAGE_KEY = 'wanees_simulation_overrides';

/**
 * Real Device Provider
 * Communicates with the physical ESP32 via HTTP API (/api/device/data).
 */
export class RealDeviceProvider implements WaneesDataProvider {
  private lastKnownData: NormalizedDeviceData = {
    deviceId: 'WN-001',
    temperature: 27.4,
    humidity: 53,
    risk: 'SAFE',
    deviceStatus: 'ONLINE',
    timestamp: new Date().toISOString(),
    source: 'real',
    battery: 98,
    shipmentId: 'WN-001',
    cargo: 'Fresh Mango Export (Physical ESP32)',
    origin: 'Cairo, Egypt',
    destination: 'Rotterdam, Netherlands',
    firmware: 'v1.4.2-esp32',
    lastSeen: 'Just now',
  };

  private history: HistoricalReading[] = [
    { time: '00:00', temperature: 24.2, humidity: 50 },
    { time: '04:00', temperature: 25.0, humidity: 51 },
    { time: '08:00', temperature: 25.8, humidity: 52 },
    { time: '12:00', temperature: 26.5, humidity: 52 },
    { time: '16:00', temperature: 27.1, humidity: 53 },
    { time: 'Now', temperature: 27.4, humidity: 53 },
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(REAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          this.lastKnownData = { ...this.lastKnownData, ...parsed, source: 'real' };
        }
      } catch {
        /* ignore */
      }
    }
  }

  async fetchLatestTelemetry(deviceId = 'WN-001'): Promise<NormalizedDeviceData> {
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/device/data?deviceId=${encodeURIComponent(deviceId)}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const remote = json.data;
            const updated: NormalizedDeviceData = {
              ...this.lastKnownData,
              deviceId: remote.deviceId || deviceId,
              temperature: remote.temperature,
              humidity: remote.humidity,
              risk: remote.risk || calculateRisk(remote.temperature, remote.humidity),
              deviceStatus: remote.deviceStatus || 'ONLINE',
              timestamp: remote.timestamp || new Date().toISOString(),
              source: 'real',
              battery: remote.battery ?? this.lastKnownData.battery,
              lastSeen: 'Just now',
            };

            this.lastKnownData = updated;
            this.recordHistory(updated.temperature, updated.humidity);

            try {
              localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(updated));
            } catch {
              /* ignore */
            }

            return updated;
          }
        }
      }
    } catch {
      // Offline fallback: continue serving cached state
    }
    return this.lastKnownData;
  }

  async getDevice(deviceId: string): Promise<NormalizedDeviceData | null> {
    if (deviceId.toUpperCase() === 'WN-001' || deviceId.toLowerCase() === 'wanees-001') {
      return this.fetchLatestTelemetry(deviceId);
    }
    return null;
  }

  async getAllDevices(): Promise<NormalizedDeviceData[]> {
    const dev = await this.fetchLatestTelemetry('WN-001');
    return [dev];
  }

  /**
   * Helper for development/testing: Post test telemetry directly to the API
   */
  async sendTestTelemetry(temperature: number, humidity: number, riskOverride?: RiskLevel): Promise<NormalizedDeviceData> {
    const risk = riskOverride || calculateRisk(temperature, humidity);
    const payload = {
      deviceId: 'WN-001',
      temperature,
      humidity,
      risk,
      deviceStatus: 'ONLINE' as const,
      timestamp: new Date().toISOString(),
      source: 'real' as const,
    };

    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/device/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      /* ignore */
    }

    this.lastKnownData = { ...this.lastKnownData, ...payload };
    this.recordHistory(temperature, humidity);

    try {
      localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(this.lastKnownData));
    } catch {
      /* ignore */
    }

    return this.lastKnownData;
  }

  getHistory(): HistoricalReading[] {
    return [...this.history];
  }

  private recordHistory(temperature: number, humidity: number) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Update or append
    if (this.history.length >= 8) {
      this.history.shift();
    }
    this.history[this.history.length - 1] = {
      time: 'Now',
      temperature,
      humidity,
    };
  }
}

/**
 * Simulation Provider
 * Manages virtual devices (WN-002, WN-003, WN-004) with customizable risk conditions.
 */
export class SimulationProvider implements WaneesDataProvider {
  private baseDevices: Record<string, NormalizedDeviceData> = {
    'WN-002': {
      deviceId: 'WN-002',
      temperature: 30.8,
      humidity: 75,
      risk: 'MEDIUM',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 84,
      shipmentId: 'WN-002',
      cargo: 'Premium Mango Export',
      origin: 'Cairo, Egypt',
      destination: 'Jeddah, Saudi Arabia',
      firmware: 'v1.4.2-sim',
      lastSeen: '10 sec ago',
    },
    'WN-003': {
      deviceId: 'WN-003',
      temperature: 35.8,
      humidity: 82,
      risk: 'CRITICAL',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 76,
      shipmentId: 'WN-003',
      cargo: 'Fresh Agricultural Cargo',
      origin: 'Cairo, Egypt',
      destination: 'Dubai, UAE',
      firmware: 'v1.4.1-sim',
      lastSeen: '5 sec ago',
    },
    'WN-004': {
      deviceId: 'WN-004',
      temperature: 24.5,
      humidity: 62,
      risk: 'SAFE',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 91,
      shipmentId: 'WN-004',
      cargo: 'Pharmaceutical Vaccines (Cold Chain)',
      origin: 'Alexandria, Egypt',
      destination: 'Amman, Jordan',
      firmware: 'v1.4.2-sim',
      lastSeen: '12 sec ago',
    },
  };

  private simulationProfiles: Record<RiskLevel, { temperature: number; humidity: number }> = {
    SAFE: { temperature: 27.4, humidity: 68 },
    MEDIUM: { temperature: 30.8, humidity: 75 },
    HIGH: { temperature: 33.5, humidity: 79 },
    CRITICAL: { temperature: 35.8, humidity: 82 },
  };

  private getOverrides(): Record<string, RiskLevel> {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(SIM_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  setSimulationRisk(deviceId: string, risk: RiskLevel) {
    if (typeof window === 'undefined') return;
    const overrides = this.getOverrides();
    overrides[deviceId] = risk;
    try {
      localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      /* ignore */
    }
  }

  async getDevice(deviceId: string): Promise<NormalizedDeviceData | null> {
    const base = this.baseDevices[deviceId];
    if (!base) return null;

    const overrides = this.getOverrides();
    const activeRisk = overrides[deviceId] || base.risk;
    const profile = this.simulationProfiles[activeRisk];

    return {
      ...base,
      risk: activeRisk,
      temperature: profile.temperature,
      humidity: profile.humidity,
      source: 'simulation',
      lastSeen: 'Just now',
    };
  }

  async getAllDevices(): Promise<NormalizedDeviceData[]> {
    const overrides = this.getOverrides();
    return Object.keys(this.baseDevices).map(id => {
      const base = this.baseDevices[id];
      const activeRisk = overrides[id] || base.risk;
      const profile = this.simulationProfiles[activeRisk];
      return {
        ...base,
        risk: activeRisk,
        temperature: profile.temperature,
        humidity: profile.humidity,
        source: 'simulation',
        lastSeen: 'Just now',
      };
    });
  }
}

/**
 * Unified Wanees Data Service
 * Dashboard queries this service, which abstracts both real and simulated feeds.
 */
class WaneesDataServiceManager {
  public realProvider = new RealDeviceProvider();
  public simProvider = new SimulationProvider();
  private listeners: Set<() => void> = new Set();
  private pollTimer: any = null;

  constructor() {
    this.startPolling();
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch {
        /* ignore */
      }
    });
  }

  startPolling(intervalMs = 2000) {
    if (typeof window === 'undefined') return;
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      await this.realProvider.fetchLatestTelemetry('WN-001');
      this.notify();
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async getAllDevices(): Promise<NormalizedDeviceData[]> {
    const real = await this.realProvider.getAllDevices();
    const sim = await this.simProvider.getAllDevices();
    return [...real, ...sim];
  }

  async getDevice(id: string): Promise<NormalizedDeviceData | null> {
    const isReal = id.toUpperCase() === 'WN-001' || id.toLowerCase() === 'wanees-001';
    if (isReal) {
      return this.realProvider.getDevice('WN-001');
    }
    return this.simProvider.getDevice(id);
  }

  simulateDevice(deviceId: string, risk: RiskLevel) {
    if (deviceId.toUpperCase() === 'WN-001' || deviceId.toLowerCase() === 'wanees-001') {
      const presets: Record<RiskLevel, { temp: number; hum: number }> = {
        SAFE: { temp: 27.4, hum: 53 },
        MEDIUM: { temp: 31.8, hum: 76 },
        HIGH: { temp: 34.0, hum: 78 },
        CRITICAL: { temp: 37.2, hum: 85 },
      };
      const p = presets[risk];
      this.realProvider.sendTestTelemetry(p.temp, p.hum, risk);
    } else {
      this.simProvider.setSimulationRisk(deviceId, risk);
    }
    this.notify();
  }

  async triggerTestTelemetry(temp: number, hum: number, risk?: RiskLevel) {
    const res = await this.realProvider.sendTestTelemetry(temp, hum, risk);
    this.notify();
    return res;
  }
}

export const waneesDataService = new WaneesDataServiceManager();
