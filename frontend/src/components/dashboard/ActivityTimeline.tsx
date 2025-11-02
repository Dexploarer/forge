/**
 * ActivityTimeline - Real-time activity feed
 * Shows recent platform events in a compact timeline format
 */

import { useEffect, useState } from 'react'
import { Activity, Users, Database, AlertCircle, CheckCircle } from 'lucide-react'
import { useApiFetch } from '../../utils/api'

interface ActivityEvent {
  type: string
  timestamp: string
  userId: string | null
  assetId: string | null
  details: Record<string, any>
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const apiFetch = useApiFetch()

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await apiFetch('/api/admin/activity?limit=10')
        if (response.ok) {
          const data = await response.json()
          setEvents(data.activity || [])
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
    // Refresh every 10 seconds
    const interval = setInterval(fetchActivity, 10000)
    return () => clearInterval(interval)
  }, [apiFetch])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'user_created':
        return <Users size={16} className="text-blue-400" />
      case 'asset_created':
        return <Database size={16} className="text-green-400" />
      case 'asset_published':
        return <CheckCircle size={16} className="text-emerald-400" />
      default:
        return <Activity size={16} className="text-gray-400" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'user_created':
        return 'border-blue-500/30'
      case 'asset_created':
        return 'border-green-500/30'
      case 'asset_published':
        return 'border-emerald-500/30'
      default:
        return 'border-gray-500/30'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const getEventDescription = (event: ActivityEvent) => {
    switch (event.type) {
      case 'user_created':
        return `New user registered${event.details.email ? `: ${event.details.email}` : ''}`
      case 'asset_created':
        return `Created ${event.details.type || 'asset'}: ${event.details.name || 'Unnamed'}`
      case 'asset_published':
        return `Published ${event.details.type || 'asset'}: ${event.details.name || 'Unnamed'}`
      default:
        return 'Unknown event'
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={20} className="text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-3 bg-slate-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full font-medium">
          Live
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={`${event.type}-${event.timestamp}-${index}`}
              className="flex gap-3 pb-3 border-b border-slate-700/50 last:border-0 last:pb-0"
            >
              <div className={`p-2 bg-slate-800 border ${getEventColor(event.type)} rounded-lg shrink-0`}>
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {getEventDescription(event)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTime(event.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
