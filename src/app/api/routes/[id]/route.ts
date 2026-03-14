import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { CACHE_TTL } from '@/lib/constants'
import type { RouteShape } from '@/lib/types'

export const runtime = 'nodejs'

let routesData: { id: string; name: string; color: string; type: string }[] | null = null
let routeStopsData: Record<string, { id: string; name: string; lat: number; lng: number; sequence: number }[]> | null = null

function loadStaticData() {
  if (!routesData) {
    const routesPath = join(process.cwd(), 'public', 'data', 'routes.json')
    routesData = existsSync(routesPath) ? JSON.parse(readFileSync(routesPath, 'utf-8')) : []
  }
  if (!routeStopsData) {
    const routeStopsPath = join(process.cwd(), 'public', 'data', 'route-stops.json')
    routeStopsData = existsSync(routeStopsPath) ? JSON.parse(readFileSync(routeStopsPath, 'utf-8')) : {}
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  loadStaticData()

  const route = routesData?.find(r => r.id === id)
  if (!route) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 })
  }

  const shapePath = join(process.cwd(), 'public', 'data', 'shapes', `${id}.json`)
  let coordinates: [number, number][] = []
  if (existsSync(shapePath)) {
    coordinates = JSON.parse(readFileSync(shapePath, 'utf-8'))
  }

  const stops = routeStopsData?.[id] || []

  const response: RouteShape = {
    routeId: route.id,
    routeName: route.name,
    routeColor: route.color,
    coordinates,
    stops,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_TTL.routes}, stale-while-revalidate=3600`,
    },
  })
}
