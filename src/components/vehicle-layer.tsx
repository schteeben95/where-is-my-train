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
