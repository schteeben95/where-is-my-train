'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Map } from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator } from '@deck.gl/core'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MELBOURNE_CENTER, DEFAULT_ZOOM, CARTO_TILE_URLS } from '@/lib/constants'
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { createVehicleLayers } from './vehicle-layer'
import { createAllRouteLayers, type RouteData } from './route-layer'
import type { Vehicle, VehicleFilter } from '@/lib/types'

export interface StopData {
  id: string
  name: string
  lat: number
  lng: number
}

interface MapViewProps {
  vehicles: Vehicle[]
  isDark: boolean
  filter: VehicleFilter
  activeRouteId: string | null
  highlightRouteId: string | null
  flyTo: { lng: number; lat: number; zoom?: number; screenY?: number } | null
  onVehicleClick: (vehicle: Vehicle, screenCoords?: { x: number; y: number }) => void
  onVehicleHover: (vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => void
  onStopHover: (stop: StopData | null, screenCoords?: { x: number; y: number }) => void
  onMapClick: () => void
}

const INITIAL_VIEW_STATE: Record<string, any> = {
  longitude: MELBOURNE_CENTER.lng,
  latitude: MELBOURNE_CENTER.lat,
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: 0,
}

export function MapView({ vehicles, isDark, filter, activeRouteId, highlightRouteId, flyTo, onVehicleClick, onVehicleHover, onStopHover, onMapClick }: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([])
  const [stops, setStops] = useState<StopData[]>([])
  const prevFlyTo = useRef(flyTo)

  // Load all route shapes and stops once
  useEffect(() => {
    Promise.all([
      fetch('/data/all-routes.json').then(r => r.json()),
      fetch('/data/route-stops.json').then(r => r.json()),
    ]).then(([routes, routeStops]: [RouteData[], Record<string, StopData[]>]) => {
      setAllRoutes(routes)
      // Only include stops from train routes
      const trainRouteIds = new Set(routes.filter(r => r.type === 'train').map(r => r.id))
      const seen: Record<string, StopData> = {}
      for (const [routeId, stops] of Object.entries(routeStops)) {
        if (!trainRouteIds.has(routeId)) continue
        for (const stop of stops) {
          if (!seen[stop.id]) {
            seen[stop.id] = { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng }
          }
        }
      }
      setStops(Object.values(seen))
    }).catch(() => console.warn('Could not load routes/stops data'))
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

  const showStops = viewState.zoom >= 11.5
  const stopLayers = useMemo(() => {
    if (!showStops || stops.length === 0) return []
    return [
      new ScatterplotLayer<StopData>({
        id: 'stop-dots',
        data: stops,
        getPosition: (d) => [d.lng, d.lat],
        getRadius: 30,
        getFillColor: isDark ? [255, 255, 255, 120] : [0, 0, 0, 120],
        getLineColor: isDark ? [255, 255, 255, 60] : [0, 0, 0, 60],
        stroked: true,
        lineWidthMinPixels: 1,
        radiusMinPixels: 2,
        radiusMaxPixels: 5,
        pickable: true,
        onHover: (info: any) => {
          onStopHover(info.object as StopData | null, info.object ? { x: info.x, y: info.y } : undefined)
        },
      }),
      ...(viewState.zoom >= 13 ? [
        new TextLayer<StopData>({
          id: 'stop-labels',
          data: stops,
          getPosition: (d) => [d.lng, d.lat],
          getText: (d) => d.name.replace(/ Station$/, ''),
          getSize: 10,
          getColor: isDark ? [255, 255, 255, 100] : [0, 0, 0, 100],
          getPixelOffset: [0, -12],
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 400,
          pickable: false,
        }),
      ] : []),
    ]
  }, [showStops, stops, viewState.zoom, isDark, onStopHover])

  const layers = useMemo(
    () => [...routeLayers, ...stopLayers, ...vehicleLayers],
    [routeLayers, stopLayers, vehicleLayers]
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
