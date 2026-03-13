# Where Is My Train - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web app showing live train and tram positions across Melbourne on an interactive map with a Liquid Glass UI.

**Architecture:** Next.js 15 App Router with a Node.js API route that fetches GTFS-RT protobuf feeds, enriches them with static GTFS data, and serves JSON cached at Vercel's CDN (30s TTL). Client renders vehicles on a Deck.gl + MapLibre map with LOD transitions and Liquid Glass floating panels.

**Tech Stack:** Next.js 15, TypeScript, Deck.gl, MapLibre GL JS, CartoCDN tiles, protobufjs, Tailwind CSS, Vitest, pnpm, Vercel.

---

## File Structure

```
where-is-my-train/
├── public/
│   └── data/                          # GTFS static data (generated at build time)
│       ├── routes.json                # Route metadata: id, name, color, type
│       ├── stops.json                 # All stop locations: id, name, lat, lng
│       └── shapes/                    # Route polylines, one file per route
│           └── [routeId].json
├── scripts/
│   └── fetch-gtfs.ts                  # Build-time: download + process GTFS static data
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout: fonts, metadata, theme provider
│   │   ├── page.tsx                   # Home page: renders MapView
│   │   ├── globals.css                # Tailwind imports + liquid glass utilities
│   │   └── api/
│   │       ├── vehicles/
│   │       │   └── route.ts           # GET /api/vehicles - fetch + parse GTFS-RT, enrich, return JSON
│   │       └── routes/
│   │           └── [id]/
│   │               └── route.ts       # GET /api/routes/[id] - serve static route shape + stops
│   ├── components/
│   │   ├── map-view.tsx               # Main map container: MapLibre + Deck.gl setup
│   │   ├── vehicle-layer.tsx          # Deck.gl layer: dots at low zoom, icons at high zoom
│   │   ├── route-layer.tsx            # Deck.gl layer: route polyline when viewing a route
│   │   ├── vehicle-popup.tsx          # Click popup: line name, direction, status
│   │   ├── route-panel.tsx            # Slide-in panel: full route detail view
│   │   ├── filter-bar.tsx             # Top-left: logo + train/tram/both pill toggles
│   │   ├── theme-toggle.tsx           # Top-right: sun/moon theme switch
│   │   ├── info-bar.tsx               # Bottom: vehicle count, last updated, attribution
│   │   └── glass-panel.tsx            # Reusable Liquid Glass container component
│   ├── hooks/
│   │   ├── use-vehicles.ts            # Poll /api/vehicles every 30s, return vehicle array
│   │   └── use-theme.ts               # System preference detection + localStorage toggle
│   ├── lib/
│   │   ├── gtfs-lookup.json           # Generated: routeId/tripId/stopId -> metadata lookup
│   │   ├── gtfs-rt.ts                 # Server-side: fetch + parse GTFS-RT protobuf feeds
│   │   ├── enrich.ts                  # Server-side: join raw vehicles with gtfs-lookup
│   │   ├── types.ts                   # Shared TypeScript types (Vehicle, Route, Stop, etc.)
│   │   └── constants.ts               # Map defaults, API URLs, zoom thresholds, colors
│   └── __tests__/
│       ├── gtfs-rt.test.ts            # Unit test: protobuf parsing
│       ├── enrich.test.ts             # Unit test: enrichment logic
│       └── fixtures/
│           ├── vehicle-positions.pb   # Recorded protobuf response (metro trains)
│           └── tram-positions.pb      # Recorded protobuf response (trams)
├── .env.local                         # OPENDATA_API_KEY (gitignored)
├── .env.example                       # Template for required env vars
├── next.config.ts                     # Next.js config
├── tailwind.config.ts                 # Tailwind config with liquid glass theme
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── .gitignore
```

---

## Chunk 1: Project Scaffolding + GTFS Data Pipeline

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js with pnpm**

```bash
cd /Users/stevenhan/Develop/where-is-my-train
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Accept defaults. This creates the base Next.js 15 project with TypeScript, Tailwind, ESLint, App Router, and `src/` directory.

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add deck.gl @deck.gl/core @deck.gl/layers @deck.gl/mapbox @deck.gl/react maplibre-gl react-map-gl protobufjs
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Create `.env.example`**

```
OPENDATA_API_KEY=your_api_key_here
# NEXT_PUBLIC_PTV_API_ENABLED=false
# PTV_DEV_ID=
# PTV_API_KEY=
# NEXT_PUBLIC_USE_FIXTURES=false
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Verify setup**

```bash
pnpm dev
```

Visit `http://localhost:3000` - should see Next.js default page.

```bash
pnpm test:run
```

Should pass with 0 tests (no test files yet).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with Deck.gl, MapLibre, Vitest"
```

---

### Task 2: Shared types and constants

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`

- [ ] **Step 1: Create TypeScript types**

Create `src/lib/types.ts`:

```typescript
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
  coordinates: [number, number][] // [lng, lat] pairs
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
  stops: Record<string, string> // stopId -> name
}

export type VehicleFilter = 'all' | 'train' | 'tram'
export type ThemeMode = 'dark' | 'light' | 'system'
```

- [ ] **Step 2: Create constants**

Create `src/lib/constants.ts`:

```typescript
export const GTFS_RT_URLS = {
  metro: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions',
  tram: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions',
} as const

export const MELBOURNE_CENTER = {
  lat: -37.8136,
  lng: 144.9631,
} as const

export const DEFAULT_ZOOM = 12

export const ZOOM_THRESHOLD_LOD = 13 // Switch from dots to icons

export const POLL_INTERVAL_MS = 30_000

export const CARTO_TILE_URLS = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
} as const

export const CACHE_TTL = {
  vehicles: 30,
  routes: 86400,
} as const
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add shared TypeScript types and constants"
```

---

### Task 3: GTFS static data pipeline script

**Files:**
- Create: `scripts/fetch-gtfs.ts`
- Generate: `public/data/routes.json`, `public/data/stops.json`, `public/data/shapes/`, `src/lib/gtfs-lookup.json`

- [ ] **Step 1: Install script dependencies**

```bash
pnpm add -D tsx csv-parse unzipper @types/unzipper
```

- [ ] **Step 2: Write the fetch-gtfs script**

Create `scripts/fetch-gtfs.ts`:

```typescript
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import { pipeline } from 'stream/promises'
import unzipper from 'unzipper'

// This combined GTFS zip from PTV contains ALL modes (metro train, tram, bus, V/Line).
// The script filters to route_type 0 (tram) and 2 (rail) below.
const GTFS_ZIP_URL = 'https://data.ptv.vic.gov.au/downloads/gtfs.zip'

const OUT_DIR = join(process.cwd(), 'public', 'data')
const SHAPES_DIR = join(OUT_DIR, 'shapes')
const LOOKUP_PATH = join(process.cwd(), 'src', 'lib', 'gtfs-lookup.json')
const TMP_DIR = join(process.cwd(), '.gtfs-tmp')

// Route types in GTFS: 0 = tram, 2 = rail
const ROUTE_TYPES_WE_WANT = ['0', '2']

async function downloadAndExtract(url: string, dest: string) {
  console.log(`Downloading ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`)

  mkdirSync(dest, { recursive: true })

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const tmpZip = join(dest, 'gtfs.zip')
  writeFileSync(tmpZip, buffer)

  const directory = await unzipper.Open.file(tmpZip)

  const needed = ['routes.txt', 'stops.txt', 'trips.txt', 'shapes.txt', 'stop_times.txt']

  for (const entry of directory.files) {
    const name = entry.path.split('/').pop() || ''
    if (needed.includes(name)) {
      const outPath = join(dest, name)
      await pipeline(entry.stream(), createWriteStream(outPath))
      console.log(`  Extracted ${name}`)
    }
  }
}

function parseCsv(filePath: string): Record<string, string>[] {
  if (!existsSync(filePath)) {
    console.warn(`  Warning: ${filePath} not found, skipping`)
    return []
  }
  const content = readFileSync(filePath, 'utf-8')
  return parse(content, { columns: true, skip_empty_lines: true })
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(SHAPES_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })

  await downloadAndExtract(GTFS_ZIP_URL, TMP_DIR)

  const routesRaw = parseCsv(join(TMP_DIR, 'routes.txt'))
  const stopsRaw = parseCsv(join(TMP_DIR, 'stops.txt'))
  const tripsRaw = parseCsv(join(TMP_DIR, 'trips.txt'))
  const shapesRaw = parseCsv(join(TMP_DIR, 'shapes.txt'))

  const relevantRoutes = routesRaw.filter(r => ROUTE_TYPES_WE_WANT.includes(r.route_type))
  const relevantRouteIds = new Set(relevantRoutes.map(r => r.route_id))

  const routes = relevantRoutes.map(r => ({
    id: r.route_id,
    name: r.route_long_name || r.route_short_name,
    shortName: r.route_short_name,
    color: r.route_color ? `#${r.route_color}` : (r.route_type === '2' ? '#0072CE' : '#78BE20'),
    type: r.route_type === '2' ? 'train' : 'tram',
  }))
  writeFileSync(join(OUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2))
  console.log(`Wrote ${routes.length} routes`)

  const relevantTrips = tripsRaw.filter(t => relevantRouteIds.has(t.route_id))
  const relevantShapeIds = new Set(relevantTrips.map(t => t.shape_id).filter(Boolean))

  const stops = stopsRaw
    .filter(s => s.location_type === '0' || s.location_type === '')
    .map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lng: parseFloat(s.stop_lon),
    }))
  writeFileSync(join(OUT_DIR, 'stops.json'), JSON.stringify(stops, null, 2))
  console.log(`Wrote ${stops.length} stops`)

  const shapePoints: Record<string, { lat: number; lng: number; seq: number }[]> = {}
  for (const s of shapesRaw) {
    if (!relevantShapeIds.has(s.shape_id)) continue
    if (!shapePoints[s.shape_id]) shapePoints[s.shape_id] = []
    shapePoints[s.shape_id].push({
      lat: parseFloat(s.shape_pt_lat),
      lng: parseFloat(s.shape_pt_lon),
      seq: parseInt(s.shape_pt_sequence),
    })
  }

  const routeToShape: Record<string, string> = {}
  for (const t of relevantTrips) {
    if (t.shape_id && !routeToShape[t.route_id]) {
      routeToShape[t.route_id] = t.shape_id
    }
  }

  for (const [routeId, shapeId] of Object.entries(routeToShape)) {
    const points = shapePoints[shapeId]
    if (!points) continue
    points.sort((a, b) => a.seq - b.seq)
    const coordinates = points.map(p => [p.lng, p.lat])
    writeFileSync(join(SHAPES_DIR, `${routeId}.json`), JSON.stringify(coordinates))
  }
  console.log(`Wrote ${Object.keys(routeToShape).length} shape files`)

  // Build route-to-stops mapping from stop_times.txt
  const stopTimesRaw = parseCsv(join(TMP_DIR, 'stop_times.txt'))
  const tripToRoute: Record<string, string> = {}
  for (const t of relevantTrips) {
    tripToRoute[t.trip_id] = t.route_id
  }

  // For each route, collect ordered stops (using one representative trip)
  const routeStopsMap: Record<string, { stopId: string; sequence: number }[]> = {}
  const seenRouteTrip: Set<string> = new Set()
  for (const st of stopTimesRaw) {
    const routeId = tripToRoute[st.trip_id]
    if (!routeId) continue
    // Only process one trip per route (to get a representative stop sequence)
    if (seenRouteTrip.has(routeId)) continue
    if (!routeStopsMap[routeId]) routeStopsMap[routeId] = []
    routeStopsMap[routeId].push({
      stopId: st.stop_id,
      sequence: parseInt(st.stop_sequence),
    })
  }
  // Mark routes as seen after processing all their stop_times
  for (const st of stopTimesRaw) {
    const routeId = tripToRoute[st.trip_id]
    if (routeId && routeStopsMap[routeId]?.length > 0) {
      seenRouteTrip.add(routeId)
    }
  }

  // Sort stops by sequence and resolve names
  const stopsById = Object.fromEntries(stops.map(s => [s.id, s]))
  const routeStops: Record<string, { id: string; name: string; lat: number; lng: number; sequence: number }[]> = {}
  for (const [routeId, stopList] of Object.entries(routeStopsMap)) {
    stopList.sort((a, b) => a.sequence - b.sequence)
    routeStops[routeId] = stopList
      .map(s => {
        const stop = stopsById[s.stopId]
        if (!stop) return null
        return { id: s.stopId, name: stop.name, lat: stop.lat, lng: stop.lng, sequence: s.sequence }
      })
      .filter(Boolean) as any
  }
  writeFileSync(join(OUT_DIR, 'route-stops.json'), JSON.stringify(routeStops, null, 2))
  console.log(`Wrote route-stops mapping for ${Object.keys(routeStops).length} routes`)

  const lookup = {
    routes: Object.fromEntries(routes.map(r => [r.id, { name: r.name, color: r.color }])),
    trips: Object.fromEntries(
      relevantTrips.map(t => [t.trip_id, { routeId: t.route_id, headsign: t.trip_headsign || '' }])
    ),
    stops: Object.fromEntries(stops.map(s => [s.id, s.name])),
  }
  mkdirSync(join(process.cwd(), 'src', 'lib'), { recursive: true })
  writeFileSync(LOOKUP_PATH, JSON.stringify(lookup, null, 2))
  console.log(`Wrote lookup table`)

  console.log('Done!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Add script to package.json**

Add to `scripts`:
```json
"fetch-gtfs": "tsx scripts/fetch-gtfs.ts"
```

- [ ] **Step 4: Add generated files to .gitignore**

Append to `.gitignore`:
```
.gtfs-tmp/
public/data/
src/lib/gtfs-lookup.json
```

Note: `public/data/` and `gtfs-lookup.json` are generated at build time - they should NOT be committed. They'll be regenerated in CI/Vercel builds.

- [ ] **Step 5: Run the script**

```bash
pnpm fetch-gtfs
```

Expected: downloads GTFS zip, extracts CSVs, writes `public/data/routes.json`, `public/data/stops.json`, shape files, and `src/lib/gtfs-lookup.json`.

- [ ] **Step 6: Verify output**

```bash
cat public/data/routes.json | head -20
ls public/data/shapes/ | head -10
cat src/lib/gtfs-lookup.json | head -20
```

Should see route metadata, shape coordinate files, and the lookup table.

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-gtfs.ts package.json pnpm-lock.yaml .gitignore
git commit -m "feat: add GTFS static data pipeline script"
```

---

## Chunk 2: API Layer (GTFS-RT Parsing + Enrichment)

### Task 4: GTFS-RT protobuf parsing module

**Files:**
- Create: `src/lib/gtfs-rt.ts`, `src/__tests__/gtfs-rt.test.ts`, `src/__tests__/fixtures/`

- [ ] **Step 1: Create fixture directory and record test fixtures**

```bash
mkdir -p src/__tests__/fixtures
```

Fetch real protobuf responses and save as fixtures:

```bash
source .env.local
curl -H "KeyId: $OPENDATA_API_KEY" \
  "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions" \
  -o src/__tests__/fixtures/vehicle-positions.pb

curl -H "KeyId: $OPENDATA_API_KEY" \
  "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions" \
  -o src/__tests__/fixtures/tram-positions.pb
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/gtfs-rt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseVehiclePositions } from '@/lib/gtfs-rt'

describe('parseVehiclePositions', () => {
  it('parses a real metro train protobuf response', () => {
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
    expect(first.lat).toBeLessThan(-30) // Melbourne is around -37.8
    expect(first.lat).toBeGreaterThan(-40)
  })

  it('parses a real tram protobuf response', () => {
    const buffer = readFileSync(
      join(__dirname, 'fixtures', 'tram-positions.pb')
    )
    const vehicles = parseVehiclePositions(buffer, 'tram')

    expect(vehicles.length).toBeGreaterThan(0)
    expect(vehicles[0].type).toBe('tram')
  })

  it('returns empty array for empty/invalid buffer', () => {
    const vehicles = parseVehiclePositions(Buffer.from([]), 'train')
    expect(vehicles).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test:run src/__tests__/gtfs-rt.test.ts
```

Expected: FAIL - `parseVehiclePositions` not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/gtfs-rt.ts`:

```typescript
import protobuf from 'protobufjs'

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

const STATUS_MAP: Record<number, RawVehicle['status']> = {
  0: 'INCOMING_AT',
  1: 'STOPPED_AT',
  2: 'IN_TRANSIT_TO',
}

// Parse the GTFS-RT proto definition once and cache it
let cachedFeedMessageType: protobuf.Type | null = null

function getFeedMessageType(): protobuf.Type {
  if (cachedFeedMessageType) return cachedFeedMessageType

  const gtfsRoot = protobuf.parse(`
    syntax = "proto2";

    message FeedMessage {
      required FeedHeader header = 1;
      repeated FeedEntity entity = 2;
    }

    message FeedHeader {
      required string gtfs_realtime_version = 1;
      optional uint64 timestamp = 5;
    }

    message FeedEntity {
      required string id = 1;
      optional VehiclePosition vehicle = 4;
    }

    message VehiclePosition {
      optional TripDescriptor trip = 1;
      optional VehicleDescriptor vehicle = 8;
      optional Position position = 2;
      optional uint32 current_stop_sequence = 3;
      optional string stop_id = 7;
      optional uint32 current_status = 4;
      optional uint64 timestamp = 5;
    }

    message Position {
      required float latitude = 1;
      required float longitude = 2;
      optional float bearing = 3;
      optional float speed = 5;
    }

    message TripDescriptor {
      optional string trip_id = 1;
      optional string route_id = 5;
      optional string start_date = 3;
      optional string start_time = 4;
    }

    message VehicleDescriptor {
      optional string id = 1;
      optional string label = 2;
    }
  `).root

  cachedFeedMessageType = gtfsRoot.lookupType('FeedMessage')
  return cachedFeedMessageType
}

export function parseVehiclePositions(
  buffer: Buffer | Uint8Array,
  vehicleType: 'train' | 'tram'
): RawVehicle[] {
  if (!buffer || buffer.length === 0) return []

  try {
    const FeedMessage = getFeedMessageType()
    const decoded = FeedMessage.decode(
      buffer instanceof Buffer ? new Uint8Array(buffer) : buffer
    ) as any

    const vehicles: RawVehicle[] = []

    for (const entity of decoded.entity || []) {
      const v = entity.vehicle
      if (!v?.position) continue

      vehicles.push({
        id: v.vehicle?.id || entity.id,
        type: vehicleType,
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing || 0,
        routeId: v.trip?.routeId || '',
        tripId: v.trip?.tripId || '',
        stopId: v.stopId || '',
        status: STATUS_MAP[v.currentStatus ?? 2] || 'IN_TRANSIT_TO',
        timestamp: Number(v.timestamp || 0),
      })
    }

    return vehicles
  } catch (err) {
    console.error('Failed to parse GTFS-RT feed:', err)
    return []
  }
}
```

Note: protobufjs converts snake_case field names to camelCase by default (e.g. `route_id` becomes `routeId`, `stop_id` becomes `stopId`). If tests fail due to field name mismatches, check the actual decoded object shape and adjust property access accordingly.

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test:run src/__tests__/gtfs-rt.test.ts
```

Expected: PASS. If field names from protobuf don't match (camelCase vs snake_case), adjust the property access in the parser.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gtfs-rt.ts src/__tests__/gtfs-rt.test.ts src/__tests__/fixtures/
git commit -m "feat: add GTFS-RT protobuf parser with test fixtures"
```

---

### Task 5: Enrichment module

**Files:**
- Create: `src/lib/enrich.ts`, `src/__tests__/enrich.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/enrich.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/__tests__/enrich.test.ts
```

Expected: FAIL - `enrichVehicles` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/enrich.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:run src/__tests__/enrich.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts src/__tests__/enrich.test.ts
git commit -m "feat: add vehicle enrichment module with GTFS lookup"
```

---

### Task 6: Vehicles API route

**Files:**
- Create: `src/app/api/vehicles/route.ts`

- [ ] **Step 1: Write the API route**

Create `src/app/api/vehicles/route.ts`:

```typescript
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
    const vehicles = enrichVehicles(allRaw, lookup)

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
```

- [ ] **Step 2: Test manually**

```bash
pnpm dev
```

Then in another terminal:
```bash
curl http://localhost:3000/api/vehicles | jq '.vehicles | length'
```

Expected: a number > 0 (the count of active trains + trams).

```bash
curl http://localhost:3000/api/vehicles | jq '.vehicles[0]'
```

Expected: a vehicle object with enriched fields (routeName, routeColor, direction, currentStop).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/vehicles/route.ts
git commit -m "feat: add /api/vehicles route with GTFS-RT parsing and enrichment"
```

---

### Task 7: Routes API route

**Files:**
- Create: `src/app/api/routes/[id]/route.ts`

- [ ] **Step 1: Write the API route**

Create `src/app/api/routes/[id]/route.ts`:

```typescript
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
```

- [ ] **Step 2: Test manually**

Pick a route ID from `public/data/routes.json`:
```bash
ROUTE_ID=$(cat public/data/routes.json | jq -r '.[0].id')
curl "http://localhost:3000/api/routes/$ROUTE_ID" | jq '.routeName, (.coordinates | length)'
```

Expected: route name and a coordinate count > 0.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/routes/[id]/route.ts"
git commit -m "feat: add /api/routes/[id] route for static route shapes"
```

---

## Chunk 3: Map + Vehicle Rendering

### Task 8: Theme hook

**Files:**
- Create: `src/hooks/use-theme.ts`

- [ ] **Step 1: Write the theme hook**

Create `src/hooks/use-theme.ts`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThemeMode } from '@/lib/types'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getEffectiveTheme(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? getSystemTheme() : mode
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeMode | null
    if (saved && ['dark', 'light', 'system'].includes(saved)) {
      setMode(saved)
    }
  }, [])

  useEffect(() => {
    setResolved(getEffectiveTheme(mode))

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => setResolved(getSystemTheme())
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [mode])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'system'
      ? (getSystemTheme() === 'dark' ? 'light' : 'dark')
      : mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    localStorage.setItem('theme', next)
  }, [mode])

  return { mode, resolved, toggle }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-theme.ts
git commit -m "feat: add useTheme hook with system preference detection"
```

---

### Task 9: Vehicle polling hook

**Files:**
- Create: `src/hooks/use-vehicles.ts`

- [ ] **Step 1: Write the hook**

Create `src/hooks/use-vehicles.ts`:

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Vehicle, VehiclesResponse, VehicleFilter } from '@/lib/types'
import { POLL_INTERVAL_MS } from '@/lib/constants'

export function useVehicles(filter: VehicleFilter = 'all') {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const allVehiclesRef = useRef<Vehicle[]>([])

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data: VehiclesResponse = await res.json()
      allVehiclesRef.current = data.vehicles
      setLastUpdated(data.timestamp)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch vehicles:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const all = allVehiclesRef.current
    if (filter === 'all') {
      setVehicles(all)
    } else {
      setVehicles(all.filter(v => v.type === filter))
    }
  }, [filter, lastUpdated])

  useEffect(() => {
    fetchVehicles()
    const interval = setInterval(fetchVehicles, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchVehicles])

  return { vehicles, lastUpdated, loading, error, refetch: fetchVehicles }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-vehicles.ts
git commit -m "feat: add useVehicles hook with 30s polling"
```

---

### Task 10: Liquid Glass component + CSS

**Files:**
- Create: `src/components/glass-panel.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add Liquid Glass CSS utilities**

Add to `src/app/globals.css` (after the existing Tailwind directives):

```css
/* Liquid Glass Design System - iOS 26 / macOS Tahoe inspired */
.glass {
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-shadow: rgba(0, 0, 0, 0.3);
  --glass-highlight: rgba(255, 255, 255, 0.12);
  --glass-blur: 32px;

  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 22px;
  box-shadow:
    0 8px 32px var(--glass-shadow),
    inset 0 1px 0 var(--glass-highlight);
  overflow: hidden;
}

.glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.03) 40%,
    transparent 60%
  );
  pointer-events: none;
  z-index: 1;
}

:root:not(.dark) .glass {
  --glass-bg: rgba(255, 255, 255, 0.55);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: rgba(0, 0, 0, 0.08);
  --glass-highlight: rgba(255, 255, 255, 0.7);
}

.glass-pill {
  --glass-blur: 24px;
  border-radius: 14px;
}

.glass-pill::before {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 50%
  );
}
```

- [ ] **Step 2: Create the GlassPanel component**

Create `src/components/glass-panel.tsx`:

```typescript
'use client'

import { forwardRef } from 'react'

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'panel' | 'pill'
  children: React.ReactNode
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ variant = 'panel', className = '', children, ...props }, ref) => {
    const baseClass = variant === 'pill' ? 'glass glass-pill' : 'glass'

    return (
      <div
        ref={ref}
        className={`${baseClass} ${className}`}
        {...props}
      >
        <div className="relative z-10">{children}</div>
      </div>
    )
  }
)

GlassPanel.displayName = 'GlassPanel'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/glass-panel.tsx src/app/globals.css
git commit -m "feat: add Liquid Glass design system and GlassPanel component"
```

---

### Task 11: MapView + Vehicle Layer

**Files:**
- Create: `src/components/map-view.tsx`, `src/components/vehicle-layer.tsx`

- [ ] **Step 1: Create the vehicle Deck.gl layer**

Create `src/components/vehicle-layer.tsx`:

```typescript
'use client'

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Vehicle } from '@/lib/types'
import { ZOOM_THRESHOLD_LOD } from '@/lib/constants'

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [136, 136, 136]
}

export function createVehicleLayers(
  vehicles: Vehicle[],
  zoom: number,
  isDark: boolean,
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void
) {
  const isZoomedIn = zoom >= ZOOM_THRESHOLD_LOD

  if (!isZoomedIn) {
    return [
      isDark
        ? new ScatterplotLayer({
            id: 'vehicle-glow',
            data: vehicles,
            getPosition: (d: Vehicle) => [d.lng, d.lat],
            getRadius: 600,
            getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 40],
            radiusMinPixels: 8,
            radiusMaxPixels: 20,
            pickable: false,
            transitions: {
              getPosition: { duration: 1000, type: 'interpolation' },
            },
          })
        : null,
      new ScatterplotLayer({
        id: 'vehicle-dots',
        data: vehicles,
        getPosition: (d: Vehicle) => [d.lng, d.lat],
        getRadius: 200,
        getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 220],
        radiusMinPixels: 4,
        radiusMaxPixels: 10,
        pickable: true,
        onClick: ({ object, x, y }: { object: Vehicle; x: number; y: number }) => {
          if (object) onVehicleClick(object, { x, y })
        },
        transitions: {
          getPosition: { duration: 1000, type: 'interpolation' },
        },
      }),
    ].filter(Boolean)
  }

  return [
    new ScatterplotLayer({
      id: 'vehicle-icons',
      data: vehicles,
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getRadius: 120,
      getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 240],
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 1,
      stroked: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 14,
      pickable: true,
      onClick: ({ object }: { object: Vehicle }) => {
        if (object) onVehicleClick(object)
      },
      transitions: {
        getPosition: { duration: 1000, type: 'interpolation' },
      },
    }),
    new TextLayer({
      id: 'vehicle-labels',
      data: vehicles,
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getText: (d: Vehicle) => d.routeName,
      getSize: 11,
      getColor: isDark ? [255, 255, 255, 200] : [0, 0, 0, 200],
      getPixelOffset: [0, -18],
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 500,
      pickable: false,
      transitions: {
        getPosition: { duration: 1000, type: 'interpolation' },
      },
    }),
  ]
}
```

- [ ] **Step 2: Create the MapView component**

Create `src/components/map-view.tsx`:

```typescript
'use client'

import { useState, useCallback, useMemo } from 'react'
import { Map } from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MELBOURNE_CENTER, DEFAULT_ZOOM, CARTO_TILE_URLS } from '@/lib/constants'
import { createVehicleLayers } from './vehicle-layer'
import { createRouteLayer } from './route-layer'
import type { Vehicle } from '@/lib/types'

interface RouteOverlay {
  coordinates: [number, number][]
  color: string
}

interface MapViewProps {
  vehicles: Vehicle[]
  isDark: boolean
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void
  activeRoute: RouteOverlay | null
}

const INITIAL_VIEW_STATE = {
  longitude: MELBOURNE_CENTER.lng,
  latitude: MELBOURNE_CENTER.lat,
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: 0,
}

export function MapView({ vehicles, isDark, onVehicleClick, activeRoute }: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)

  const handleViewStateChange = useCallback(({ viewState }: any) => {
    setViewState(viewState)
  }, [])

  const vehicleLayers = useMemo(
    () => createVehicleLayers(vehicles, viewState.zoom, isDark, onVehicleClick),
    [vehicles, viewState.zoom, isDark, onVehicleClick]
  )

  const routeLayers = useMemo(
    () => activeRoute
      ? createRouteLayer({ coordinates: activeRoute.coordinates, color: activeRoute.color, isDark })
      : [],
    [activeRoute, isDark]
  )

  const layers = useMemo(
    () => [...routeLayers, ...vehicleLayers],
    [routeLayers, vehicleLayers]
  )

  const mapStyle = isDark ? CARTO_TILE_URLS.dark : CARTO_TILE_URLS.light

  return (
    <div className="w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={true}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          mapStyle={mapStyle}
          attributionControl={false}
        />
      </DeckGL>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/map-view.tsx src/components/vehicle-layer.tsx
git commit -m "feat: add MapView with Deck.gl vehicle rendering and LOD"
```

---

## Chunk 4: UI Components + Page Assembly

### Task 12: Filter bar, theme toggle, info bar

**Files:**
- Create: `src/components/filter-bar.tsx`, `src/components/theme-toggle.tsx`, `src/components/info-bar.tsx`

- [ ] **Step 1: Create FilterBar**

Create `src/components/filter-bar.tsx`:

```typescript
'use client'

import { GlassPanel } from './glass-panel'
import type { VehicleFilter } from '@/lib/types'

interface FilterBarProps {
  filter: VehicleFilter
  onFilterChange: (filter: VehicleFilter) => void
}

const filters: { value: VehicleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'train', label: 'Trains' },
  { value: 'tram', label: 'Trams' },
]

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg font-light tracking-tight dark:text-white/90 text-black/80 mr-1">
        Where Is My Train
      </span>
      <GlassPanel variant="pill" className="flex p-1 gap-0.5">
        {filters.map(f => (
          <button
            key={f.value}
            role="switch"
            aria-checked={filter === f.value}
            onClick={() => onFilterChange(f.value)}
            className={`
              relative px-4 py-1.5 text-sm font-medium rounded-xl
              transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${filter === f.value
                ? 'bg-white/20 dark:bg-white/15 dark:text-white text-black/80 shadow-sm'
                : 'dark:text-white/50 text-black/40 hover:text-black/60 dark:hover:text-white/70'
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </GlassPanel>
    </div>
  )
}
```

- [ ] **Step 2: Create ThemeToggle**

Create `src/components/theme-toggle.tsx`:

```typescript
'use client'

import { GlassPanel } from './glass-panel'

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <GlassPanel variant="pill" className="p-1">
      <button
        role="switch"
        aria-checked={isDark}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        onClick={onToggle}
        className="flex items-center justify-center w-9 h-9 rounded-xl
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          hover:bg-white/10"
      >
        {isDark ? (
          <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>
    </GlassPanel>
  )
}
```

- [ ] **Step 3: Create InfoBar**

Create `src/components/info-bar.tsx`:

```typescript
'use client'

import { GlassPanel } from './glass-panel'

interface InfoBarProps {
  vehicleCount: number
  lastUpdated: number | null
  error: string | null
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function InfoBar({ vehicleCount, lastUpdated, error }: InfoBarProps) {
  return (
    <GlassPanel variant="pill" className="px-4 py-2">
      <div className="flex items-center gap-4 text-sm" role="status" aria-live="polite">
        <span className="font-medium">
          <span className="dark:text-white/90 text-black/80">
            {vehicleCount}
          </span>
          <span className="dark:text-white/50 text-black/50 ml-1">
            vehicles
          </span>
        </span>

        {lastUpdated && (
          <span className="dark:text-white/40 text-black/40">
            Updated {formatTime(lastUpdated)}
          </span>
        )}

        {error && (
          <span className="text-amber-400/80 text-xs">
            Data may be stale
          </span>
        )}

        <span className="dark:text-white/30 text-black/30 text-xs">
          Data: PTV/DOT (CC-BY-4.0)
        </span>
      </div>
    </GlassPanel>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/filter-bar.tsx src/components/theme-toggle.tsx src/components/info-bar.tsx
git commit -m "feat: add FilterBar, ThemeToggle, and InfoBar components"
```

---

### Task 13: Vehicle popup + Route panel

**Files:**
- Create: `src/components/vehicle-popup.tsx`, `src/components/route-panel.tsx`, `src/components/route-layer.tsx`

- [ ] **Step 1: Create VehiclePopup**

Create `src/components/vehicle-popup.tsx`:

```typescript
'use client'

import { GlassPanel } from './glass-panel'
import type { Vehicle } from '@/lib/types'

interface VehiclePopupProps {
  vehicle: Vehicle
  onClose: () => void
  onViewRoute: (routeId: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  INCOMING_AT: 'Arriving at',
  STOPPED_AT: 'Stopped at',
  IN_TRANSIT_TO: 'In transit to',
}

export function VehiclePopup({ vehicle, onClose, onViewRoute }: VehiclePopupProps) {
  return (
    <GlassPanel className="w-72 p-4" aria-live="polite">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
          rounded-full bg-white/10 hover:bg-white/20
          transition-colors duration-200 dark:text-white/60 text-black/40
          hover:dark:text-white/90 hover:text-black/70 z-20"
        aria-label="Close"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shadow-lg"
            style={{
              backgroundColor: vehicle.routeColor,
              boxShadow: `0 0 8px ${vehicle.routeColor}60`,
            }}
          />
          <span className="font-medium dark:text-white/90 text-black/80">
            {vehicle.routeName}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 dark:text-white/60 text-black/50 uppercase">
            {vehicle.type}
          </span>
        </div>

        {vehicle.direction && (
          <p className="text-sm dark:text-white/60 text-black/50">
            {vehicle.direction}
          </p>
        )}

        <p className="text-sm dark:text-white/70 text-black/60">
          {STATUS_LABELS[vehicle.status] || vehicle.status}{' '}
          <span className="font-medium">{vehicle.currentStop}</span>
        </p>

        <button
          onClick={() => onViewRoute(vehicle.routeId)}
          className="w-full mt-2 py-2 rounded-xl text-sm font-medium
            bg-white/10 hover:bg-white/15 dark:text-white/80 text-black/60
            hover:dark:text-white hover:text-black/80
            transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          View full route
        </button>
      </div>
    </GlassPanel>
  )
}
```

- [ ] **Step 2: Create RoutePanel**

Create `src/components/route-panel.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { GlassPanel } from './glass-panel'
import type { RouteShape, Vehicle } from '@/lib/types'

interface RoutePanelProps {
  routeId: string
  vehicles: Vehicle[]
  onClose: () => void
}

export function RoutePanel({ routeId, vehicles, onClose }: RoutePanelProps) {
  const [route, setRoute] = useState<RouteShape | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/routes/${routeId}`)
      .then(res => res.json())
      .then(data => {
        setRoute(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [routeId])

  const routeVehicles = vehicles.filter(v => v.routeId === routeId)

  return (
    <div
      className="fixed top-0 right-0 h-full w-[350px] z-50
        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
    >
      <GlassPanel className="h-full rounded-none rounded-l-[22px] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {route && (
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: route.routeColor,
                  boxShadow: `0 0 10px ${route.routeColor}60`,
                }}
              />
            )}
            <h2 className="text-lg font-medium dark:text-white/90 text-black/80">
              {route?.routeName || 'Loading...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              bg-white/10 hover:bg-white/20 transition-colors duration-200
              dark:text-white/60 text-black/40 hover:dark:text-white/90 hover:text-black/70"
            aria-label="Close route panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <p className="text-sm dark:text-white/50 text-black/40">Loading route details...</p>
        )}

        {!loading && route && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2">
                Vehicles on this route
              </h3>
              {routeVehicles.length === 0 ? (
                <p className="text-sm dark:text-white/50 text-black/40">No active vehicles</p>
              ) : (
                <div className="space-y-2">
                  {routeVehicles.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 p-2 rounded-xl bg-white/5"
                    >
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: v.routeColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm dark:text-white/80 text-black/70 truncate">
                          {v.direction || v.routeName}
                        </p>
                        <p className="text-xs dark:text-white/50 text-black/40">
                          {v.status === 'STOPPED_AT' ? 'At' : 'Next:'} {v.currentStop}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {route.stops.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2">
                  Stops
                </h3>
                <div className="space-y-1">
                  {route.stops.map(stop => (
                    <div key={stop.id} className="text-sm dark:text-white/60 text-black/50 py-1">
                      {stop.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
```

- [ ] **Step 3: Create route layer**

Create `src/components/route-layer.tsx`:

```typescript
'use client'

import { PathLayer } from '@deck.gl/layers'

interface RouteLayerProps {
  coordinates: [number, number][]
  color: string
  isDark: boolean
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [136, 136, 136]
}

export function createRouteLayer({ coordinates, color, isDark }: RouteLayerProps) {
  if (coordinates.length === 0) return []

  const rgb = hexToRgb(color)

  return [
    isDark
      ? new PathLayer({
          id: 'route-glow',
          data: [{ path: coordinates }],
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: [...rgb, 40],
          getWidth: 20,
          widthMinPixels: 8,
          capRounded: true,
          jointRounded: true,
        })
      : null,
    new PathLayer({
      id: 'route-line',
      data: [{ path: coordinates }],
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: [...rgb, isDark ? 180 : 200],
      getWidth: 6,
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
    }),
  ].filter(Boolean)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/vehicle-popup.tsx src/components/route-panel.tsx src/components/route-layer.tsx
git commit -m "feat: add VehiclePopup, RoutePanel, and route polyline layer"
```

---

### Task 14: Assemble the home page

**Files:**
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Where Is My Train - Live Melbourne Transit',
  description: 'Real-time positions of all trains and trams in Melbourne',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Write the home page**

Replace `src/app/page.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { MapView } from '@/components/map-view'
import { FilterBar } from '@/components/filter-bar'
import { ThemeToggle } from '@/components/theme-toggle'
import { InfoBar } from '@/components/info-bar'
import { VehiclePopup } from '@/components/vehicle-popup'
import { RoutePanel } from '@/components/route-panel'
import { useVehicles } from '@/hooks/use-vehicles'
import { useTheme } from '@/hooks/use-theme'
import type { Vehicle, VehicleFilter, RouteShape } from '@/lib/types'

export default function Home() {
  const { resolved: theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [filter, setFilter] = useState<VehicleFilter>('all')
  const { vehicles, lastUpdated, loading, error } = useVehicles(filter)

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [activeRouteData, setActiveRouteData] = useState<{ coordinates: [number, number][]; color: string } | null>(null)

  const handleVehicleClick = useCallback((vehicle: Vehicle, screenCoords?: { x: number; y: number }) => {
    setSelectedVehicle(vehicle)
    setPopupPosition(screenCoords || { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setActiveRouteId(null)
    setActiveRouteData(null)
  }, [])

  const handleViewRoute = useCallback((routeId: string) => {
    setActiveRouteId(routeId)
    setSelectedVehicle(null)
    setPopupPosition(null)
  }, [])

  // Fetch route shape when a route is selected
  useEffect(() => {
    if (!activeRouteId) {
      setActiveRouteData(null)
      return
    }
    fetch(`/api/routes/${activeRouteId}`)
      .then(res => res.json())
      .then((data: RouteShape) => {
        setActiveRouteData({ coordinates: data.coordinates, color: data.routeColor })
      })
      .catch(() => setActiveRouteData(null))
  }, [activeRouteId])

  const handleClosePopup = useCallback(() => {
    setSelectedVehicle(null)
    setPopupPosition(null)
  }, [])

  const handleCloseRoute = useCallback(() => {
    setActiveRouteId(null)
    setActiveRouteData(null)
  }, [])

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      <MapView
        vehicles={vehicles}
        isDark={isDark}
        onVehicleClick={handleVehicleClick}
        activeRoute={activeRouteData}
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <FilterBar filter={filter} onFilterChange={setFilter} />
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <InfoBar
            vehicleCount={vehicles.length}
            lastUpdated={lastUpdated}
            error={error}
          />
        </div>
      </div>

      {selectedVehicle && popupPosition && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{
            left: `${Math.min(popupPosition.x, window.innerWidth - 300)}px`,
            top: `${Math.max(popupPosition.y - 200, 10)}px`,
          }}
        >
          <VehiclePopup
            vehicle={selectedVehicle}
            onClose={handleClosePopup}
            onViewRoute={handleViewRoute}
          />
        </div>
      )}

      {activeRouteId && (
        <div className="pointer-events-auto">
          <RoutePanel
            routeId={activeRouteId}
            vehicles={vehicles}
            onClose={handleCloseRoute}
          />
        </div>
      )}

      {loading && vehicles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="glass glass-pill px-6 py-3 dark:text-white/70 text-black/50 text-sm">
            Connecting to live data...
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Verify the full app**

```bash
pnpm dev
```

Visit `http://localhost:3000`. Expected:
- Dark map of Melbourne centered on CBD
- Vehicles appear as colored dots after first fetch
- Filter toggles switch between trains/trams/all
- Theme toggle switches dark/light (map tiles + glass panels change)
- Clicking a vehicle shows popup with route info
- "View full route" opens slide-in side panel
- Info bar shows vehicle count and last updated time

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: assemble home page with map, floating UI, popups, and route panel"
```

---

## Chunk 5: Polish + Deploy

### Task 15: Vercel deployment config

**Files:**
- Modify: `next.config.ts`, `package.json`

- [ ] **Step 1: Update next.config.ts**

Replace `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    'deck.gl',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/mapbox',
    '@deck.gl/react',
  ],
}

export default nextConfig
```

- [ ] **Step 2: Add prebuild script to package.json**

Add to `scripts`:
```json
"prebuild": "tsx scripts/fetch-gtfs.ts"
```

This ensures GTFS data is fetched before every Vercel build.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts package.json
git commit -m "feat: add Vercel deployment config with GTFS prebuild"
```

---

### Task 16: End-to-end verification + deploy

- [ ] **Step 1: Create .env.local** (not committed)

```bash
echo "OPENDATA_API_KEY=your_actual_key_here" > .env.local
```

Replace `your_actual_key_here` with the real API key.

- [ ] **Step 2: Full end-to-end test**

```bash
pnpm fetch-gtfs && pnpm dev
```

Verify all functionality works:
1. Map loads with dark CartoCDN basemap
2. Vehicles appear as colored dots
3. Filter bar toggles between trains/trams/all
4. Theme toggle switches dark/light
5. Clicking a vehicle shows popup
6. "View full route" opens route panel
7. Zooming in shows larger icons with labels
8. Info bar shows vehicle count and last updated time

- [ ] **Step 3: Run tests**

```bash
pnpm test:run
```

All tests should pass.

- [ ] **Step 4: Production build**

```bash
pnpm build
```

Should complete without errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 MVP - ready for Vercel deployment"
```

- [ ] **Step 6: Deploy to Vercel**

```bash
npx vercel link
npx vercel env add OPENDATA_API_KEY
npx vercel --prod
```

Visit the live URL and verify all functionality.
