/**
 * Voice Page
 * Manage voice profiles and generate character voices with ElevenLabs
 */

import { Mic, Search, Grid, List, Play, TestTube2, Plus, Trash2, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  Textarea,
  CharacterCard,
  DetailModal,
  AudioPlayer,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface VoiceProfile {
  id: string
  name: string
  description: string | null
  gender: string | null
  age: string | null
  accent: string | null
  tone: string | null
  serviceProvider: string | null
  serviceVoiceId: string | null
  sampleAudioUrl: string | null
  tags: string[]
  isActive: boolean
  createdAt: string
}

interface VoiceGeneration {
  id: string
  text: string
  voiceProfileId: string
  npcId: string | null
  audioUrl: string | null
  duration: number | null
  context: string | null
  emotion: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error: string | null
  createdAt: string
}

export default function VoicePage() {
  const apiFetch = useApiFetch()
  const [activeTab, setActiveTab] = useState('profiles')
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [generations, setGenerations] = useState<VoiceGeneration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Profile creation
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false)
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    gender: '',
    age: '',
    accent: '',
    tone: '',
    serviceProvider: 'elevenlabs',
    serviceVoiceId: '',
  })

  // Voice generation
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    text: '',
    voiceProfileId: '',
    context: 'dialog',
    emotion: 'neutral',
  })

  // Test voice
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null)
  const [isGeneratingSample, setIsGeneratingSample] = useState(false)

  // Detail modals
  const [selectedProfile, setSelectedProfile] = useState<VoiceProfile | null>(null)

  useEffect(() => {
    fetchProfiles()
    fetchGenerations()
  }, [])

  const fetchProfiles = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/voice/profiles')
      if (response.ok) {
        const data = await response.json()
        setProfiles(data.profiles || [])
      }
    } catch (error) {
      console.error('Failed to fetch voice profiles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGenerations = async () => {
    try {
      const response = await apiFetch('/api/voice/generations')
      if (response.ok) {
        const data = await response.json()
        setGenerations(data.generations || [])
      }
    } catch (error) {
      console.error('Failed to fetch voice generations:', error)
    }
  }

  const handleCreateProfile = async () => {
    if (!newProfile.name.trim()) return

    setIsCreatingProfile(true)
    try {
      const response = await apiFetch('/api/voice/profiles', {
        method: 'POST',
        body: JSON.stringify({
          name: newProfile.name,
          description: newProfile.description || null,
          gender: newProfile.gender || null,
          age: newProfile.age || null,
          accent: newProfile.accent || null,
          tone: newProfile.tone || null,
          serviceProvider: newProfile.serviceProvider,
          serviceVoiceId: newProfile.serviceVoiceId || null,
          tags: [],
        }),
      })

      if (response.ok) {
        await fetchProfiles()
        setShowCreateProfileModal(false)
        setNewProfile({
          name: '',
          description: '',
          gender: '',
          age: '',
          accent: '',
          tone: '',
          serviceProvider: 'elevenlabs',
          serviceVoiceId: '',
        })
      }
    } catch (error) {
      console.error('Failed to create voice profile:', error)
    } finally {
      setIsCreatingProfile(false)
    }
  }

  const handleTestProfile = async (profileId: string) => {
    setTestingProfileId(profileId)
    try {
      const response = await apiFetch(`/api/voice/profiles/${profileId}/test`, {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello, this is a test of the voice profile.',
        }),
      })

      if (response.ok) {
        await fetchGenerations()
        setActiveTab('generations')
      }
    } catch (error) {
      console.error('Failed to test voice profile:', error)
    } finally {
      setTestingProfileId(null)
    }
  }

  const handleGenerateSample = async () => {
    if (!selectedProfile) return

    setIsGeneratingSample(true)
    try {
      // Generate a test sample
      const testResponse = await apiFetch(`/api/voice/profiles/${selectedProfile.id}/test`, {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello, this is a sample of the voice profile.',
        }),
      })

      if (!testResponse.ok) {
        throw new Error('Failed to generate sample')
      }

      const testData = await testResponse.json()
      const generationId = testData.generation?.id

      if (!generationId) {
        throw new Error('Failed to get generation ID')
      }

      // Poll for completion (check every 2 seconds, max 30 seconds)
      let attempts = 0
      const maxAttempts = 15

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))

        const checkResponse = await apiFetch(`/api/voice/generations/${generationId}`)
        if (checkResponse.ok) {
          const generationData = await checkResponse.json()
          const generation = generationData.generation

          if (generation.status === 'completed' && generation.audioUrl) {
            // Update the profile with the sample audio URL
            const updateResponse = await apiFetch(`/api/voice/profiles/${selectedProfile.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                sampleAudioUrl: generation.audioUrl,
              }),
            })

            if (updateResponse.ok) {
              // Refresh profiles and update selected profile
              const response = await apiFetch('/api/voice/profiles')
              if (response.ok) {
                const data = await response.json()
                const updatedProfiles = data.profiles || []
                setProfiles(updatedProfiles)
                // Update selected profile
                const updatedProfile = updatedProfiles.find((p: VoiceProfile) => p.id === selectedProfile.id)
                if (updatedProfile) {
                  setSelectedProfile(updatedProfile)
                }
              }
              return
            }
          } else if (generation.status === 'failed') {
            throw new Error(generation.error || 'Generation failed')
          }
        }

        attempts++
      }

      throw new Error('Sample generation timed out')
    } catch (error) {
      console.error('Failed to generate sample audio:', error)
      alert(`Failed to generate sample audio: ${(error as Error).message}`)
    } finally {
      setIsGeneratingSample(false)
    }
  }

  const handleGenerateVoice = async () => {
    if (!generateForm.text.trim() || !generateForm.voiceProfileId) return

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/voice/generate', {
        method: 'POST',
        body: JSON.stringify(generateForm),
      })

      if (response.ok) {
        await fetchGenerations()
        setShowGenerateModal(false)
        setGenerateForm({
          text: '',
          voiceProfileId: '',
          context: 'dialog',
          emotion: 'neutral',
        })
        setActiveTab('generations')
      }
    } catch (error) {
      console.error('Failed to generate voice:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return

    const confirmed = window.confirm(
      `Are you sure you want to delete voice profile "${selectedProfile.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/voice/profiles/${selectedProfile.id}`, {
        method: 'DELETE',
      })

      if (response.ok || response.status === 204) {
        // Remove from list
        setProfiles(profiles.filter((profile) => profile.id !== selectedProfile.id))
        // Close modal
        setSelectedProfile(null)
      } else {
        const error = await response.text()
        console.error('Failed to delete voice profile:', error)
        alert(`Failed to delete voice profile: ${error}`)
      }
    } catch (error) {
      console.error('Failed to delete voice profile:', error)
      alert('Failed to delete voice profile. Please try again.')
    }
  }

  const handleDeleteGeneration = async (generationId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this voice generation? This action cannot be undone.'
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/voice/generations/${generationId}`, {
        method: 'DELETE',
      })

      if (response.ok || response.status === 204) {
        // Remove from list
        setGenerations(generations.filter((gen) => gen.id !== generationId))
      } else {
        const error = await response.text()
        console.error('Failed to delete voice generation:', error)
        alert(`Failed to delete voice generation: ${error}`)
      }
    } catch (error) {
      console.error('Failed to delete voice generation:', error)
      alert('Failed to delete voice generation. Please try again.')
    }
  }

  const getProfileBadges = (profile: VoiceProfile) => {
    const badges: Array<'featured' | 'template' | 'published' | 'draft'> = []
    if (!profile.isActive) badges.push('draft')
    return badges
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch =
      !searchQuery ||
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.description && profile.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const filteredGenerations = generations.filter((gen) => {
    const matchesSearch = !searchQuery || gen.text.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'warning'
      case 'failed':
        return 'error'
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
                <Mic size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Voice Generation</h1>
                <p className="text-gray-400 mt-1">
                  Manage voice profiles and generate character voices with ElevenLabs
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
              {activeTab === 'profiles' && (
                <Button variant="primary" onClick={() => setShowCreateProfileModal(true)} className="gap-2">
                  <Plus size={18} />
                  Create Profile
                </Button>
              )}
              {activeTab === 'generations' && (
                <Button variant="primary" onClick={() => setShowGenerateModal(true)} className="gap-2">
                  <Plus size={18} />
                  Generate Voice
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Card className="p-1">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profiles'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Voice Profiles ({profiles.length})
            </button>
            <button
              onClick={() => setActiveTab('generations')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'generations'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Generations ({generations.length})
            </button>
          </div>
        </Card>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Content */}
        {activeTab === 'profiles' && (
          isLoading && profiles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Loading voice profiles...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <Card className="p-12 text-center">
              <Mic size={48} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {profiles.length === 0 ? 'No voice profiles yet' : 'No matching profiles'}
              </h3>
              <p className="text-gray-400 mb-4">
                {profiles.length === 0
                  ? 'Create your first voice profile to get started!'
                  : 'Try adjusting your search'}
              </p>
              {profiles.length === 0 && (
                <Button variant="primary" onClick={() => setShowCreateProfileModal(true)} className="gap-2">
                  <Plus size={18} />
                  Create Profile
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
              {filteredProfiles.map((profile) => (
                <CharacterCard
                  key={profile.id}
                  id={profile.id}
                  name={profile.name}
                  description={profile.description || 'No description'}
                  avatarUrl={profile.sampleAudioUrl}
                  badges={getProfileBadges(profile)}
                  tags={[
                    profile.gender,
                    profile.age,
                    profile.accent,
                    profile.tone,
                  ].filter(Boolean) as string[]}
                  onClick={() => setSelectedProfile(profile)}
                  onInfo={() => setSelectedProfile(profile)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'generations' && (
          isLoading && generations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Loading generations...</p>
            </div>
          ) : filteredGenerations.length === 0 ? (
            <Card className="p-12 text-center">
              <Play size={48} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {generations.length === 0 ? 'No generations yet' : 'No matching generations'}
              </h3>
              <p className="text-gray-400 mb-4">
                {generations.length === 0
                  ? 'Generate your first voice to get started!'
                  : 'Try adjusting your search'}
              </p>
              {generations.length === 0 && (
                <Button variant="primary" onClick={() => setShowGenerateModal(true)} className="gap-2">
                  <Plus size={18} />
                  Generate Voice
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGenerations.map((generation) => (
                <Card key={generation.id} variant="hover" className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                      <Mic size={24} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getStatusBadgeVariant(generation.status)} size="sm">
                          {generation.status}
                        </Badge>
                        {generation.context && (
                          <Badge variant="secondary" size="sm">
                            {generation.context}
                          </Badge>
                        )}
                        {generation.emotion && (
                          <Badge variant="secondary" size="sm">
                            {generation.emotion}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 ml-auto">
                          {formatDate(generation.createdAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGeneration(generation.id)}
                          className="ml-2 hover:text-red-400"
                          title="Delete generation"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <p className="text-white text-sm mb-3">{generation.text}</p>
                      {generation.audioUrl && generation.status === 'completed' && (
                        <AudioPlayer url={generation.audioUrl} />
                      )}
                      {generation.error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                          {generation.error}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Profile Modal */}
      <Modal open={showCreateProfileModal} onClose={() => setShowCreateProfileModal(false)} size="lg">
        <ModalHeader title="Create Voice Profile" onClose={() => setShowCreateProfileModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Profile Name *</label>
              <Input
                type="text"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                placeholder="e.g., Wise Elder, Cheerful Merchant"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Description</label>
              <Textarea
                value={newProfile.description}
                onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                placeholder="Describe the voice characteristics..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Gender</label>
                <Select
                  value={newProfile.gender}
                  onChange={(e) => setNewProfile({ ...newProfile, gender: e.target.value })}
                  aria-label="Gender"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="neutral">Neutral</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Age</label>
                <Select
                  value={newProfile.age}
                  onChange={(e) => setNewProfile({ ...newProfile, age: e.target.value })}
                  aria-label="Age"
                >
                  <option value="">Select age</option>
                  <option value="child">Child</option>
                  <option value="young">Young</option>
                  <option value="adult">Adult</option>
                  <option value="elderly">Elderly</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Accent</label>
              <Input
                type="text"
                value={newProfile.accent}
                onChange={(e) => setNewProfile({ ...newProfile, accent: e.target.value })}
                placeholder="e.g., British, Southern, French"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tone</label>
              <Input
                type="text"
                value={newProfile.tone}
                onChange={(e) => setNewProfile({ ...newProfile, tone: e.target.value })}
                placeholder="e.g., Warm, Mysterious, Authoritative"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Service Provider</label>
              <Select
                value={newProfile.serviceProvider}
                onChange={(e) => setNewProfile({ ...newProfile, serviceProvider: e.target.value })}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="azure">Azure</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Voice ID (Optional)</label>
              <Input
                type="text"
                value={newProfile.serviceVoiceId}
                onChange={(e) => setNewProfile({ ...newProfile, serviceVoiceId: e.target.value })}
                placeholder="Leave empty for default voice"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateProfileModal(false)
              setNewProfile({
                name: '',
                description: '',
                gender: '',
                age: '',
                accent: '',
                tone: '',
                serviceProvider: 'elevenlabs',
                serviceVoiceId: '',
              })
            }}
            disabled={isCreatingProfile}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateProfile}
            disabled={isCreatingProfile || !newProfile.name.trim()}
          >
            {isCreatingProfile ? 'Creating...' : 'Create Profile'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Generate Voice Modal */}
      <Modal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} size="lg">
        <ModalHeader title="Generate Voice" onClose={() => setShowGenerateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Voice Profile *</label>
              <Select
                value={generateForm.voiceProfileId}
                onChange={(e) => setGenerateForm({ ...generateForm, voiceProfileId: e.target.value })}
                aria-label="Voice Profile"
              >
                <option value="">Select voice profile</option>
                {profiles.filter(p => p.isActive).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Text to Generate *</label>
              <Textarea
                value={generateForm.text}
                onChange={(e) => setGenerateForm({ ...generateForm, text: e.target.value })}
                placeholder="Enter the text you want to convert to speech..."
                rows={4}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Context</label>
                <Select
                  value={generateForm.context}
                  onChange={(e) => setGenerateForm({ ...generateForm, context: e.target.value })}
                  aria-label="Context"
                >
                  <option value="dialog">Dialog</option>
                  <option value="narration">Narration</option>
                  <option value="combat_bark">Combat Bark</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Emotion</label>
                <Select
                  value={generateForm.emotion}
                  onChange={(e) => setGenerateForm({ ...generateForm, emotion: e.target.value })}
                  aria-label="Emotion"
                >
                  <option value="neutral">Neutral</option>
                  <option value="happy">Happy</option>
                  <option value="sad">Sad</option>
                  <option value="angry">Angry</option>
                </Select>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowGenerateModal(false)
              setGenerateForm({
                text: '',
                voiceProfileId: '',
                context: 'dialog',
                emotion: 'neutral',
              })
            }}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerateVoice}
            disabled={isGenerating || !generateForm.text.trim() || !generateForm.voiceProfileId}
          >
            {isGenerating ? 'Generating...' : 'Generate Voice'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Profile Detail Modal */}
      {selectedProfile && (
        <DetailModal
          open={!!selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onDelete={handleDeleteProfile}
          entity={{
            id: selectedProfile.id,
            name: selectedProfile.name,
            type: 'npc',
            description: selectedProfile.description || 'No description',
            badges: getProfileBadges(selectedProfile),
            overview: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    Voice Characteristics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedProfile.gender && (
                      <div>
                        <span className="text-xs text-gray-500">Gender</span>
                        <p className="text-white capitalize">{selectedProfile.gender}</p>
                      </div>
                    )}
                    {selectedProfile.age && (
                      <div>
                        <span className="text-xs text-gray-500">Age</span>
                        <p className="text-white capitalize">{selectedProfile.age}</p>
                      </div>
                    )}
                    {selectedProfile.accent && (
                      <div>
                        <span className="text-xs text-gray-500">Accent</span>
                        <p className="text-white">{selectedProfile.accent}</p>
                      </div>
                    )}
                    {selectedProfile.tone && (
                      <div>
                        <span className="text-xs text-gray-500">Tone</span>
                        <p className="text-white">{selectedProfile.tone}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    Service Configuration
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Provider</span>
                      <p className="text-white capitalize">{selectedProfile.serviceProvider || 'Not set'}</p>
                    </div>
                    {selectedProfile.serviceVoiceId && (
                      <div>
                        <span className="text-xs text-gray-500">Voice ID</span>
                        <p className="text-white font-mono text-sm">{selectedProfile.serviceVoiceId}</p>
                      </div>
                    )}
                  </div>
                </div>
                {selectedProfile.sampleAudioUrl ? (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      Sample Audio
                    </h3>
                    <AudioPlayer url={selectedProfile.sampleAudioUrl} />
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      Sample Audio
                    </h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                      <p className="text-gray-400 text-sm mb-3">No sample audio available</p>
                      <Button
                        variant="primary"
                        onClick={handleGenerateSample}
                        disabled={isGeneratingSample}
                        className="gap-2"
                      >
                        <Sparkles size={16} />
                        {isGeneratingSample ? 'Generating Sample...' : 'Generate Sample Audio'}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => handleTestProfile(selectedProfile.id)}
                    disabled={testingProfileId === selectedProfile.id}
                    className="gap-2"
                  >
                    <TestTube2 size={16} />
                    {testingProfileId === selectedProfile.id ? 'Testing...' : 'Test Voice'}
                  </Button>
                </div>
              </div>
            ),
          }}
        />
      )}
    </DashboardLayout>
  )
}
