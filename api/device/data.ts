// Serverless Function / API Endpoint: /api/device/data
// Handles real ESP32 / Wokwi hardware telemetry (POST) and status queries (GET).

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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

export const MOVEMENT_THRESHOLDS = {
  GRAVITY_BASELINE: 9.81, // Earth standard gravity (m/s²)
  MOVEMENT_DEVIATION: 1.2, // Deviation threshold indicating active shipment movement/vibration
  SHOCK_DEVIATION: 6.0,    // High deviation threshold indicating physical impact/shock
  HORIZONTAL_MOVEMENT: 1.2, // Horizontal tilt/displacement threshold
  HORIZONTAL_SHOCK: 5.5,   // Horizontal impact threshold
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

export function computeMovementStatus(
  ax?: number,
  ay?: number,
  az?: number
): MovementData | undefined {
  if (ax === undefined || ay === undefined || az === undefined) {
    return undefined;
  }

  const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
  const deviation = Math.abs(magnitude - MOVEMENT_THRESHOLDS.GRAVITY_BASELINE);
  const horizMax = Math.max(Math.abs(ax), Math.abs(ay));
  const excessDev = Math.max(deviation, horizMax);

  let status: MovementStatus = 'NORMAL';
  let statusLabel: 'Normal' | 'Movement detected' | 'Shock detected' = 'Normal';
  let userStatus: string;
  let shockG: number;
  let description: string;

  if (deviation >= MOVEMENT_THRESHOLDS.SHOCK_DEVIATION || horizMax >= MOVEMENT_THRESHOLDS.HORIZONTAL_SHOCK) {
    status = 'SHOCK_DETECTED';
    statusLabel = 'Shock detected';
    const shockFactor = 3.5 + ((excessDev - MOVEMENT_THRESHOLDS.SHOCK_DEVIATION) / 4.0) * 3.5;
    shockG = Math.round(Math.min(15.0, Math.max(3.5, shockFactor)) * 10) / 10;
    if (shockG >= 6.0) {
      userStatus = 'Critical impact';
      description = `Critical physical impact detected (${shockG.toFixed(1)} g). Urgent inspection advised.`;
    } else {
      userStatus = 'Strong impact detected';
      description = `Strong shock detected (${shockG.toFixed(1)} g). Cargo may have experienced harsh handling.`;
    }
  } else if (deviation >= MOVEMENT_THRESHOLDS.MOVEMENT_DEVIATION || horizMax >= MOVEMENT_THRESHOLDS.HORIZONTAL_MOVEMENT) {
    status = 'MOVEMENT_DETECTED';
    statusLabel = 'Movement detected';
    const moveFactor = 1.0 + ((excessDev - MOVEMENT_THRESHOLDS.MOVEMENT_DEVIATION) / (MOVEMENT_THRESHOLDS.SHOCK_DEVIATION - MOVEMENT_THRESHOLDS.MOVEMENT_DEVIATION)) * 1.5;
    shockG = Math.round(Math.max(1.0, Math.min(2.9, moveFactor)) * 10) / 10;
    if (shockG >= 2.0) {
      userStatus = 'Moderate impact';
      description = `Moderate impact detected (${shockG.toFixed(1)} g). Transit vibration recorded.`;
    } else {
      userStatus = 'Movement detected';
      description = `Active movement detected (${shockG.toFixed(1)} g). Shipment in transit.`;
    }
  } else {
    const normFactor = 0.2 + (excessDev / MOVEMENT_THRESHOLDS.MOVEMENT_DEVIATION) * 0.4;
    shockG = Math.round(Math.max(0.1, Math.min(0.8, normFactor)) * 10) / 10;
    userStatus = 'Normal handling';
    description = 'Cargo handling is steady and within normal transport limits.';
  }

  return {
    accelerationX: Math.round(ax * 100) / 100,
    accelerationY: Math.round(ay * 100) / 100,
    accelerationZ: Math.round(az * 100) / 100,
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

  if (temp >= 35) {
    factors.push(`Critical temperature threshold exceeded: ${temp.toFixed(1)}°C (safe < 29°C)`);
    score += 55;
  } else if (temp >= 32) {
    factors.push(`Elevated temperature detected: ${temp.toFixed(1)}°C`);
    score += 40;
  } else if (temp >= 29) {
    factors.push(`Moderate temperature advisory: ${temp.toFixed(1)}°C`);
    score += 25;
  } else {
    factors.push(`Temperature within safe limits: ${temp.toFixed(1)}°C`);
    score += 5;
  }

  if (humidity >= 80) {
    factors.push(`Critical humidity threshold exceeded: ${humidity}% (safe < 71%)`);
    score += 45;
  } else if (humidity >= 76) {
    factors.push(`High humidity warning: ${humidity}%`);
    score += 35;
  } else if (humidity >= 71) {
    factors.push(`Moderate humidity advisory: ${humidity}%`);
    score += 20;
  } else {
    factors.push(`Humidity within safe limits: ${humidity}%`);
    score += 5;
  }

  let level: RiskLevel = 'SAFE';
  if (temp >= 35 || humidity >= 80) level = 'CRITICAL';
  else if (temp >= 32 || humidity >= 76) level = 'HIGH';
  else if (temp >= 29 || humidity >= 71) level = 'MEDIUM';

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

// In-memory telemetry buffer for serverless runtime
const deviceStorage = new Map<string, DeviceTelemetryRecord>();

// Seed default physical device baseline (WN-001)
const initialAssessment = computeRiskAssessment(27.4, 53);
const initialMovement = computeMovementStatus(0.12, -0.04, 9.81);
deviceStorage.set('WN-001', {
  deviceId: 'WN-001',
  temperature: 27.4,
  humidity: 53,
  risk: initialAssessment.level,
  deviceStatus: 'ONLINE',
  battery: 98,
  signalStrength: -65,
  accelerationX: 0.12,
  accelerationY: -0.04,
  accelerationZ: 9.81,
  shockG: initialMovement?.shockG ?? 0.2,
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

      // Calculated Risk Assessment
      const riskAssessment = computeRiskAssessment(temperature, humidity, body.risk);
      const risk = riskAssessment.level;

      // Actuator State (LEDs, Buzzer) computed from risk and status
      const actuators = computeActuators(risk, deviceStatus);

      // MPU6050 Motion / Acceleration telemetry (optional, extensible)
      const rawAx = body.accelerationX !== undefined ? (typeof body.accelerationX === 'number' ? body.accelerationX : parseFloat(body.accelerationX)) : undefined;
      const rawAy = body.accelerationY !== undefined ? (typeof body.accelerationY === 'number' ? body.accelerationY : parseFloat(body.accelerationY)) : undefined;
      const rawAz = body.accelerationZ !== undefined ? (typeof body.accelerationZ === 'number' ? body.accelerationZ : parseFloat(body.accelerationZ)) : undefined;

      const accelerationX = rawAx !== undefined && !isNaN(rawAx) ? Math.round(rawAx * 100) / 100 : undefined;
      const accelerationY = rawAy !== undefined && !isNaN(rawAy) ? Math.round(rawAy * 100) / 100 : undefined;
      const accelerationZ = rawAz !== undefined && !isNaN(rawAz) ? Math.round(rawAz * 100) / 100 : undefined;

      const movement = computeMovementStatus(accelerationX, accelerationY, accelerationZ);

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
        shockG: movement?.shockG ?? 0.2,
        movementStatus: movement?.userStatus ?? 'Normal handling',
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
