import { useEffect, useState } from 'react'
import { useApiFetch } from '../../utils/api'

interface ActivityEvent {
  id: string
  type: 'generation' | 'login' | 'error' | 'signup' | 'asset_created' | 'user_created' | 'asset_published'
  userId: string
  userName: string
  message: string
  metadata?: Record<string, string>
  timestamp: string
  success?: boolean
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const apiFetch = useApiFetch()

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true)
        const response = await apiFetch('/api/admin/activity?limit=20')

        if (!response.ok) {
          throw new Error('Failed to fetch activity')
        }

        const data = await response.json()

        // Transform backend activity to frontend format
        const transformedEvents = data.activity.map((item: any, index: number) => ({
          id: item.assetId || item.userId || `activity-${index}`,
          type: item.type,
          userId: item.userId || '',
          userName: item.details?.displayName || item.details?.owner || item.details?.name || 'Unknown',
          message: item.type === 'user_created'
            ? `New user joined: ${item.details?.email || 'User'}`
            : item.type === 'asset_published'
            ? `Published asset: ${item.details?.name || 'Asset'}`
            : `Created ${item.details?.type || 'asset'}: ${item.details?.name || 'Item'}`,
          metadata: item.details,
          timestamp: item.timestamp,
          success: true
        }))

        setEvents(transformedEvents)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity')
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getEventIcon = (type: ActivityEvent['type']) => {
    if (type === 'user_created') {
      return (
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    }
    if (type === 'asset_published') {
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    if (type === 'asset_created') {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  }

  const getEventBadge = (type: ActivityEvent['type']) => {
    let bgColor = 'bg-gray-500/20'
    let textColor = 'text-gray-400'

    if (type === 'user_created') {
      bgColor = 'bg-purple-500/20'
      textColor = 'text-purple-400'
    } else if (type === 'asset_published') {
      bgColor = 'bg-green-500/20'
      textColor = 'text-green-400'
    } else if (type === 'asset_created') {
      bgColor = 'bg-blue-500/20'
      textColor = 'text-blue-400'
    }

    return { bgColor, textColor }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatEventType = (type: ActivityEvent['type']) => {
    const types = {
      user_created: 'User Joined',
      asset_created: 'Asset Created',
      asset_published: 'Asset Published',
      generation: 'Generation',
      login: 'Login',
      error: 'Error',
      signup: 'Sign Up'
    }
    return types[type] || type
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-6">
        <div className="text-center py-8 text-gray-400">Loading activity...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 text-red-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold">Error Loading Activity</h3>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Recent Activity
        </h3>
      </div>
      <div className="p-6">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No recent activity</div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {events.map((event) => {
              const badge = getEventBadge(event.type)
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="mt-1">{getEventIcon(event.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                        {formatEventType(event.type)}
                      </span>
                      <span className="text-sm font-medium text-white truncate">{event.userName}</span>
                    </div>

                    <p className="text-sm text-gray-300">{event.message}</p>

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <code key={key} className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-400">
                            {key}: {value}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
