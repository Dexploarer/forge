/**
 * Badge Component
 */

import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md'
}

export function Badge({
  className,
  variant = 'secondary',
  size = 'md',
  ...props
}: BadgeProps) {
  const variants = {
    primary: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    secondary: 'bg-slate-700/50 text-gray-300 border-slate-600',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const sizes = {
    sm: 'text-[0.625rem] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}
