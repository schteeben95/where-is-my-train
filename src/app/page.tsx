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
import type { Vehicle, VehicleFilter, RouteShape } from '@/lib/types'

export default function Home() {
  const { resolved: theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [filter, setFilter] = useState<VehicleFilter>('all')
  const { vehicles, lastUpdated, loading, error } = useVehicles(filter)

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [activeRouteData, setActiveRouteData] = useState<{ coordinates: [number, number][]; color: string } | null>(null)

  const handleVehicleClick = useCallback((vehicle: Vehicle, screenCoords?: { x: number; y: number }) => {
    setSelectedVehicle(vehicle)
    setPopupPosition(screenCoords || { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    // Immediately show the route on the map
    setActiveRouteId(vehicle.routeId)
  }, [])

  const handleViewRoute = useCallback((routeId: string) => {
    setActiveRouteId(routeId)
    setSelectedVehicle(null)
    setPopupPosition(null)
  }, [])

  // Fetch route shape when a route is selected
  useEffect(() => {
    if (!activeRouteId) {
      setActiveRouteData(null)
      return
    }
    fetch(`/api/routes/${activeRouteId}`)
      .then(res => res.json())
      .then((data: RouteShape) => {
        setActiveRouteData({ coordinates: data.coordinates, color: data.routeColor })
      })
      .catch(() => setActiveRouteData(null))
  }, [activeRouteId])

  const handleClosePopup = useCallback(() => {
    setSelectedVehicle(null)
    setPopupPosition(null)
  }, [])

  const handleCloseRoute = useCallback(() => {
    setActiveRouteId(null)
    setActiveRouteData(null)
  }, [])

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      <MapView
        vehicles={vehicles}
        isDark={isDark}
        onVehicleClick={handleVehicleClick}
        activeRoute={activeRouteData}
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <FilterBar filter={filter} onFilterChange={setFilter} />
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <InfoBar
            vehicleCount={vehicles.length}
            lastUpdated={lastUpdated}
            error={error}
          />
        </div>
      </div>

      {selectedVehicle && popupPosition && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{
            left: `${Math.min(popupPosition.x, window.innerWidth - 300)}px`,
            top: `${Math.max(popupPosition.y - 200, 10)}px`,
          }}
        >
          <VehiclePopup
            vehicle={selectedVehicle}
            onClose={handleClosePopup}
            onViewRoute={handleViewRoute}
          />
        </div>
      )}

      {activeRouteId && (
        <div className="pointer-events-auto">
          <RoutePanel
            routeId={activeRouteId}
            vehicles={vehicles}
            onClose={handleCloseRoute}
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
