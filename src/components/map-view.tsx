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
  onVehicleHover: (vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => void
  onMapClick: () => void
  activeRoute: RouteOverlay | null
}

const INITIAL_VIEW_STATE = {
  longitude: MELBOURNE_CENTER.lng,
  latitude: MELBOURNE_CENTER.lat,
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: 0,
}

export function MapView({ vehicles, isDark, onVehicleClick, onVehicleHover, onMapClick, activeRoute }: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)

  const handleViewStateChange = useCallback(({ viewState }: any) => {
    setViewState(viewState)
  }, [])

  const vehicleLayers = useMemo(
    () => createVehicleLayers(vehicles, viewState.zoom, isDark, onVehicleClick, onVehicleHover),
    [vehicles, viewState.zoom, isDark, onVehicleClick, onVehicleHover]
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
