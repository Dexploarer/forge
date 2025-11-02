/**
 * QuickActions - Panel with frequently used action buttons
 */

import { Plus, Users, Database, Zap, FileText, Settings } from 'lucide-react'

interface ActionButton {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  color?: string
  shortcut?: string
}

export function QuickActions() {
  const actions: ActionButton[] = [
    {
      id: 'new-user',
      label: 'New User',
      icon: <Users size={20} />,
      onClick: () => console.log('New user'),
      color: 'blue',
      shortcut: 'N',
    },
    {
      id: 'new-asset',
      label: 'New Asset',
      icon: <Database size={20} />,
      onClick: () => console.log('New asset'),
      color: 'green',
      shortcut: 'A',
    },
    {
      id: 'run-generation',
      label: 'AI Generate',
      icon: <Zap size={20} />,
      onClick: () => console.log('AI generate'),
      color: 'purple',
      shortcut: 'G',
    },
    {
      id: 'view-logs',
      label: 'View Logs',
      icon: <FileText size={20} />,
      onClick: () => console.log('View logs'),
      color: 'orange',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      onClick: () => console.log('Settings'),
      color: 'gray',
    },
  ]

  const getColorClasses = (color: string = 'blue') => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400 hover:border-blue-500/50',
      green: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400 hover:border-green-500/50',
      purple: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400 hover:border-purple-500/50',
      orange: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-400 hover:border-orange-500/50',
      gray: 'bg-slate-700/50 hover:bg-slate-600/50 border-slate-600 text-gray-300 hover:border-slate-500',
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Plus size={20} className="text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`
              flex flex-col items-center gap-2 p-4 rounded-lg border
              transition-all duration-200
              ${getColorClasses(action.color)}
            `}
          >
            {action.icon}
            <span className="text-sm font-medium text-center">
              {action.label}
            </span>
            {action.shortcut && (
              <kbd className="px-2 py-0.5 text-xs bg-black/30 rounded font-mono">
                {action.shortcut}
              </kbd>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
