import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseVehiclePositions } from '@/lib/gtfs-rt'

describe('parseVehiclePositions', () => {
  it('parses a protobuf response and extracts vehicles', () => {
    const buffer = readFileSync(
      join(__dirname, 'fixtures', 'vehicle-positions.pb')
    )
    const vehicles = parseVehiclePositions(buffer, 'train')

    expect(vehicles.length).toBeGreaterThan(0)

    const first = vehicles[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('lat')
    expect(first).toHaveProperty('lng')
    expect(first).toHaveProperty('bearing')
    expect(first).toHaveProperty('routeId')
    expect(first).toHaveProperty('tripId')
    expect(first.type).toBe('train')
    expect(typeof first.lat).toBe('number')
    expect(typeof first.lng).toBe('number')
  })

  it('returns empty array for empty/invalid buffer', () => {
    const vehicles = parseVehiclePositions(Buffer.from([]), 'train')
    expect(vehicles).toEqual([])
  })

  it('parses tram protobuf response and tags vehicles as tram type', () => {
    const buffer = readFileSync(
      join(__dirname, 'fixtures', 'tram-positions.pb')
    )
    const vehicles = parseVehiclePositions(buffer, 'tram')

    expect(vehicles.length).toBeGreaterThan(0)
    expect(vehicles[0].type).toBe('tram')
    expect(typeof vehicles[0].lat).toBe('number')
    expect(typeof vehicles[0].lng).toBe('number')
  })

  it('extracts correct field values from fixture', () => {
    const buffer = readFileSync(
      join(__dirname, 'fixtures', 'vehicle-positions.pb')
    )
    const vehicles = parseVehiclePositions(buffer, 'train')

    expect(vehicles).toHaveLength(3)

    const [first, second, third] = vehicles

    expect(first.routeId).toBe('route-sandringham')
    expect(first.tripId).toBe('trip-1001')
    expect(first.status).toBe('IN_TRANSIT_TO')
    expect(first.lat).toBeCloseTo(-37.8136, 3)
    expect(first.lng).toBeCloseTo(144.9631, 3)
    expect(first.bearing).toBeCloseTo(180, 1)

    expect(second.status).toBe('STOPPED_AT')
    expect(third.status).toBe('INCOMING_AT')
  })
})
