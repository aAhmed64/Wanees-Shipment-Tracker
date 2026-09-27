// Vercel Serverless Function: /api/device/data
// Handles real ESP32 device telemetry (POST) and status queries (GET).

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DeviceTelemetryPayload {
  deviceId: string;
  temperature: number;
  humidity: number;
  risk?: RiskLevel;
  battery?: number;
  deviceStatus?: 'ONLINE' | 'OFFLINE';
  latitude?: number;
  longitude?: number;
  signalStrength?: number;
  timestamp?: string;
  source?: 'real' | 'simulation';
}

// In-memory telemetry buffer for serverless execution
const deviceStorage = new Map<string, DeviceTelemetryPayload>();

// Seed default physical device state
deviceStorage.set('WN-001', {
  deviceId: 'WN-001',
  temperature: 27.4,
  humidity: 53,
  risk: 'SAFE',
  deviceStatus: 'ONLINE',
  battery: 98,
  timestamp: new Date().toISOString(),
  source: 'real',
});

export function computeRisk(temp: number, humidity: number): RiskLevel {
  if (temp >= 35 || humidity >= 80) return 'CRITICAL';
  if (temp >= 32 || humidity >= 76) return 'HIGH';
  if (temp >= 29 || humidity >= 71) return 'MEDIUM';
  return 'SAFE';
}

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

  if (req.method === 'GET') {
    const deviceId = req.query?.deviceId || (req.url && new URL(req.url, 'http://localhost').searchParams.get('deviceId'));
    if (deviceId) {
      const normalizedId = String(deviceId).trim();
      const device = deviceStorage.get(normalizedId) || deviceStorage.get('WN-001');
      return res.status(200).json({ success: true, data: device || null });
    }
    const all = Array.from(deviceStorage.values());
    return res.status(200).json({ success: true, count: all.length, data: all });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid JSON body' });
        }
      }

      if (!body || typeof body !== 'object') {
        return res.status(400).json({ success: false, error: 'Payload must be a JSON object' });
      }

      const deviceId = String(body.deviceId || 'WN-001').trim();
      const temperature = typeof body.temperature === 'number' ? body.temperature : parseFloat(body.temperature);
      const humidity = typeof body.humidity === 'number' ? body.humidity : parseFloat(body.humidity);

      if (isNaN(temperature) || isNaN(humidity)) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid temperature and humidity fields. Expected numbers.',
        });
      }

      const risk: RiskLevel = body.risk && ['SAFE', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.risk.toUpperCase())
        ? (body.risk.toUpperCase() as RiskLevel)
        : computeRisk(temperature, humidity);

      const normalized: DeviceTelemetryPayload = {
        deviceId,
        temperature: Math.round(temperature * 10) / 10,
        humidity: Math.round(humidity),
        risk,
        deviceStatus: body.deviceStatus === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        battery: typeof body.battery === 'number' ? body.battery : 98,
        timestamp: body.timestamp || new Date().toISOString(),
        source: 'real',
        latitude: body.latitude,
        longitude: body.longitude,
        signalStrength: body.signalStrength,
      };

      deviceStorage.set(deviceId, normalized);

      return res.status(200).json({
        success: true,
        message: `Telemetry recorded for device ${deviceId}`,
        data: normalized,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
