/**
 * Navigation Types
 */

import type { LucideIcon } from 'lucide-react'

export type NavigationItemType = 'single' | 'collapsible'

export interface NavigationItem {
  id: string
  label: string
  icon: LucideIcon
  path?: string
  type: NavigationItemType
  badge?: string
  isNew?: boolean
  children?: NavigationLink[]
  defaultExpanded?: boolean
}

export interface NavigationLink {
  id: string
  label: string
  icon: LucideIcon
  path: string
  badge?: string
  isNew?: boolean
  shortcut?: string
}

export interface NavigationConfig {
  sections: NavigationItem[]
  footer?: NavigationLink[]
}
