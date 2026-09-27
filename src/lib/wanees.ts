import { waneesDataService, calculateRisk, type NormalizedDeviceData, type DataSource } from './dataProvider'

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DeviceStatus = 'ONLINE' | 'OFFLINE'
export type ShipmentStatus = 'IN_TRANSIT' | 'COMPLETED'
export type User = { name: string; company: string; email: string }
export type SensorReading = { temperature: number; humidity: number; risk: RiskLevel; updated: string }
export type Shipment = {
  id: string
  cargo: string
  origin: string
  destination: string
  deviceId: string
  status: ShipmentStatus
  reading: SensorReading
  source: DataSource
}
export type Device = {
  id: string
  status: DeviceStatus
  battery: number
  firmware: string
  lastSeen: string
  source: DataSource
  shipmentId?: string
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
    reading: { temperature: 27.4, humidity: 53, risk: 'SAFE', updated: 'Just now' },
    source: 'real',
  },
  {
    id: 'WN-002',
    cargo: 'Premium Mango Export',
    origin: 'Cairo, Egypt',
    destination: 'Jeddah, Saudi Arabia',
    deviceId: 'Wanees-002',
    status: 'IN_TRANSIT',
    reading: { temperature: 30.8, humidity: 75, risk: 'MEDIUM', updated: '10 sec ago' },
    source: 'simulation',
  },
  {
    id: 'WN-003',
    cargo: 'Fresh Agricultural Cargo',
    origin: 'Cairo, Egypt',
    destination: 'Dubai, UAE',
    deviceId: 'Wanees-003',
    status: 'IN_TRANSIT',
    reading: { temperature: 35.8, humidity: 82, risk: 'CRITICAL', updated: '5 sec ago' },
    source: 'simulation',
  },
  {
    id: 'WN-004',
    cargo: 'Pharmaceutical Cold Chain',
    origin: 'Alexandria, Egypt',
    destination: 'Amman, Jordan',
    deviceId: 'Wanees-004',
    status: 'IN_TRANSIT',
    reading: { temperature: 24.5, humidity: 62, risk: 'SAFE', updated: '12 sec ago' },
    source: 'simulation',
  },
]

export const devices: Device[] = [
  { id: 'Wanees-001', status: 'ONLINE', battery: 98, firmware: 'v1.4.2-esp32', lastSeen: 'Just now', source: 'real', shipmentId: 'WN-001' },
  { id: 'Wanees-002', status: 'ONLINE', battery: 84, firmware: 'v1.4.2-sim', lastSeen: '10 seconds ago', source: 'simulation', shipmentId: 'WN-002' },
  { id: 'Wanees-003', status: 'ONLINE', battery: 76, firmware: 'v1.4.1-sim', lastSeen: '5 seconds ago', source: 'simulation', shipmentId: 'WN-003' },
  { id: 'Wanees-004', status: 'ONLINE', battery: 91, firmware: 'v1.4.2-sim', lastSeen: '12 seconds ago', source: 'simulation', shipmentId: 'WN-004' },
]

export const datastreamMapping = {
  temperature: 'V0',
  humidity: 'V1',
  risk: 'V2',
  battery: 'V3',
  latitude: 'V4',
  longitude: 'V5',
}

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
 * Optional legacy Blynk adapter
 * Preserved for backwards compatibility, completely optional.
 */
export const blynkService = {
  async getDeviceCurrentData(deviceId: string) {
    return shipmentService.forDevice(deviceId)?.reading ?? null
  },
  async getTemperature(deviceId: string) {
    return (await this.getDeviceCurrentData(deviceId))?.temperature ?? null
  },
  async getHumidity(deviceId: string) {
    return (await this.getDeviceCurrentData(deviceId))?.humidity ?? null
  },
  async getRisk(deviceId: string) {
    return (await this.getDeviceCurrentData(deviceId))?.risk ?? null
  },
  async getHistoricalData(deviceId: string) {
    const shipment = shipmentService.forDevice(deviceId)
    return shipment ? mockHistory(shipment.reading) : []
  },
}

/**
 * Unified Shipment Service
 * Integrates RealDeviceProvider (for physical WN-001) and SimulationProvider (for WN-002, WN-003, WN-004)
 */
export const shipmentService = {
  list(): Shipment[] {
    const realData = waneesDataService.realProvider.getDevice('WN-001')
    // Synchronous read of latest known states
    const realSnapshot = (waneesDataService.realProvider as any).lastKnownData as NormalizedDeviceData
    const simOverrides = (waneesDataService.simProvider as any).getOverrides?.() || {}
    const simProfiles = (waneesDataService.simProvider as any).simulationProfiles || {}

    return defaultShipments.map(item => {
      if (item.id === 'WN-001') {
        const temp = realSnapshot?.temperature ?? item.reading.temperature
        const hum = realSnapshot?.humidity ?? item.reading.humidity
        const risk = realSnapshot?.risk ?? calculateRisk(temp, hum)
        return {
          ...item,
          reading: {
            temperature: temp,
            humidity: hum,
            risk,
            updated: 'Live from ESP32',
          },
          source: 'real' as const,
        }
      }

      // Simulated shipments
      const overrideRisk = simOverrides[item.id] as RiskLevel | undefined
      if (overrideRisk && simProfiles[overrideRisk]) {
        const p = simProfiles[overrideRisk]
        return {
          ...item,
          reading: {
            temperature: p.temperature,
            humidity: p.humidity,
            risk: overrideRisk,
            updated: 'Just now (simulated)',
          },
          source: 'simulation' as const,
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
        return {
          ...device,
          status: realSnapshot?.deviceStatus || 'ONLINE',
          battery: realSnapshot?.battery ?? 98,
          lastSeen: realSnapshot?.lastSeen || 'Just now',
          source: 'real' as const,
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
              ? `Temperature (${shipment.reading.temperature.toFixed(1)}°C) exceeded safe threshold on ${shipment.source === 'real' ? 'Physical ESP32' : 'Simulated Unit'}.`
              : risk === 'HIGH'
              ? `Environmental conditions approaching critical range on ${shipment.id}.`
              : `Humidity (${shipment.reading.humidity}%) elevated above nominal range.`,
          time: shipment.source === 'real' ? 'Just now' : shipment.id === 'WN-003' ? '2 minutes ago' : '18 minutes ago',
          active: true,
          source: shipment.source,
        })
      }
    })

    // Also include a resolved alert for demonstration
    dynamic.push({
      id: 'alert-hist-01',
      shipmentId: 'WN-001',
      level: 'RESOLVED',
      message: 'Physical ESP32 environmental baseline calibrated and verified.',
      time: '45 minutes ago',
      active: false,
      source: 'real',
    })

    return dynamic
  },
}

export function mockHistory(reading: SensorReading | Omit<SensorReading, 'updated'>) {
  // If it's the real device, we can blend with RealDeviceProvider's history
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
