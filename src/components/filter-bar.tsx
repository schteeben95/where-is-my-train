'use client'

import { GlassPanel } from './glass-panel'
import type { VehicleFilter } from '@/lib/types'

interface FilterBarProps {
  filter: VehicleFilter
  onFilterChange: (filter: VehicleFilter) => void
}

const filters: { value: VehicleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'train', label: 'Trains' },
  { value: 'tram', label: 'Trams' },
]

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg font-light tracking-tight dark:text-white/90 text-black/80 mr-1">
        Where is my train?
      </span>
      <GlassPanel variant="pill" className="flex p-1 gap-0.5">
        {filters.map(f => (
          <button
            key={f.value}
            role="switch"
            aria-checked={filter === f.value}
            onClick={() => onFilterChange(f.value)}
            className={`
              relative px-4 py-1.5 text-sm font-medium rounded-xl
              transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${filter === f.value
                ? 'bg-white/20 dark:bg-white/15 dark:text-white text-black/80 shadow-sm'
                : 'dark:text-white/50 text-black/40 hover:text-black/60 dark:hover:text-white/70'
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </GlassPanel>
    </div>
  )
}
