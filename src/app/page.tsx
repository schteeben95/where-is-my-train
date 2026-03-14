'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MapView, type StopData } from '@/components/map-view'
import { StopPanel } from '@/components/stop-panel'
import { FilterBar } from '@/components/filter-bar'
import { ThemeToggle } from '@/components/theme-toggle'
import { InfoBar } from '@/components/info-bar'
import { VehiclePopup } from '@/components/vehicle-popup'
import { GlassPanel } from '@/components/glass-panel'
import { RoutePanel } from '@/components/route-panel'
import { useVehicles } from '@/hooks/use-vehicles'
import { useTheme } from '@/hooks/use-theme'
import type { Vehicle, VehicleFilter } from '@/lib/types'

export default function Home() {
  const { resolved: theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [filter, setFilter] = useState<VehicleFilter>('train')

  useEffect(() => {
    const saved = localStorage.getItem('vehicleFilter')
    if (saved === 'train' || saved === 'tram' || saved === 'all') setFilter(saved)
  }, [])
  const { vehicles, lastUpdated, loading, error } = useVehicles(filter)

  const [hoveredVehicle, setHoveredVehicle] = useState<Vehicle | null>(null)
  const [hoveredStop, setHoveredStop] = useState<StopData | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [activeStop, setActiveStop] = useState<StopData | null>(null)
  const [highlightStop, setHighlightStop] = useState<{ id: string; lat: number; lng: number } | null>(null)
  const [panelHighlightRouteIds, setPanelHighlightRouteIds] = useState<string[]>([])
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number; screenY?: number } | null>(null)
  const viewStateRef = useRef<{ longitude: number; latitude: number; zoom: number } | null>(null)
  const savedViewState = useRef<{ longitude: number; latitude: number; zoom: number } | null>(null)

  const handleVehicleHover = useCallback((vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => {
    setHoveredVehicle(vehicle)
    setHoveredStop(null)
    setHoverPosition(screenCoords || null)
  }, [])

  const handleStopHover = useCallback((stop: StopData | null, screenCoords?: { x: number; y: number }) => {
    setHoveredStop(stop)
    setHoveredVehicle(null)
    setHoverPosition(screenCoords || null)
  }, [])

  const handleVehicleClick = useCallback((vehicle: Vehicle, screenCoords?: { x: number; y: number }) => {
    setHoveredVehicle(null)
    setHoverPosition(null)
    setActiveRouteId(vehicle.routeId)
    if (screenCoords) {
      setFlyTo({ lng: vehicle.lng, lat: vehicle.lat, screenY: screenCoords.y })
    }
  }, [])

  const handleCloseRoute = useCallback(() => {
    setActiveRouteId(null)
    setHoveredVehicle(null)
    setHoverPosition(null)
  }, [])

  const handleVehicleSelect = useCallback((vehicle: Vehicle) => {
    setFlyTo({ lng: vehicle.lng, lat: vehicle.lat, zoom: 15 })
  }, [])

  const handleStopSelect = useCallback((stop: { lat: number; lng: number }) => {
    setFlyTo({ lng: stop.lng, lat: stop.lat, zoom: 15 })
  }, [])

  const handleStopClick = useCallback((stop: StopData) => {
    setActiveStop(stop)
    setActiveRouteId(null)
    setHoveredVehicle(null)
    setHoverPosition(null)
  }, [])

  const handleFitRoute = useCallback((bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => {
    const centerLng = (bounds.minLng + bounds.maxLng) / 2
    const centerLat = (bounds.minLat + bounds.maxLat) / 2
    const latSpan = bounds.maxLat - bounds.minLat
    const lngSpan = bounds.maxLng - bounds.minLng
    // Compute zoom to fit bounds with padding
    const latZoom = Math.log2(360 / (latSpan * 2.5))
    const lngZoom = Math.log2(360 / (lngSpan * 2.5))
    const zoom = Math.min(latZoom, lngZoom, 15)
    setFlyTo({ lng: centerLng, lat: centerLat, zoom })
  }, [])

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      <MapView
        vehicles={vehicles}
        isDark={isDark}
        filter={filter}
        activeRouteId={activeRouteId}
        highlightRouteIds={panelHighlightRouteIds.length > 0 ? panelHighlightRouteIds : (activeStop?.routeIds ?? hoveredStop?.routeIds ?? (hoveredVehicle ? [hoveredVehicle.routeId] : []))}
        highlightStopId={activeStop?.id ?? highlightStop?.id ?? null}
        flyTo={flyTo}
        onVehicleClick={handleVehicleClick}
        onVehicleHover={handleVehicleHover}
        onStopHover={handleStopHover}
        onStopClick={handleStopClick}
        viewStateRef={viewStateRef}
        onMapClick={useCallback(() => {
          setActiveRouteId(null)
          setActiveStop(null)
          setHoveredVehicle(null)
          setHoveredStop(null)
          setHoverPosition(null)
        }, [])}
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-4 left-4 right-4 pointer-events-auto flex items-center justify-between gap-2">
          <FilterBar filter={filter} onFilterChange={(f) => {
            setFilter(f)
            localStorage.setItem('vehicleFilter', f)
          }} />
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>

        <div className={`absolute left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 pointer-events-auto transition-all duration-500 ${activeRouteId ? 'bottom-14' : 'bottom-4'}`}>
          <InfoBar
            vehicleCount={vehicles.length}
            lastUpdated={lastUpdated}
            error={error}
          />
        </div>

        <div className={`absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 pointer-events-auto transition-all duration-500 ${activeRouteId ? 'bottom-14' : 'bottom-1 sm:bottom-4'}`}>
          <p className="text-xs dark:text-white/50 text-black/40">
            By{' '}
            <a
              href="https://stevenhan.net"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:dark:text-white/70 hover:text-black/60 transition-colors"
            >
              Steven X. Han
            </a>
          </p>
        </div>
      </div>

      {hoveredVehicle && hoverPosition && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${Math.min(hoverPosition.x + 12, window.innerWidth - 300)}px`,
            top: `${Math.max(hoverPosition.y - 80, 10)}px`,
          }}
        >
          <VehiclePopup vehicle={hoveredVehicle} />
        </div>
      )}

      {hoveredStop && hoverPosition && !hoveredVehicle && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${Math.min(hoverPosition.x + 12, window.innerWidth - 200)}px`,
            top: `${Math.max(hoverPosition.y - 40, 10)}px`,
          }}
        >
          <GlassPanel className="px-3 py-2">
            <p className="text-sm font-medium dark:text-white/90 text-black/80">
              {hoveredStop.name}
            </p>
            {hoveredStop.routes.length > 0 && (
              <p className="text-xs dark:text-white/50 text-black/40 mt-0.5">
                {hoveredStop.routes.join(', ')}
              </p>
            )}
          </GlassPanel>
        </div>
      )}

      {activeRouteId && (
        <div className="pointer-events-auto">
          <RoutePanel
            routeId={activeRouteId}
            vehicles={vehicles}
            onClose={handleCloseRoute}
            onVehicleSelect={handleVehicleSelect}
            onFitRoute={handleFitRoute}
            onStopHighlight={setHighlightStop}
            onStopSelect={handleStopSelect}
            autoFit={!!activeStop}
            onBack={activeStop ? () => {
              setActiveRouteId(null)
              if (savedViewState.current) {
                setFlyTo({ lng: savedViewState.current.longitude, lat: savedViewState.current.latitude, zoom: savedViewState.current.zoom })
                savedViewState.current = null
              }
            } : undefined}
          />
        </div>
      )}

      {activeStop && !activeRouteId && (
        <div className="pointer-events-auto">
          <StopPanel
            stop={activeStop}
            onClose={() => { setActiveStop(null); setPanelHighlightRouteIds([]) }}
            onRouteSelect={(routeId) => {
              setPanelHighlightRouteIds([])
              if (viewStateRef.current) {
                savedViewState.current = { ...viewStateRef.current }
              }
              setActiveRouteId(routeId)
            }}
            onRouteHover={setPanelHighlightRouteIds}
          />
        </div>
      )}

      {loading && vehicles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="glass glass-pill px-6 py-3 dark:text-white/70 text-black/50 text-sm">
            Connecting to live data...
          </div>
        </div>
      )}
    </main>
  )
}
