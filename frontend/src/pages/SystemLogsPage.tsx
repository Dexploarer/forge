/**
 * System Logs Page
 * System logs viewer and search
 */

import { FileText, Download, Trash2, RefreshCw, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
} from '../components/common'
import { useApiFetch } from '../utils/api'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  source: string
}

export default function SystemLogsPage() {
  const apiFetch = useApiFetch()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/admin/logs')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    let filtered = logs

    if (selectedLevel !== 'all') {
      filtered = filtered.filter((log) => log.level === selectedLevel)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(query) ||
          log.source.toLowerCase().includes(query)
      )
    }

    setFilteredLogs(filtered)
  }, [logs, selectedLevel, searchQuery])

  const handleDownloadLogs = () => {
    const logText = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-logs-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      try {
        const response = await apiFetch('/api/admin/logs', {
          method: 'DELETE',
        })
        if (response.ok) {
          setLogs([])
        }
      } catch (error) {
        console.error('Failed to clear logs:', error)
      }
    }
  }

  const getLevelBadgeVariant = (level: LogLevel) => {
    const variants: Record<LogLevel, 'error' | 'warning' | 'primary' | 'secondary'> = {
      error: 'error',
      warn: 'warning',
      info: 'primary',
      debug: 'secondary',
    }
    return variants[level]
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <FileText size={28} className="text-orange-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">System Logs</h1>
                <p className="text-gray-400 mt-1">
                  View and search system logs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
                {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadLogs}
                className="gap-2"
              >
                <Download size={16} />
                Download Logs
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearLogs}
                className="gap-2"
              >
                <Trash2 size={16} />
                Clear Logs
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <Input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedLevel('all')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedLevel === 'all'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedLevel('error')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedLevel === 'error'
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600'
                  }`}
                >
                  Error
                </button>
                <button
                  onClick={() => setSelectedLevel('warn')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedLevel === 'warn'
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600'
                  }`}
                >
                  Warn
                </button>
                <button
                  onClick={() => setSelectedLevel('info')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedLevel === 'info'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600'
                  }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setSelectedLevel('debug')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedLevel === 'debug'
                      ? 'bg-gray-500 border-gray-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600'
                  }`}
                >
                  Debug
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Display */}
        <Card>
          <CardHeader>
            <CardTitle>Log Entries</CardTitle>
            <CardDescription>
              Showing {filteredLogs.length} of {logs.length} log entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw size={32} className="mx-auto animate-spin mb-4" />
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={32} className="mx-auto mb-4 opacity-50" />
                No logs found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <Badge variant={getLevelBadgeVariant(log.level)} size="sm" className="mt-0.5">
                      {log.level.toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          [{log.source}]
                        </span>
                      </div>
                      <p className="text-sm text-white font-mono mt-1 whitespace-pre-wrap break-words">
                        {log.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
