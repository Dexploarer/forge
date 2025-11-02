/**
 * Lore Page
 * Create and manage world lore with AI assistance
 */

import { BookOpen, Plus, Download, Search, Sparkles } from 'lucide-react'
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

interface LoreEntry {
  id: string
  title: string
  content: string
  category: 'history' | 'faction' | 'character' | 'location' | 'artifact' | 'event'
  tags: string[]
  createdAt: string
}

export default function LorePage() {
  const apiFetch = useApiFetch()
  const [lore, setLore] = useState<LoreEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<LoreEntry['category'] | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newLore, setNewLore] = useState({
    title: '',
    content: '',
    category: 'history' as LoreEntry['category'],
    tags: '',
  })

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
    fetchLore()
  }, [])

  const fetchLore = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/lore')
      if (response.ok) {
        const data = await response.json()
        setLore(data.lore || [])
      }
    } catch (error) {
      console.error('Failed to fetch lore:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateLore = async () => {
    if (!newLore.title.trim() || !newLore.content.trim()) return

    setIsCreating(true)
    try {
      const response = await apiFetch('/api/lore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newLore.title,
          content: newLore.content,
          category: newLore.category,
          tags: newLore.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        await fetchLore()
        setShowCreateModal(false)
        setNewLore({ title: '', content: '', category: 'history', tags: '' })
      }
    } catch (error) {
      console.error('Failed to create lore:', error)
    } finally {
      setIsCreating(false)
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
          <div className="space-y-4">
            {filteredLore.map((entry) => (
              <Card key={entry.id} variant="hover">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <CardTitle>{entry.title}</CardTitle>
                    <Badge variant="secondary">{entry.category}</Badge>
                  </div>
                  <CardDescription className="whitespace-pre-line">{entry.content}</CardDescription>
                </CardHeader>
                {entry.tags && entry.tags.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
                <CardContent className="pt-0">
                  <div className="text-xs text-gray-500">
                    Created: {new Date(entry.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Lore Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Create Lore Entry" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Title</label>
              <Input
                type="text"
                value={newLore.title}
                onChange={(e) => setNewLore({ ...newLore, title: e.target.value })}
                placeholder="Enter lore title"
                autoFocus
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
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-1">AI Generation</h4>
                  <p className="text-xs text-gray-400">
                    Generate lore content with AI using the /api/ai-gateway endpoint
                  </p>
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
