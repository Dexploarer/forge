/**
 * AnalyticsPage - Platform metrics and insights dashboard
 */

import { useEffect, useState } from 'react'
import { BarChart3, Download, Users, Database, FolderKanban, HardDrive } from 'lucide-react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { CompactStatCard } from '../components/dashboard/CompactStatCard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card'
import { useApiFetch } from '../utils/api'

interface AnalyticsData {
  totalUsers: number
  totalAssets: number
  totalProjects: number
  storageUsed: number
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d')
  const apiFetch = useApiFetch()

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        // Try both endpoints
        let response = await apiFetch('/api/analytics')
        if (!response.ok) {
          response = await apiFetch('/api/admin/stats')
        }

        if (response.ok) {
          const data = await response.json()
          // Handle both possible response structures
          const stats = data.stats || data
          setAnalytics({
            totalUsers: stats.totalUsers || 0,
            totalAssets: stats.totalAssets || 0,
            totalProjects: stats.totalProjects || 0,
            storageUsed: stats.totalStorageBytes || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [apiFetch, timeRange])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleExportReport = () => {
    // TODO: Implement export functionality
    console.log('Exporting analytics report...')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <BarChart3 size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              <p className="text-gray-400 mt-1">Platform metrics and insights</p>
            </div>
          </div>
          <button
            onClick={handleExportReport}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export Report
          </button>
        </div>

        {/* Time Range Selector */}
        <Card>
          <CardContent className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Time range:</span>
            <div className="flex gap-2">
              {[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: 'all', label: 'All time' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value as typeof timeRange)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === option.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactStatCard
              title="Total Users"
              value={analytics.totalUsers.toLocaleString()}
              icon={Users}
              color="blue"
            />
            <CompactStatCard
              title="Total Assets"
              value={analytics.totalAssets.toLocaleString()}
              icon={Database}
              color="green"
            />
            <CompactStatCard
              title="Total Projects"
              value={analytics.totalProjects.toLocaleString()}
              icon={FolderKanban}
              color="purple"
            />
            <CompactStatCard
              title="Storage Used"
              value={formatBytes(analytics.storageUsed)}
              icon={HardDrive}
              color="orange"
            />
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-400">Loading analytics...</p>
            </CardContent>
          </Card>
        )}

        {/* Additional Analytics Section */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Insights</CardTitle>
            <CardDescription>
              More detailed analytics and trends will be available here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">Advanced analytics coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
