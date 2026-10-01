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

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
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
      temperature: 27.4,
      humidity: 53,
      risk: 'SAFE',
      updated: 'Just now',
      battery: 98,
      signalStrength: -65,
      accelerationX: 0.12,
      accelerationY: -0.04,
      accelerationZ: 9.81,
      shockG: 0.2,
      movementStatus: 'Normal handling',
      movement: computeMovementStatus(0.12, -0.04, 9.81),
      actuators: computeActuators('SAFE', 'ONLINE'),
      riskAssessment: computeRiskAssessment(27.4, 53),
    },
    source: 'real',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(27.4, 53),
  },
  {
    id: 'WN-002',
    cargo: 'Premium Mango Export',
    origin: 'Cairo, Egypt',
    destination: 'Jeddah, Saudi Arabia',
    deviceId: 'Wanees-002',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 30.8,
      humidity: 75,
      risk: 'MEDIUM',
      updated: '10 sec ago',
      battery: 84,
      signalStrength: -72,
      accelerationX: 0.28,
      accelerationY: -0.15,
      accelerationZ: 9.84,
      movement: computeMovementStatus(0.28, -0.15, 9.84),
      actuators: computeActuators('MEDIUM', 'ONLINE'),
      riskAssessment: computeRiskAssessment(30.8, 75),
    },
    source: 'simulation',
    actuators: computeActuators('MEDIUM', 'ONLINE'),
    riskAssessment: computeRiskAssessment(30.8, 75),
  },
  {
    id: 'WN-003',
    cargo: 'Fresh Agricultural Cargo',
    origin: 'Cairo, Egypt',
    destination: 'Dubai, UAE',
    deviceId: 'Wanees-003',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 35.8,
      humidity: 82,
      risk: 'CRITICAL',
      updated: '5 sec ago',
      battery: 76,
      signalStrength: -80,
      accelerationX: 1.85,
      accelerationY: -1.42,
      accelerationZ: 11.20,
      movement: computeMovementStatus(1.85, -1.42, 11.20),
      actuators: computeActuators('CRITICAL', 'ONLINE'),
      riskAssessment: computeRiskAssessment(35.8, 82),
    },
    source: 'simulation',
    actuators: computeActuators('CRITICAL', 'ONLINE'),
    riskAssessment: computeRiskAssessment(35.8, 82),
  },
  {
    id: 'WN-004',
    cargo: 'Pharmaceutical Cold Chain',
    origin: 'Alexandria, Egypt',
    destination: 'Amman, Jordan',
    deviceId: 'Wanees-004',
    status: 'IN_TRANSIT',
    reading: {
      temperature: 24.5,
      humidity: 62,
      risk: 'SAFE',
      updated: '12 sec ago',
      battery: 91,
      signalStrength: -68,
      accelerationX: 0.04,
      accelerationY: 0.02,
      accelerationZ: 9.81,
      movement: computeMovementStatus(0.04, 0.02, 9.81),
      actuators: computeActuators('SAFE', 'ONLINE'),
      riskAssessment: computeRiskAssessment(24.5, 62),
    },
    source: 'simulation',
    actuators: computeActuators('SAFE', 'ONLINE'),
    riskAssessment: computeRiskAssessment(24.5, 62),
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
    riskAssessment: computeRiskAssessment(27.4, 53),
  },
  {
    id: 'Wanees-002',
    status: 'ONLINE',
    battery: 84,
    firmware: 'v1.4.2-sim',
    lastSeen: '10 seconds ago',
    source: 'simulation',
    shipmentId: 'WN-002',
    actuators: computeActuators('MEDIUM', 'ONLINE'),
    riskAssessment: computeRiskAssessment(30.8, 75),
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
    riskAssessment: computeRiskAssessment(35.8, 82),
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
    riskAssessment: computeRiskAssessment(24.5, 62),
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
        const risk = realSnapshot?.risk ?? calculateRisk(temp, hum)
        const status = realSnapshot?.deviceStatus ?? 'ONLINE'
        const actuators = realSnapshot?.actuators ?? computeActuators(risk, status)
        const riskAssessment = realSnapshot?.riskAssessment ?? computeRiskAssessment(temp, hum, risk)
        const ax = realSnapshot?.accelerationX ?? item.reading.accelerationX ?? 0.12
        const ay = realSnapshot?.accelerationY ?? item.reading.accelerationY ?? -0.04
        const az = realSnapshot?.accelerationZ ?? item.reading.accelerationZ ?? 9.81
        const movement = realSnapshot?.movement ?? computeMovementStatus(ax, ay, az)
        const shockG = realSnapshot?.shockG ?? movement?.shockG ?? 0.2
        const movementStatus = realSnapshot?.movementStatus ?? movement?.userStatus ?? 'Normal handling'

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
        const actuators = computeActuators(overrideRisk, 'ONLINE')
        const riskAssessment = computeRiskAssessment(p.temperature, p.humidity, overrideRisk)
        const ax = p.accelerationX ?? item.reading.accelerationX ?? 0.1
        const ay = p.accelerationY ?? item.reading.accelerationY ?? 0
        const az = p.accelerationZ ?? item.reading.accelerationZ ?? 9.81
        const movement = computeMovementStatus(ax, ay, az)
        const shockG = movement?.shockG ?? (overrideRisk === 'CRITICAL' ? 4.8 : overrideRisk === 'MEDIUM' ? 1.4 : 0.2)
        const movementStatus = movement?.userStatus ?? (overrideRisk === 'CRITICAL' ? 'Strong impact detected' : overrideRisk === 'MEDIUM' ? 'Movement detected' : 'Normal handling')
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

  const temp = [24, 25, 25.5, 26, 26.8, reading.temperature]
  const humidity = [64, 65, 66, 67, 68, reading.humidity]
  const labels = ['00:00', '04:00', '08:00', '12:00', '16:00', 'Now']
  return labels.map((time, index) => ({ time, temperature: temp[index], humidity: humidity[index] }))
}

export function mockMotionHistory(shipment: Shipment): HistoricalMotionReading[] {
  const currentMovement = shipment.reading.movement || computeMovementStatus(
    shipment.reading.accelerationX,
    shipment.reading.accelerationY,
    shipment.reading.accelerationZ
  )
  const currShock = shipment.reading.shockG ?? currentMovement?.shockG ?? 0.2
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
          shockG: pt.shockG ?? 0.2,
          status: pt.status ?? 'Normal handling',
        }
      })
    }
  }

  return [
    { time: '10:15', x: 0.05, y: -0.02, z: 9.80, shockG: 0.2, status: 'Normal handling' },
    { time: '10:25', x: 0.08, y: -0.01, z: 9.82, shockG: 0.2, status: 'Normal handling' },
    { time: '10:32', x: 0.12, y: -0.03, z: 9.81, shockG: 0.2, status: 'Normal handling' },
    { time: '10:37', x: 1.85, y: -1.20, z: 10.45, shockG: 1.1, status: 'Movement detected' },
    { time: '10:41', x: 0.15, y: -0.04, z: 9.81, shockG: 0.2, status: 'Normal handling' },
    {
      time: 'Now',
      x: shipment.reading.accelerationX ?? 0.12,
      y: shipment.reading.accelerationY ?? -0.04,
      z: shipment.reading.accelerationZ ?? 9.81,
      shockG: currShock,
      status: currStatus,
    },
  ]
}
