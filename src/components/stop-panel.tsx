'use client'

import { GlassPanel } from './glass-panel'
import type { StopData } from './map-view'

interface StopPanelProps {
  stop: StopData
  onClose: () => void
  onRouteSelect: (routeId: string) => void
}

export function StopPanel({ stop, onClose, onRouteSelect }: StopPanelProps) {
  return (
    <div
      data-route-panel
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 px-4 pb-4 w-full max-w-xl
        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
    >
      <GlassPanel className="glass-heavy rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-white/60 dark:bg-white/70" />
            <span className="text-base font-medium dark:text-white/90 text-black/80">
              {stop.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              bg-white/8 hover:bg-white/15 transition-colors duration-200
              dark:text-white/60 text-black/40 hover:dark:text-white/90 hover:text-black/70"
            aria-label="Close stop panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Routes */}
        <div className="p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider dark:text-white/40 text-black/40 mb-2">
            Lines through this station
          </h3>
          <div className="flex flex-wrap gap-2">
            {stop.routes.map((name, i) => (
              <button
                key={stop.routeIds[i]}
                onClick={() => onRouteSelect(stop.routeIds[i])}
                className="px-3 py-1.5 text-sm rounded-xl
                  bg-white/8 hover:bg-white/15 transition-colors duration-200
                  dark:text-white/70 text-black/60 hover:dark:text-white/90 hover:text-black/80
                  cursor-pointer"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
