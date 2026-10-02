import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'node:fs';

// Ensure global CSS survives route regenerations.
// TanStack Start collects stylesheets from route modules; this ensures index.css is always imported.
function ensureRootCss() {
  return {
    name: 'wanees-ensure-root-css',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0];
      if (!file.endsWith('/src/routes/__root.tsx')) return null;
      if (/import\s+['"][^'"]*index\.css['"]/.test(code)) return null;
      const cssPath = path.resolve(path.dirname(file), '../index.css');
      if (!fs.existsSync(cssPath)) return null;
      return { code: `${code}\nimport '../index.css';\n`, map: null };
    },
  };
}

// Route tree diagnostics for TanStack Router
function routeTreeHealth() {
  const ROUTES_DIR = path.resolve(import.meta.dirname, './src/routes');
  const GEN_FILE = path.resolve(import.meta.dirname, './src/routeTree.gen.ts');
  const SETTLE_MS = 1200;
  const STARTUP_SETTLE_MS = 4000;

  function routeFiles(dir: string, base = ''): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('-')) continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...routeFiles(path.join(dir, entry.name), rel));
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.startsWith('__root.')) {
        if (!/createFileRoute\s*\(/.test(fs.readFileSync(path.join(dir, entry.name), 'utf-8'))) continue;
        out.push(rel.replace(/\.lazy\.tsx?$/, '').replace(/\.tsx?$/, ''));
      }
    }
    return out;
  }

  function missingFromTree(): string[] {
    if (!fs.existsSync(GEN_FILE) || !fs.existsSync(ROUTES_DIR)) return [];
    const gen = fs.readFileSync(GEN_FILE, 'utf-8');
    return [...new Set(routeFiles(ROUTES_DIR))].filter(id => {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return !new RegExp(`\\./routes/${escaped}(\\.tsx?)?['"\`]`).test(gen);
    });
  }

  return {
    name: 'wanees-route-tree-health',
    apply: 'serve' as const,
    configureServer(server: import('vite').ViteDevServer) {
      let timer: NodeJS.Timeout | undefined;
      let pending: string | null = null;

      const report = (message: string) => {
        pending = message;
        try {
          server.ws.send({
            type: 'error',
            err: { message, stack: '', plugin: 'wanees-route-tree-health', id: GEN_FILE },
          });
        } catch {
          /* fail open */
        }
      };

      const check = () => {
        try {
          const missing = missingFromTree();
          if (missing.length === 0) {
            pending = null;
            return;
          }
          setTimeout(() => {
            try {
              const stillMissing = missingFromTree();
              if (stillMissing.length === 0) {
                pending = null;
                return;
              }
              const files = stillMissing.map(id => `  src/routes/${id}.tsx`).join('\n');
              const message =
                'Route generation warning — src/routeTree.gen.ts might be out of sync:\n' +
                `${files}\n`;
              report(message);
            } catch {
              /* fail open */
            }
          }, SETTLE_MS);
        } catch {
          /* fail open */
        }
      };

      server.watcher.on('all', (_event: string, file: string) => {
        if (!file.startsWith(ROUTES_DIR)) return;
        clearTimeout(timer);
        timer = setTimeout(check, SETTLE_MS);
      });

      const startupTimer = setTimeout(check, STARTUP_SETTLE_MS);

      try {
        server.ws.on('connection', () => {
          if (pending) report(pending);
        });
      } catch {
        /* fail open */
      }

      server.httpServer?.once('close', () => {
        clearTimeout(startupTimer);
        clearTimeout(timer);
      });
    },
  };
}

// In-dev API middleware mimicking Vercel serverless /api/device/data
function waneesApiPlugin() {
  const store = new Map<string, any>();

  function getTemperatureStatus(temp: number) {
    if (temp < 8.0 || temp > 15.0) return 'CRITICAL';
    if ((temp >= 8.0 && temp < 10.0) || (temp > 13.0 && temp <= 15.0)) return 'WARNING';
    return 'SAFE';
  }

  function getHumidityStatus(hum: number) {
    if (hum < 80.0 || hum > 97.0) return 'CRITICAL';
    if ((hum >= 80.0 && hum < 85.0) || (hum > 95.0 && hum <= 97.0)) return 'WARNING';
    return 'SAFE';
  }

  function getShockStatus(shockG: number) {
    if (shockG >= 3.0) return 'CRITICAL';
    if (shockG >= 1.5) return 'WARNING';
    return 'SAFE';
  }

  function computeRiskAssessment(temp: number, hum: number, shockG: number = 0.98, overrideRisk?: string) {
    if (overrideRisk && ['SAFE', 'WARNING', 'CRITICAL', 'MEDIUM', 'HIGH'].includes(overrideRisk.toUpperCase())) {
      const raw = overrideRisk.toUpperCase();
      const level = raw === 'MEDIUM' || raw === 'HIGH' ? 'WARNING' : raw;
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

    let level: string;
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

  function computeActuators(risk: string, status: string) {
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

  function computeMovementStatus(ax?: number, ay?: number, az?: number, explicitShockG?: number) {
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
    let status: string;
    let statusLabel: string;
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

  // Baseline physical device
  const defaultMovement = computeMovementStatus(0.05, -0.02, 9.81, 0.98);
  const defaultAssessment = computeRiskAssessment(11.8, 89, defaultMovement?.shockG ?? 0.98);
  store.set('WN-001', {
    deviceId: 'WN-001',
    temperature: 11.8,
    humidity: 89,
    risk: defaultAssessment.level,
    deviceStatus: 'ONLINE',
    battery: 98,
    signalStrength: -65,
    accelerationX: 0.05,
    accelerationY: -0.02,
    accelerationZ: 9.81,
    shockG: defaultMovement?.shockG ?? 0.98,
    movementStatus: defaultMovement?.userStatus ?? 'Normal handling',
    movement: defaultMovement,
    location: { latitude: 30.0444, longitude: 31.2357 },
    latitude: 30.0444,
    longitude: 31.2357,
    timestamp: new Date().toISOString(),
    source: 'real',
    riskAssessment: defaultAssessment,
    actuators: computeActuators(defaultAssessment.level, 'ONLINE'),
  });

  return {
    name: 'wanees-api-middleware',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/device/data')) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (req.method === 'GET') {
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const deviceId = urlObj.searchParams.get('deviceId');
          res.setHeader('Content-Type', 'application/json');
          if (deviceId) {
            const item = store.get(deviceId) || store.get('WN-001');
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, data: item || null }));
          }
          const all = Array.from(store.values());
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, count: all.length, data: all }));
        }

        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const deviceId = String(body.deviceId || 'WN-001').trim();
              const temperature = typeof body.temperature === 'number' ? body.temperature : parseFloat(body.temperature);
              const humidity = typeof body.humidity === 'number' ? body.humidity : parseFloat(body.humidity);

              if (isNaN(temperature) || isNaN(humidity)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Missing or invalid sensor data: "temperature" and "humidity" must be numbers',
                  })
                );
              }

              const validStatuses = ['ONLINE', 'OFFLINE', 'SLEEP', 'WARNING', 'ERROR'];
              const rawStatus = body.deviceStatus ? String(body.deviceStatus).toUpperCase() : 'ONLINE';
              const deviceStatus = validStatuses.includes(rawStatus) ? rawStatus : 'ONLINE';

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

              const riskAssessment = computeRiskAssessment(temperature, humidity, shockG, body.risk);
              const risk = riskAssessment.level;
              const actuators = computeActuators(risk, deviceStatus);

              const location = body.location
                ? {
                    latitude: Number(body.location.latitude) || 30.0444,
                    longitude: Number(body.location.longitude) || 31.2357,
                    altitude: body.location.altitude ? Number(body.location.altitude) : undefined,
                    speed: body.location.speed ? Number(body.location.speed) : undefined,
                  }
                : body.latitude && body.longitude
                  ? { latitude: Number(body.latitude), longitude: Number(body.longitude) }
                  : undefined;

              const record = {
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

              store.set(deviceId, record);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Telemetry recorded successfully for ${deviceId}`,
                  data: record,
                })
              );
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: e?.message || 'Server error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    ensureRootCss(),
    routeTreeHealth(),
    waneesApiPlugin(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: false,
      },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'framer-motion',
      '@tanstack/react-router',
      '@tanstack/react-query',
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: '.vite-out',
    emptyOutDir: true,
  },
});
