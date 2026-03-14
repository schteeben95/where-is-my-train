'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Map } from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator } from '@deck.gl/core'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MELBOURNE_CENTER, DEFAULT_ZOOM, CARTO_TILE_URLS } from '@/lib/constants'
import { createVehicleLayers } from './vehicle-layer'
import { createAllRouteLayers, type RouteData } from './route-layer'
import type { Vehicle, VehicleFilter } from '@/lib/types'

interface MapViewProps {
  vehicles: Vehicle[]
  isDark: boolean
  filter: VehicleFilter
  activeRouteId: string | null
  highlightRouteId: string | null
  flyTo: { lng: number; lat: number; zoom?: number; screenY?: number } | null
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void
  onVehicleHover: (vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => void
  onMapClick: () => void
}

const INITIAL_VIEW_STATE: Record<string, any> = {
  longitude: MELBOURNE_CENTER.lng,
  latitude: MELBOURNE_CENTER.lat,
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: 0,
}

export function MapView({ vehicles, isDark, filter, activeRouteId, highlightRouteId, flyTo, onVehicleClick, onVehicleHover, onMapClick }: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([])
  const prevFlyTo = useRef(flyTo)

  // Load all route shapes once
  useEffect(() => {
    fetch('/data/all-routes.json')
      .then(res => res.json())
      .then((data: RouteData[]) => setAllRoutes(data))
      .catch(() => console.warn('Could not load all-routes.json'))
  }, [])

  // Fly to a position when flyTo changes
  useEffect(() => {
    if (flyTo && flyTo !== prevFlyTo.current) {
      const targetZoom = flyTo.zoom ?? viewState.zoom
      let targetLat = flyTo.lat

      if (flyTo.screenY != null && typeof window !== 'undefined') {
        const vh = window.innerHeight
        const buffer = 20

        // Measure the actual panel height after it renders (next frame)
        requestAnimationFrame(() => {
          const panelEl = document.querySelector('[data-route-panel]')
          const panelHeight = panelEl ? panelEl.getBoundingClientRect().height : 0
          const panelTop = vh - panelHeight

          // Only move if the vehicle would be covered by the panel (with buffer)
          if (flyTo.screenY! > panelTop - buffer) {
            // Remaining visible area above the panel
            const visibleHeight = vh - panelHeight
            // Vehicle is currently at screenY from top, map center is at vh/2.
            // We want vehicle at visibleHeight/2 from top.
            // Offset in pixels = screenY - visibleHeight/2 ... but we're setting
            // a new center, so: offset = vh/2 - visibleHeight/2 = panelHeight/2
            const offsetPx = panelHeight / 2
            const cosLat = Math.cos(flyTo.lat * Math.PI / 180)
            const latPerPixel = 360 * cosLat / (256 * Math.pow(2, targetZoom))

            setViewState((prev: any) => ({
              ...prev,
              longitude: flyTo.lng,
              latitude: flyTo.lat - latPerPixel * offsetPx,
              zoom: targetZoom,
              transitionDuration: 800,
              transitionInterpolator: new FlyToInterpolator(),
            }))
          }
          // If not covered, don't move the map
        })
      } else {
        // Direct flyTo (e.g. from route panel vehicle list)
        setViewState((prev: any) => ({
          ...prev,
          longitude: flyTo.lng,
          latitude: targetLat,
          zoom: targetZoom,
          transitionDuration: 1000,
          transitionInterpolator: new FlyToInterpolator(),
        }))
      }
    }
    prevFlyTo.current = flyTo
  }, [flyTo])

  const handleViewStateChange = useCallback(({ viewState }: any) => {
    setViewState(viewState)
  }, [])

  const vehicleLayers = useMemo(
    () => createVehicleLayers(vehicles, viewState.zoom, isDark, onVehicleClick, onVehicleHover),
    [vehicles, viewState.zoom, isDark, onVehicleClick, onVehicleHover]
  )

  const effectiveHighlight = activeRouteId ?? highlightRouteId

  const filteredRoutes = useMemo(
    () => filter === 'all' ? allRoutes : allRoutes.filter(r => r.type === filter),
    [allRoutes, filter]
  )

  const routeLayers = useMemo(
    () => createAllRouteLayers(filteredRoutes, effectiveHighlight, isDark),
    [filteredRoutes, effectiveHighlight, isDark]
  )

  const layers = useMemo(
    () => [...routeLayers, ...vehicleLayers],
    [routeLayers, vehicleLayers]
  )

  // Fetch and simplify CARTO style: remove minor roads, buildings, rail (we draw our own)
  const [mapStyle, setMapStyle] = useState<any>(
    isDark ? CARTO_TILE_URLS.dark : CARTO_TILE_URLS.light
  )
  const prevTheme = useRef(isDark)

  const HIDDEN_LAYERS = new Set([
    'road_service_case', 'road_service_fill',
    'road_minor_case', 'road_minor_fill',
    'road_path',
    'tunnel_service_case', 'tunnel_service_fill',
    'tunnel_minor_case', 'tunnel_minor_fill',
    'tunnel_path',
    'tunnel_rail', 'tunnel_rail_dash',
    'bridge_service_case', 'bridge_service_fill',
    'bridge_minor_case', 'bridge_minor_fill',
    'bridge_path',
    'rail', 'rail_dash',
    'building', 'building-top',
    'roadname_minor', 'housenumber',
    'aeroway-runway', 'aeroway-taxiway',
  ])

  useEffect(() => {
    const url = isDark ? CARTO_TILE_URLS.dark : CARTO_TILE_URLS.light
    prevTheme.current = isDark
    fetch(url)
      .then(res => res.json())
      .then(style => {
        style.layers = style.layers.filter((l: any) => !HIDDEN_LAYERS.has(l.id))
        // Darken the basemap in dark mode so transit overlays stand out
        if (isDark) {
          for (const layer of style.layers) {
            const p = layer.paint
            if (!p) continue
            if (p['background-color']) p['background-color'] = '#050508'
            // Only modify simple numeric opacities (skip zoom expressions/arrays)
            const dim = (key: string, factor: number) => {
              const v = p[key]
              if (v === undefined) p[key] = factor
              else if (typeof v === 'number') p[key] = v * factor
            }
            if (p['fill-color'] && typeof p['fill-color'] === 'string') dim('fill-opacity', 0.6)
            if (p['line-color'] && typeof p['line-color'] === 'string') dim('line-opacity', 0.4)
            if (p['text-color'] && typeof p['text-color'] === 'string') dim('text-opacity', 0.5)
          }
        }
        setMapStyle(style)
      })
      .catch(() => setMapStyle(url))
  }, [isDark])

  return (
    <div className="w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={true}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        onClick={(info: any) => {
          if (!info.object) onMapClick()
        }}
      >
        <Map
          mapStyle={mapStyle}
          attributionControl={false}
        />
      </DeckGL>
    </div>
  )
}
