import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function DashboardPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy()

  // Sync user with backend on mount
  useEffect(() => {
    const syncUser = async () => {
      if (!authenticated) {
        console.log('[DashboardPage] Not authenticated, skipping sync')
        return
      }

      console.log('[DashboardPage] Starting user sync...')

      try {
        const token = await getAccessToken()

        if (!token) {
          console.error('[DashboardPage] No access token available')
          return
        }

        console.log('[DashboardPage] Got access token, calling backend...')

        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        console.log('[DashboardPage] Backend response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }))
          console.error('[DashboardPage] Failed to sync user:', errorData)
        } else {
          const data = await response.json()
          console.log('[DashboardPage] User synced successfully:', data)
        }
      } catch (error) {
        console.error('[DashboardPage] Error syncing user:', error)
      }
    }

    syncUser()
  }, [authenticated, getAccessToken])

  // Redirect to login if not authenticated
  if (ready && !authenticated) {
    window.location.href = '/'
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">HyperForge Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              {user?.email?.address || user?.wallet?.address || 'User'}
            </span>
            <button
              onClick={logout}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-medium border border-slate-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome to HyperForge!
          </h2>
          <p className="text-gray-400">
            Your AI-powered game development platform
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="bg-blue-500/20 rounded-lg p-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Projects</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="bg-purple-500/20 rounded-lg p-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Assets</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="bg-pink-500/20 rounded-lg p-3">
                <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Team Members</p>
                <p className="text-2xl font-bold text-white">1</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button className="flex flex-col items-center p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-blue-500 hover:bg-blue-500/10 transition duration-200">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium text-gray-300">Create Project</span>
              </button>

              <button className="flex flex-col items-center p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-purple-500 hover:bg-purple-500/10 transition duration-200">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-medium text-gray-300">Upload Asset</span>
              </button>

              <button className="flex flex-col items-center p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-pink-500 hover:bg-pink-500/10 transition duration-200">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm font-medium text-gray-300">AI Generate</span>
              </button>

              <button className="flex flex-col items-center p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-green-500 hover:bg-green-500/10 transition duration-200">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-300">Invite Team</span>
              </button>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-8 bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-4 text-white">Getting Started</h3>
          <p className="mb-6 text-gray-300">
            Welcome to HyperForge! Here are some quick tips to get you started with AI-powered game development:
          </p>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500/30 rounded-full flex items-center justify-center mr-3 mt-0.5 text-sm text-blue-300 font-semibold">
                1
              </span>
              <span className="text-gray-300">Create your first project to organize your game assets</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-500/30 rounded-full flex items-center justify-center mr-3 mt-0.5 text-sm text-purple-300 font-semibold">
                2
              </span>
              <span className="text-gray-300">Use AI to generate 3D models, music, or game content</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-pink-500/30 rounded-full flex items-center justify-center mr-3 mt-0.5 text-sm text-pink-300 font-semibold">
                3
              </span>
              <span className="text-gray-300">Invite team members to collaborate on your project</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
