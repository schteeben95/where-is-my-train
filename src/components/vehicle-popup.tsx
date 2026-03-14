'use client'

import { GlassPanel } from './glass-panel'
import type { Vehicle } from '@/lib/types'

interface VehiclePopupProps {
  vehicle: Vehicle
}

const STATUS_LABELS: Record<string, string> = {
  INCOMING_AT: 'Arriving at',
  STOPPED_AT: 'Stopped at',
  IN_TRANSIT_TO: 'In transit to',
}

export function VehiclePopup({ vehicle }: VehiclePopupProps) {
  return (
    <GlassPanel className="px-4 py-3" aria-live="polite">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shadow-lg"
            style={{
              backgroundColor: vehicle.routeColor,
              boxShadow: `0 0 8px ${vehicle.routeColor}60`,
            }}
          />
          <span className="font-medium text-sm dark:text-white/90 text-black/80">
            {vehicle.routeName}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 dark:text-white/50 text-black/40 uppercase">
            {vehicle.type}
          </span>
        </div>

        {vehicle.direction && (
          <p className="text-xs dark:text-white/60 text-black/50">
            {vehicle.direction}
          </p>
        )}

        {vehicle.currentStop && (
          <p className="text-xs dark:text-white/50 text-black/40">
            {STATUS_LABELS[vehicle.status] || vehicle.status}{' '}
            <span className="dark:text-white/70 text-black/60">{vehicle.currentStop}</span>
          </p>
        )}
      </div>
    </GlassPanel>
  )
}
