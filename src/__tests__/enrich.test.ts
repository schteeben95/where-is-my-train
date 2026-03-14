import { describe, it, expect } from 'vitest'
import { enrichVehicles } from '@/lib/enrich'
import type { GtfsLookup } from '@/lib/types'

const mockLookup: GtfsLookup = {
  routes: {
    'route-1': { name: 'Sandringham', color: '#0072CE' },
    'route-2': { name: 'Route 96', color: '#78BE20' },
  },
  trips: {
    'trip-1': { routeId: 'route-1', headsign: 'Flinders Street' },
    'trip-2': { routeId: 'route-2', headsign: 'East Brunswick' },
  },
  stops: {
    'stop-1': 'South Yarra',
    'stop-2': 'St Kilda Road',
  },
}

describe('enrichVehicles', () => {
  it('enriches raw vehicles with route name, color, and stop name', () => {
    const raw = [
      {
        id: 'v1',
        type: 'train' as const,
        lat: -37.8,
        lng: 144.9,
        bearing: 180,
        routeId: 'route-1',
        tripId: 'trip-1',
        stopId: 'stop-1',
        status: 'IN_TRANSIT_TO' as const,
        timestamp: 1000,
      },
    ]

    const enriched = enrichVehicles(raw, mockLookup)

    expect(enriched[0].routeName).toBe('Sandringham')
    expect(enriched[0].routeColor).toBe('#0072CE')
    expect(enriched[0].direction).toBe('towards Flinders Street')
    expect(enriched[0].currentStop).toBe('South Yarra')
  })

  it('falls back to raw IDs when lookup has no match', () => {
    const raw = [
      {
        id: 'v2',
        type: 'tram' as const,
        lat: -37.8,
        lng: 144.9,
        bearing: 90,
        routeId: 'unknown-route',
        tripId: 'unknown-trip',
        stopId: 'unknown-stop',
        status: 'STOPPED_AT' as const,
        timestamp: 2000,
      },
    ]

    const enriched = enrichVehicles(raw, mockLookup)

    expect(enriched[0].routeName).toBe('unknown-route')
    expect(enriched[0].routeColor).toBe('#888888')
    expect(enriched[0].direction).toBe('')
    expect(enriched[0].currentStop).toBe('unknown-stop')
  })
})
