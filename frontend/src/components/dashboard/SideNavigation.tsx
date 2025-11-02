/**
 * SideNavigation - Collapsible sidebar with hierarchical navigation
 * Inspired by modern crypto trading platforms and asset-forge
 */

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'
import { navigationConfig } from '../../config/navigation'
import type { NavigationItem, NavigationLink } from '../../types/navigation'

export function SideNavigation() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(
      navigationConfig.sections
        .filter(section => section.defaultExpanded)
        .map(section => section.id)
    )
  )

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const handleMobileClose = () => {
    setMobileOpen(false)
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const renderNavigationLink = (link: NavigationLink) => {
    const Icon = link.icon
    const active = isActive(link.path)

    return (
      <Link
        key={link.id}
        to={link.path}
        onClick={handleMobileClose}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg
          transition-all duration-200
          ${active
            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
            : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
          }
          ${collapsed ? 'justify-center' : 'justify-start'}
        `}
      >
        <Icon size={20} className={active ? 'text-blue-400' : ''} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium">
              {link.label}
            </span>
            {link.badge && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full">
                {link.badge}
              </span>
            )}
            {link.isNew && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-400 rounded-full">
                NEW
              </span>
            )}
            {link.shortcut && (
              <span className="text-xs text-gray-500 font-mono">
                {link.shortcut}
              </span>
            )}
          </>
        )}
      </Link>
    )
  }

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = item.icon
    const isExpanded = expandedSections.has(item.id)

    if (item.type === 'single' && item.path) {
      const link: NavigationLink = {
        id: item.id,
        label: item.label,
        icon: item.icon,
        path: item.path,
        badge: item.badge,
        isNew: item.isNew,
      }
      return renderNavigationLink(link)
    }

    if (item.type === 'collapsible' && item.children) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleSection(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg
              text-gray-400 hover:text-white hover:bg-slate-700/50
              transition-all duration-200
              ${collapsed ? 'justify-center' : 'justify-start'}
            `}
          >
            <Icon size={20} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sm font-medium">
                  {item.label}
                </span>
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </>
            )}
          </button>

          {isExpanded && !collapsed && (
            <div className="ml-6 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
              {item.children.map(child => renderNavigationLink(child))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              F
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">Forge</h1>
              <p className="text-xs text-gray-500 truncate">MMO Platform</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-sm mx-auto">
            F
          </div>
        )}

        {/* Desktop Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:block p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <ChevronRight
            size={18}
            className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-2">
        {navigationConfig.sections.map(item => renderNavigationItem(item))}
      </nav>

      {/* Footer */}
      {navigationConfig.footer && (
        <div className="border-t border-slate-700/50 p-3 space-y-1">
          {navigationConfig.footer.map(link => renderNavigationLink(link))}
        </div>
      )}

      {/* User Profile Section */}
      <div className="border-t border-slate-700/50 p-3">
        <Link
          to="/settings"
          onClick={handleMobileClose}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            A
          </div>
          {!collapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-gray-500 truncate">admin@forge.local</p>
            </div>
          )}
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 border border-slate-700 rounded-lg p-2.5 shadow-lg text-white hover:bg-slate-700 transition-colors"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 z-50
          flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${collapsed ? 'w-16' : 'w-[280px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Spacer for fixed sidebar (desktop only) */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-[280px]'
        }`}
      />
    </>
  )
}
