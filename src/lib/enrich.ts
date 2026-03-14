import type { Vehicle, GtfsLookup } from './types'

interface RawVehicle {
  id: string
  type: 'train' | 'tram'
  lat: number
  lng: number
  bearing: number
  routeId: string
  tripId: string
  stopId: string
  status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO'
  timestamp: number
}

const DEFAULT_COLOR = '#888888'

export function enrichVehicles(
  raw: RawVehicle[],
  lookup: GtfsLookup
): Vehicle[] {
  return raw.map(v => {
    const routeInfo = lookup.routes[v.routeId]
    const tripInfo = lookup.trips[v.tripId]
    const stopName = lookup.stops[v.stopId]

    const effectiveRouteId = tripInfo?.routeId || v.routeId
    const effectiveRouteInfo = lookup.routes[effectiveRouteId] || routeInfo

    return {
      id: v.id,
      type: v.type,
      lat: v.lat,
      lng: v.lng,
      bearing: v.bearing,
      routeId: effectiveRouteId,
      routeName: effectiveRouteInfo?.name || v.routeId,
      routeColor: effectiveRouteInfo?.color || DEFAULT_COLOR,
      direction: tripInfo?.headsign ? `towards ${tripInfo.headsign}` : '',
      tripId: v.tripId,
      currentStop: stopName || v.stopId,
      status: v.status,
      timestamp: v.timestamp,
    }
  })
}
