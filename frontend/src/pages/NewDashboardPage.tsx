/**
 * NewDashboardPage - Spectacular modern dashboard for MMO game development platform
 * Features: compact stats, activity feed, quick actions, and real-time updates
 */

import { useEffect, useState } from 'react'
import { Users, Database, CheckCircle, FileEdit, Zap, HardDrive } from 'lucide-react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { CompactStatCard } from '../components/dashboard/CompactStatCard'
import { QuickActions } from '../components/dashboard/QuickActions'
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline'
import { GlobalSearch } from '../components/dashboard/GlobalSearch'
import { StatsCards } from '../components/admin/StatsCards'
import { useApiFetch } from '../utils/api'

interface PlatformStats {
  totalUsers: number
  totalAssets: number
  publishedAssets: number
  draftAssets: number
  totalStorageBytes: number
  newUsersToday: number
  newAssetsToday: number
  assetsByType: Record<string, number>
}

export default function NewDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const apiFetch = useApiFetch()

  // Global keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiFetch('/api/admin/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [apiFetch])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <DashboardLayout onSearchClick={() => setSearchOpen(true)}>
        <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
          <p className="text-gray-400">Monitor your MMO platform's performance and activity</p>
        </div>

        {/* Compact Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <CompactStatCard
              title="Total Users"
              value={stats.totalUsers.toLocaleString()}
              icon={Users}
              color="blue"
              trend={{
                value: stats.newUsersToday > 0 ? ((stats.newUsersToday / stats.totalUsers) * 100) : 0,
                label: 'today',
              }}
            />
            <CompactStatCard
              title="Total Assets"
              value={stats.totalAssets.toLocaleString()}
              icon={Database}
              color="green"
              trend={{
                value: stats.newAssetsToday > 0 ? ((stats.newAssetsToday / stats.totalAssets) * 100) : 0,
                label: 'today',
              }}
            />
            <CompactStatCard
              title="Published"
              value={stats.publishedAssets.toLocaleString()}
              icon={CheckCircle}
              color="purple"
            />
            <CompactStatCard
              title="Drafts"
              value={stats.draftAssets.toLocaleString()}
              icon={FileEdit}
              color="orange"
            />
            <CompactStatCard
              title="New Today"
              value={stats.newAssetsToday.toLocaleString()}
              icon={Zap}
              color="cyan"
            />
            <CompactStatCard
              title="Storage"
              value={formatBytes(stats.totalStorageBytes)}
              icon={HardDrive}
              color="red"
            />
          </div>
        ) : null}

        {/* Quick Actions */}
        <QuickActions />

        {/* Main Grid - Activity and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed - Takes 1 column */}
          <div className="lg:col-span-1">
            <ActivityTimeline />
          </div>

          {/* Detailed Stats - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Platform Statistics</h3>
              <StatsCards />
            </div>
          </div>
        </div>

        {/* Asset Types Breakdown */}
        {stats && Object.keys(stats.assetsByType).length > 0 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Assets by Type</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {Object.entries(stats.assetsByType).map(([type, count]) => (
                <div key={type} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1 truncate capitalize">{type}</p>
                  <p className="text-2xl font-bold text-white">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </DashboardLayout>
    </>
  )
}
