export const GTFS_RT_URLS = {
  metro: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions',
  tram: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions',
} as const

export const MELBOURNE_CENTER = {
  lat: -37.8136,
  lng: 144.9631,
} as const

export const DEFAULT_ZOOM = 12
export const ZOOM_THRESHOLD_LOD = 13
export const POLL_INTERVAL_MS = 30_000

export const CARTO_TILE_URLS = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
} as const

export const CACHE_TTL = {
  vehicles: 30,
  routes: 86400,
} as const
