import { useEffect, useState } from 'react'
import { useApiFetch } from '../utils/api'
import { usePrivy } from '@privy-io/react-auth'

export default function DebugAuthPage() {
  const [debugData, setDebugData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const apiFetch = useApiFetch()
  const { user, ready, authenticated } = usePrivy()

  useEffect(() => {
    const fetchDebug = async () => {
      try {
        const response = await apiFetch('/api/admin/debug-auth')
        if (!response.ok) {
          const err = await response.text()
          throw new Error(`HTTP ${response.status}: ${err}`)
        }
        const data = await response.json()
        setDebugData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    if (authenticated) {
      fetchDebug()
    }
  }, [authenticated, apiFetch])

  if (!ready) {
    return <div className="p-8">Loading...</div>
  }

  if (!authenticated) {
    return <div className="p-8">Not authenticated. Please login first.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Auth Debug Information</h1>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Privy User Info (Frontend)</h2>
          <pre className="bg-slate-900 p-4 rounded text-xs text-gray-300 overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Backend Debug Response</h2>
          {error ? (
            <div className="text-red-400 p-4 bg-red-900/20 rounded">{error}</div>
          ) : debugData ? (
            <pre className="bg-slate-900 p-4 rounded text-xs text-gray-300 overflow-auto">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-400">Loading...</div>
          )}
        </div>

        <div className="mt-6">
          <a href="/admin" className="text-blue-400 hover:text-blue-300">← Back to Admin Dashboard</a>
        </div>
      </div>
    </div>
  )
}
