/**
 * Navigation Configuration
 * Single source of truth for all dashboard navigation
 */

import {
  LayoutDashboard,
  Users,
  Database,
  Activity,
  Settings,
  Shield,
  FileText,
  Zap,
  BarChart3,
  Mic,
  Music,
  Scroll,
  Target,
  Book,
  HelpCircle,
  User,
} from 'lucide-react'

import type { NavigationConfig } from '../types/navigation'

export const navigationConfig: NavigationConfig = {
  sections: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      type: 'single',
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      path: '/users',
      type: 'single',
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: Database,
      type: 'collapsible',
      defaultExpanded: false,
      children: [
        {
          id: 'all-assets',
          label: 'All Assets',
          icon: Database,
          path: '/assets',
        },
        {
          id: '3d-assets',
          label: '3D Models',
          icon: Database,
          path: '/assets/3d',
        },
        {
          id: 'audio-assets',
          label: 'Audio Files',
          icon: Music,
          path: '/assets/audio',
        },
      ],
    },
    {
      id: 'content',
      label: 'Game Content',
      icon: Scroll,
      type: 'collapsible',
      defaultExpanded: false,
      children: [
        {
          id: 'npcs',
          label: 'NPCs',
          icon: Users,
          path: '/content/npcs',
        },
        {
          id: 'quests',
          label: 'Quests',
          icon: Target,
          path: '/content/quests',
        },
        {
          id: 'lore',
          label: 'Lore',
          icon: Book,
          path: '/content/lore',
        },
      ],
    },
    {
      id: 'voice',
      label: 'Voice & Audio',
      icon: Mic,
      type: 'collapsible',
      defaultExpanded: false,
      children: [
        {
          id: 'voices',
          label: 'Voices',
          icon: Mic,
          path: '/voice',
        },
        {
          id: 'music',
          label: 'Music',
          icon: Music,
          path: '/music',
        },
        {
          id: 'sfx',
          label: 'Sound Effects',
          icon: Music,
          path: '/sfx',
        },
      ],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      type: 'collapsible',
      defaultExpanded: false,
      children: [
        {
          id: 'overview',
          label: 'Overview',
          icon: BarChart3,
          path: '/analytics',
        },
        {
          id: 'ai-usage',
          label: 'AI Usage',
          icon: Zap,
          path: '/analytics/ai',
          isNew: true,
        },
      ],
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Activity,
      path: '/activity',
      type: 'single',
    },
    {
      id: 'admin',
      label: 'Admin Tools',
      icon: Shield,
      type: 'collapsible',
      defaultExpanded: false,
      children: [
        {
          id: 'system-settings',
          label: 'System Settings',
          icon: Settings,
          path: '/admin/settings',
        },
        {
          id: 'logs',
          label: 'System Logs',
          icon: FileText,
          path: '/admin/logs',
        },
      ],
    },
  ],
  footer: [
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      shortcut: ',',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      path: '/profile',
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      path: '/help',
      shortcut: '?',
    },
  ],
}
