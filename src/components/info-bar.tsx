'use client'

import { GlassPanel } from './glass-panel'

interface InfoBarProps {
  vehicleCount: number
  lastUpdated: number | null
  error: string | null
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function InfoBar({ vehicleCount, lastUpdated, error }: InfoBarProps) {
  return (
    <GlassPanel variant="pill" className="px-4 py-2">
      <div className="flex items-center gap-4 text-sm" role="status" aria-live="polite">
        <span className="font-medium">
          <span className="dark:text-white/90 text-black/80">
            {vehicleCount}
          </span>
          <span className="dark:text-white/50 text-black/50 ml-1">
            vehicles
          </span>
        </span>

        {lastUpdated && (
          <span className="dark:text-white/40 text-black/40">
            Updated {formatTime(lastUpdated)}
          </span>
        )}

        {error && (
          <span className="text-amber-400/80 text-xs">
            Data may be stale
          </span>
        )}

        <span className="dark:text-white/30 text-black/30 text-xs">
          Data: PTV/DOT (CC-BY-4.0)
        </span>
      </div>
    </GlassPanel>
  )
}
