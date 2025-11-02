/**
 * AIUsagePage - AI usage tracking and costs
 */

import { useEffect, useState } from 'react'
import { Zap, Filter, Calendar } from 'lucide-react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { CompactStatCard } from '../components/dashboard/CompactStatCard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { useApiFetch } from '../utils/api'

interface AIUsageMetrics {
  totalRequests: number
  totalCost: number
  totalTokens: number
}

interface AIUsageRecord {
  date: string
  model: string
  requests: number
  tokens: number
  cost: number
}

export default function AIUsagePage() {
  const [metrics, setMetrics] = useState<AIUsageMetrics | null>(null)
  const [records, setRecords] = useState<AIUsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d')
  const apiFetch = useApiFetch()

  useEffect(() => {
    const fetchAIUsage = async () => {
      setLoading(true)
      try {
        // Try both endpoints
        let response = await apiFetch('/api/analytics/ai-usage')
        if (!response.ok) {
          response = await apiFetch('/api/ai/usage')
        }

        if (response.ok) {
          const data = await response.json()
          setMetrics({
            totalRequests: data.totalRequests || 0,
            totalCost: data.totalCost || 0,
            totalTokens: data.totalTokens || 0,
          })
          setRecords(data.records || [])
        }
      } catch (error) {
        console.error('Failed to fetch AI usage:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAIUsage()
  }, [apiFetch, selectedModel, dateRange])

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const uniqueModels = ['all', ...new Set(records.map((r) => r.model))]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
              <Zap size={24} className="text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">AI Usage</h1>
                <Badge variant="primary" size="sm">New</Badge>
              </div>
              <p className="text-gray-400 mt-1">Track AI service usage and costs</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex items-center flex-wrap gap-4">
            {/* Model Filter */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {uniqueModels.map((model) => (
                  <option key={model} value={model}>
                    {model === 'all' ? 'All Models' : model}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">Range:</span>
              <div className="flex gap-2">
                {[
                  { value: '7d', label: '7d' },
                  { value: '30d', label: '30d' },
                  { value: 'all', label: 'All' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateRange(option.value as typeof dateRange)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      dateRange === option.value
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CompactStatCard
              title="Total Requests"
              value={formatNumber(metrics.totalRequests)}
              icon={Zap}
              color="purple"
            />
            <CompactStatCard
              title="Total Cost"
              value={formatCost(metrics.totalCost)}
              icon={Zap}
              color="green"
            />
            <CompactStatCard
              title="Tokens Used"
              value={formatNumber(metrics.totalTokens)}
              icon={Zap}
              color="blue"
            />
          </div>
        ) : null}

        {/* Usage Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usage History</CardTitle>
            <CardDescription>Detailed breakdown of AI service usage</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4">
                    <div className="h-4 bg-slate-700 rounded flex-1"></div>
                    <div className="h-4 bg-slate-700 rounded w-24"></div>
                    <div className="h-4 bg-slate-700 rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Model</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Requests</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Tokens</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-sm text-white">{record.date}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" size="sm">{record.model}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-white text-right">{record.requests.toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm text-white text-right">{formatNumber(record.tokens)}</td>
                        <td className="py-3 px-4 text-sm text-green-400 font-medium text-right">{formatCost(record.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Zap size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No AI usage data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
