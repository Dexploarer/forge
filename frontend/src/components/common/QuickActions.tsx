/**
 * QuickActions Component
 * Row of icon-only action buttons for entity cards
 */

import { Eye, Copy, Heart, Trash } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../utils/cn'

export interface QuickActionsProps {
  onView?: () => void
  onClone?: () => void
  onFavorite?: () => void
  onDelete?: () => void
  isFavorited?: boolean
  className?: string
}

export function QuickActions({
  onView,
  onClone,
  onFavorite,
  onDelete,
  isFavorited = false,
  className,
}: QuickActionsProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          title="View details"
          className="p-2"
        >
          <Eye className="w-4 h-4" />
        </Button>
      )}

      {onClone && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClone}
          title="Clone"
          className="p-2"
        >
          <Copy className="w-4 h-4" />
        </Button>
      )}

      {onFavorite && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onFavorite}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          className="p-2"
        >
          <Heart className={cn('w-4 h-4', isFavorited && 'fill-current')} />
        </Button>
      )}

      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          title="Delete"
          className="p-2 hover:text-red-400"
        >
          <Trash className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
