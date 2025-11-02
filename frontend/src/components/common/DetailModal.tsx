/**
 * DetailModal Component
 * Comprehensive modal for displaying detailed entity information with tabbed content
 */

import { useState, type ReactNode } from 'react'
import { Edit2, Trash2, Copy, Share2, User, Scroll, Database, MapPin, Sparkles } from 'lucide-react'
import { Modal, ModalBody } from './Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'
import { Button } from './Button'
import { Badge } from './Badge'
import { cn } from '../../utils/cn'

export interface DetailModalProps {
  open: boolean
  onClose: () => void
  entity: {
    id: string
    name: string
    type: 'npc' | 'quest' | 'asset' | 'lore'
    avatarUrl?: string | null
    description: string
    badges?: Array<'featured' | 'template' | 'published' | 'draft'>
    // Tab content
    overview?: ReactNode
    assets?: ReactNode
    lore?: ReactNode
    quests?: ReactNode
    locations?: ReactNode
    technical?: ReactNode
  }
  onEdit?: () => void
  onDelete?: () => void
  onClone?: () => void
  onShare?: () => void
  onGenerateImage?: () => Promise<void>
  isGeneratingImage?: boolean
}

const entityTypeConfig = {
  npc: {
    label: 'NPC',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  quest: {
    label: 'Quest',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  asset: {
    label: 'Asset',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  lore: {
    label: 'Lore',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
}

const badgeConfig = {
  featured: { label: 'Featured', variant: 'warning' as const },
  template: { label: 'Template', variant: 'primary' as const },
  published: { label: 'Published', variant: 'success' as const },
  draft: { label: 'Draft', variant: 'secondary' as const },
}

export function DetailModal({
  open,
  onClose,
  entity,
  onEdit,
  onDelete,
  onClone,
  onShare,
  onGenerateImage,
  isGeneratingImage = false,
}: DetailModalProps) {
  // Determine available tabs
  const availableTabs = [
    { id: 'overview', label: 'Overview', content: entity.overview, icon: User },
    { id: 'assets', label: 'Assets', content: entity.assets, icon: Database },
    { id: 'lore', label: 'Lore', content: entity.lore, icon: Scroll },
    { id: 'quests', label: 'Quests', content: entity.quests, icon: Scroll },
    { id: 'locations', label: 'Locations', content: entity.locations, icon: MapPin },
    { id: 'technical', label: 'Technical', content: entity.technical, icon: Database },
  ].filter((tab) => tab.content !== undefined)

  // Default to first available tab
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'overview')

  if (!open) return null

  const typeConfig = entityTypeConfig[entity.type]

  return (
    <Modal open={open} onClose={onClose} size="xl">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900 border-b border-slate-700">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800/50 transition-colors z-10"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="p-8 pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-xl">
                  {entity.avatarUrl ? (
                    <img
                      src={entity.avatarUrl}
                      alt={entity.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <User size={64} />
                    </div>
                  )}
                </div>

                {/* Generate Image Button - shown when no avatar */}
                {!entity.avatarUrl && onGenerateImage && (
                  <button
                    onClick={onGenerateImage}
                    disabled={isGeneratingImage}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    title="Generate AI Image"
                  >
                    {isGeneratingImage ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={20} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Name and Type */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-3xl font-bold text-white truncate">
                  {entity.name}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border font-medium text-xs px-3 py-1',
                    typeConfig.color
                  )}
                >
                  {typeConfig.label}
                </span>
              </div>

              {/* Badges */}
              {entity.badges && entity.badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {entity.badges.map((badge) => {
                    const config = badgeConfig[badge]
                    return (
                      <Badge key={badge} variant={config.variant} size="md">
                        {config.label}
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* Description */}
              <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">
                {entity.description}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {onEdit && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onEdit}
                    className="gap-2"
                  >
                    <Edit2 size={16} />
                    Edit
                  </Button>
                )}
                {onClone && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onClone}
                    className="gap-2"
                  >
                    <Copy size={16} />
                    Clone
                  </Button>
                )}
                {onShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShare}
                    className="gap-2"
                  >
                    <Share2 size={16} />
                    Share
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={onDelete}
                    className="gap-2"
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      {availableTabs.length > 0 && (
        <div className="p-6 border-b border-slate-700">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {availableTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                    <Icon size={16} />
                    {tab.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Tab Content */}
      <ModalBody className="max-h-[50vh] overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {availableTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              <div className="text-gray-300">{tab.content}</div>
            </TabsContent>
          ))}
        </Tabs>
      </ModalBody>
    </Modal>
  )
}
