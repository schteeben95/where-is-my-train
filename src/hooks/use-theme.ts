'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThemeMode } from '@/lib/types'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getEffectiveTheme(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? getSystemTheme() : mode
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeMode | null
    if (saved && ['dark', 'light', 'system'].includes(saved)) {
      setMode(saved)
    }
  }, [])

  useEffect(() => {
    setResolved(getEffectiveTheme(mode))

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => setResolved(getSystemTheme())
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [mode])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'system'
      ? (getSystemTheme() === 'dark' ? 'light' : 'dark')
      : mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    localStorage.setItem('theme', next)
  }, [mode])

  return { mode, resolved, toggle }
}
