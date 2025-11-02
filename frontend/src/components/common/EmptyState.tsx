/**
 * EmptyState Component
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 backdrop-blur-sm p-12 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-slate-800/50 p-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-400 mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
