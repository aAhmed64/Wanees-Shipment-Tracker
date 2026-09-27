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

  function computeRiskAssessment(temp: number, humidity: number, overrideRisk?: string) {
    if (overrideRisk && ['SAFE', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(overrideRisk.toUpperCase())) {
      const level = overrideRisk.toUpperCase();
      const scores: Record<string, number> = { SAFE: 10, MEDIUM: 45, HIGH: 75, CRITICAL: 95 };
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

    let level = 'SAFE';
    if (temp >= 35 || humidity >= 80) level = 'CRITICAL';
    else if (temp >= 32 || humidity >= 76) level = 'HIGH';
    else if (temp >= 29 || humidity >= 71) level = 'MEDIUM';

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

  // Baseline physical device
  const defaultAssessment = computeRiskAssessment(27.4, 53);
  store.set('WN-001', {
    deviceId: 'WN-001',
    temperature: 27.4,
    humidity: 53,
    risk: defaultAssessment.level,
    deviceStatus: 'ONLINE',
    battery: 98,
    signalStrength: -65,
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

              const riskAssessment = computeRiskAssessment(temperature, humidity, body.risk);
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
