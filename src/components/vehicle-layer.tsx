'use client'

import { ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers'
import type { Vehicle } from '@/lib/types'
import { ZOOM_THRESHOLD_LOD } from '@/lib/constants'

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [136, 136, 136]
}

// Create a data URL for a directional arrow SVG
function createArrowIconMapping() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <polygon points="32,8 48,40 32,32 16,40" fill="white" stroke="none"/>
  </svg>`
  const encoded = typeof btoa !== 'undefined'
    ? `data:image/svg+xml;base64,${btoa(svg)}`
    : `data:image/svg+xml,${encodeURIComponent(svg)}`
  return {
    url: encoded,
    mapping: { arrow: { x: 0, y: 0, width: 64, height: 64, anchorY: 32 } },
  }
}

const arrowIcon = createArrowIconMapping()

// Bearing is degrees clockwise from north.
// Screen coords: +x = right, +y = down.
// So: dx = sin(bearing) * dist, dy = -cos(bearing) * dist
function bearingToPixelOffset(bearing: number, dist: number): [number, number] {
  const rad = (bearing * Math.PI) / 180
  return [Math.sin(rad) * dist, -Math.cos(rad) * dist]
}

// Greedy label deconfliction: hide labels that would overlap in screen space
function deconflictLabels(vehicles: Vehicle[], zoom: number): Vehicle[] {
  // Approximate pixels per degree at this zoom (Mercator)
  const scale = 256 * Math.pow(2, zoom) / 360
  const cosLat = Math.cos(-37.8 * Math.PI / 180) // Melbourne latitude

  const MIN_DIST_PX = 90 // minimum pixel distance between label centers
  const placed: { px: number; py: number }[] = []
  const visible: Vehicle[] = []

  for (const v of vehicles) {
    const px = v.lng * scale * cosLat
    const py = v.lat * scale
    let tooClose = false
    for (const p of placed) {
      const dx = px - p.px
      const dy = py - p.py
      if (dx * dx + dy * dy < MIN_DIST_PX * MIN_DIST_PX) {
        tooClose = true
        break
      }
    }
    if (!tooClose) {
      placed.push({ px, py })
      visible.push(v)
    }
  }
  return visible
}

export function createVehicleLayers(
  vehicles: Vehicle[],
  zoom: number,
  isDark: boolean,
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void,
  onVehicleHover: (vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => void
) {
  const isZoomedIn = zoom >= ZOOM_THRESHOLD_LOD
  const vehiclesWithBearing = vehicles.filter(v => v.bearing !== 0)

  // Scale arrow size and offset with zoom to match dot size
  const t = Math.max(0, Math.min(1, (zoom - 10) / 7)) // 0 at zoom 10, 1 at zoom 17
  const arrowSize = 8 + t * 8      // 8px at low zoom, 16px at high zoom
  const arrowOffset = 6 + t * 18   // 6px at low zoom, 24px at high zoom

  if (!isZoomedIn) {
    return [
      // Glow layer (dark mode only)
      isDark
        ? new ScatterplotLayer({
            id: 'vehicle-glow',
            data: vehicles,
            getPosition: (d: Vehicle) => [d.lng, d.lat],
            getRadius: 300,
            getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 25],
            radiusMinPixels: 6,
            radiusMaxPixels: 10,
            pickable: false,
          })
        : null,
      // Main dots
      new ScatterplotLayer({
        id: 'vehicle-dots',
        data: vehicles,
        getPosition: (d: Vehicle) => [d.lng, d.lat],
        getRadius: 200,
        getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 220],
        radiusMinPixels: 4,
        radiusMaxPixels: 7,
        pickable: true,
        onClick: (info: any) => {
          if (info.object) onVehicleClick(info.object as Vehicle, { x: info.x, y: info.y })
        },
        onHover: (info: any) => {
          onVehicleHover(info.object as Vehicle | null, info.object ? { x: info.x, y: info.y } : undefined)
        },
      }),
      // Direction arrows - positioned ahead of the dot
      new IconLayer({
        id: 'vehicle-arrows',
        data: vehiclesWithBearing,
        getPosition: (d: Vehicle) => [d.lng, d.lat],
        getIcon: () => 'arrow',
        iconAtlas: arrowIcon.url,
        iconMapping: arrowIcon.mapping,
        getSize: arrowSize,
        getAngle: (d: Vehicle) => 360 - d.bearing,
        getColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 200],
        getPixelOffset: (d: Vehicle) => bearingToPixelOffset(d.bearing, arrowOffset),
        pickable: false,
      }),
    ].filter(Boolean)
  }

  return [
    // Zoomed-in dots with stroke
    new ScatterplotLayer({
      id: 'vehicle-icons',
      data: vehicles,
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getRadius: 120,
      getFillColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 240],
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 1,
      stroked: true,
      radiusMinPixels: 5,
      radiusMaxPixels: 8,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) onVehicleClick(info.object as Vehicle, { x: info.x, y: info.y })
      },
      onHover: (info: any) => {
        onVehicleHover(info.object as Vehicle | null, info.object ? { x: info.x, y: info.y } : undefined)
      },
    }),
    // Direction arrows - positioned ahead of the dot
    new IconLayer({
      id: 'vehicle-arrows-zoomed',
      data: vehiclesWithBearing,
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getIcon: () => 'arrow',
      iconAtlas: arrowIcon.url,
      iconMapping: arrowIcon.mapping,
      getSize: arrowSize,
      getAngle: (d: Vehicle) => 360 - d.bearing,
      getColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 220],
      getPixelOffset: (d: Vehicle) => bearingToPixelOffset(d.bearing, arrowOffset),
      pickable: false,
    }),
    // Route name labels (deconflicted to avoid overlap)
    new TextLayer({
      id: 'vehicle-labels',
      data: deconflictLabels(vehicles, zoom),
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getText: (d: Vehicle) => d.routeName,
      getSize: 11,
      getColor: isDark ? [255, 255, 255, 200] : [0, 0, 0, 200],
      getPixelOffset: [0, 22],
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 500,
      pickable: false,
    }),
  ]
}
