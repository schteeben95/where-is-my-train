'use client'

import { useEffect, useState } from 'react'
import { GlassPanel } from './glass-panel'
import type { RouteShape, Vehicle } from '@/lib/types'

interface RoutePanelProps {
  routeId: string
  vehicles: Vehicle[]
  onClose: () => void
}

export function RoutePanel({ routeId, vehicles, onClose }: RoutePanelProps) {
  const [route, setRoute] = useState<RouteShape | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/routes/${routeId}`)
      .then(res => res.json())
      .then(data => {
        setRoute(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [routeId])

  const routeVehicles = vehicles.filter(v => v.routeId === routeId)

  return (
    <div
      className="fixed top-0 right-0 h-full w-[350px] z-50
        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
    >
      <GlassPanel className="h-full rounded-none rounded-l-[22px] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {route && (
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: route.routeColor,
                  boxShadow: `0 0 10px ${route.routeColor}60`,
                }}
              />
            )}
            <h2 className="text-lg font-medium dark:text-white/90 text-black/80">
              {route?.routeName || 'Loading...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              bg-white/10 hover:bg-white/20 transition-colors duration-200
              dark:text-white/60 text-black/40 hover:dark:text-white/90 hover:text-black/70"
            aria-label="Close route panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <p className="text-sm dark:text-white/50 text-black/40">Loading route details...</p>
        )}

        {!loading && route && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2">
                Vehicles on this route
              </h3>
              {routeVehicles.length === 0 ? (
                <p className="text-sm dark:text-white/50 text-black/40">No active vehicles</p>
              ) : (
                <div className="space-y-2">
                  {routeVehicles.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 p-2 rounded-xl bg-white/5"
                    >
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: v.routeColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm dark:text-white/80 text-black/70 truncate">
                          {v.direction || v.routeName}
                        </p>
                        <p className="text-xs dark:text-white/50 text-black/40">
                          {v.status === 'STOPPED_AT' ? 'At' : 'Next:'} {v.currentStop}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {route.stops.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2">
                  Stops
                </h3>
                <div className="space-y-1">
                  {route.stops.map(stop => (
                    <div key={stop.id} className="text-sm dark:text-white/60 text-black/50 py-1">
                      {stop.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
