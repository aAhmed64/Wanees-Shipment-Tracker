// Serverless Function / API Endpoint: /api/device/data
// Handles real ESP32 / Wokwi hardware telemetry (POST) and status queries (GET).

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
  location?: GpsLocation;
  latitude?: number;
  longitude?: number;
  sensors?: Record<string, number | boolean | string>;
  riskAssessment: RiskAssessment;
  actuators: ActuatorState;
  metadata?: Record<string, any>;
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
deviceStorage.set('WN-001', {
  deviceId: 'WN-001',
  temperature: 27.4,
  humidity: 53,
  risk: initialAssessment.level,
  deviceStatus: 'ONLINE',
  battery: 98,
  signalStrength: -65,
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
