'use client'

import { useState, useCallback, useEffect } from 'react'
import { MapView } from '@/components/map-view'
import { FilterBar } from '@/components/filter-bar'
import { ThemeToggle } from '@/components/theme-toggle'
import { InfoBar } from '@/components/info-bar'
import { VehiclePopup } from '@/components/vehicle-popup'
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
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number; screenY?: number } | null>(null)

  const handleVehicleHover = useCallback((vehicle: Vehicle | null, screenCoords?: { x: number; y: number }) => {
    setHoveredVehicle(vehicle)
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
  }, [])

  const handleVehicleSelect = useCallback((vehicle: Vehicle) => {
    setFlyTo({ lng: vehicle.lng, lat: vehicle.lat, zoom: 15 })
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
        highlightRouteId={hoveredVehicle?.routeId ?? null}
        flyTo={flyTo}
        onVehicleClick={handleVehicleClick}
        onVehicleHover={handleVehicleHover}
        onMapClick={handleCloseRoute}
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-4 left-4 right-4 pointer-events-auto flex items-center justify-between gap-2">
          <FilterBar filter={filter} onFilterChange={(f) => {
            setFilter(f)
            localStorage.setItem('vehicleFilter', f)
          }} />
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>

        <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-auto transition-all duration-500 ${activeRouteId ? 'bottom-14' : 'bottom-4'}`}>
          <InfoBar
            vehicleCount={vehicles.length}
            lastUpdated={lastUpdated}
            error={error}
          />
        </div>

        <div className={`absolute right-4 pointer-events-auto transition-all duration-500 ${activeRouteId ? 'bottom-14' : 'bottom-4'}`}>
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

      {activeRouteId && (
        <div className="pointer-events-auto">
          <RoutePanel
            routeId={activeRouteId}
            vehicles={vehicles}
            onClose={handleCloseRoute}
            onVehicleSelect={handleVehicleSelect}
            onFitRoute={handleFitRoute}
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
