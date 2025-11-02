/**
 * NPCs Page
 * Create and manage non-player characters
 */

import { Users, Plus, Search, Grid, List, Star, Sparkles } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../components/common'
import { CharacterCard, DetailModal } from '../components/common'
import { useApiFetch } from '../utils/api'

interface NPC {
  id: string
  name: string
  personality: string
  faction: string | null
  voiceId: string | null
  avatarUrl?: string | null
  modelUrl?: string | null
  isFeatured?: boolean
  isTemplate?: boolean
  usageCount?: number
  relatedLore?: string[]
  quests?: string[]
  locations?: string[]
  tags?: string[]
  createdAt: string
  updatedAt?: string
}

export default function NPCsPage() {
  const apiFetch = useApiFetch()
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFaction, setSelectedFaction] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newNpc, setNewNpc] = useState({
    name: '',
    personality: '',
    faction: '',
    voiceId: '',
  })
  const [selectedNpc, setSelectedNpc] = useState<NPC | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  useEffect(() => {
    fetchNpcs()
  }, [])

  const fetchNpcs = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/npcs')
      if (response.ok) {
        const data = await response.json()
        setNpcs(data.npcs || [])
      }
    } catch (error) {
      console.error('Failed to fetch NPCs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNpc = async () => {
    if (!newNpc.name.trim() || !newNpc.personality.trim()) return

    setIsCreating(true)
    try {
      const payload: Record<string, any> = {
        name: newNpc.name,
        personality: newNpc.personality,
      }

      // Only include optional fields if they have values
      if (newNpc.faction?.trim()) {
        payload.faction = newNpc.faction
      }
      if (newNpc.voiceId?.trim()) {
        payload.voiceId = newNpc.voiceId
      }

      const response = await apiFetch('/api/npcs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        await fetchNpcs()
        setShowCreateModal(false)
        setNewNpc({ name: '', personality: '', faction: '', voiceId: '' })
      }
    } catch (error) {
      console.error('Failed to create NPC:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/npcs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          // projectId omitted - backend handles null gracefully
          useContext: false, // Set to false since no projectId
          contextLimit: 5,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const npc = data.npc

        // Populate form with generated data
        setNewNpc({
          name: npc.name || '',
          personality: npc.personality || npc.description || '',
          faction: npc.faction || npc.race || '',
          voiceId: '',
        })

        setShowAiGenerate(false)
        setAiPrompt('')
      } else {
        const error = await response.text()
        console.error('AI generation failed:', error)
        alert('AI generation failed. Please try again.')
      }
    } catch (error) {
      console.error('Failed to generate NPC:', error)
      alert('Failed to generate NPC. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredNpcs = npcs.filter((npc) => {
    const matchesFaction = selectedFaction === 'all' || npc.faction === selectedFaction
    const matchesSearch =
      !searchQuery ||
      npc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      npc.personality.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFaction && matchesSearch
  })

  const factions = ['all', ...Array.from(new Set(npcs.map((n) => n.faction).filter((f): f is string => f !== null)))]

  const getFactionCount = (faction: string) => {
    if (faction === 'all') return npcs.length
    return npcs.filter((npc) => npc.faction === faction).length
  }

  const featuredNpcs = npcs.filter((npc) => npc.isFeatured)

  const handleViewNpc = (npc: NPC) => {
    setSelectedNpc(npc)
    setShowDetailModal(true)
  }

  const handleCloneNpc = (npc: NPC) => {
    // Placeholder for clone functionality
    console.log('Clone NPC:', npc.name)
    // TODO: Implement clone logic
  }

  const handleGenerateImage = async () => {
    if (!selectedNpc) return

    setIsGeneratingImage(true)
    try {
      // Construct prompt from NPC context
      const promptParts = [
        `Portrait of ${selectedNpc.name}`,
        selectedNpc.personality,
      ]
      if (selectedNpc.faction) {
        promptParts.push(`from the ${selectedNpc.faction} faction`)
      }
      const prompt = promptParts.join(', ')

      console.log('[NPCsPage] handleGenerateImage: Generating image', {
        npcId: selectedNpc.id,
        npcName: selectedNpc.name,
        promptLength: prompt.length,
      })

      // Call image generation endpoint
      const response = await apiFetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid',
          model: 'google/gemini-2.5-flash-image-preview', // Google Gemini multimodal image generation
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[NPCsPage] handleGenerateImage: Failed', error)
        alert('Failed to generate image. Please try again.')
        return
      }

      const data = await response.json()
      console.log('[NPCsPage] handleGenerateImage: Image generated', {
        imageUrl: data.imageUrl,
        cost: data.cost,
        costFormatted: data.costFormatted,
        revisedPrompt: data.revisedPrompt,
      })

      // Update NPC with the generated image
      const updateResponse = await apiFetch(`/api/npcs/${selectedNpc.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarUrl: data.imageUrl,
        }),
      })

      if (updateResponse.ok) {
        console.log('[NPCsPage] handleGenerateImage: NPC updated with new avatar')
        // Refresh the NPC list
        await fetchNpcs()
        // Update the selected NPC
        setSelectedNpc({
          ...selectedNpc,
          avatarUrl: data.imageUrl,
        })
      } else {
        console.error('[NPCsPage] handleGenerateImage: Failed to update NPC')
        alert('Image generated but failed to save to NPC. Please try again.')
      }
    } catch (error) {
      console.error('[NPCsPage] handleGenerateImage: Error', error)
      alert('Failed to generate image. Please try again.')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const getNpcBadges = (npc: NPC): Array<'featured' | 'template' | 'published' | 'draft'> => {
    const badges: Array<'featured' | 'template' | 'published' | 'draft'> = []
    if (npc.isFeatured) badges.push('featured')
    if (npc.isTemplate) badges.push('template')
    badges.push('published') // Default for now
    return badges
  }

  const renderOverviewTab = (npc: NPC): ReactNode => {
    return (
      <div className="space-y-6">
        {/* Personality */}
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
            Personality
          </h3>
          <p className="text-gray-300 leading-relaxed">{npc.personality}</p>
        </div>

        {/* Faction */}
        {npc.faction && (
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Faction
            </h3>
            <Badge variant="primary" size="md">
              {npc.faction}
            </Badge>
          </div>
        )}

        {/* Voice */}
        {npc.voiceId && (
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Voice Settings
            </h3>
            <p className="text-gray-300">Voice ID: <span className="text-blue-400 font-mono">{npc.voiceId}</span></p>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-700">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Created
            </h4>
            <p className="text-gray-300">{new Date(npc.createdAt).toLocaleString()}</p>
          </div>
          {npc.updatedAt && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Last Updated
              </h4>
              <p className="text-gray-300">{new Date(npc.updatedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderPlaceholderTab = (title: string): ReactNode => {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-2">{title} content coming soon...</p>
        <p className="text-gray-500 text-sm">This feature is under development</p>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Users size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">NPCs</h1>
                <p className="text-gray-400 mt-1">
                  Create and manage non-player characters
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
              <Badge variant="secondary">{npcs.length} NPCs</Badge>
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create NPC
              </Button>
            </div>
          </div>
        </div>

        {/* Faction Filters */}
        {factions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {factions.map((faction) => (
              <button
                key={faction}
                onClick={() => setSelectedFaction(faction)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedFaction === faction
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-gray-300 border border-slate-700 hover:border-blue-500'
                }`}
              >
                {faction === 'all' ? 'All' : faction}
                {getFactionCount(faction) > 0 && (
                  <span className="ml-2 opacity-70">({getFactionCount(faction)})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search NPCs by name or personality..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Featured NPCs Section */}
        {featuredNpcs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Featured NPCs</h2>
              <Badge variant="secondary">{featuredNpcs.length}</Badge>
            </div>
            <div className="relative">
              <div className="overflow-x-auto pb-4 -mx-2 px-2">
                <div className="flex gap-4 min-w-min">
                  {featuredNpcs.map((npc) => (
                    <div key={npc.id} className="w-[300px] flex-shrink-0">
                      <CharacterCard
                        id={npc.id}
                        name={npc.name}
                        description={npc.personality}
                        avatarUrl={npc.avatarUrl}
                        badges={getNpcBadges(npc)}
                        tags={npc.tags?.slice(0, 3) || (npc.faction ? [npc.faction] : [])}
                        stats={{
                          usageCount: npc.usageCount,
                        }}
                        onClick={() => handleViewNpc(npc)}
                        onClone={() => handleCloneNpc(npc)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NPCs Grid/List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading NPCs...</p>
          </div>
        ) : filteredNpcs.length === 0 ? (
          <Card className="p-12 text-center">
            <Users size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {npcs.length === 0 ? 'No NPCs Yet' : 'No Matching NPCs'}
            </h3>
            <p className="text-gray-400 mb-4">
              {npcs.length === 0
                ? 'Create your first NPC!'
                : searchQuery
                ? 'Try a different search term'
                : 'No NPCs in this faction'}
            </p>
            {npcs.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create NPC
              </Button>
            )}
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'grid grid-cols-1 gap-4'
            }
          >
            {filteredNpcs.map((npc) => (
              <CharacterCard
                key={npc.id}
                id={npc.id}
                name={npc.name}
                description={npc.personality}
                avatarUrl={npc.avatarUrl}
                badges={getNpcBadges(npc)}
                tags={npc.tags || (npc.faction ? [npc.faction] : [])}
                stats={{
                  usageCount: npc.usageCount,
                }}
                onClick={() => handleViewNpc(npc)}
                onClone={() => handleCloneNpc(npc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create NPC Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Create NPC" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            {/* AI Generation Section */}
            {!showAiGenerate ? (
              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} className="text-purple-400" />
                    <div>
                      <h4 className="text-sm font-medium text-white">Generate with AI</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Let AI create a complete NPC based on your description
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAiGenerate(true)}
                    className="gap-2"
                  >
                    <Sparkles size={16} />
                    Generate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-400" />
                  <h4 className="text-sm font-medium text-white">AI Generation</h4>
                </div>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the NPC you want to create... (e.g., 'A wise old wizard who guards ancient secrets')"
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAiGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="gap-2"
                  >
                    {isGenerating ? 'Generating...' : 'Generate NPC'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAiGenerate(false)
                      setAiPrompt('')
                    }}
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-gray-400 mb-4">Or create manually:</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Name</label>
                  <Input
                    type="text"
                    value={newNpc.name}
                    onChange={(e) => setNewNpc({ ...newNpc, name: e.target.value })}
                    placeholder="Enter NPC name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Personality</label>
                  <Textarea
                    value={newNpc.personality}
                    onChange={(e) => setNewNpc({ ...newNpc, personality: e.target.value })}
                    placeholder="Describe the NPC's personality, background, and traits..."
                    rows={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Faction (Optional)</label>
                  <Input
                    type="text"
                    value={newNpc.faction}
                    onChange={(e) => setNewNpc({ ...newNpc, faction: e.target.value })}
                    placeholder="e.g., Royal Guard, Merchant Guild"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Voice (Optional)</label>
                  <Input
                    type="text"
                    value={newNpc.voiceId}
                    onChange={(e) => setNewNpc({ ...newNpc, voiceId: e.target.value })}
                    placeholder="Voice ID or assignment"
                  />
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false)
              setNewNpc({ name: '', personality: '', faction: '', voiceId: '' })
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateNpc}
            disabled={isCreating || !newNpc.name.trim() || !newNpc.personality.trim()}
          >
            {isCreating ? 'Creating...' : 'Create NPC'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal */}
      {selectedNpc && (
        <DetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedNpc(null)
          }}
          entity={{
            id: selectedNpc.id,
            name: selectedNpc.name,
            type: 'npc',
            avatarUrl: selectedNpc.avatarUrl,
            description: selectedNpc.personality,
            badges: getNpcBadges(selectedNpc),
            overview: renderOverviewTab(selectedNpc),
            assets: selectedNpc.modelUrl ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    3D Model
                  </h3>
                  <p className="text-gray-300 break-all">{selectedNpc.modelUrl}</p>
                </div>
              </div>
            ) : (
              renderPlaceholderTab('Assets')
            ),
            lore: selectedNpc.relatedLore && selectedNpc.relatedLore.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                  Related Lore
                </h3>
                <ul className="space-y-2">
                  {selectedNpc.relatedLore.map((lore, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{lore}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              renderPlaceholderTab('Lore')
            ),
            quests: selectedNpc.quests && selectedNpc.quests.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                  Associated Quests
                </h3>
                <ul className="space-y-2">
                  {selectedNpc.quests.map((quest, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{quest}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              renderPlaceholderTab('Quests')
            ),
            locations: selectedNpc.locations && selectedNpc.locations.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                  Locations
                </h3>
                <ul className="space-y-2">
                  {selectedNpc.locations.map((location, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{location}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              renderPlaceholderTab('Locations')
            ),
          }}
          onEdit={() => {
            // TODO: Implement edit functionality
            console.log('Edit NPC:', selectedNpc.name)
          }}
          onDelete={() => {
            // TODO: Implement delete functionality
            console.log('Delete NPC:', selectedNpc.name)
          }}
          onClone={() => {
            handleCloneNpc(selectedNpc)
          }}
          onGenerateImage={handleGenerateImage}
          isGeneratingImage={isGeneratingImage}
        />
      )}
    </DashboardLayout>
  )
}
