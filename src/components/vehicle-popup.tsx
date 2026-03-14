'use client'

import { GlassPanel } from './glass-panel'
import type { Vehicle } from '@/lib/types'

interface VehiclePopupProps {
  vehicle: Vehicle
  onClose: () => void
  onViewRoute: (routeId: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  INCOMING_AT: 'Arriving at',
  STOPPED_AT: 'Stopped at',
  IN_TRANSIT_TO: 'In transit to',
}

export function VehiclePopup({ vehicle, onClose, onViewRoute }: VehiclePopupProps) {
  return (
    <GlassPanel className="w-72 p-4" aria-live="polite">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
          rounded-full bg-white/10 hover:bg-white/20
          transition-colors duration-200 dark:text-white/60 text-black/40
          hover:dark:text-white/90 hover:text-black/70 z-20"
        aria-label="Close"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shadow-lg"
            style={{
              backgroundColor: vehicle.routeColor,
              boxShadow: `0 0 8px ${vehicle.routeColor}60`,
            }}
          />
          <span className="font-medium dark:text-white/90 text-black/80">
            {vehicle.routeName}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 dark:text-white/60 text-black/50 uppercase">
            {vehicle.type}
          </span>
        </div>

        {vehicle.direction && (
          <p className="text-sm dark:text-white/60 text-black/50">
            {vehicle.direction}
          </p>
        )}

        <p className="text-sm dark:text-white/70 text-black/60">
          {STATUS_LABELS[vehicle.status] || vehicle.status}{' '}
          <span className="font-medium">{vehicle.currentStop}</span>
        </p>

        <button
          onClick={() => onViewRoute(vehicle.routeId)}
          className="w-full mt-2 py-2 rounded-xl text-sm font-medium
            bg-white/10 hover:bg-white/15 dark:text-white/80 text-black/60
            hover:dark:text-white hover:text-black/80
            transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          View full route
        </button>
      </div>
    </GlassPanel>
  )
}
