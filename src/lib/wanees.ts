export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DeviceStatus = 'ONLINE' | 'OFFLINE'
export type ShipmentStatus = 'IN_TRANSIT' | 'COMPLETED'
export type User = { name: string; company: string; email: string }
export type SensorReading = { temperature: number; humidity: number; risk: RiskLevel; updated: string }
export type Shipment = { id: string; cargo: string; origin: string; destination: string; deviceId: string; status: ShipmentStatus; reading: SensorReading }
export type Device = { id: string; status: DeviceStatus; battery: number; firmware: string; lastSeen: string }
export type Alert = { id: string; shipmentId: string; level: RiskLevel | 'RESOLVED'; message: string; time: string; active: boolean }

const AUTH_KEY = 'wanees_demo_auth'
const USERS_KEY = 'wanees_demo_users'
const SIM_KEY = 'wanees_demo_override'

export const defaultUser: User = { name: 'Ahmed Hassan', company: 'Wanees Demo Co.', email: 'demo@wanees.com' }
export const defaultShipments: Shipment[] = [
  { id: 'WN-001', cargo: 'Fresh Mango Export', origin: 'Cairo, Egypt', destination: 'Rotterdam, Netherlands', deviceId: 'Wanees-001', status: 'IN_TRANSIT', reading: { temperature: 27.4, humidity: 68, risk: 'SAFE', updated: 'Just now' } },
  { id: 'WN-002', cargo: 'Premium Mango Export', origin: 'Cairo, Egypt', destination: 'Jeddah, Saudi Arabia', deviceId: 'Wanees-002', status: 'IN_TRANSIT', reading: { temperature: 30.8, humidity: 75, risk: 'MEDIUM', updated: '10 sec ago' } },
  { id: 'WN-003', cargo: 'Fresh Agricultural Cargo', origin: 'Cairo, Egypt', destination: 'Dubai, UAE', deviceId: 'Wanees-003', status: 'IN_TRANSIT', reading: { temperature: 35.8, humidity: 82, risk: 'CRITICAL', updated: '5 sec ago' } },
]
export const devices: Device[] = [
  { id: 'Wanees-001', status: 'ONLINE', battery: 98, firmware: 'v1.4.2', lastSeen: 'Just now' },
  { id: 'Wanees-002', status: 'ONLINE', battery: 84, firmware: 'v1.4.2', lastSeen: '10 seconds ago' },
  { id: 'Wanees-003', status: 'ONLINE', battery: 76, firmware: 'v1.4.1', lastSeen: '5 seconds ago' },
  { id: 'Wanees-004', status: 'ONLINE', battery: 91, firmware: 'v1.4.2', lastSeen: '12 seconds ago' },
]
export const initialAlerts: Alert[] = [
  { id: 'a1', shipmentId: 'WN-003', level: 'CRITICAL', message: 'Temperature exceeded safe threshold.', time: '2 minutes ago', active: true },
  { id: 'a2', shipmentId: 'WN-002', level: 'MEDIUM', message: 'Humidity approaching upper threshold.', time: '18 minutes ago', active: false },
  { id: 'a3', shipmentId: 'WN-001', level: 'RESOLVED', message: 'Environmental conditions returned to normal.', time: '42 minutes ago', active: false },
]

export const simulationReadings: Record<RiskLevel, Omit<SensorReading, 'updated'>> = {
  SAFE: { temperature: 27.4, humidity: 68, risk: 'SAFE' },
  MEDIUM: { temperature: 30.8, humidity: 75, risk: 'MEDIUM' },
  HIGH: { temperature: 33.5, humidity: 79, risk: 'HIGH' },
  CRITICAL: { temperature: 35.8, humidity: 82, risk: 'CRITICAL' },
}

export const datastreamMapping = { temperature: 'V0', humidity: 'V1', risk: 'V2', battery: 'V3', latitude: 'V4', longitude: 'V5' }

export const authService = {
  currentUser: (): User | null => typeof window === 'undefined' ? null : JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') as User | null,
  login: (email: string, password: string): User => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as (User & { password: string })[]
    const demo = { ...defaultUser, password: 'wanees123' }
    const match = [demo, ...users].find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password)
    if (!match) throw new Error('Email or password is incorrect. Try demo@wanees.com / wanees123.')
    const user = { name: match.name, company: match.company, email: match.email }
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    return user
  },
  register: (user: User, password: string): User => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as (User & { password: string })[]
    if (users.some(existing => existing.email.toLowerCase() === user.email.toLowerCase()) || user.email.toLowerCase() === defaultUser.email) throw new Error('An account with this email already exists.')
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, { ...user, password }]))
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    return user
  },
  logout: () => localStorage.removeItem(AUTH_KEY),
}

export const blynkService = {
  async getDeviceCurrentData(deviceId: string) { return shipmentService.forDevice(deviceId)?.reading ?? null },
  async getTemperature(deviceId: string) { return (await this.getDeviceCurrentData(deviceId))?.temperature ?? null },
  async getHumidity(deviceId: string) { return (await this.getDeviceCurrentData(deviceId))?.humidity ?? null },
  async getRisk(deviceId: string) { return (await this.getDeviceCurrentData(deviceId))?.risk ?? null },
  async getHistoricalData(deviceId: string) {
    const shipment = shipmentService.forDevice(deviceId)
    return shipment ? mockHistory(shipment.reading) : []
  },
}

export const shipmentService = {
  list(): Shipment[] {
    const overrides = typeof window === 'undefined' ? {} : JSON.parse(localStorage.getItem(SIM_KEY) || '{}') as Record<string, RiskLevel>
    return defaultShipments.map(shipment => overrides[shipment.id]
      ? { ...shipment, reading: { ...simulationReadings[overrides[shipment.id]], updated: 'Just now' } }
      : shipment)
  },
  get(id: string) { return this.list().find(shipment => shipment.id === id) },
  forDevice(deviceId: string) { return this.list().find(shipment => shipment.deviceId === deviceId) },
  simulate(shipmentId: string, risk: RiskLevel) {
    const overrides = JSON.parse(localStorage.getItem(SIM_KEY) || '{}') as Record<string, RiskLevel>
    localStorage.setItem(SIM_KEY, JSON.stringify({ ...overrides, [shipmentId]: risk }))
  },
}

export const deviceService = { list: () => devices, get: (id: string) => devices.find(device => device.id.toLowerCase() === id.toLowerCase()) }
export const alertService = {
  list(): Alert[] {
    const monitored = shipmentService.list().filter(shipment => shipment.id !== 'WN-001')
    const dynamic = monitored.map(shipment => ({
      id: `sim-${shipment.id}`,
      shipmentId: shipment.id,
      level: shipment.reading.risk === 'SAFE' ? 'RESOLVED' as const : shipment.reading.risk,
      message: shipment.reading.risk === 'SAFE' ? 'Environmental conditions returned to normal.' : shipment.reading.risk === 'CRITICAL' ? 'Temperature exceeded safe threshold.' : shipment.reading.risk === 'HIGH' ? 'Environmental conditions exceeded the warning range.' : 'Humidity approaching upper threshold.',
      time: shipment.reading.risk === 'SAFE' ? 'Just now' : shipment.id === 'WN-003' ? '2 minutes ago' : '18 minutes ago',
      active: shipment.id === 'WN-003' && shipment.reading.risk !== 'SAFE',
    }))
    return [...dynamic, initialAlerts[2]]
  },
}

export function mockHistory(reading: SensorReading | Omit<SensorReading, 'updated'>) {
  const temp = [24, 25, 25.5, 26, 26.8, reading.temperature]
  const humidity = [64, 65, 66, 67, 68, reading.humidity]
  const labels = ['00:00', '04:00', '08:00', '12:00', '16:00', 'Now']
  return labels.map((time, index) => ({ time, temperature: temp[index], humidity: humidity[index] }))
}
