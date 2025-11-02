/**
 * ActivityPage - Full activity log viewer
 */

import { useEffect, useState } from 'react'
import { Activity, Search, Download, Users, Database, CheckCircle, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card'
import { useApiFetch } from '../utils/api'

interface ActivityEvent {
  type: string
  timestamp: string
  userId: string | null
  assetId: string | null
  details: Record<string, any>
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const apiFetch = useApiFetch()

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true)
      try {
        // Try both endpoints
        let response = await apiFetch('/api/admin/activity')
        if (!response.ok) {
          response = await apiFetch('/api/activity')
        }

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
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [apiFetch])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'user_created':
        return <Users size={20} className="text-blue-400" />
      case 'asset_created':
        return <Database size={20} className="text-green-400" />
      case 'asset_published':
        return <CheckCircle size={20} className="text-emerald-400" />
      default:
        return <Activity size={20} className="text-gray-400" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'user_created':
        return 'border-blue-500/30 bg-blue-500/10'
      case 'asset_created':
        return 'border-green-500/30 bg-green-500/10'
      case 'asset_published':
        return 'border-emerald-500/30 bg-emerald-500/10'
      default:
        return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
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
        return event.details.message || 'Unknown event'
    }
  }

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesSearch = searchQuery === '' ||
      getEventDescription(event).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.userId && event.userId.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = eventTypeFilter === 'all' || event.type === eventTypeFilter

    return matchesSearch && matchesType
  })

  // Paginate
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage)
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const uniqueEventTypes = ['all', ...new Set(events.map((e) => e.type))]

  const handleExportLogs = () => {
    // TODO: Implement export functionality
    console.log('Exporting activity logs...')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
              <Activity size={24} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Activity Log</h1>
              <p className="text-gray-400 mt-1">View all platform activity</p>
            </div>
          </div>
          <button
            onClick={handleExportLogs}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export Logs
          </button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex items-center flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activity by user, action, or entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Event Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Type:</span>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {uniqueEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Events' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Activity List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Showing {paginatedEvents.length} of {filteredEvents.length} events
                </CardDescription>
              </div>
              <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full font-medium">
                Live
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-700 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedEvents.length > 0 ? (
              <div className="space-y-1">
                {paginatedEvents.map((event, index) => (
                  <div
                    key={`${event.type}-${event.timestamp}-${index}`}
                    className="flex gap-4 p-4 rounded-lg hover:bg-slate-700/30 transition-colors"
                  >
                    <div className={`p-3 border ${getEventColor(event.type)} rounded-lg shrink-0 h-fit`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium mb-1">
                        {getEventDescription(event)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatTimestamp(event.timestamp)}</span>
                        {event.userId && (
                          <>
                            <span>•</span>
                            <span>User: {event.userId.slice(0, 8)}...</span>
                          </>
                        )}
                        {event.assetId && (
                          <>
                            <span>•</span>
                            <span>Asset: {event.assetId.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {searchQuery || eventTypeFilter !== 'all'
                    ? 'No matching activity found'
                    : 'No recent activity'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-700/50 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-700/50 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
