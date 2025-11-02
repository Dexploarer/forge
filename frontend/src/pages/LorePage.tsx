/**
 * Lore Page
 * Create and manage world lore with AI assistance
 */

import { BookOpen, Plus, Download, Search, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
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
import { CharacterCard } from '../components/common/CharacterCard'
import { DetailModal } from '../components/common/DetailModal'
import { useApiFetch } from '../utils/api'

interface LoreEntry {
  id: string
  title: string
  content: string
  category: 'history' | 'faction' | 'character' | 'location' | 'artifact' | 'event'
  tags: string[]
  createdAt: string
  updatedAt?: string
  isFeatured?: boolean
  relatedNpcs?: string[]
  relatedQuests?: string[]
  relatedLocations?: string[]
}

export default function LorePage() {
  const apiFetch = useApiFetch()
  const [lore, setLore] = useState<LoreEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<LoreEntry['category'] | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedLore, setSelectedLore] = useState<LoreEntry | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [newLore, setNewLore] = useState({
    title: '',
    content: '',
    category: 'history' as LoreEntry['category'],
    tags: '',
  })
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const categories: Array<{ value: LoreEntry['category'] | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'history', label: 'History' },
    { value: 'faction', label: 'Faction' },
    { value: 'character', label: 'Character' },
    { value: 'location', label: 'Location' },
    { value: 'artifact', label: 'Artifact' },
    { value: 'event', label: 'Event' },
  ]

  useEffect(() => {
    console.log('[LorePage] Component mounted, fetching lore entries')
    fetchLore()
  }, [])

  const fetchLore = async () => {
    console.log('[LorePage] fetchLore: Starting API call to /api/lore')
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/lore')
      console.log('[LorePage] fetchLore: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[LorePage] fetchLore: Response data structure', {
          hasLoreEntries: !!data.loreEntries,
          loreEntriesCount: data.loreEntries?.length || 0,
          hasPagination: !!data.pagination,
          rawKeys: Object.keys(data),
        })

        const entries = data.loreEntries || []
        setLore(entries)
        console.log('[LorePage] fetchLore: Set lore state with', entries.length, 'entries')
      } else {
        const errorText = await response.text()
        console.error('[LorePage] fetchLore: API error', {
          status: response.status,
          error: errorText,
        })
      }
    } catch (error) {
      console.error('[LorePage] fetchLore: Exception caught', error)
    } finally {
      setIsLoading(false)
      console.log('[LorePage] fetchLore: Completed')
    }
  }

  const handleCreateLore = async () => {
    if (!newLore.title.trim() || !newLore.content.trim()) {
      console.warn('[LorePage] handleCreateLore: Validation failed - missing title or content')
      return
    }

    const payload = {
      title: newLore.title,
      content: newLore.content,
      category: newLore.category,
      tags: newLore.tags.split(',').map(t => t.trim()).filter(Boolean),
    }

    console.log('[LorePage] handleCreateLore: Starting lore creation', {
      title: payload.title.substring(0, 50) + '...',
      contentLength: payload.content.length,
      category: payload.category,
      tagsCount: payload.tags.length,
    })

    setIsCreating(true)
    try {
      const response = await apiFetch('/api/lore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[LorePage] handleCreateLore: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[LorePage] handleCreateLore: Lore created successfully', {
          loreId: data.lore?.id,
        })

        await fetchLore()
        setShowCreateModal(false)
        setNewLore({ title: '', content: '', category: 'history', tags: '' })
        console.log('[LorePage] handleCreateLore: Modal closed, form reset')
      } else {
        const errorText = await response.text()
        console.error('[LorePage] handleCreateLore: API error', {
          status: response.status,
          error: errorText,
        })
        alert(`Failed to create lore: ${errorText}`)
      }
    } catch (error) {
      console.error('[LorePage] handleCreateLore: Exception caught', error)
      alert('Failed to create lore. Please try again.')
    } finally {
      setIsCreating(false)
      console.log('[LorePage] handleCreateLore: Completed')
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      console.warn('[LorePage] handleAiGenerate: Empty prompt')
      return
    }

    const payload = {
      prompt: aiPrompt,
      category: newLore.category,
      useContext: false,
      contextLimit: 5,
    }

    console.log('[LorePage] handleAiGenerate: Starting AI generation', {
      promptLength: aiPrompt.length,
      category: newLore.category,
    })

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/lore/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[LorePage] handleAiGenerate: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        const loreEntry = data.lore

        console.log('[LorePage] handleAiGenerate: AI generated lore', {
          hasTitle: !!loreEntry.title,
          hasContent: !!loreEntry.content,
          contentLength: loreEntry.content?.length || 0,
          category: loreEntry.category,
          tagsCount: loreEntry.tags?.length || 0,
        })

        // Populate form with generated data
        setNewLore({
          title: loreEntry.title || '',
          content: loreEntry.content || '',
          category: loreEntry.category || newLore.category,
          tags: loreEntry.tags?.join(', ') || '',
        })

        setShowAiGenerate(false)
        setAiPrompt('')
        console.log('[LorePage] handleAiGenerate: Form populated with AI-generated data')
      } else {
        const error = await response.text()
        console.error('[LorePage] handleAiGenerate: API error', {
          status: response.status,
          error,
        })
        alert('AI generation failed. Please try again.')
      }
    } catch (error) {
      console.error('[LorePage] handleAiGenerate: Exception caught', error)
      alert('Failed to generate lore. Please try again.')
    } finally {
      setIsGenerating(false)
      console.log('[LorePage] handleAiGenerate: Completed')
    }
  }

  const handleExportLore = () => {
    const dataStr = JSON.stringify(lore, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    const exportFileDefaultName = `lore-${Date.now()}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const filteredLore = lore.filter((entry) => {
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getCategoryCount = (category: LoreEntry['category'] | 'all') => {
    if (category === 'all') return lore.length
    return lore.filter((entry) => entry.category === category).length
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleLoreClick = (entry: LoreEntry) => {
    setSelectedLore(entry)
    setShowDetailModal(true)
  }

  const handleGenerateImage = async () => {
    if (!selectedLore) return

    setIsGeneratingImage(true)
    try {
      // Construct prompt from lore context
      const promptParts = [
        `Fantasy lore illustration for "${selectedLore.title}"`,
        selectedLore.content.substring(0, 200), // Limit content length
        `category: ${selectedLore.category}`,
      ]
      const prompt = promptParts.join(', ')

      console.log('[LorePage] handleGenerateImage: Generating image', {
        loreId: selectedLore.id,
        loreTitle: selectedLore.title,
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
        console.error('[LorePage] handleGenerateImage: Failed', error)
        alert('Failed to generate image. Please try again.')
        return
      }

      const data = await response.json()
      console.log('[LorePage] handleGenerateImage: Image generated', {
        imageUrl: data.imageUrl,
        cost: data.cost,
        costFormatted: data.costFormatted,
        revisedPrompt: data.revisedPrompt,
      })

      // Update lore with the generated image
      const updateResponse = await apiFetch(`/api/lore/${selectedLore.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarUrl: data.imageUrl,
        }),
      })

      if (updateResponse.ok) {
        console.log('[LorePage] handleGenerateImage: Lore updated with new avatar')
        // Refresh the lore list
        await fetchLore()
        // Update the selected lore
        setSelectedLore({
          ...selectedLore,
          // @ts-ignore - avatarUrl is not in the interface but backend supports it
          avatarUrl: data.imageUrl,
        })
      } else {
        console.error('[LorePage] handleGenerateImage: Failed to update lore')
        alert('Image generated but failed to save to lore. Please try again.')
      }
    } catch (error) {
      console.error('[LorePage] handleGenerateImage: Error', error)
      alert('Failed to generate image. Please try again.')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <BookOpen size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Lore</h1>
                <p className="text-gray-400 mt-1">
                  Create and manage world lore with AI assistance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{lore.length} entries</Badge>
              {lore.length > 0 && (
                <Button onClick={handleExportLore} size="sm" variant="secondary" className="gap-2">
                  <Download size={16} />
                  Export All
                </Button>
              )}
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create Lore
              </Button>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-gray-300 border border-slate-700 hover:border-blue-500'
              }`}
            >
              {cat.label}
              {getCategoryCount(cat.value) > 0 && (
                <span className="ml-2 opacity-70">({getCategoryCount(cat.value)})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lore entries..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Lore Entries */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading lore...</p>
          </div>
        ) : filteredLore.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {lore.length === 0 ? 'No Lore Entries' : 'No Matching Lore'}
            </h3>
            <p className="text-gray-400 mb-4">
              {lore.length === 0
                ? 'Create your first lore entry to start building your world'
                : searchQuery
                ? 'Try a different search term'
                : 'No lore entries in this category'}
            </p>
            {lore.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create Lore Entry
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLore.map((entry) => (
              <CharacterCard
                key={entry.id}
                id={entry.id}
                name={entry.title}
                description={entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '')}
                avatarUrl={null}
                badges={[
                  ...(entry.isFeatured ? ['featured' as const] : []),
                ]}
                tags={[
                  entry.category,
                  ...(entry.tags || []),
                ].slice(0, 3)}
                onClick={() => handleLoreClick(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLore && (
        <DetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          entity={{
            id: selectedLore.id,
            name: selectedLore.title,
            type: 'lore',
            avatarUrl: null,
            description: selectedLore.content.substring(0, 200) + (selectedLore.content.length > 200 ? '...' : ''),
            badges: [
              ...(selectedLore.isFeatured ? ['featured' as const] : []),
            ],
            overview: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Category</h3>
                  <Badge variant="secondary" size="md">{selectedLore.category}</Badge>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Content</h3>
                  <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                    {selectedLore.content}
                  </p>
                </div>
                {selectedLore.tags && selectedLore.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedLore.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" size="md">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Dates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Created</p>
                      <p className="text-white">{formatDate(selectedLore.createdAt)}</p>
                    </div>
                    {selectedLore.updatedAt && (
                      <div>
                        <p className="text-sm text-gray-400">Updated</p>
                        <p className="text-white">{formatDate(selectedLore.updatedAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
            assets: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Related NPCs</h3>
                {selectedLore.relatedNpcs && selectedLore.relatedNpcs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLore.relatedNpcs.map((npc, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-gray-300">{npc}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    No NPCs are currently associated with this lore entry. This feature will automatically track NPCs that reference this lore.
                  </p>
                )}
              </div>
            ),
            quests: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Related Quests</h3>
                {selectedLore.relatedQuests && selectedLore.relatedQuests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLore.relatedQuests.map((quest, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-gray-300">{quest}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    No quests are currently associated with this lore entry. This feature will automatically track quests that reference this lore.
                  </p>
                )}
              </div>
            ),
            locations: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Related Locations</h3>
                {selectedLore.relatedLocations && selectedLore.relatedLocations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLore.relatedLocations.map((location, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-gray-300">{location}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    No locations are currently mentioned in this lore entry. This feature will automatically track locations referenced in the content.
                  </p>
                )}
              </div>
            ),
          }}
          onGenerateImage={handleGenerateImage}
          isGeneratingImage={isGeneratingImage}
        />
      )}


      {/* Create Lore Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Create Lore Entry" onClose={() => setShowCreateModal(false)} />
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
                        Let AI create immersive lore based on your description
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
                  placeholder="Describe the lore you want to create... (e.g., 'The ancient war between dragons and the first kingdoms')"
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
                    {isGenerating ? 'Generating...' : 'Generate Lore'}
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
                  <label className="block text-sm font-medium text-white mb-2">Title</label>
                  <Input
                    type="text"
                    value={newLore.title}
                    onChange={(e) => setNewLore({ ...newLore, title: e.target.value })}
                    placeholder="Enter lore title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {categories
                      .filter((cat) => cat.value !== 'all')
                      .map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() =>
                            setNewLore({ ...newLore, category: cat.value as LoreEntry['category'] })
                          }
                          className={`px-3 py-2 rounded-lg text-sm transition-all ${
                            newLore.category === cat.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-gray-300 border border-slate-700 hover:border-blue-500'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Content</label>
                  <Textarea
                    value={newLore.content}
                    onChange={(e) => setNewLore({ ...newLore, content: e.target.value })}
                    placeholder="Write your lore content..."
                    rows={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Tags (comma-separated)
                  </label>
                  <Input
                    type="text"
                    value={newLore.tags}
                    onChange={(e) => setNewLore({ ...newLore, tags: e.target.value })}
                    placeholder="ancient, magical, legendary"
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
              setNewLore({ title: '', content: '', category: 'history', tags: '' })
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateLore}
            disabled={isCreating || !newLore.title.trim() || !newLore.content.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Lore Entry'}
          </Button>
        </ModalFooter>
      </Modal>
    </DashboardLayout>
  )
}
