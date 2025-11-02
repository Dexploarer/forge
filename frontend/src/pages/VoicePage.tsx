/**
 * Voice Page
 * Generate and manage character voices with ElevenLabs
 */

import { Mic, Plus, Search, Grid, List } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface VoiceSample {
  id: string
  voiceName: string
  npcId: string | null
  npcName?: string
  text: string
  audioUrl: string | null
  createdAt: string
}

interface NPC {
  id: string
  name: string
}

export default function VoicePage() {
  const apiFetch = useApiFetch()
  const [voices, setVoices] = useState<VoiceSample[]>([])
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newVoice, setNewVoice] = useState({
    voiceName: '',
    npcId: '',
    text: '',
  })

  useEffect(() => {
    fetchVoices()
    fetchNpcs()
  }, [])

  const fetchVoices = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/voice')
      if (response.ok) {
        const data = await response.json()
        setVoices(data.voices || [])
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNpcs = async () => {
    try {
      const response = await apiFetch('/api/npcs')
      if (response.ok) {
        const data = await response.json()
        setNpcs(data.npcs || [])
      }
    } catch (error) {
      console.error('Failed to fetch NPCs:', error)
    }
  }

  const handleCreateVoice = async () => {
    if (!newVoice.voiceName.trim() || !newVoice.text.trim()) return

    setIsCreating(true)
    try {
      const response = await apiFetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceName: newVoice.voiceName,
          npcId: newVoice.npcId || null,
          text: newVoice.text,
        }),
      })

      if (response.ok) {
        await fetchVoices()
        setShowCreateModal(false)
        setNewVoice({ voiceName: '', npcId: '', text: '' })
      }
    } catch (error) {
      console.error('Failed to create voice:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch =
      !searchQuery ||
      voice.voiceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (voice.npcName && voice.npcName.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Mic size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Voice Generation</h1>
                <p className="text-gray-400 mt-1">
                  Generate and manage character voices with ElevenLabs
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
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Generate Voice
              </Button>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voices..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Voice Samples Grid/List */}
        {isLoading && voices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading voices...</p>
          </div>
        ) : filteredVoices.length === 0 ? (
          <Card className="p-12 text-center">
            <Mic size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {voices.length === 0 ? 'No voice samples yet' : 'No matching voices'}
            </h3>
            <p className="text-gray-400 mb-4">
              {voices.length === 0
                ? 'Generate your first voice sample to get started!'
                : 'Try adjusting your search'}
            </p>
            {voices.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={18} />
                Generate Voice
              </Button>
            )}
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
          >
            {filteredVoices.map((voice) => (
              <Card key={voice.id} variant="hover" className="group">
                {viewMode === 'grid' ? (
                  <>
                    {/* Grid View */}
                    <div className="aspect-square bg-slate-900 rounded-t-lg overflow-hidden border-b border-slate-700 flex items-center justify-center">
                      <Mic size={48} className="text-purple-400" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-base truncate">{voice.voiceName}</CardTitle>
                      <CardDescription className="truncate">
                        {voice.npcName ? `NPC: ${voice.npcName}` : 'No NPC assigned'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-400 line-clamp-2">{voice.text}</p>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{formatDate(voice.createdAt)}</span>
                      {voice.audioUrl && (
                        <Badge variant="success" size="sm">
                          Audio
                        </Badge>
                      )}
                    </CardFooter>
                  </>
                ) : (
                  <>
                    {/* List View */}
                    <CardContent className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                        <Mic size={24} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{voice.voiceName}</h3>
                        <p className="text-sm text-gray-400 truncate">
                          {voice.npcName ? `NPC: ${voice.npcName}` : 'No NPC assigned'}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-1">{voice.text}</p>
                      </div>
                      {voice.audioUrl && (
                        <Badge variant="success" size="sm">
                          Audio
                        </Badge>
                      )}
                      <span className="text-sm text-gray-500">{formatDate(voice.createdAt)}</span>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Voice Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <ModalHeader title="Generate Voice" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Voice Name</label>
              <Input
                type="text"
                value={newVoice.voiceName}
                onChange={(e) => setNewVoice({ ...newVoice, voiceName: e.target.value })}
                placeholder="Enter voice name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">NPC Assignment (Optional)</label>
              <Select
                value={newVoice.npcId}
                onChange={(e) => setNewVoice({ ...newVoice, npcId: e.target.value })}
              >
                <option value="">No NPC</option>
                {npcs.map((npc) => (
                  <option key={npc.id} value={npc.id}>
                    {npc.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Text to Generate</label>
              <Input
                type="text"
                value={newVoice.text}
                onChange={(e) => setNewVoice({ ...newVoice, text: e.target.value })}
                placeholder="Enter text for voice generation"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false)
              setNewVoice({ voiceName: '', npcId: '', text: '' })
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateVoice}
            disabled={isCreating || !newVoice.voiceName.trim() || !newVoice.text.trim()}
          >
            {isCreating ? 'Generating...' : 'Generate Voice'}
          </Button>
        </ModalFooter>
      </Modal>
    </DashboardLayout>
  )
}
