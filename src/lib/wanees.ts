import {
  waneesDataService,
  calculateRisk,
  computeRiskAssessment,
  computeActuators,
  computeMovementStatus,
  MOVEMENT_THRESHOLDS,
  type NormalizedDeviceData,
  type DataSource,
  type ActuatorState,
  type RiskAssessment,
  type GpsLocation,
  type MovementStatus,
  type MovementData,
  type HistoricalMotionReading,
} from './dataProvider'

export type {
  DataSource,
  ActuatorState,
  RiskAssessment,
  GpsLocation,
  NormalizedDeviceData,
  MovementStatus,
  MovementData,
  HistoricalMotionReading,
}
export { calculateRisk, computeRiskAssessment, computeActuators, computeMovementStatus, MOVEMENT_THRESHOLDS }

export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL' | 'MEDIUM' | 'HIGH'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SLEEP' | 'WARNING' | 'ERROR'
export type ShipmentStatus = 'IN_TRANSIT' | 'COMPLETED'
export type User = { name: string; company: string; email: string }

export type SensorReading = {
  temperature: number
  humidity: number
  risk: RiskLevel
  updated: string
  battery?: number
  signalStrength?: number
  accelerationX?: number
  accelerationY?: number
  accelerationZ?: number
  shockG?: number
  movementStatus?: string
  movement?: MovementData
  actuators?: ActuatorState
  riskAssessment?: RiskAssessment
}

export type Shipment = {
  id: string
  cargo: string
  origin: string
  destination: string
  deviceId: string
  status: ShipmentStatus
  reading: SensorReading
  source: DataSource
  actuators?: ActuatorState
  riskAssessment?: RiskAssessment
}

export type Device = {
  id: string
  status: DeviceStatus
  battery: number
  firmware: string
  lastSeen: string
  source: DataSource
  shipmentId?: string
  actuators?: ActuatorState
  riskAssessment?: RiskAssessment
}

export type Alert = {
  id: string
  shipmentId: string
  level: RiskLevel | 'RESOLVED'
  message: string
  time: string
  active: boolean
  source?: DataSource
}

const AUTH_KEY = 'wanees_demo_auth'
const USERS_KEY = 'wanees_demo_users'

export const defaultUser: User = {
  name: 'Ahmed Hassan',
  company: 'Wanees Demo Co.',
  email: 'demo@wanees.com',
}

export const defaultShipments: Shipment[] = [
  {
    id: 'WN-001',
    cargo: 'Fresh Mango Export (Physical ESP32)',
    origin: 'Cairo, Egypt',
    destination: 'Rotterdam, Netherlands',
    deviceId: 'Wanees-001',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 11.8,
      humidity: 89,
      risk: 'SAFE',
      updated: 'Just now',
      battery: 98,
      signalStrength: -65,
      accelerationX: 0.05,
      accelerationY: -0.02,
      accelerationZ: 9.81,
      shockG: 0.98,
      movementStatus: 'Normal handling',
      movement: computeMovementStatus(0.05, -0.02, 9.81, 0.98),
      actuators: computeActuators('SAFE', 'ONLINE'),
      riskAssessment: computeRiskAssessment(11.8, 89, 0.98),
    },
    source: 'real',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(11.8, 89, 0.98),
  },
  {
    id: 'WN-002',
    cargo: 'Premium Mango Export',
    origin: 'Cairo, Egypt',
    destination: 'Jeddah, Saudi Arabia',
    deviceId: 'Wanees-002',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 14.2,
      humidity: 83,
      risk: 'WARNING',
      updated: '10 sec ago',
      battery: 84,
      signalStrength: -72,
      accelerationX: 1.20,
      accelerationY: -0.85,
      accelerationZ: 10.40,
      shockG: 1.75,
      movementStatus: 'Movement detected',
      movement: computeMovementStatus(1.20, -0.85, 10.40, 1.75),
      actuators: computeActuators('WARNING', 'ONLINE'),
      riskAssessment: computeRiskAssessment(14.2, 83, 1.75),
    },
    source: 'simulation',
    actuators: computeActuators('WARNING', 'ONLINE'),
    riskAssessment: computeRiskAssessment(14.2, 83, 1.75),
  },
  {
    id: 'WN-003',
    cargo: 'Fresh Agricultural Cargo',
    origin: 'Cairo, Egypt',
    destination: 'Dubai, UAE',
    deviceId: 'Wanees-003',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 16.5,
      humidity: 78,
      risk: 'CRITICAL',
      updated: '5 sec ago',
      battery: 76,
      signalStrength: -80,
      accelerationX: 3.20,
      accelerationY: -2.10,
      accelerationZ: 14.50,
      shockG: 3.40,
      movementStatus: 'Strong impact detected',
      movement: computeMovementStatus(3.20, -2.10, 14.50, 3.40),
      actuators: computeActuators('CRITICAL', 'ONLINE'),
      riskAssessment: computeRiskAssessment(16.5, 78, 3.40),
    },
    source: 'simulation',
    actuators: computeActuators('CRITICAL', 'ONLINE'),
    riskAssessment: computeRiskAssessment(16.5, 78, 3.40),
  },
  {
    id: 'WN-004',
    cargo: 'Pharmaceutical Cold Chain',
    origin: 'Alexandria, Egypt',
    destination: 'Amman, Jordan',
    deviceId: 'Wanees-004',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 11.5,
      humidity: 90,
      risk: 'SAFE',
      updated: '12 sec ago',
      battery: 91,
      signalStrength: -68,
      accelerationX: 0.04,
      accelerationY: 0.02,
      accelerationZ: 9.81,
      shockG: 0.98,
      movementStatus: 'Normal handling',
      movement: computeMovementStatus(0.04, 0.02, 9.81, 0.98),
      actuators: computeActuators('SAFE', 'ONLINE'),
      riskAssessment: computeRiskAssessment(11.5, 90, 0.98),
    },
    source: 'simulation',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(11.5, 90, 0.98),
  },
]

export const devices: Device[] = [
  {
    id: 'Wanees-001',
    status: 'ONLINE',
    battery: 98,
    firmware: 'v1.4.2-esp32',
    lastSeen: 'Just now',
    source: 'real',
    shipmentId: 'WN-001',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(11.8, 89, 0.98),
  },
  {
    id: 'Wanees-002',
    status: 'ONLINE',
    battery: 84,
    firmware: 'v1.4.2-sim',
    lastSeen: '10 seconds ago',
    source: 'simulation',
    shipmentId: 'WN-002',
    actuators: computeActuators('WARNING', 'ONLINE'),
    riskAssessment: computeRiskAssessment(14.2, 83, 1.75),
  },
  {
    id: 'Wanees-003',
    status: 'ONLINE',
    battery: 76,
    firmware: 'v1.4.1-sim',
    lastSeen: '5 seconds ago',
    source: 'simulation',
    shipmentId: 'WN-003',
    actuators: computeActuators('CRITICAL', 'ONLINE'),
    riskAssessment: computeRiskAssessment(16.5, 78, 3.40),
  },
  {
    id: 'Wanees-004',
    status: 'ONLINE',
    battery: 91,
    firmware: 'v1.4.2-sim',
    lastSeen: '12 seconds ago',
    source: 'simulation',
    shipmentId: 'WN-004',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(11.5, 90, 0.98),
  },
]

export const authService = {
  currentUser: (): User | null =>
    typeof window === 'undefined' ? null : (JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') as User | null),
  login: (email: string, password: string): User => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as (User & { password: string })[]
    const demo = { ...defaultUser, password: 'wanees123' }
    const match = [demo, ...users].find(
      user => user.email.toLowerCase() === email.toLowerCase() && user.password === password
    )
    if (!match) throw new Error('Email or password is incorrect. Try demo@wanees.com / wanees123.')
    const user = { name: match.name, company: match.company, email: match.email }
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    return user
  },
  register: (user: User, password: string): User => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as (User & { password: string })[]
    if (
      users.some(existing => existing.email.toLowerCase() === user.email.toLowerCase()) ||
      user.email.toLowerCase() === defaultUser.email
    ) {
      throw new Error('An account with this email already exists.')
    }
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, { ...user, password }]))
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    return user
  },
  logout: () => localStorage.removeItem(AUTH_KEY),
}

/**
 * Unified Shipment Service
 * Integrates RealDeviceProvider (for physical WN-001) and SimulationProvider (for WN-002, WN-003, WN-004)
 */
export const shipmentService = {
  list(): Shipment[] {
    const realSnapshot = (waneesDataService.realProvider as any).lastKnownData as NormalizedDeviceData
    const simOverrides = (waneesDataService.simProvider as any).getOverrides?.() || {}
    const simProfiles = (waneesDataService.simProvider as any).simulationProfiles || {}

    return defaultShipments.map(item => {
      if (item.id === 'WN-001') {
        const temp = realSnapshot?.temperature ?? item.reading.temperature
        const hum = realSnapshot?.humidity ?? item.reading.humidity
        const ax = realSnapshot?.accelerationX ?? item.reading.accelerationX ?? 0.05
        const ay = realSnapshot?.accelerationY ?? item.reading.accelerationY ?? -0.02
        const az = realSnapshot?.accelerationZ ?? item.reading.accelerationZ ?? 9.81
        const explicitShockG = realSnapshot?.shockG ?? item.reading.shockG
        const movement = realSnapshot?.movement ?? computeMovementStatus(ax, ay, az, explicitShockG)
        const shockG = explicitShockG ?? movement?.shockG ?? 0.98
        const movementStatus = realSnapshot?.movementStatus ?? movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling')
        const risk = realSnapshot?.risk ?? calculateRisk(temp, hum, shockG)
        const status = realSnapshot?.deviceStatus ?? 'ONLINE'
        const actuators = realSnapshot?.actuators ?? computeActuators(risk, status)
        const riskAssessment = realSnapshot?.riskAssessment ?? computeRiskAssessment(temp, hum, shockG, risk)

        return {
          ...item,
          reading: {
            temperature: temp,
            humidity: hum,
            risk,
            updated: 'Live from ESP32',
            battery: realSnapshot?.battery ?? 98,
            signalStrength: realSnapshot?.signalStrength ?? -65,
            accelerationX: ax,
            accelerationY: ay,
            accelerationZ: az,
            shockG,
            movementStatus,
            movement,
            actuators,
            riskAssessment,
          },
          source: 'real' as const,
          actuators,
          riskAssessment,
        }
      }

      // Simulated shipments
      const overrideRisk = simOverrides[item.id] as RiskLevel | undefined
      if (overrideRisk && simProfiles[overrideRisk]) {
        const p = simProfiles[overrideRisk]
        const ax = p.accelerationX ?? item.reading.accelerationX ?? 0.05
        const ay = p.accelerationY ?? item.reading.accelerationY ?? -0.02
        const az = p.accelerationZ ?? item.reading.accelerationZ ?? 9.81
        const shockG = p.shockG ?? (overrideRisk === 'CRITICAL' ? 3.4 : overrideRisk === 'WARNING' || overrideRisk === 'MEDIUM' ? 1.75 : 0.98)
        const movement = computeMovementStatus(ax, ay, az, shockG)
        const movementStatus = movement?.userStatus ?? (shockG >= 3.0 ? 'Strong impact detected' : shockG >= 1.5 ? 'Movement detected' : 'Normal handling')
        const actuators = computeActuators(overrideRisk, 'ONLINE')
        const riskAssessment = computeRiskAssessment(p.temperature, p.humidity, shockG, overrideRisk)
        return {
          ...item,
          reading: {
            temperature: p.temperature,
            humidity: p.humidity,
            risk: overrideRisk,
            updated: 'Just now (simulated)',
            battery: item.reading.battery ?? 85,
            signalStrength: item.reading.signalStrength ?? -70,
            accelerationX: ax,
            accelerationY: ay,
            accelerationZ: az,
            shockG,
            movementStatus,
            movement,
            actuators,
            riskAssessment,
          },
          source: 'simulation' as const,
          actuators,
          riskAssessment,
        }
      }

      return item
    })
  },

  get(id: string): Shipment | undefined {
    return this.list().find(shipment => shipment.id === id)
  },

  forDevice(deviceId: string): Shipment | undefined {
    const normalized = deviceId.toLowerCase()
    return this.list().find(
      shipment => shipment.deviceId.toLowerCase() === normalized || shipment.id.toLowerCase() === normalized
    )
  },

  simulate(shipmentId: string, risk: RiskLevel) {
    waneesDataService.simulateDevice(shipmentId, risk)
  },
}

export const deviceService = {
  list(): Device[] {
    const realSnapshot = (waneesDataService.realProvider as any).lastKnownData as NormalizedDeviceData
    return devices.map(device => {
      if (device.id === 'Wanees-001' || device.shipmentId === 'WN-001') {
        const status = realSnapshot?.deviceStatus || 'ONLINE'
        const risk = realSnapshot?.risk || 'SAFE'
        return {
          ...device,
          status,
          battery: realSnapshot?.battery ?? 98,
          lastSeen: realSnapshot?.lastSeen || 'Just now',
          source: 'real' as const,
          actuators: realSnapshot?.actuators ?? computeActuators(risk, status),
          riskAssessment: realSnapshot?.riskAssessment,
        }
      }
      return device
    })
  },
  get(id: string): Device | undefined {
    return this.list().find(device => device.id.toLowerCase() === id.toLowerCase() || device.shipmentId?.toLowerCase() === id.toLowerCase())
  },
}

export const alertService = {
  list(): Alert[] {
    const shipments = shipmentService.list()
    const dynamic: Alert[] = []

    shipments.forEach(shipment => {
      const risk = shipment.reading.risk
      if (risk !== 'SAFE') {
        dynamic.push({
          id: `alert-${shipment.id}`,
          shipmentId: shipment.id,
          level: risk,
          message:
            risk === 'CRITICAL'
              ? `Critical threshold exceeded (${shipment.reading.temperature.toFixed(1)}°C / ${shipment.reading.humidity}%). Buzzer triggered on ${shipment.source === 'real' ? 'Physical ESP32' : 'Simulated Unit'}.`
              : risk === 'HIGH'
              ? `High environmental stress warning on ${shipment.id} (${shipment.reading.temperature.toFixed(1)}°C).`
              : `Moderate conditions advisory on ${shipment.id} (${shipment.reading.humidity}% RH).`,
          time: shipment.source === 'real' ? 'Just now' : shipment.id === 'WN-003' ? '2 minutes ago' : '18 minutes ago',
          active: true,
          source: shipment.source,
        })
      }
    })

    dynamic.push({
      id: 'alert-hist-01',
      shipmentId: 'WN-001',
      level: 'RESOLVED',
      message: 'Physical ESP32 baseline telemetry verified and online.',
      time: '45 minutes ago',
      active: false,
      source: 'real',
    })

    return dynamic
  },
}

export function mockHistory(reading: SensorReading | Omit<SensorReading, 'updated'>) {
  const realHistory = waneesDataService.realProvider.getHistory()
  if (realHistory && realHistory.length > 0) {
    return realHistory.map((pt, idx) => {
      if (idx === realHistory.length - 1) {
        return { time: 'Now', temperature: reading.temperature, humidity: reading.humidity }
      }
      return pt
    })
  }

  const temp = [11.2, 11.4, 11.6, 11.9, 12.0, reading.temperature]
  const humidity = [88, 89, 89, 90, 90, reading.humidity]
  const labels = ['00:00', '04:00', '08:00', '12:00', '16:00', 'Now']
  return labels.map((time, index) => ({ time, temperature: temp[index], humidity: humidity[index] }))
}

export function mockMotionHistory(shipment: Shipment): HistoricalMotionReading[] {
  const currentMovement = shipment.reading.movement || computeMovementStatus(
    shipment.reading.accelerationX,
    shipment.reading.accelerationY,
    shipment.reading.accelerationZ,
    shipment.reading.shockG
  )
  const currShock = shipment.reading.shockG ?? currentMovement?.shockG ?? 0.98
  const currStatus = shipment.reading.movementStatus ?? currentMovement?.userStatus ?? 'Normal handling'

  if (shipment.source === 'real') {
    const realMotion = waneesDataService.realProvider.getMotionHistory()
    if (realMotion && realMotion.length > 0) {
      return realMotion.map((pt, idx) => {
        if (idx === realMotion.length - 1) {
          return {
            time: 'Now',
            x: shipment.reading.accelerationX ?? pt.x,
            y: shipment.reading.accelerationY ?? pt.y,
            z: shipment.reading.accelerationZ ?? pt.z,
            shockG: currShock,
            status: currStatus,
          }
        }
        return {
          ...pt,
          shockG: pt.shockG ?? 0.98,
          status: pt.status ?? 'Normal handling',
        }
      })
    }
  }

  return [
    { time: '10:15', x: 0.05, y: -0.02, z: 9.80, shockG: 0.98, status: 'Normal handling' },
    { time: '10:25', x: 0.08, y: -0.01, z: 9.82, shockG: 1.02, status: 'Normal handling' },
    { time: '10:32', x: 0.12, y: -0.03, z: 9.81, shockG: 0.99, status: 'Normal handling' },
    { time: '10:37', x: 1.85, y: -1.20, z: 10.45, shockG: 1.75, status: 'Movement detected' },
    { time: '10:41', x: 4.80, y: -2.10, z: 12.80, shockG: 3.25, status: 'Strong impact detected' },
    {
      time: 'Now',
      x: shipment.reading.accelerationX ?? 0.05,
      y: shipment.reading.accelerationY ?? -0.02,
      z: shipment.reading.accelerationZ ?? 9.81,
      shockG: currShock,
      status: currStatus,
    },
  ]
}

export function getShockPresentation(shockG?: number, userStatus?: string) {
  const g = typeof shockG === 'number' && !isNaN(shockG) ? Math.round(shockG * 100) / 100 : 0.98

  if (g >= 3.0 || userStatus === 'Critical impact' || userStatus === 'Strong impact detected') {
    return {
      value: `${g.toFixed(2)} g`,
      status: g >= 5.0 ? '🔴 Critical impact' : '⚠️ Strong impact detected',
      rawStatus: 'Strong impact detected',
      level: 'critical',
      badgeClass: 'border-red-400/35 bg-red-400/15 text-red-300',
      dotClass: 'bg-red-400',
      description: `Critical physical impact detected (${g.toFixed(2)} g >= 3.0 g threshold). Urgent inspection advised.`,
    }
  }
  if (g >= 1.5 || userStatus === 'Movement detected' || userStatus === 'Moderate impact') {
    return {
      value: `${g.toFixed(2)} g`,
      status: 'Movement detected',
      rawStatus: 'Movement detected',
      level: 'warning',
      badgeClass: 'border-amber-400/35 bg-amber-400/15 text-amber-300',
      dotClass: 'bg-amber-400',
      description: `Active movement / moderate impact detected (${g.toFixed(2)} g in 1.5–<3.0 g warning range).`,
    }
  }
  return {
    value: `${g.toFixed(2)} g`,
    status: 'Normal handling',
    rawStatus: 'Normal handling',
    level: 'normal',
    badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
    description: `Cargo handling is steady and within normal transport limits (${g.toFixed(2)} g < 1.5 g).`,
  }
}
