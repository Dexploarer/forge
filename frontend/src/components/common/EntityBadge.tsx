/**
 * EntityBadge Component
 * Small circular or pill badge with icon for entity status indicators
 */

import { Star, Copy, CheckCircle, Edit, Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface EntityBadgeProps {
  type: 'featured' | 'template' | 'published' | 'draft' | 'new'
  className?: string
}

export function EntityBadge({ type, className }: EntityBadgeProps) {
  const config = {
    featured: {
      icon: Star,
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      label: 'Featured',
    },
    template: {
      icon: Copy,
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      label: 'Template',
    },
    published: {
      icon: CheckCircle,
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
      label: 'Published',
    },
    draft: {
      icon: Edit,
      className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      label: 'Draft',
    },
    new: {
      icon: Sparkles,
      className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      label: 'New',
    },
  }

  const { icon: Icon, className: badgeClassName, label } = config[type]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium',
        badgeClassName,
        className
      )}
      title={label}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  )
}
