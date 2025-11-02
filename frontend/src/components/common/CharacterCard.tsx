/**
 * CharacterCard Component
 * Inspired by Eliza.OS marketplace design
 */

import { Eye, Copy, Info, Star, FileText, CheckCircle, Edit } from 'lucide-react'
import { Badge } from './Badge'
import { Button } from './Button'
import { cn } from '../../utils/cn'

export interface CharacterCardProps {
  id: string
  name: string
  description: string
  avatarUrl?: string | null
  handle?: string // @username style
  badges?: Array<'featured' | 'template' | 'published' | 'draft'>
  tags?: string[] // category tags
  stats?: {
    usageCount?: number
    favorites?: number
    interactions?: number
  }
  onClick?: () => void
  onClone?: () => void
  onInfo?: () => void
  className?: string
}

const badgeConfig = {
  featured: {
    icon: Star,
    variant: 'warning' as const,
    label: 'Featured',
  },
  template: {
    icon: Copy,
    variant: 'primary' as const,
    label: 'Template',
  },
  published: {
    icon: CheckCircle,
    variant: 'success' as const,
    label: 'Published',
  },
  draft: {
    icon: Edit,
    variant: 'secondary' as const,
    label: 'Draft',
  },
}

export function CharacterCard({
  name,
  description,
  avatarUrl,
  handle,
  badges = [],
  tags = [],
  stats,
  onClick,
  onClone,
  onInfo,
  className,
}: CharacterCardProps) {
  const handleCardClick = () => {
    if (onClick) {
      onClick()
    }
  }

  const handleCloneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClone) {
      onClone()
    }
  }

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onInfo) {
      onInfo()
    }
  }

  // Generate a color for placeholder avatar based on first letter
  const getPlaceholderColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500',
    ]
    const charCode = name.charCodeAt(0)
    return colors[charCode % colors.length]
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur-sm',
        'p-6 transition-all duration-200',
        'hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={handleCardClick}
    >
      {/* Badges - Top Right Corner */}
      {badges.length > 0 && (
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          {badges.map((badgeType) => {
            const config = badgeConfig[badgeType]
            const IconComponent = config.icon
            return (
              <Badge
                key={badgeType}
                variant={config.variant}
                size="sm"
                className="flex items-center gap-1"
                title={config.label}
              >
                <IconComponent className="w-3 h-3" />
                <span className="sr-only">{config.label}</span>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Avatar */}
      <div className="flex justify-center mb-4">
        <div className="relative w-[120px] h-[120px]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full rounded-full object-cover border-2 border-slate-700 group-hover:border-blue-500/50 transition-colors duration-200"
            />
          ) : (
            <div
              className={cn(
                'w-full h-full rounded-full flex items-center justify-center text-white text-4xl font-bold border-2 border-slate-700 group-hover:border-blue-500/50 transition-colors duration-200',
                getPlaceholderColor(name)
              )}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Name and Handle */}
      <div className="text-center mb-3">
        <h3 className="text-lg font-bold text-white truncate" title={name}>
          {name}
        </h3>
        {handle && (
          <p className="text-sm text-gray-400 mt-0.5">
            {handle.startsWith('@') ? handle : `@${handle}`}
          </p>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 text-center mb-4 line-clamp-3 min-h-[3.75rem]">
        {description}
      </p>

      {/* Stats */}
      {stats && (
        <div className="flex justify-center gap-4 mb-4 text-xs text-gray-400">
          {stats.usageCount !== undefined && (
            <div className="flex items-center gap-1" title="Usage count">
              <FileText className="w-3 h-3" />
              <span>{stats.usageCount.toLocaleString()}</span>
            </div>
          )}
          {stats.favorites !== undefined && (
            <div className="flex items-center gap-1" title="Favorites">
              <Star className="w-3 h-3" />
              <span>{stats.favorites.toLocaleString()}</span>
            </div>
          )}
          {stats.interactions !== undefined && (
            <div className="flex items-center gap-1" title="Interactions">
              <Copy className="w-3 h-3" />
              <span>{stats.interactions.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-4 min-h-[1.75rem]">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" size="sm">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="secondary" size="sm" title={tags.slice(3).join(', ')}>
              +{tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center items-center pt-3 border-t border-slate-700/50">
        <Button
          variant="primary"
          size="sm"
          onClick={handleCardClick}
          className="flex-1"
          title="View character"
        >
          <Eye className="w-4 h-4 mr-1.5" />
          View
        </Button>
        {onClone && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCloneClick}
            className="flex-1"
            title="Clone character"
          >
            <Copy className="w-4 h-4 mr-1.5" />
            Clone
          </Button>
        )}
        {onInfo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInfoClick}
            className="px-3"
            title="Character info"
          >
            <Info className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
