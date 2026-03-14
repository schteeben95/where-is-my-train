export interface Vehicle {
  id: string
  type: 'train' | 'tram'
  lat: number
  lng: number
  bearing: number
  routeId: string
  routeName: string
  routeColor: string
  direction: string
  tripId: string
  currentStop: string
  status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO'
  timestamp: number
}

export interface VehiclesResponse {
  timestamp: number
  vehicles: Vehicle[]
}

export interface RouteShape {
  routeId: string
  routeName: string
  routeColor: string
  coordinates: [number, number][]
  stops: RouteStop[]
}

export interface RouteStop {
  id: string
  name: string
  lat: number
  lng: number
  sequence: number
}

export interface GtfsLookup {
  routes: Record<string, { name: string; color: string }>
  trips: Record<string, { routeId: string; headsign: string }>
  stops: Record<string, string>
}

export type VehicleFilter = 'all' | 'train' | 'tram'
export type ThemeMode = 'dark' | 'light' | 'system'
