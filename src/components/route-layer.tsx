'use client'

import { PathLayer } from '@deck.gl/layers'

export interface RouteData {
  id: string
  name: string
  color: string
  type: string
  coordinates: [number, number][]
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [136, 136, 136]
}

export function createAllRouteLayers(
  routes: RouteData[],
  activeRouteId: string | null,
  isDark: boolean
) {
  const layers: (PathLayer | null)[] = []

  // Background routes (faded)
  const bgRoutes = routes.filter(r => r.id !== activeRouteId)
  if (bgRoutes.length > 0) {
    layers.push(
      new PathLayer<RouteData>({
        id: 'routes-background',
        data: bgRoutes,
        getPath: (d) => d.coordinates,
        getColor: (d) => [...hexToRgb(d.color), isDark ? 70 : 80],
        getWidth: 10,
        widthMinPixels: 3,
        widthMaxPixels: 14,
        capRounded: true,
        jointRounded: true,
        pickable: false,
      })
    )
  }

  // Active route (full opacity with glow)
  if (activeRouteId) {
    const activeRoute = routes.find(r => r.id === activeRouteId)
    if (activeRoute) {
      const rgb = hexToRgb(activeRoute.color)

      if (isDark) {
        layers.push(
          new PathLayer<RouteData>({
            id: 'route-active-glow',
            data: [activeRoute],
            getPath: (d) => d.coordinates,
            getColor: [...rgb, 50],
            getWidth: 20,
            widthMinPixels: 8,
            capRounded: true,
            jointRounded: true,
          })
        )
      }

      layers.push(
        new PathLayer<RouteData>({
          id: 'route-active-line',
          data: [activeRoute],
          getPath: (d) => d.coordinates,
          getColor: [...rgb, isDark ? 200 : 220],
          getWidth: 10,
          widthMinPixels: 3,
          widthMaxPixels: 16,
          capRounded: true,
          jointRounded: true,
        })
      )
    }
  }

  return layers.filter(Boolean)
}
