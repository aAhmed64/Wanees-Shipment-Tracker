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
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SLEEP' | 'WARNING' | 'ERROR';
export type DataSource = 'real' | 'simulation';

export interface ActuatorState {
  ledGreen: boolean;
  ledYellow: boolean;
  ledRed: boolean;
  buzzer: boolean;
  stateSummary: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0 - 100
  factors: string[];
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
}

/**
 * Normalized Wanees Device Data Model
 * Extensible data model consumed across the entire dashboard.
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
  signalStrength?: number;
  location?: GpsLocation;
  latitude?: number;
  longitude?: number;
  sensors?: Record<string, number | boolean | string>;
  riskAssessment?: RiskAssessment;
  actuators?: ActuatorState;
  shipmentId?: string;
  cargo?: string;
  origin?: string;
  destination?: string;
  firmware?: string;
  lastSeen?: string;
  metadata?: Record<string, any>;
}

export interface HistoricalReading {
  time: string;
  temperature: number;
  humidity: number;
}

/**
 * Modular Risk Classification
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

export function computeRiskAssessment(
  temperature: number,
  humidity: number,
  overrideRisk?: string
): RiskAssessment {
  if (overrideRisk && ['SAFE', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(overrideRisk.toUpperCase())) {
    const level = overrideRisk.toUpperCase() as RiskLevel;
    const scores: Record<RiskLevel, number> = { SAFE: 10, MEDIUM: 45, HIGH: 75, CRITICAL: 95 };
    return {
      level,
      score: scores[level],
      factors: [`Manual risk override set to ${level}`],
    };
  }

  const factors: string[] = [];
  let score = 0;

  if (temperature >= 35) {
    factors.push(`Critical temperature threshold exceeded: ${temperature.toFixed(1)}°C (limit: < 29°C)`);
    score += 55;
  } else if (temperature >= 32) {
    factors.push(`Elevated temperature detected: ${temperature.toFixed(1)}°C`);
    score += 40;
  } else if (temperature >= 29) {
    factors.push(`Moderate temperature warning: ${temperature.toFixed(1)}°C`);
    score += 25;
  } else {
    factors.push(`Temperature nominal: ${temperature.toFixed(1)}°C`);
    score += 5;
  }

  if (humidity >= 80) {
    factors.push(`Critical humidity threshold exceeded: ${humidity}% (limit: < 71%)`);
    score += 45;
  } else if (humidity >= 76) {
    factors.push(`High humidity condition: ${humidity}%`);
    score += 35;
  } else if (humidity >= 71) {
    factors.push(`Moderate humidity advisory: ${humidity}%`);
    score += 20;
  } else {
    factors.push(`Humidity nominal: ${humidity}%`);
    score += 5;
  }

  let level: RiskLevel = 'SAFE';
  if (temperature >= 35 || humidity >= 80) level = 'CRITICAL';
  else if (temperature >= 32 || humidity >= 76) level = 'HIGH';
  else if (temperature >= 29 || humidity >= 71) level = 'MEDIUM';

  return {
    level,
    score: Math.min(100, score),
    factors,
  };
}

export function computeActuators(risk: RiskLevel, status: DeviceStatus): ActuatorState {
  if (status === 'OFFLINE') {
    return {
      ledGreen: false,
      ledYellow: false,
      ledRed: false,
      buzzer: false,
      stateSummary: 'Device offline - all actuators standby',
    };
  }

  switch (risk) {
    case 'CRITICAL':
      return {
        ledGreen: false,
        ledYellow: false,
        ledRed: true,
        buzzer: true,
        stateSummary: 'CRITICAL ALERT: Red LED Active & Alarm Buzzer Sounding',
      };
    case 'HIGH':
      return {
        ledGreen: false,
        ledYellow: false,
        ledRed: true,
        buzzer: false,
        stateSummary: 'HIGH RISK: Red Warning LED Active (Buzzer Silent)',
      };
    case 'MEDIUM':
      return {
        ledGreen: false,
        ledYellow: true,
        ledRed: false,
        buzzer: false,
        stateSummary: 'MEDIUM RISK: Yellow Advisory LED Active',
      };
    case 'SAFE':
    default:
      return {
        ledGreen: true,
        ledYellow: false,
        ledRed: false,
        buzzer: false,
        stateSummary: 'SAFE: Green LED Active (Nominal Environmental Range)',
      };
  }
}

/**
 * Common Data Provider Interface
 */
export interface WaneesDataProvider {
  getDevice(deviceId: string): Promise<NormalizedDeviceData | null>;
  getAllDevices(): Promise<NormalizedDeviceData[]>;
}

// Storage keys
const REAL_STORAGE_KEY = 'wanees_real_device_telemetry';
const SIM_STORAGE_KEY = 'wanees_simulation_overrides';

/**
 * Real Device Provider
 * Communicates with the physical ESP32 via HTTP API (/api/device/data).
 */
export class RealDeviceProvider implements WaneesDataProvider {
  private lastKnownData: NormalizedDeviceData;
  private history: HistoricalReading[] = [
    { time: '00:00', temperature: 24.2, humidity: 50 },
    { time: '04:00', temperature: 25.0, humidity: 51 },
    { time: '08:00', temperature: 25.8, humidity: 52 },
    { time: '12:00', temperature: 26.5, humidity: 52 },
    { time: '16:00', temperature: 27.1, humidity: 53 },
    { time: 'Now', temperature: 27.4, humidity: 53 },
  ];

  constructor() {
    const baseAssessment = computeRiskAssessment(27.4, 53);
    this.lastKnownData = {
      deviceId: 'WN-001',
      temperature: 27.4,
      humidity: 53,
      risk: 'SAFE',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'real',
      battery: 98,
      signalStrength: -65,
      location: { latitude: 30.0444, longitude: 31.2357 },
      latitude: 30.0444,
      longitude: 31.2357,
      riskAssessment: baseAssessment,
      actuators: computeActuators('SAFE', 'ONLINE'),
      shipmentId: 'WN-001',
      cargo: 'Fresh Mango Export (Physical ESP32)',
      origin: 'Cairo, Egypt',
      destination: 'Rotterdam, Netherlands',
      firmware: 'v1.4.2-esp32',
      lastSeen: 'Just now',
    };

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
            const temp = remote.temperature ?? this.lastKnownData.temperature;
            const hum = remote.humidity ?? this.lastKnownData.humidity;
            const risk = remote.risk || calculateRisk(temp, hum);
            const status = remote.deviceStatus || 'ONLINE';

            const updated: NormalizedDeviceData = {
              ...this.lastKnownData,
              deviceId: remote.deviceId || deviceId,
              temperature: temp,
              humidity: hum,
              risk,
              deviceStatus: status,
              timestamp: remote.timestamp || new Date().toISOString(),
              source: 'real',
              battery: remote.battery ?? this.lastKnownData.battery,
              signalStrength: remote.signalStrength ?? this.lastKnownData.signalStrength,
              location: remote.location ?? this.lastKnownData.location,
              latitude: remote.latitude ?? remote.location?.latitude ?? this.lastKnownData.latitude,
              longitude: remote.longitude ?? remote.location?.longitude ?? this.lastKnownData.longitude,
              sensors: remote.sensors ?? this.lastKnownData.sensors,
              riskAssessment: remote.riskAssessment ?? computeRiskAssessment(temp, hum, risk),
              actuators: remote.actuators ?? computeActuators(risk, status),
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
      // Offline fallback
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

  async sendTestTelemetry(
    temperature: number,
    humidity: number,
    riskOverride?: RiskLevel,
    extraFields?: Partial<NormalizedDeviceData>
  ): Promise<NormalizedDeviceData> {
    const risk = riskOverride || calculateRisk(temperature, humidity);
    const riskAssessment = computeRiskAssessment(temperature, humidity, risk);
    const deviceStatus: DeviceStatus = extraFields?.deviceStatus || 'ONLINE';
    const actuators = computeActuators(risk, deviceStatus);

    const payload = {
      deviceId: 'WN-001',
      temperature,
      humidity,
      risk,
      deviceStatus,
      timestamp: new Date().toISOString(),
      source: 'real' as const,
      battery: extraFields?.battery ?? this.lastKnownData.battery ?? 98,
      signalStrength: extraFields?.signalStrength ?? this.lastKnownData.signalStrength ?? -65,
      location: extraFields?.location ?? this.lastKnownData.location,
      latitude: extraFields?.latitude ?? this.lastKnownData.latitude,
      longitude: extraFields?.longitude ?? this.lastKnownData.longitude,
      sensors: extraFields?.sensors,
      riskAssessment,
      actuators,
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
      signalStrength: -72,
      location: { latitude: 21.5433, longitude: 39.1728 },
      latitude: 21.5433,
      longitude: 39.1728,
      riskAssessment: computeRiskAssessment(30.8, 75),
      actuators: computeActuators('MEDIUM', 'ONLINE'),
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
      signalStrength: -80,
      location: { latitude: 25.2048, longitude: 55.2708 },
      latitude: 25.2048,
      longitude: 55.2708,
      riskAssessment: computeRiskAssessment(35.8, 82),
      actuators: computeActuators('CRITICAL', 'ONLINE'),
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
      signalStrength: -68,
      location: { latitude: 31.9454, longitude: 35.9284 },
      latitude: 31.9454,
      longitude: 35.9284,
      riskAssessment: computeRiskAssessment(24.5, 62),
      actuators: computeActuators('SAFE', 'ONLINE'),
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
      riskAssessment: computeRiskAssessment(profile.temperature, profile.humidity),
      actuators: computeActuators(activeRisk, base.deviceStatus),
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
        riskAssessment: computeRiskAssessment(profile.temperature, profile.humidity),
        actuators: computeActuators(activeRisk, base.deviceStatus),
        source: 'simulation',
        lastSeen: 'Just now',
      };
    });
  }
}

/**
 * Unified Wanees Data Service
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

  async triggerTestTelemetry(temp: number, hum: number, risk?: RiskLevel, extras?: Partial<NormalizedDeviceData>) {
    const res = await this.realProvider.sendTestTelemetry(temp, hum, risk, extras);
    this.notify();
    return res;
  }
}

export const waneesDataService = new WaneesDataServiceManager();
