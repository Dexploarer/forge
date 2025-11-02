import { useEffect, useState } from 'react'
import { useApiFetch } from '../utils/api'
import { usePrivy } from '@privy-io/react-auth'

export default function DebugAuthPage() {
  const [debugData, setDebugData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapResult, setBootstrapResult] = useState<any>(null)
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

  const handleBootstrapAdmin = async () => {
    try {
      setBootstrapping(true)
      setBootstrapResult(null)
      setError(null)

      const response = await apiFetch('/api/admin/bootstrap-admin', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to bootstrap admin')
      }

      setBootstrapResult(data)

      // Refresh debug data
      const debugResponse = await apiFetch('/api/admin/debug-auth')
      if (debugResponse.ok) {
        const debugData = await debugResponse.json()
        setDebugData(debugData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBootstrapping(false)
    }
  }

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

        {bootstrapResult && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">Success!</span>
            </div>
            <p className="text-gray-300">{bootstrapResult.message}</p>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Privy User Info (Frontend)</h2>
          <pre className="bg-slate-900 p-4 rounded text-xs text-gray-300 overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Backend Debug Response</h2>
          {error ? (
            <div className="text-red-400 p-4 bg-red-900/20 rounded">{error}</div>
          ) : debugData ? (
            <>
              <pre className="bg-slate-900 p-4 rounded text-xs text-gray-300 overflow-auto mb-4">
                {JSON.stringify(debugData, null, 2)}
              </pre>

              {debugData.role !== 'admin' && (
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-gray-400 mb-3">
                    Your role is <code className="text-yellow-400 bg-slate-900 px-2 py-1 rounded">{debugData.role}</code>.
                    Click below to become the first admin user.
                  </p>
                  <button
                    onClick={handleBootstrapAdmin}
                    disabled={bootstrapping}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {bootstrapping ? 'Promoting to Admin...' : 'Make Me Admin'}
                  </button>
                </div>
              )}
            </>
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
