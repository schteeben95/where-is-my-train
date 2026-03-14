'use client'

import { forwardRef } from 'react'

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'panel' | 'pill'
  children: React.ReactNode
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ variant = 'panel', className = '', children, ...props }, ref) => {
    const baseClass = variant === 'pill' ? 'glass glass-pill' : 'glass'

    return (
      <div
        ref={ref}
        className={`${baseClass} ${className}`}
        {...props}
      >
        <div className="relative z-10">{children}</div>
      </div>
    )
  }
)

GlassPanel.displayName = 'GlassPanel'
