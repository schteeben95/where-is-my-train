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

export function createVehicleLayers(
  vehicles: Vehicle[],
  zoom: number,
  isDark: boolean,
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void
) {
  const isZoomedIn = zoom >= ZOOM_THRESHOLD_LOD
  const vehiclesWithBearing = vehicles.filter(v => v.bearing !== 0)

  if (!isZoomedIn) {
    return [
      // Glow layer (dark mode only)
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
        radiusMaxPixels: 10,
        pickable: true,
        onClick: (info: any) => {
          if (info.object) onVehicleClick(info.object as Vehicle, { x: info.x, y: info.y })
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
        getSize: 14,
        getAngle: (d: Vehicle) => 360 - d.bearing,
        getColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 200],
        getPixelOffset: (d: Vehicle) => bearingToPixelOffset(d.bearing, 14),
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
      radiusMinPixels: 6,
      radiusMaxPixels: 14,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) onVehicleClick(info.object as Vehicle, { x: info.x, y: info.y })
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
      getSize: 18,
      getAngle: (d: Vehicle) => 360 - d.bearing,
      getColor: (d: Vehicle) => [...hexToRgb(d.routeColor), 220],
      getPixelOffset: (d: Vehicle) => bearingToPixelOffset(d.bearing, 18),
      pickable: false,
    }),
    // Route name labels
    new TextLayer({
      id: 'vehicle-labels',
      data: vehicles,
      getPosition: (d: Vehicle) => [d.lng, d.lat],
      getText: (d: Vehicle) => d.routeName,
      getSize: 11,
      getColor: isDark ? [255, 255, 255, 200] : [0, 0, 0, 200],
      getPixelOffset: [0, 14],
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 500,
      pickable: false,
    }),
  ]
}
