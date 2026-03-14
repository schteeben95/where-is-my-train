import { NextResponse } from 'next/server'
import { parseVehiclePositions } from '@/lib/gtfs-rt'
import { enrichVehicles } from '@/lib/enrich'
import { GTFS_RT_URLS, CACHE_TTL } from '@/lib/constants'
import type { GtfsLookup, VehiclesResponse } from '@/lib/types'

export const runtime = 'nodejs'

// Load lookup table at module scope (persists across requests in same cold start)
let lookup: GtfsLookup
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lookup = require('@/lib/gtfs-lookup.json')
} catch {
  lookup = { routes: {}, trips: {}, stops: {} }
  console.warn('GTFS lookup table not found - run pnpm fetch-gtfs first')
}

async function fetchFeed(url: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { KeyId: apiKey },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function GET() {
  const apiKey = process.env.OPENDATA_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENDATA_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const [metroBuffer, tramBuffer] = await Promise.allSettled([
      fetchFeed(GTFS_RT_URLS.metro, apiKey),
      fetchFeed(GTFS_RT_URLS.tram, apiKey),
    ])

    const metroRaw =
      metroBuffer.status === 'fulfilled'
        ? parseVehiclePositions(metroBuffer.value, 'train')
        : []

    const tramRaw =
      tramBuffer.status === 'fulfilled'
        ? parseVehiclePositions(tramBuffer.value, 'tram')
        : []

    if (metroBuffer.status === 'rejected') {
      console.error('Metro feed failed:', metroBuffer.reason)
    }
    if (tramBuffer.status === 'rejected') {
      console.error('Tram feed failed:', tramBuffer.reason)
    }

    const allRaw = [...metroRaw, ...tramRaw]
    const enriched = enrichVehicles(allRaw, lookup)

    // Deduplicate by vehicle ID, keeping the most recent entry
    const seen = new Map<string, typeof enriched[number]>()
    for (const v of enriched) {
      const existing = seen.get(v.id)
      if (!existing || v.timestamp > existing.timestamp) {
        seen.set(v.id, v)
      }
    }
    const vehicles = Array.from(seen.values()).sort((a, b) => a.id.localeCompare(b.id))

    const response: VehiclesResponse = {
      timestamp: Math.floor(Date.now() / 1000),
      vehicles,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL.vehicles}, stale-while-revalidate=60`,
      },
    })
  } catch (err) {
    console.error('Vehicles API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch vehicle positions' },
      { status: 502 }
    )
  }
}
