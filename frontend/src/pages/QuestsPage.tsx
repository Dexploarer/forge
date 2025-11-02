/**
 * Quests Page
 * Create and manage game quests
 */

import { Target, Plus, Search, Grid, List } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Textarea,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface Quest {
  id: string
  title: string
  description: string
  objectives: string[]
  rewards: string
  status: 'active' | 'completed' | 'draft'
  createdAt: string
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
  const [newQuest, setNewQuest] = useState({
    title: '',
    description: '',
    objectives: '',
    rewards: '',
  })

  const statuses: Array<{ value: Quest['status'] | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ]

  useEffect(() => {
    fetchQuests()
  }, [])

  const fetchQuests = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/quests')
      if (response.ok) {
        const data = await response.json()
        setQuests(data.quests || [])
      }
    } catch (error) {
      console.error('Failed to fetch quests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateQuest = async () => {
    if (!newQuest.title.trim() || !newQuest.description.trim()) return

    setIsCreating(true)
    try {
      const response = await apiFetch('/api/quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newQuest.title,
          description: newQuest.description,
          objectives: newQuest.objectives.split('\n').map(o => o.trim()).filter(Boolean),
          rewards: newQuest.rewards,
          status: 'draft',
        }),
      })

      if (response.ok) {
        await fetchQuests()
        setShowCreateModal(false)
        setNewQuest({ title: '', description: '', objectives: '', rewards: '' })
      }
    } catch (error) {
      console.error('Failed to create quest:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const filteredQuests = quests.filter((quest) => {
    const matchesStatus = selectedStatus === 'all' || quest.status === selectedStatus
    const matchesSearch =
      !searchQuery ||
      quest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      case 'completed':
        return 'secondary'
      case 'draft':
        return 'warning'
      default:
        return 'secondary'
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
              <Card key={quest.id} variant="hover">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <CardTitle>{quest.title}</CardTitle>
                    <Badge variant={getStatusVariant(quest.status)}>
                      {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{quest.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">
                      Objectives: <span className="text-gray-300">{quest.objectives.length}</span>
                    </div>
                    {quest.rewards && (
                      <div className="text-sm text-gray-400">
                        Rewards: <span className="text-gray-300">{quest.rewards}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Created: {new Date(quest.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Quest Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Create Quest" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Title</label>
              <Input
                type="text"
                value={newQuest.title}
                onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                placeholder="Enter quest title"
                autoFocus
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
    </DashboardLayout>
  )
}
