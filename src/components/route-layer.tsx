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
