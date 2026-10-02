// Serverless Function / API Endpoint: /api/device/data
// Handles real ESP32 / Wokwi hardware telemetry (POST) and status queries (GET).

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

export interface ActuatorState {
  ledGreen: boolean;
  ledYellow: boolean;
  ledRed: boolean;
  buzzer: boolean;
  stateSummary: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: string[];
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
}

export interface DeviceTelemetryRecord {
  deviceId: string;
  temperature: number;
  humidity: number;
  risk: RiskLevel;
  deviceStatus: DeviceStatus;
  timestamp: string;
  source: DataSource;
  battery: number;
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
  riskAssessment: RiskAssessment;
  actuators: ActuatorState;
  metadata?: Record<string, any>;
}

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

export function computeRiskAssessment(
  temp: number,
  hum: number,
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

  const tStatus = getTemperatureStatus(temp);
  if (tStatus === 'CRITICAL') {
    factors.push(`Critical temperature: ${temp.toFixed(1)}°C outside critical limits (<8.0°C or >15.0°C)`);
    score += 45;
  } else if (tStatus === 'WARNING') {
    factors.push(`Temperature warning: ${temp.toFixed(1)}°C outside normal bounds (10.0°C–13.0°C)`);
    score += 25;
  } else {
    factors.push(`Temperature nominal: ${temp.toFixed(1)}°C within safe cold chain range (10.0°C–13.0°C)`);
    score += 5;
  }

  const hStatus = getHumidityStatus(hum);
  if (hStatus === 'CRITICAL') {
    factors.push(`Critical humidity: ${hum}% outside critical limits (<80% or >97%)`);
    score += 40;
  } else if (hStatus === 'WARNING') {
    factors.push(`Humidity warning: ${hum}% outside normal bounds (85%–95%)`);
    score += 20;
  } else {
    factors.push(`Humidity nominal: ${hum}% within safe range (85%–95%)`);
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

// In-memory telemetry buffer for serverless runtime
const deviceStorage = new Map<string, DeviceTelemetryRecord>();

// Seed default physical device baseline (WN-001) matching cold chain ESP32 standards
const initialMovement = computeMovementStatus(0.05, -0.02, 9.81, 0.98);
const initialAssessment = computeRiskAssessment(11.8, 89, initialMovement?.shockG ?? 0.98);
deviceStorage.set('WN-001', {
  deviceId: 'WN-001',
  temperature: 11.8,
  humidity: 89,
  risk: initialAssessment.level,
  deviceStatus: 'ONLINE',
  battery: 98,
  signalStrength: -65,
  accelerationX: 0.05,
  accelerationY: -0.02,
  accelerationZ: 9.81,
  shockG: initialMovement?.shockG ?? 0.98,
  movementStatus: initialMovement?.userStatus ?? 'Normal handling',
  movement: initialMovement,
  location: { latitude: 30.0444, longitude: 31.2357 },
  latitude: 30.0444,
  longitude: 31.2357,
  timestamp: new Date().toISOString(),
  source: 'real',
  riskAssessment: initialAssessment,
  actuators: computeActuators(initialAssessment.level, 'ONLINE'),
});

function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Query latest telemetry
  if (req.method === 'GET') {
    const urlObj = req.url ? new URL(req.url, 'http://localhost') : null;
    const deviceId = req.query?.deviceId || urlObj?.searchParams.get('deviceId');
    
    if (deviceId) {
      const normalizedId = String(deviceId).trim();
      const device = deviceStorage.get(normalizedId) || deviceStorage.get('WN-001');
      return res.status(200).json({ success: true, data: device || null });
    }

    const all = Array.from(deviceStorage.values());
    return res.status(200).json({ success: true, count: all.length, data: all });
  }

  // POST: Receive new telemetry from ESP32 or simulation
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
        }
      }

      if (!body || typeof body !== 'object') {
        return res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      }

      // deviceId defaults to WN-001
      const deviceId = String(body.deviceId || 'WN-001').trim();

      // Temperature and humidity are required sensor values
      const temperature = typeof body.temperature === 'number' ? body.temperature : parseFloat(body.temperature);
      const humidity = typeof body.humidity === 'number' ? body.humidity : parseFloat(body.humidity);

      if (isNaN(temperature) || isNaN(humidity)) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid sensor data: "temperature" and "humidity" must be numbers',
          received: { temperature: body.temperature, humidity: body.humidity },
        });
      }

      // Distinction between Device Status, Calculated Risk, and Actuators
      const validStatuses: DeviceStatus[] = ['ONLINE', 'OFFLINE', 'SLEEP', 'WARNING', 'ERROR'];
      const rawStatus = body.deviceStatus ? String(body.deviceStatus).toUpperCase() : 'ONLINE';
      const deviceStatus: DeviceStatus = validStatuses.includes(rawStatus as DeviceStatus)
        ? (rawStatus as DeviceStatus)
        : 'ONLINE';

      // MPU6050 Motion / Acceleration telemetry (optional, extensible)
      const rawAx = body.accelerationX !== undefined ? (typeof body.accelerationX === 'number' ? body.accelerationX : parseFloat(body.accelerationX)) : undefined;
      const rawAy = body.accelerationY !== undefined ? (typeof body.accelerationY === 'number' ? body.accelerationY : parseFloat(body.accelerationY)) : undefined;
      const rawAz = body.accelerationZ !== undefined ? (typeof body.accelerationZ === 'number' ? body.accelerationZ : parseFloat(body.accelerationZ)) : undefined;
      const rawShockG = body.shockG !== undefined ? (typeof body.shockG === 'number' ? body.shockG : parseFloat(body.shockG)) : undefined;

      const accelerationX = rawAx !== undefined && !isNaN(rawAx) ? Math.round(rawAx * 100) / 100 : undefined;
      const accelerationY = rawAy !== undefined && !isNaN(rawAy) ? Math.round(rawAy * 100) / 100 : undefined;
      const accelerationZ = rawAz !== undefined && !isNaN(rawAz) ? Math.round(rawAz * 100) / 100 : undefined;
      const explicitShockG = rawShockG !== undefined && !isNaN(rawShockG) ? Math.round(rawShockG * 100) / 100 : undefined;

      const movement = computeMovementStatus(accelerationX, accelerationY, accelerationZ, explicitShockG);
      const shockG = explicitShockG ?? movement?.shockG ?? 0.98;

      // Calculated Risk Assessment matching exact ESP32 thresholds
      const riskAssessment = computeRiskAssessment(temperature, humidity, shockG, body.risk);
      const risk = riskAssessment.level;

      // Actuator State (LEDs, Buzzer) computed from risk and status
      const actuators = computeActuators(risk, deviceStatus);

      // Location / GPS handling
      const location: GpsLocation | undefined = body.location
        ? {
            latitude: Number(body.location.latitude) || 30.0444,
            longitude: Number(body.location.longitude) || 31.2357,
            altitude: body.location.altitude ? Number(body.location.altitude) : undefined,
            speed: body.location.speed ? Number(body.location.speed) : undefined,
          }
        : body.latitude && body.longitude
          ? { latitude: Number(body.latitude), longitude: Number(body.longitude) }
          : undefined;

      const record: DeviceTelemetryRecord = {
        deviceId,
        temperature: Math.round(temperature * 10) / 10,
        humidity: Math.round(humidity),
        risk,
        deviceStatus,
        battery: typeof body.battery === 'number' ? body.battery : 98,
        signalStrength: typeof body.signalStrength === 'number' ? body.signalStrength : (body.rssi ?? -65),
        accelerationX,
        accelerationY,
        accelerationZ,
        shockG,
        movementStatus: movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling'),
        movement,
        location,
        latitude: location?.latitude ?? body.latitude,
        longitude: location?.longitude ?? body.longitude,
        sensors: body.sensors && typeof body.sensors === 'object' ? body.sensors : undefined,
        timestamp: body.timestamp || new Date().toISOString(),
        source: body.source === 'simulation' ? 'simulation' : 'real',
        riskAssessment,
        actuators,
        metadata: body.metadata,
      };

      deviceStorage.set(deviceId, record);

      return res.status(200).json({
        success: true,
        message: `Telemetry recorded successfully for ${deviceId}`,
        data: record,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
