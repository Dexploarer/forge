/**
 * Quests Page
 * Create and manage game quests
 */

import { Target, Plus, Search, Grid, List, CheckCircle, Users, MapPin, Scroll, Award, Sparkles } from 'lucide-react'
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
  CharacterCard,
  DetailModal,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface Quest {
  id: string
  name: string  // Backend uses 'name', not 'title'
  description: string
  questType?: string
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert'
  minLevel?: number
  maxLevel?: number | null
  status: 'draft' | 'active' | 'archived'
  repeatable?: boolean
  objectives?: any[]  // Array of objective objects
  rewards?: any
  requirements?: any
  startDialog?: string | null
  completeDialog?: string | null
  failDialog?: string | null
  questGiverNpcId?: string | null
  location?: string | null
  relatedNpcs?: string[]
  estimatedDuration?: number | null
  cooldownHours?: number
  tags?: string[]
  metadata?: any
  // Display fields (derived)
  avatarUrl?: string | null
  questGiver?: string
  participants?: string[]
  locations?: string[]
  relatedLore?: string[]
  isFeatured?: boolean
  createdAt: string
  updatedAt?: string
}

export default function QuestsPage() {
  const apiFetch = useApiFetch()
  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<Quest['status'] | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [newQuest, setNewQuest] = useState({
    title: '',
    description: '',
    objectives: '',
    rewards: '',
  })
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const statuses: Array<{ value: Quest['status'] | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ]

  useEffect(() => {
    console.log('[QuestsPage] Component mounted, fetching quests')
    fetchQuests()
  }, [])

  const fetchQuests = async () => {
    console.log('[QuestsPage] fetchQuests: Starting API call to /api/quests')
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/quests')
      console.log('[QuestsPage] fetchQuests: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[QuestsPage] fetchQuests: Response data structure', {
          hasQuests: !!data.quests,
          questsCount: data.quests?.length || 0,
          hasPagination: !!data.pagination,
          rawKeys: Object.keys(data),
        })

        const fetchedQuests = data.quests || []
        setQuests(fetchedQuests)
        console.log('[QuestsPage] fetchQuests: Set quests state with', fetchedQuests.length, 'quests')
      } else {
        const errorText = await response.text()
        console.error('[QuestsPage] fetchQuests: API error', {
          status: response.status,
          error: errorText,
        })
      }
    } catch (error) {
      console.error('[QuestsPage] fetchQuests: Exception caught', error)
    } finally {
      setIsLoading(false)
      console.log('[QuestsPage] fetchQuests: Completed')
    }
  }

  const handleCreateQuest = async () => {
    if (!newQuest.title.trim() || !newQuest.description.trim()) {
      console.warn('[QuestsPage] handleCreateQuest: Validation failed - missing title or description')
      return
    }

    setIsCreating(true)
    try {
      // Convert objectives string to array of objective objects
      const objectivesArray = newQuest.objectives
        .split('\n')
        .map(o => o.trim())
        .filter(Boolean)
        .map((desc, idx) => ({
          id: `obj${idx + 1}`,
          type: 'custom',
          description: desc,
        }))

      // Build request payload
      const payload: any = {
        name: newQuest.title,  // Backend expects 'name'
        description: newQuest.description,
        questType: 'side',
        difficulty: 'medium',
        status: 'draft',
      }

      // Only include objectives if user provided any
      if (objectivesArray.length > 0) {
        payload.objectives = objectivesArray
      } else {
        // Provide a default objective if none specified
        payload.objectives = [{
          id: 'obj1',
          type: 'main',
          description: 'Complete the quest',
        }]
      }

      // Only include rewards if user provided any
      if (newQuest.rewards.trim()) {
        payload.rewards = {
          gold: 100,
          experience: 250,
        }
      }

      console.log('[QuestsPage] handleCreateQuest: Starting quest creation', {
        name: payload.name.substring(0, 50) + '...',
        descriptionLength: payload.description.length,
        objectivesCount: payload.objectives.length,
        hasRewards: !!payload.rewards,
      })

      const response = await apiFetch('/api/quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[QuestsPage] handleCreateQuest: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[QuestsPage] handleCreateQuest: Quest created successfully', {
          questId: data.quest?.id,
        })

        await fetchQuests()
        setShowCreateModal(false)
        setNewQuest({ title: '', description: '', objectives: '', rewards: '' })
        console.log('[QuestsPage] handleCreateQuest: Modal closed, form reset')
      } else {
        const errorText = await response.text()
        console.error('[QuestsPage] handleCreateQuest: API error', {
          status: response.status,
          error: errorText,
        })
        alert(`Failed to create quest: ${errorText}`)
      }
    } catch (error) {
      console.error('[QuestsPage] handleCreateQuest: Exception caught', error)
      alert('Failed to create quest. Please try again.')
    } finally {
      setIsCreating(false)
      console.log('[QuestsPage] handleCreateQuest: Completed')
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      console.warn('[QuestsPage] handleAiGenerate: Empty prompt')
      return
    }

    const payload = {
      prompt: aiPrompt,
      questType: 'side',
      difficulty: 'medium',
      useContext: false,
      contextLimit: 5,
    }

    console.log('[QuestsPage] handleAiGenerate: Starting AI generation', {
      promptLength: aiPrompt.length,
    })

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/quests/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[QuestsPage] handleAiGenerate: Received response', {
        status: response.status,
        ok: response.ok,
      })

      if (response.ok) {
        const data = await response.json()
        const quest = data.quest

        console.log('[QuestsPage] handleAiGenerate: AI generated quest', {
          hasName: !!quest.name,
          hasDescription: !!quest.description,
          objectivesCount: quest.objectives?.length || 0,
          hasRewards: !!quest.rewards,
        })

        // Format objectives as newline-separated string
        const objectivesText = quest.objectives
          ?.map((obj: any) => obj.description || obj)
          .join('\n') || ''

        // Format rewards
        const rewardsText = []
        if (quest.rewards?.experience) rewardsText.push(`${quest.rewards.experience} XP`)
        if (quest.rewards?.gold) rewardsText.push(`${quest.rewards.gold} gold`)
        if (quest.rewards?.items?.length) {
          quest.rewards.items.forEach((item: any) => {
            rewardsText.push(`${item.name} x${item.quantity}`)
          })
        }

        // Populate form with generated data
        setNewQuest({
          title: quest.name || '',
          description: quest.description || '',
          objectives: objectivesText,
          rewards: rewardsText.join(', '),
        })

        setShowAiGenerate(false)
        setAiPrompt('')
        console.log('[QuestsPage] handleAiGenerate: Form populated with AI-generated data')
      } else {
        const error = await response.text()
        console.error('[QuestsPage] handleAiGenerate: API error', {
          status: response.status,
          error,
        })
        alert('AI generation failed. Please try again.')
      }
    } catch (error) {
      console.error('[QuestsPage] handleAiGenerate: Exception caught', error)
      alert('Failed to generate quest. Please try again.')
    } finally {
      setIsGenerating(false)
      console.log('[QuestsPage] handleAiGenerate: Completed')
    }
  }

  const filteredQuests = quests.filter((quest) => {
    const matchesStatus = selectedStatus === 'all' || quest.status === selectedStatus
    const matchesSearch =
      !searchQuery ||
      quest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quest.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusCount = (status: Quest['status'] | 'all') => {
    if (status === 'all') return quests.length
    return quests.filter((quest) => quest.status === status).length
  }

  const getStatusVariant = (status: Quest['status']): 'success' | 'warning' | 'secondary' => {
    switch (status) {
      case 'active':
        return 'success'
      case 'archived':
        return 'secondary'
      case 'draft':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  const getQuestBadges = (quest: Quest): Array<'featured' | 'draft'> => {
    const badges: Array<'featured' | 'draft'> = []
    if (quest.isFeatured) badges.push('featured')
    if (quest.status === 'draft') badges.push('draft')
    return badges
  }

  const getQuestTags = (quest: Quest): string[] => {
    const tags: string[] = []

    // Add custom tags
    if (quest.tags) tags.push(...quest.tags)

    // Add difficulty
    if (quest.difficulty) {
      tags.push(quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1))
    }

    // Add location if available
    if (quest.locations && quest.locations.length > 0) {
      tags.push(quest.locations[0])
    }

    return tags
  }

  const getDifficultyBadge = (difficulty?: string): { label: string; variant: 'success' | 'warning' | 'secondary' | 'error' } | null => {
    if (!difficulty) return null

    switch (difficulty) {
      case 'easy':
        return { label: 'Easy', variant: 'success' }
      case 'medium':
        return { label: 'Medium', variant: 'warning' }
      case 'hard':
        return { label: 'Hard', variant: 'secondary' }
      case 'epic':
        return { label: 'Epic', variant: 'error' }
      default:
        return null
    }
  }

  const handleQuestClick = (quest: Quest) => {
    setSelectedQuest(quest)
    setShowDetailModal(true)
  }

  const handleGenerateImage = async () => {
    if (!selectedQuest) return

    setIsGeneratingImage(true)
    try {
      // Construct prompt from quest context
      const promptParts = [
        `Fantasy game quest illustration for "${selectedQuest.name}"`,
        selectedQuest.description.substring(0, 200), // Limit description length
      ]
      if (selectedQuest.questType) {
        promptParts.push(`quest type: ${selectedQuest.questType}`)
      }
      const prompt = promptParts.join(', ')

      console.log('[QuestsPage] handleGenerateImage: Generating image', {
        questId: selectedQuest.id,
        questName: selectedQuest.name,
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
          entityType: 'quest',
          entityId: selectedQuest.id,
          entityName: selectedQuest.name,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[QuestsPage] handleGenerateImage: Failed', error)
        alert('Failed to generate image. Please try again.')
        return
      }

      const data = await response.json()
      console.log('[QuestsPage] handleGenerateImage: Image generated', {
        imageUrl: data.imageUrl,
        cost: data.cost,
        costFormatted: data.costFormatted,
        revisedPrompt: data.revisedPrompt,
      })

      // Update quest with the generated image
      const updateResponse = await apiFetch(`/api/quests/${selectedQuest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarUrl: data.imageUrl,
        }),
      })

      if (updateResponse.ok) {
        console.log('[QuestsPage] handleGenerateImage: Quest updated with new avatar')
        // Refresh the quest list
        await fetchQuests()
        // Update the selected quest
        setSelectedQuest({
          ...selectedQuest,
          avatarUrl: data.imageUrl,
        })
      } else {
        console.error('[QuestsPage] handleGenerateImage: Failed to update quest')
        alert('Image generated but failed to save to quest. Please try again.')
      }
    } catch (error) {
      console.error('[QuestsPage] handleGenerateImage: Error', error)
      alert('Failed to generate image. Please try again.')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleDeleteQuest = async () => {
    if (!selectedQuest) return

    const confirmed = window.confirm(
      `Are you sure you want to delete quest "${selectedQuest.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/quests/${selectedQuest.id}`, {
        method: 'DELETE',
      })

      if (response.ok || response.status === 204) {
        // Remove from list
        setQuests(quests.filter((quest) => quest.id !== selectedQuest.id))
        // Close modal
        setShowDetailModal(false)
        setSelectedQuest(null)
      } else {
        const error = await response.text()
        console.error('Failed to delete quest:', error)
        alert(`Failed to delete quest: ${error}`)
      }
    } catch (error) {
      console.error('Failed to delete quest:', error)
      alert('Failed to delete quest. Please try again.')
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
                <Target size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Quests</h1>
                <p className="text-gray-400 mt-1">
                  Create and manage game quests
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
              <Badge variant="secondary">{quests.length} quests</Badge>
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create Quest
              </Button>
            </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setSelectedStatus(status.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === status.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-gray-300 border border-slate-700 hover:border-blue-500'
              }`}
            >
              {status.label}
              {getStatusCount(status.value) > 0 && (
                <span className="ml-2 opacity-70">({getStatusCount(status.value)})</span>
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
              placeholder="Search quests by title or description..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Quests Grid/List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading quests...</p>
          </div>
        ) : filteredQuests.length === 0 ? (
          <Card className="p-12 text-center">
            <Target size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {quests.length === 0 ? 'No Quests Yet' : 'No Matching Quests'}
            </h3>
            <p className="text-gray-400 mb-4">
              {quests.length === 0
                ? 'Create your first quest!'
                : searchQuery
                ? 'Try a different search term'
                : 'No quests with this status'}
            </p>
            {quests.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Create Quest
              </Button>
            )}
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {filteredQuests.map((quest) => (
              <CharacterCard
                key={quest.id}
                id={quest.id}
                name={quest.name}
                description={quest.description}
                avatarUrl={quest.avatarUrl}
                handle={quest.questGiver ? `@${quest.questGiver}` : undefined}
                badges={getQuestBadges(quest)}
                tags={getQuestTags(quest)}
                onClick={() => handleQuestClick(quest)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Quest Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Create Quest" onClose={() => setShowCreateModal(false)} />
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
                        Let AI create an engaging quest with objectives and rewards
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
                  placeholder="Describe the quest you want to create... (e.g., 'A quest to retrieve a stolen magical artifact from a bandit camp')"
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
                    {isGenerating ? 'Generating...' : 'Generate Quest'}
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
                    value={newQuest.title}
                    onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                    placeholder="Enter quest title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Description</label>
                  <Textarea
                    value={newQuest.description}
                    onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                    placeholder="Describe the quest story and context..."
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Objectives (one per line)
                  </label>
                  <Textarea
                    value={newQuest.objectives}
                    onChange={(e) => setNewQuest({ ...newQuest, objectives: e.target.value })}
                    placeholder="Find the ancient artifact&#10;Defeat the guardian&#10;Return to the quest giver"
                    rows={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Rewards</label>
                  <Input
                    type="text"
                    value={newQuest.rewards}
                    onChange={(e) => setNewQuest({ ...newQuest, rewards: e.target.value })}
                    placeholder="e.g., 500 gold, Legendary Sword, +10 reputation"
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
              setNewQuest({ title: '', description: '', objectives: '', rewards: '' })
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateQuest}
            disabled={isCreating || !newQuest.title.trim() || !newQuest.description.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Quest'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Quest Detail Modal */}
      {selectedQuest && (
        <DetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedQuest(null)
          }}
          onDelete={handleDeleteQuest}
          entity={{
            id: selectedQuest.id,
            name: selectedQuest.name,
            type: 'quest',
            avatarUrl: selectedQuest.avatarUrl,
            description: selectedQuest.description,
            badges: getQuestBadges(selectedQuest),
            overview: (
              <div className="space-y-6">
                {/* Status and Difficulty */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant={getStatusVariant(selectedQuest.status)} size="md">
                    <CheckCircle size={14} className="mr-1.5" />
                    {selectedQuest.status.charAt(0).toUpperCase() + selectedQuest.status.slice(1)}
                  </Badge>
                  {selectedQuest.difficulty && (
                    <Badge variant={getDifficultyBadge(selectedQuest.difficulty)?.variant || 'secondary'} size="md">
                      <Target size={14} className="mr-1.5" />
                      {getDifficultyBadge(selectedQuest.difficulty)?.label}
                    </Badge>
                  )}
                </div>

                {/* Quest Giver */}
                {selectedQuest.questGiver && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Users size={18} />
                      Quest Giver
                    </h3>
                    <p className="text-gray-300">{selectedQuest.questGiver}</p>
                  </div>
                )}

                {/* Objectives */}
                {selectedQuest.objectives && selectedQuest.objectives.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <CheckCircle size={18} />
                      Objectives
                    </h3>
                    <ul className="space-y-2">
                      {selectedQuest.objectives.map((objective: any, index: number) => (
                        <li key={index} className="flex items-start gap-3 text-gray-300">
                          <span className="text-blue-400 font-semibold mt-0.5">{index + 1}.</span>
                          <span>{typeof objective === 'string' ? objective : objective.description || objective.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rewards */}
                {selectedQuest.rewards && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Award size={18} />
                      Rewards
                    </h3>
                    <div className="text-gray-300">
                      {typeof selectedQuest.rewards === 'string' ? (
                        <p>{selectedQuest.rewards}</p>
                      ) : (
                        <div className="space-y-1">
                          {selectedQuest.rewards.experience && (
                            <p>• {selectedQuest.rewards.experience} XP</p>
                          )}
                          {selectedQuest.rewards.gold && (
                            <p>• {selectedQuest.rewards.gold} Gold</p>
                          )}
                          {selectedQuest.rewards.items?.map((item: any, idx: number) => (
                            <p key={idx}>• {item.name} x{item.quantity}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-slate-700 pt-4 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Created:</span>
                    <span className="text-gray-300">
                      {new Date(selectedQuest.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedQuest.updatedAt && (
                    <div className="flex justify-between text-gray-400">
                      <span>Updated:</span>
                      <span className="text-gray-300">
                        {new Date(selectedQuest.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ),
            quests: selectedQuest.participants && selectedQuest.participants.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Users size={18} />
                  NPCs Involved
                </h3>
                {selectedQuest.questGiver && (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Users size={20} className="text-purple-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{selectedQuest.questGiver}</div>
                        <div className="text-sm text-gray-400">Quest Giver</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedQuest.participants.map((participant, index) => (
                  <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Users size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{participant}</div>
                        <div className="text-sm text-gray-400">Participant</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Users size={48} className="mx-auto mb-3 opacity-30" />
                <p>No NPC participants defined for this quest.</p>
              </div>
            ),
            locations: selectedQuest.locations && selectedQuest.locations.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <MapPin size={18} />
                  Quest Locations
                </h3>
                <div className="grid gap-3">
                  {selectedQuest.locations.map((location, index) => (
                    <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <MapPin size={20} className="text-green-400" />
                        <span className="text-white font-medium">{location}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <MapPin size={48} className="mx-auto mb-3 opacity-30" />
                <p>No locations defined for this quest.</p>
              </div>
            ),
            lore: selectedQuest.relatedLore && selectedQuest.relatedLore.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Scroll size={18} />
                  Related Lore
                </h3>
                <div className="grid gap-3">
                  {selectedQuest.relatedLore.map((loreId, index) => (
                    <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <Scroll size={20} className="text-amber-400" />
                        <span className="text-white font-medium">Lore Entry: {loreId}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-400 italic">
                  Click on a lore entry to view its full content.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Scroll size={48} className="mx-auto mb-3 opacity-30" />
                <p>No related lore entries for this quest.</p>
              </div>
            ),
          }}
          onGenerateImage={handleGenerateImage}
          isGeneratingImage={isGeneratingImage}
        />
      )}
    </DashboardLayout>
  )
}
