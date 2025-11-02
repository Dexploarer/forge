/**
 * CompactStatCard - Compact metric card with trend indicator
 * Inspired by crypto trading dashboards
 */

import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface CompactStatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'cyan'
  onClick?: () => void
}

const colorClasses = {
  blue: {
    icon: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    trend: 'text-blue-400',
  },
  purple: {
    icon: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    trend: 'text-purple-400',
  },
  green: {
    icon: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    trend: 'text-green-400',
  },
  orange: {
    icon: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    trend: 'text-orange-400',
  },
  red: {
    icon: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    trend: 'text-red-400',
  },
  cyan: {
    icon: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    trend: 'text-cyan-400',
  },
}

export function CompactStatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  onClick,
}: CompactStatCardProps) {
  const colors = colorClasses[color]
  const trendUp = trend && trend.value > 0
  const trendDown = trend && trend.value < 0
  const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus

  return (
    <div
      className={`
        card-hover p-4 group
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Value and Title */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1 truncate">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-white truncate">
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <TrendIcon
                size={14}
                className={trendUp ? 'text-green-400' : trendDown ? 'text-red-400' : 'text-gray-400'}
              />
              <span
                className={`text-xs font-medium ${
                  trendUp ? 'text-green-400' : trendDown ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {trendUp ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>

        {/* Right: Icon */}
        <div className={`p-2.5 ${colors.bg} border ${colors.border} rounded-lg shrink-0`}>
          <Icon size={20} className={colors.icon} />
        </div>
      </div>
    </div>
  )
}
