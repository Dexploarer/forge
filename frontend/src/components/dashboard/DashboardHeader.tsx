/**
 * DashboardHeader - Top bar with search, notifications, and user menu
 */

import { Search, Bell, Settings, LogOut } from 'lucide-react'

interface DashboardHeaderProps {
  onSearchClick?: () => void
  onLogout?: () => void
}

export function DashboardHeader({ onSearchClick, onLogout }: DashboardHeaderProps) {
  const handleLogout = () => {
    localStorage.removeItem('authenticated')
    if (onLogout) {
      onLogout()
    } else {
      window.location.href = '/'
    }
  }

  return (
    <header className="h-16 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-30">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs/Title */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              Dashboard
            </h2>
            <p className="text-xs text-gray-500 truncate">
              Welcome back, Admin
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <button
            onClick={onSearchClick}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Search (Cmd+K)"
          >
            <Search size={18} />
            <span className="hidden sm:inline text-sm">Search</span>
            <kbd className="hidden lg:inline px-2 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded font-mono">
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <button
            className="relative p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Settings */}
          <button
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 bg-slate-800 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/50 rounded-lg transition-colors text-gray-400 hover:text-red-400"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
