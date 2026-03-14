'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Vehicle, VehiclesResponse, VehicleFilter } from '@/lib/types'
import { POLL_INTERVAL_MS } from '@/lib/constants'

export function useVehicles(filter: VehicleFilter = 'all') {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const allVehiclesRef = useRef<Vehicle[]>([])

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data: VehiclesResponse = await res.json()
      allVehiclesRef.current = data.vehicles
      setLastUpdated(data.timestamp)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch vehicles:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const all = allVehiclesRef.current
    if (filter === 'all') {
      setVehicles(all)
    } else {
      setVehicles(all.filter(v => v.type === filter))
    }
  }, [filter, lastUpdated])

  useEffect(() => {
    fetchVehicles()
    const interval = setInterval(fetchVehicles, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchVehicles])

  return { vehicles, lastUpdated, loading, error, refetch: fetchVehicles }
}
