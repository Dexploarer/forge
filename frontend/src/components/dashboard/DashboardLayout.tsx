/**
 * DashboardLayout - Main layout container with sidebar and header
 */

import type { ReactNode } from 'react'
import { SideNavigation } from './SideNavigation'
import { DashboardHeader } from './DashboardHeader'

interface DashboardLayoutProps {
  children: ReactNode
  onSearchClick?: () => void
}

export function DashboardLayout({ children, onSearchClick }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Side Navigation */}
        <SideNavigation />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <DashboardHeader onSearchClick={onSearchClick} />

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-6 xl:p-8 max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
