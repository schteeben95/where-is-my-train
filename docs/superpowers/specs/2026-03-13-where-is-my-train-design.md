# Where Is My Train - Design Spec

## Overview

A real-time web application showing the live positions of all trains and trams in Melbourne on an interactive map. Built with Next.js, Deck.gl, and MapLibre. Hosted on Vercel.

## Data Sources

### Primary: GTFS-RT Open Data Feeds (vehicle positions)

- **Metro Train:** `https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions`
- **Yarra Trams:** `https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions`
- **Auth:** API key passed as `KeyId` header
- **Format:** GTFS-Realtime Protocol Buffers (binary)
- **Refresh rate:** ~30s (metro), ~60s (trams)
- **License:** CC-BY-4.0

### Secondary: GTFS Static Schedule Data (build-time)

- Route shapes (polylines for drawing lines on the map)
- Stop locations (lat/lng, name)
- Route metadata (name, color, type)
- Downloaded from `https://opendata.transport.vic.gov.au/dataset/gtfs-schedule` at build time
- Pre-processed into JSON bundles

### Future (Feature-flagged): PTV Timetable API v3

- Departures, disruptions, detailed stop info
- Gated behind `NEXT_PUBLIC_PTV_API_ENABLED` env var
- Requires separate devid + API key (HMAC-SHA1 auth)
- Not part of Phase 1 or 2

## Architecture

### Edge-Cached Proxy Pattern

```
Client (React + Deck.gl + MapLibre)
  |
  | polls every 30s
  v
Next.js API Routes (Node.js runtime, CDN-cached via Cache-Control: s-maxage=30)
  |
  | fetches + parses protobuf
  v
GTFS-RT Open Data API
```

### API Routes

All API routes use `export const runtime = 'nodejs'` (required for protobuf parsing). Caching is handled via `Cache-Control: public, s-maxage=N` headers, which Vercel's CDN respects.

| Route | Purpose | `s-maxage` |
|-------|---------|------------|
| `GET /api/vehicles` | All train + tram positions as JSON (client filters by `type` param) | 30 |
| `GET /api/routes/[id]` | Route shape + stops (from static data) | 86400 |
| `GET /api/stops/nearby?lat=&lng=` | Nearby stops (Phase 2) | 300 |
| `GET /api/departures/[stopId]` | Departures (PTV API, feature-flagged) | 30 |

### Vehicle JSON Response Shape

```json
{
  "timestamp": 1710345600,
  "vehicles": [
    {
      "id": "vehicle-123",
      "type": "train",
      "lat": -37.8136,
      "lng": 144.9631,
      "bearing": 180,
      "routeId": "6",
      "routeName": "Sandringham",
      "routeColor": "#0072CE",
      "direction": "towards Flinders Street",
      "tripId": "trip-456",
      "currentStop": "South Yarra",
      "status": "IN_TRANSIT_TO",
      "timestamp": 1710345590
    }
  ]
}
```

### Build-Time Data Pipeline

1. Download GTFS static zip files for metro train + tram
2. Parse `routes.txt`, `shapes.txt`, `stops.txt`, `trips.txt`
3. Output as optimized JSON:
   - `routes.json` - route metadata + colors
   - `shapes/[routeId].json` - polyline coordinates per route
   - `stops.json` - all stop locations
4. Bundle into `public/data/` for client access
5. Also generate `src/lib/gtfs-lookup.json` - a flattened lookup table (routeId -> {name, color}, tripId -> {routeId, direction}, stopId -> name) loaded at module scope by the API route for response enrichment

### Server-Side GTFS Enrichment

The `/api/vehicles` route needs to enrich raw GTFS-RT data (which only has IDs) with human-readable names and colors. This is done via a lookup table:

- `src/lib/gtfs-lookup.json` is generated at build time and imported at module scope in the API route
- Maps: `routeId -> {name, color}`, `tripId -> {routeId, headsign}`, `stopId -> name`
- Loaded once per cold start, stays in memory for the function's lifetime
- If a vehicle reports an ID not in the lookup (stale static data), fields default to the raw ID

### GTFS Static Data Freshness

- Build-time script (`scripts/fetch-gtfs.ts`) downloads and processes GTFS data
- Vercel cron job or GitHub Action triggers a rebuild weekly to pick up timetable changes
- If a vehicle reports a `routeId` or `stopId` not in the lookup, the API falls back to raw IDs gracefully

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Map renderer | Deck.gl + MapLibre GL JS |
| Map tiles | CartoCDN free basemap (dark: `dark_matter`, light: `positron`) - no API key needed |
| Protobuf parsing | `protobufjs/light` (works in Node.js runtime, smaller than full protobufjs) |
| Styling | Tailwind CSS + custom glassmorphism utilities |
| Animation | CSS transitions + `cubic-bezier` easing (panels), Deck.gl transitions (map) |
| Deployment | Vercel |
| Package manager | pnpm |

## UI Design

### Layout

- Full-screen map, edge to edge (100vw x 100vh)
- Floating UI overlay - no sidebars or headers consuming map space
- All UI panels use glassmorphism design language

### Glassmorphism Design System

- `backdrop-filter: blur(20px)` with semi-transparent backgrounds
- Subtle 1px border with `rgba(255,255,255,0.15)` for edge definition
- Soft drop shadows with color tint
- Border radius: 16-20px on panels, 12px on buttons/toggles
- Typography: Inter (or system sans-serif), light/medium weights
- Accent colors derived from transit line colors

### Floating Controls

- **Top-left:** App logo/name + mode filter (trains / trams / both) as pill toggles
- **Top-right:** Theme toggle (sun/moon icon), "Near me" button (Phase 2)
- **Bottom:** Collapsible info bar - vehicle count, last updated time, data attribution

### Theme

- Follows `prefers-color-scheme` on first load
- Manual toggle persists to `localStorage`
- **Dark mode (hero look):**
  - Near-black basemap with subtle road/water lines
  - Vehicle dots emit soft glow halos in their line color
  - Glass panels have luminous edge highlights
  - White text on translucent dark panels
- **Light mode:**
  - Light grey basemap
  - White-tinted translucent glass panels
  - Solid vivid vehicle dots
  - Subtle shadows instead of glows

### Vehicle Rendering (Level of Detail)

- **Zoom < 13:** Color-coded dots
  - Trains: blue color family (per-line shades)
  - Trams: green color family (per-route shades)
  - Subtle pulse animation
  - Size scaled for visibility without overlap
- **Zoom >= 13:** Directional vehicle icons
  - Train silhouette / tram silhouette SVGs
  - Rotated to match bearing
  - Line name label beside the icon
- **Interpolation:** When new position data arrives, vehicles animate from their old position to the new position using Deck.gl's built-in `TransitionInterpolator` (linear lerp over ~1s). No dead-reckoning or bearing-based prediction - just smooth snapping to corrected positions each refresh cycle.

### Click Interaction

1. **Tap vehicle** - popup anchored to vehicle:
   - Line name + direction
   - Current status (in transit to / stopped at [station])
   - "View full route" button
2. **"View full route"** - panel slides in from right (~350px):
   - Route polyline drawn on map (from GTFS shapes)
   - All stops listed, current vehicle position highlighted
   - Other vehicles on the same route shown
   - Close button returns to overview

### Micro-interactions

- Vehicle dots pulse gently on data refresh
- Hover: vehicle scales up slightly with intensified glow
- Panel transitions: CSS `transition` with `cubic-bezier(0.32, 0.72, 0, 1)` easing
- Filter toggles: smooth active/inactive animation

## Phased Delivery

### Phase 1: Full City Overview (MVP)

- All trains and trams on the map in real-time
- Edge-cached API proxy
- LOD vehicle rendering (dots -> icons)
- Click popup with basic info
- "View full route" side panel
- Dark/light theme with system detection
- Glassmorphism UI
- Deploy to Vercel

### Phase 2: Near Me Mode

- "Near me" button requests geolocation
- Map centers on user, shows nearby vehicles
- Nearby stops displayed with walking distance
- Vehicles approaching nearby stops highlighted

### Phase 3: Route Focus (requires PTV API key)

- Route picker UI (search/browse lines)
- Selecting a route: zooms to fit, shows all vehicles + stops
- Departure times per stop (from PTV Timetable API)
- Disruption alerts
- Feature-flagged behind `NEXT_PUBLIC_PTV_API_ENABLED`

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENDATA_API_KEY` | Yes | GTFS-RT feed authentication |
| `NEXT_PUBLIC_PTV_API_ENABLED` | No | Feature flag for PTV API |
| `PTV_DEV_ID` | No | PTV Timetable API developer ID |
| `PTV_API_KEY` | No | PTV Timetable API key |

## Error Handling

- If GTFS-RT feed is unreachable: show last cached data with "Data may be stale" indicator
- If no cached data available: show empty map with "Connecting to live data..." message
- Individual feed failure (e.g. trams down but trains up): show available data, indicate partial outage
- Client offline: show cached view with offline indicator

## Testing Strategy

- **API route tests:** Unit tests for protobuf parsing and GTFS enrichment logic using recorded protobuf fixtures (saved from real API responses). No live API calls in tests.
- **Component tests:** Vitest + React Testing Library for UI components (panels, toggles, popups)
- **Map rendering:** Manual/visual testing - Deck.gl layers are impractical to unit test. Verified by running the dev server with fixture data.
- **Dev mode fixtures:** `NEXT_PUBLIC_USE_FIXTURES=true` env var loads saved JSON responses instead of hitting the live API. Avoids burning API quota during development.

## Accessibility

- All floating controls are keyboard-navigable (tab order, Enter/Space to activate)
- Filter toggles and theme toggle use `role="switch"` with `aria-checked`
- Vehicle popup and route panel use `aria-live="polite"` for screen reader announcements
- Glass panels use a solid-enough background opacity (minimum `rgba(0,0,0,0.7)` dark / `rgba(255,255,255,0.8)` light) to meet WCAG AA contrast on text
- Info bar vehicle count and last-updated time are screen-reader accessible

## Performance Targets

- Initial page load: < 2s on 4G
- Map interaction: 60fps during pan/zoom
- Vehicle update cycle: 30s with smooth interpolation
- Support rendering 500+ simultaneous vehicles without jank
