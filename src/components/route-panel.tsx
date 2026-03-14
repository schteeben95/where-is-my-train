'use client'

import { useEffect, useState } from 'react'
import { GlassPanel } from './glass-panel'
import type { RouteShape, Vehicle } from '@/lib/types'

interface RoutePanelProps {
  routeId: string
  vehicles: Vehicle[]
  onClose: () => void
  onVehicleSelect: (vehicle: Vehicle) => void
  onFitRoute: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => void
  onStopHighlight: (stop: { id: string; lat: number; lng: number } | null) => void
}

const CITY_TERMINI = ['flinders street', 'flinders st', 'southern cross', 'parliament']

function isCityBound(vehicle: Vehicle, routeName: string): boolean {
  const dir = vehicle.direction.toLowerCase()
  // Strip "via ..." suffix to get the actual destination
  const destination = dir.replace(/\s+via\s+.+$/, '').replace(/^towards\s+/, '').trim()
  // Heading to a known city terminus
  if (CITY_TERMINI.some(t => destination.endsWith(t))) return true
  // Heading to this route's own terminus = FROM city
  const rn = routeName.toLowerCase()
  if (rn.includes(destination) || destination.includes(rn)) return false
  // Cross-city line (e.g. Cranbourne towards Sunbury via Metro Tunnel) = through city
  if (dir.includes('via metro tunnel')) return true
  return false
}

const STATUS_SHORT: Record<string, string> = {
  INCOMING_AT: 'Arriving',
  STOPPED_AT: 'At',
  IN_TRANSIT_TO: 'Next',
}

function VehicleCard({ vehicle, onSelect }: { vehicle: Vehicle; onSelect: (v: Vehicle) => void }) {
  return (
    <button
      onClick={() => onSelect(vehicle)}
      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5
        hover:bg-white/10 transition-colors duration-200 text-left cursor-pointer w-full"
    >
      <div
        className="w-2 h-2 rounded-full animate-pulse shrink-0"
        style={{ backgroundColor: vehicle.routeColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm dark:text-white/80 text-black/70 truncate">
          {vehicle.direction || vehicle.routeName}
        </p>
        {vehicle.currentStop && (
          <p className="text-xs dark:text-white/45 text-black/40 truncate">
            {STATUS_SHORT[vehicle.status] || vehicle.status}: {vehicle.currentStop}
          </p>
        )}
      </div>
      <svg className="w-3.5 h-3.5 dark:text-white/25 text-black/25 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    </button>
  )
}

export function RoutePanel({ routeId, vehicles, onClose, onVehicleSelect, onFitRoute, onStopHighlight }: RoutePanelProps) {
  const [route, setRoute] = useState<RouteShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStops, setShowStops] = useState(false)

  useEffect(() => {
    setLoading(true)
    setShowStops(false)
    fetch(`/api/routes/${routeId}`)
      .then(res => res.json())
      .then(data => {
        setRoute(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [routeId])

  const routeVehicles = vehicles.filter(v => v.routeId === routeId)

  // Sort by distance to Flinders Street Station (CBD hub)
  const FLINDERS_ST = { lat: -37.8183, lng: 144.9671 }
  const distToCity = (v: Vehicle) => {
    const dlat = v.lat - FLINDERS_ST.lat
    const dlng = v.lng - FLINDERS_ST.lng
    return dlat * dlat + dlng * dlng
  }

  const rn = route?.routeName || routeVehicles[0]?.routeName || ''
  const toCity = routeVehicles.filter(v => isCityBound(v, rn)).sort((a, b) => distToCity(a) - distToCity(b))
  const fromCity = routeVehicles.filter(v => !isCityBound(v, rn)).sort((a, b) => distToCity(a) - distToCity(b))

  return (
    <div
      data-route-panel
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 px-4 pb-4 w-full max-w-4xl
        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
    >
      <GlassPanel className="glass-heavy rounded-2xl overflow-hidden max-h-[45vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {route && (
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: route.routeColor,
                  boxShadow: `0 0 10px ${route.routeColor}60`,
                }}
              />
            )}
            <button
              className="text-base font-medium dark:text-white/90 text-black/80
                hover:underline underline-offset-2 cursor-pointer"
              onClick={() => {
                if (!route || route.coordinates.length === 0) return
                let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
                for (const [lng, lat] of route.coordinates) {
                  if (lng < minLng) minLng = lng
                  if (lat < minLat) minLat = lat
                  if (lng > maxLng) maxLng = lng
                  if (lat > maxLat) maxLat = lat
                }
                onFitRoute({ minLng, minLat, maxLng, maxLat })
              }}
            >
              {route?.routeName || 'Loading...'}
            </button>
            <span className="text-xs dark:text-white/40 text-black/35">
              {routeVehicles.length} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            {route && route.stops.length > 0 && (
              <button
                onClick={() => setShowStops(!showStops)}
                className="px-3 py-1.5 text-xs rounded-lg
                  bg-white/8 hover:bg-white/15 transition-colors duration-200
                  dark:text-white/60 text-black/50 hover:dark:text-white/80 hover:text-black/70"
              >
                {showStops ? 'Hide Stops' : 'Show Stops'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full
                bg-white/8 hover:bg-white/15 transition-colors duration-200
                dark:text-white/60 text-black/40 hover:dark:text-white/90 hover:text-black/70"
              aria-label="Close route panel"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-5">
              <p className="text-sm dark:text-white/50 text-black/40">Loading route details...</p>
            </div>
          )}

          {!loading && !showStops && (
            <div className="grid grid-cols-2 gap-0 divide-x divide-white/10">
              {/* To City */}
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  To City
                </h3>
                {toCity.length === 0 ? (
                  <p className="text-xs dark:text-white/30 text-black/30">None active</p>
                ) : (
                  <div className="space-y-1.5">
                    {toCity.map(v => (
                      <VehicleCard key={v.id} vehicle={v} onSelect={onVehicleSelect} />
                    ))}
                  </div>
                )}
              </div>

              {/* From City */}
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  From City
                </h3>
                {fromCity.length === 0 ? (
                  <p className="text-xs dark:text-white/30 text-black/30">None active</p>
                ) : (
                  <div className="space-y-1.5">
                    {fromCity.map(v => (
                      <VehicleCard key={v.id} vehicle={v} onSelect={onVehicleSelect} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && showStops && route && route.stops.length > 0 && (
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
                {route.stops.map((stop, i) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2 py-1 rounded-lg px-1 -mx-1
                      hover:bg-white/10 transition-colors duration-150 cursor-default"
                    onMouseEnter={() => onStopHighlight({ id: stop.id, lat: stop.lat, lng: stop.lng })}
                    onMouseLeave={() => onStopHighlight(null)}
                  >
                    <span className="text-xs dark:text-white/30 text-black/25 w-4 text-right shrink-0">{i + 1}</span>
                    <span className="text-sm dark:text-white/60 text-black/50 truncate">{stop.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  )
}
