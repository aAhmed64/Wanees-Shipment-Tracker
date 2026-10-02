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

import { activityLogService } from './activityLog';

export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL' | 'MEDIUM' | 'HIGH';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SLEEP' | 'WARNING' | 'ERROR';
export type DataSource = 'real' | 'simulation';

export type MovementStatus = 'NORMAL' | 'MOVEMENT_DETECTED' | 'SHOCK_DETECTED';

export interface MovementData {
  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;
  magnitude: number;
  shockG: number;
  status: MovementStatus;
  statusLabel: 'Normal' | 'Movement detected' | 'Shock detected';
  userStatus: string;
  description: string;
}

export interface HistoricalMotionReading {
  time: string;
  x: number;
  y: number;
  z: number;
  shockG: number;
  status: string;
}

export const ESP32_THRESHOLDS = {
  TEMPERATURE: {
    NORMAL_MIN: 10.0,
    NORMAL_MAX: 13.0,
    WARNING_LOW_MIN: 8.0,
    WARNING_HIGH_MAX: 15.0,
  },
  HUMIDITY: {
    NORMAL_MIN: 85.0,
    NORMAL_MAX: 95.0,
    WARNING_LOW_MIN: 80.0,
    WARNING_HIGH_MAX: 97.0,
  },
  SHOCK: {
    NORMAL_MAX: 1.5,
    WARNING_MAX: 3.0,
  },
};

export const MOVEMENT_THRESHOLDS = {
  GRAVITY_BASELINE: 9.81,
  MOVEMENT_DEVIATION: 1.2,
  SHOCK_DEVIATION: 6.0,
  HORIZONTAL_MOVEMENT: 1.2,
  HORIZONTAL_SHOCK: 5.5,
};

export function getTemperatureStatus(temp: number): 'SAFE' | 'WARNING' | 'CRITICAL' {
  if (temp < 8.0 || temp > 15.0) return 'CRITICAL';
  if ((temp >= 8.0 && temp < 10.0) || (temp > 13.0 && temp <= 15.0)) return 'WARNING';
  return 'SAFE';
}

export function getHumidityStatus(hum: number): 'SAFE' | 'WARNING' | 'CRITICAL' {
  if (hum < 80.0 || hum > 97.0) return 'CRITICAL';
  if ((hum >= 80.0 && hum < 85.0) || (hum > 95.0 && hum <= 97.0)) return 'WARNING';
  return 'SAFE';
}

export function getShockStatus(shockG: number): 'SAFE' | 'WARNING' | 'CRITICAL' {
  if (shockG >= 3.0) return 'CRITICAL';
  if (shockG >= 1.5) return 'WARNING';
  return 'SAFE';
}

export function computeMovementStatus(
  ax?: number,
  ay?: number,
  az?: number,
  explicitShockG?: number
): MovementData | undefined {
  let shockG = 0.98;
  const axVal = ax ?? 0.0;
  const ayVal = ay ?? 0.0;
  const azVal = az ?? 9.81;

  if (explicitShockG !== undefined && !isNaN(explicitShockG)) {
    shockG = Math.round(explicitShockG * 100) / 100;
  } else if (ax !== undefined && ay !== undefined && az !== undefined) {
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    shockG = Math.round((magnitude / 9.80665) * 100) / 100;
  } else if (explicitShockG === undefined && ax === undefined) {
    return undefined;
  }

  const magnitude = Math.sqrt(axVal * axVal + ayVal * ayVal + azVal * azVal);
  let status: MovementStatus;
  let statusLabel: 'Normal' | 'Movement detected' | 'Shock detected';
  let userStatus: string;
  let description: string;

  if (shockG >= 3.0) {
    status = 'SHOCK_DETECTED';
    statusLabel = 'Shock detected';
    userStatus = shockG >= 5.0 ? 'Critical impact' : 'Strong impact detected';
    description = `Critical physical impact detected (${shockG.toFixed(2)} g). Immediate inspection advised.`;
  } else if (shockG >= 1.5) {
    status = 'MOVEMENT_DETECTED';
    statusLabel = 'Movement detected';
    userStatus = 'Movement detected';
    description = `Active movement / moderate impact detected (${shockG.toFixed(2)} g). Transit vibration recorded.`;
  } else {
    status = 'NORMAL';
    statusLabel = 'Normal';
    userStatus = 'Normal handling';
    description = 'Cargo handling is steady and within normal transport limits (<1.5 g).';
  }

  return {
    accelerationX: Math.round(axVal * 100) / 100,
    accelerationY: Math.round(ayVal * 100) / 100,
    accelerationZ: Math.round(azVal * 100) / 100,
    magnitude: Math.round(magnitude * 100) / 100,
    shockG,
    status,
    statusLabel,
    userStatus,
    description,
  };
}

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
  accelerationX?: number;
  accelerationY?: number;
  accelerationZ?: number;
  shockG?: number;
  movementStatus?: string;
  movement?: MovementData;
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
 * Modular Risk Classification matching ESP32 hardware thresholds:
 * TEMPERATURE:
 * - Normal: 10°C to 13°C
 * - Warning: 8°C to <10°C OR >13°C to 15°C
 * - Critical: <8°C OR >15°C
 * HUMIDITY:
 * - Normal: 85% to 95%
 * - Warning: 80% to <85% OR >95% to 97%
 * - Critical: <80% OR >97%
 * SHOCK:
 * - Normal: <1.5 g
 * - Warning: 1.5 g to <3.0 g
 * - Critical: >=3.0 g
 * Overall status:
 * - CRITICAL if ANY sensor is critical
 * - WARNING if no sensor is critical but ANY sensor is warning
 * - SAFE if all sensors are normal
 */
export function calculateRisk(
  temperature: number,
  humidity: number,
  shockG: number = 0.98
): RiskLevel {
  const t = getTemperatureStatus(temperature);
  const h = getHumidityStatus(humidity);
  const s = getShockStatus(shockG);
  if (t === 'CRITICAL' || h === 'CRITICAL' || s === 'CRITICAL') return 'CRITICAL';
  if (t === 'WARNING' || h === 'WARNING' || s === 'WARNING') return 'WARNING';
  return 'SAFE';
}

export function computeRiskAssessment(
  temperature: number,
  humidity: number,
  shockG: number = 0.98,
  overrideRisk?: string
): RiskAssessment {
  if (overrideRisk && ['SAFE', 'WARNING', 'CRITICAL', 'MEDIUM', 'HIGH'].includes(overrideRisk.toUpperCase())) {
    const raw = overrideRisk.toUpperCase();
    const level: RiskLevel = raw === 'MEDIUM' || raw === 'HIGH' ? 'WARNING' : (raw as RiskLevel);
    const scores: Record<string, number> = { SAFE: 10, WARNING: 50, MEDIUM: 50, HIGH: 70, CRITICAL: 95 };
    return {
      level,
      score: scores[raw] ?? 50,
      factors: [`Status override set to ${level}`],
    };
  }

  const factors: string[] = [];
  let score = 0;

  const tStatus = getTemperatureStatus(temperature);
  if (tStatus === 'CRITICAL') {
    factors.push(`Critical temperature: ${temperature.toFixed(1)}°C outside critical limits (<8.0°C or >15.0°C)`);
    score += 45;
  } else if (tStatus === 'WARNING') {
    factors.push(`Temperature warning: ${temperature.toFixed(1)}°C outside normal bounds (10.0°C–13.0°C)`);
    score += 25;
  } else {
    factors.push(`Temperature nominal: ${temperature.toFixed(1)}°C within safe cold chain range (10.0°C–13.0°C)`);
    score += 5;
  }

  const hStatus = getHumidityStatus(humidity);
  if (hStatus === 'CRITICAL') {
    factors.push(`Critical humidity: ${humidity}% outside critical limits (<80% or >97%)`);
    score += 40;
  } else if (hStatus === 'WARNING') {
    factors.push(`Humidity warning: ${humidity}% outside normal bounds (85%–95%)`);
    score += 20;
  } else {
    factors.push(`Humidity nominal: ${humidity}% within safe range (85%–95%)`);
    score += 5;
  }

  const sStatus = getShockStatus(shockG);
  if (sStatus === 'CRITICAL') {
    factors.push(`Critical shock detected: ${shockG.toFixed(2)} g exceeds critical threshold (>=3.0 g)`);
    score += 50;
  } else if (sStatus === 'WARNING') {
    factors.push(`Shock warning: ${shockG.toFixed(2)} g in warning range (1.5 g–<3.0 g)`);
    score += 25;
  } else {
    factors.push(`Shock nominal: ${shockG.toFixed(2)} g within safe handling limits (<1.5 g)`);
    score += 5;
  }

  let level: RiskLevel;
  if (tStatus === 'CRITICAL' || hStatus === 'CRITICAL' || sStatus === 'CRITICAL') {
    level = 'CRITICAL';
  } else if (tStatus === 'WARNING' || hStatus === 'WARNING' || sStatus === 'WARNING') {
    level = 'WARNING';
  } else {
    level = 'SAFE';
  }

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
    case 'MEDIUM':
    case 'WARNING':
      return {
        ledGreen: false,
        ledYellow: true,
        ledRed: false,
        buzzer: false,
        stateSummary: 'WARNING: Yellow Warning LED Active (Buzzer Silent)',
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
    { time: '00:00', temperature: 11.2, humidity: 88 },
    { time: '04:00', temperature: 11.5, humidity: 89 },
    { time: '08:00', temperature: 11.7, humidity: 90 },
    { time: '12:00', temperature: 12.1, humidity: 91 },
    { time: '16:00', temperature: 11.9, humidity: 89 },
    { time: 'Now', temperature: 11.8, humidity: 89 },
  ];
  private motionHistory: HistoricalMotionReading[] = [
    { time: '10:15', x: 0.05, y: -0.02, z: 9.80, shockG: 0.98, status: 'Normal handling' },
    { time: '10:25', x: 0.08, y: -0.01, z: 9.82, shockG: 1.02, status: 'Normal handling' },
    { time: '10:32', x: 0.12, y: -0.03, z: 9.81, shockG: 0.99, status: 'Normal handling' },
    { time: '10:37', x: 1.85, y: -1.20, z: 10.45, shockG: 1.75, status: 'Movement detected' },
    { time: '10:41', x: 4.80, y: -2.10, z: 12.80, shockG: 3.25, status: 'Strong impact detected' },
    { time: 'Now', x: 0.05, y: -0.02, z: 9.81, shockG: 0.98, status: 'Normal handling' },
  ];

  constructor() {
    const baseMovement = computeMovementStatus(0.05, -0.02, 9.81, 0.98);
    const baseAssessment = computeRiskAssessment(11.8, 89, 0.98);
    this.lastKnownData = {
      deviceId: 'WN-001',
      temperature: 11.8,
      humidity: 89,
      risk: 'SAFE',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'real',
      battery: 98,
      signalStrength: -65,
      accelerationX: 0.05,
      accelerationY: -0.02,
      accelerationZ: 9.81,
      shockG: 0.98,
      movementStatus: 'Normal handling',
      movement: baseMovement,
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
            const remote = Array.isArray(json.data)
              ? (json.data.find((d: any) => d.deviceId === deviceId) || json.data[0])
              : json.data;
            if (!remote) return this.lastKnownData;
            const temp = remote.temperature ?? this.lastKnownData.temperature;
            const hum = remote.humidity ?? this.lastKnownData.humidity;
            const ax = remote.accelerationX ?? this.lastKnownData.accelerationX;
            const ay = remote.accelerationY ?? this.lastKnownData.accelerationY;
            const az = remote.accelerationZ ?? this.lastKnownData.accelerationZ;
            const explicitShockG = remote.shockG !== undefined ? Number(remote.shockG) : undefined;
            const movement = computeMovementStatus(ax, ay, az, explicitShockG);
            const shockG = explicitShockG ?? movement?.shockG ?? this.lastKnownData.shockG ?? 0.98;
            const risk = remote.risk || calculateRisk(temp, hum, shockG);
            const status = remote.deviceStatus || 'ONLINE';
            const movementStatus = remote.movementStatus ?? movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling');

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
              accelerationX: ax,
              accelerationY: ay,
              accelerationZ: az,
              shockG,
              movementStatus,
              movement,
              location: remote.location ?? this.lastKnownData.location,
              latitude: remote.latitude ?? remote.location?.latitude ?? this.lastKnownData.latitude,
              longitude: remote.longitude ?? remote.location?.longitude ?? this.lastKnownData.longitude,
              sensors: remote.sensors ?? this.lastKnownData.sensors,
              riskAssessment: remote.riskAssessment ?? computeRiskAssessment(temp, hum, shockG, risk),
              actuators: remote.actuators ?? computeActuators(risk, status),
              lastSeen: 'Just now',
            };

            const prevData = this.lastKnownData;
            this.lastKnownData = updated;
            this.recordHistory(updated.temperature, updated.humidity);
            this.recordMotionHistory(ax ?? 0.05, ay ?? -0.02, az ?? 9.81, shockG);
            this.checkAndLogEvents(prevData, updated);

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
    const ax = extraFields?.accelerationX ?? this.lastKnownData.accelerationX;
    const ay = extraFields?.accelerationY ?? this.lastKnownData.accelerationY;
    const az = extraFields?.accelerationZ ?? this.lastKnownData.accelerationZ;
    const explicitShockG = extraFields?.shockG;
    const movement = extraFields?.movement ?? computeMovementStatus(ax, ay, az, explicitShockG);
    const shockG = explicitShockG ?? movement?.shockG ?? 0.98;
    const movementStatus = movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling');

    const risk = riskOverride || calculateRisk(temperature, humidity, shockG);
    const riskAssessment = computeRiskAssessment(temperature, humidity, shockG, risk);
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
      accelerationX: ax,
      accelerationY: ay,
      accelerationZ: az,
      shockG,
      movementStatus,
      movement,
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

    const prevData = this.lastKnownData;
    this.lastKnownData = { ...this.lastKnownData, ...payload };
    this.recordHistory(temperature, humidity);
    this.recordMotionHistory(ax ?? 0.05, ay ?? -0.02, az ?? 9.81, shockG);
    this.checkAndLogEvents(prevData, this.lastKnownData);

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

  getMotionHistory(): HistoricalMotionReading[] {
    return [...this.motionHistory];
  }

  private checkAndLogEvents(prev: NormalizedDeviceData, next: NormalizedDeviceData) {
    const shipmentId = next.shipmentId || 'WN-001';
    const nextShock = typeof next.shockG === 'number' && !isNaN(next.shockG) ? next.shockG : 0.98;
    const prevShock = typeof prev.shockG === 'number' && !isNaN(prev.shockG) ? prev.shockG : 0.98;

    // Shock events
    if (nextShock >= 3.0 && (prevShock < 3.0 || Math.abs(nextShock - prevShock) > 0.4)) {
      activityLogService.logEvent(
        shipmentId,
        'Critical impact detected',
        `Critical impact detected (${nextShock.toFixed(2)} g) - Severe physical shock exceeding threshold (>=3.0 g)`,
        'CRITICAL',
        `${nextShock.toFixed(2)} g`
      );
    } else if (nextShock >= 1.5 && prevShock < 1.5) {
      activityLogService.logEvent(
        shipmentId,
        'Shock detected',
        `Shock detected (${nextShock.toFixed(2)} g) - Cargo bumped during transport transfer`,
        'WARNING',
        `${nextShock.toFixed(2)} g`
      );
    }

    // Risk / condition changed
    if (prev.risk !== next.risk) {
      const sev =
        next.risk === 'CRITICAL'
          ? 'CRITICAL'
          : next.risk === 'WARNING' || next.risk === 'HIGH' || next.risk === 'MEDIUM'
          ? 'WARNING'
          : 'INFO';
      activityLogService.logEvent(
        shipmentId,
        'Cargo condition changed',
        `Cargo condition changed to ${next.risk} · Temp: ${next.temperature.toFixed(1)}°C, Humidity: ${next.humidity}%, Shock: ${nextShock.toFixed(2)} g`,
        sev,
        next.risk
      );
    }

    // Temperature threshold status changed
    const prevTStatus = getTemperatureStatus(prev.temperature);
    const nextTStatus = getTemperatureStatus(next.temperature);
    if (prevTStatus !== nextTStatus) {
      if (nextTStatus === 'CRITICAL') {
        activityLogService.logEvent(
          shipmentId,
          'Temperature entered CRITICAL',
          `Temperature entered CRITICAL (${next.temperature.toFixed(1)}°C) - Outside safe limits (<8°C or >15°C)`,
          'CRITICAL',
          `${next.temperature.toFixed(1)}°C`
        );
      } else if (nextTStatus === 'WARNING') {
        activityLogService.logEvent(
          shipmentId,
          'Temperature entered WARNING',
          `Temperature entered WARNING (${next.temperature.toFixed(1)}°C) - Drift from safe range (threshold: 10–13°C)`,
          'WARNING',
          `${next.temperature.toFixed(1)}°C`
        );
      }
    }

    // Humidity threshold status changed
    const prevHStatus = getHumidityStatus(prev.humidity);
    const nextHStatus = getHumidityStatus(next.humidity);
    if (prevHStatus !== nextHStatus) {
      if (nextHStatus === 'CRITICAL') {
        activityLogService.logEvent(
          shipmentId,
          'Humidity entered CRITICAL',
          `Humidity entered CRITICAL (${next.humidity}%) - Outside safe limits (<80% or >97%)`,
          'CRITICAL',
          `${next.humidity}%`
        );
      } else if (nextHStatus === 'WARNING') {
        activityLogService.logEvent(
          shipmentId,
          'Humidity entered WARNING',
          `Humidity entered WARNING (${next.humidity}%) - Drift from safe range (threshold: 85–95%)`,
          'WARNING',
          `${next.humidity}%`
        );
      }
    }
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

  private recordMotionHistory(x: number, y: number, z: number, explicitShockG?: number) {
    const movement = computeMovementStatus(x, y, z, explicitShockG);
    const shockG = explicitShockG ?? movement?.shockG ?? 0.98;
    const status = movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (this.motionHistory.length >= 10) {
      this.motionHistory.shift();
    }
    this.motionHistory.push({
      time: nowTime,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      shockG,
      status,
    });
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
      temperature: 14.2,
      humidity: 83,
      risk: 'WARNING',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 84,
      signalStrength: -72,
      accelerationX: 1.20,
      accelerationY: -0.85,
      accelerationZ: 10.40,
      shockG: 1.75,
      movementStatus: 'Movement detected',
      movement: computeMovementStatus(1.20, -0.85, 10.40, 1.75),
      location: { latitude: 21.5433, longitude: 39.1728 },
      latitude: 21.5433,
      longitude: 39.1728,
      riskAssessment: computeRiskAssessment(14.2, 83, 1.75),
      actuators: computeActuators('WARNING', 'ONLINE'),
      shipmentId: 'WN-002',
      cargo: 'Premium Mango Export',
      origin: 'Cairo, Egypt',
      destination: 'Jeddah, Saudi Arabia',
      firmware: 'v1.4.2-sim',
      lastSeen: '10 sec ago',
    },
    'WN-003': {
      deviceId: 'WN-003',
      temperature: 16.5,
      humidity: 78,
      risk: 'CRITICAL',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 76,
      signalStrength: -80,
      accelerationX: 3.20,
      accelerationY: -2.10,
      accelerationZ: 14.50,
      shockG: 3.40,
      movementStatus: 'Strong impact detected',
      movement: computeMovementStatus(3.20, -2.10, 14.50, 3.40),
      location: { latitude: 25.2048, longitude: 55.2708 },
      latitude: 25.2048,
      longitude: 55.2708,
      riskAssessment: computeRiskAssessment(16.5, 78, 3.40),
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
      temperature: 11.5,
      humidity: 90,
      risk: 'SAFE',
      deviceStatus: 'ONLINE',
      timestamp: new Date().toISOString(),
      source: 'simulation',
      battery: 91,
      signalStrength: -68,
      accelerationX: 0.04,
      accelerationY: 0.02,
      accelerationZ: 9.81,
      shockG: 0.98,
      movementStatus: 'Normal handling',
      movement: computeMovementStatus(0.04, 0.02, 9.81, 0.98),
      location: { latitude: 31.9454, longitude: 35.9284 },
      latitude: 31.9454,
      longitude: 35.9284,
      riskAssessment: computeRiskAssessment(11.5, 90, 0.98),
      actuators: computeActuators('SAFE', 'ONLINE'),
      shipmentId: 'WN-004',
      cargo: 'Pharmaceutical Vaccines (Cold Chain)',
      origin: 'Alexandria, Egypt',
      destination: 'Amman, Jordan',
      firmware: 'v1.4.2-sim',
      lastSeen: '12 sec ago',
    },
  };

  private simulationProfiles: Record<RiskLevel, { temperature: number; humidity: number; accelerationX: number; accelerationY: number; accelerationZ: number; shockG: number }> = {
    SAFE: { temperature: 11.8, humidity: 90, accelerationX: 0.05, accelerationY: -0.02, accelerationZ: 9.81, shockG: 0.98 },
    WARNING: { temperature: 14.2, humidity: 83, accelerationX: 1.20, accelerationY: -0.85, accelerationZ: 10.40, shockG: 1.75 },
    MEDIUM: { temperature: 14.2, humidity: 83, accelerationX: 1.20, accelerationY: -0.85, accelerationZ: 10.40, shockG: 1.75 },
    HIGH: { temperature: 14.8, humidity: 96, accelerationX: 1.80, accelerationY: -1.20, accelerationZ: 11.20, shockG: 2.20 },
    CRITICAL: { temperature: 16.5, humidity: 76, accelerationX: 3.50, accelerationY: -2.40, accelerationZ: 14.80, shockG: 3.50 },
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
    const movement = computeMovementStatus(profile.accelerationX, profile.accelerationY, profile.accelerationZ, profile.shockG);

    return {
      ...base,
      risk: activeRisk,
      temperature: profile.temperature,
      humidity: profile.humidity,
      accelerationX: profile.accelerationX,
      accelerationY: profile.accelerationY,
      accelerationZ: profile.accelerationZ,
      shockG: profile.shockG,
      movementStatus: movement?.userStatus ?? (profile.shockG >= 3.0 ? 'Strong impact detected' : profile.shockG >= 1.5 ? 'Movement detected' : 'Normal handling'),
      movement,
      riskAssessment: computeRiskAssessment(profile.temperature, profile.humidity, profile.shockG),
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
      const movement = computeMovementStatus(profile.accelerationX, profile.accelerationY, profile.accelerationZ, profile.shockG);
      return {
        ...base,
        risk: activeRisk,
        temperature: profile.temperature,
        humidity: profile.humidity,
        accelerationX: profile.accelerationX,
        accelerationY: profile.accelerationY,
        accelerationZ: profile.accelerationZ,
        shockG: profile.shockG,
        movementStatus: movement?.userStatus ?? (profile.shockG >= 3.0 ? 'Strong impact detected' : profile.shockG >= 1.5 ? 'Movement detected' : 'Normal handling'),
        movement,
        riskAssessment: computeRiskAssessment(profile.temperature, profile.humidity, profile.shockG),
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
      const presets: Record<RiskLevel, { temp: number; hum: number; shockG: number }> = {
        SAFE: { temp: 11.8, hum: 90, shockG: 0.98 },
        WARNING: { temp: 14.2, hum: 89, shockG: 1.80 },
        MEDIUM: { temp: 14.2, hum: 89, shockG: 1.80 },
        HIGH: { temp: 14.8, hum: 96, shockG: 2.20 },
        CRITICAL: { temp: 16.5, hum: 76, shockG: 3.50 },
      };
      const p = presets[risk];
      this.realProvider.sendTestTelemetry(p.temp, p.hum, risk, { shockG: p.shockG });
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
