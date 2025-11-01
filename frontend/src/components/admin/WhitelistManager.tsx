import React, { useEffect, useState } from 'react'

interface WhitelistEntry {
  id: string
  walletAddress: string
  addedBy: {
    id: string
    name: string
  } | null
  reason?: string
  createdAt: string
}

export function WhitelistManager() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success] = useState<string | null>(null)

  // Form state
  const [walletAddress, setWalletAddress] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchWhitelist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchWhitelist = async () => {
    try {
      setLoading(true)
      // TODO: Implement /api/admin/whitelist endpoint
      // For now, show empty whitelist
      setEntries([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load whitelist')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate wallet address
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      setError('Invalid wallet address. Must start with 0x and be 42 characters long.')
      return
    }

    setIsSubmitting(true)
    setError('Whitelist management endpoint not yet implemented')
    setIsSubmitting(false)
    // TODO: Implement /api/admin/whitelist/add endpoint
  }

  const handleRemoveWallet = async (_id: string) => {
    if (!confirm('Are you sure you want to remove this wallet from the whitelist?')) {
      return
    }

    // TODO: Implement /api/admin/whitelist/remove endpoint
    setError('Whitelist management endpoint not yet implemented')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Add Wallet Form */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Add Wallet to Whitelist
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Wallet Address *
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Early supporter, Partner organization"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !walletAddress}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isSubmitting ? 'Adding...' : 'Add to Whitelist'}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}
        </div>
      </div>

      {/* Whitelist Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Whitelisted Wallets ({entries.length})</h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading whitelist...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No whitelisted wallets yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Wallet Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Added By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Reason</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date Added</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4">
                        <code className="text-sm text-blue-400">{entry.walletAddress}</code>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {entry.addedBy ? entry.addedBy.name : <span className="italic text-gray-500">System</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {entry.reason || <span className="italic">No reason provided</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">{formatDate(entry.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveWallet(entry.id)}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
