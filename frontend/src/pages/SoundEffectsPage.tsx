/**
 * Sound Effects Page
 * Manage sound effects with AI generation and upload capabilities
 */

import { Volume2, Search, Grid, List, Wand2, Upload } from 'lucide-react'
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

interface SoundEffect {
  id: string
  name: string
  description: string | null
  audioUrl: string | null
  duration: number | null
  fileSize: number | null
  format: string | null
  category: string | null
  subcategory: string | null
  volume: number | null
  priority: number | null
  generationType: string | null
  generationPrompt: string | null
  variationGroup: string | null
  variationIndex: number | null
  triggers: string[]
  spatialAudio: boolean
  minDistance: number | null
  maxDistance: number | null
  tags: string[]
  metadata: Record<string, any>
  status: 'draft' | 'processing' | 'published' | 'failed'
  createdAt: string
  updatedAt: string
}

export default function SoundEffectsPage() {
  const apiFetch = useApiFetch()
  const [sfx, setSfx] = useState<SoundEffect[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // AI Generation
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    name: '',
    prompt: '',
    category: '',
    subcategory: '',
    duration: '',
  })

  // Upload
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: '',
    subcategory: '',
    volume: '100',
    priority: '5',
    tags: '',
  })

  // Detail modal
  const [selectedSfx, setSelectedSfx] = useState<SoundEffect | null>(null)

  useEffect(() => {
    fetchSfx()
  }, [])

  const fetchSfx = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/sfx')
      if (response.ok) {
        const data = await response.json()
        setSfx(data.sfx || [])
      }
    } catch (error) {
      console.error('Failed to fetch sound effects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateSfx = async () => {
    if (!generateForm.name.trim() || !generateForm.prompt.trim()) return

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/sfx/generate', {
        method: 'POST',
        body: JSON.stringify({
          name: generateForm.name,
          prompt: generateForm.prompt,
          category: generateForm.category || undefined,
          subcategory: generateForm.subcategory || undefined,
          duration: generateForm.duration ? parseInt(generateForm.duration, 10) : undefined,
        }),
      })

      if (response.ok) {
        await fetchSfx()
        setShowGenerateModal(false)
        setGenerateForm({
          name: '',
          prompt: '',
          category: '',
          subcategory: '',
          duration: '',
        })
      }
    } catch (error) {
      console.error('Failed to generate SFX:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateSfxForUpload = async () => {
    if (!uploadForm.name.trim()) return

    setIsUploading(true)
    try {
      const response = await apiFetch('/api/sfx', {
        method: 'POST',
        body: JSON.stringify({
          name: uploadForm.name,
          description: uploadForm.description || null,
          category: uploadForm.category || null,
          subcategory: uploadForm.subcategory || null,
          volume: uploadForm.volume ? parseInt(uploadForm.volume, 10) : null,
          priority: uploadForm.priority ? parseInt(uploadForm.priority, 10) : null,
          tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const sfxId = data.sfx.id

        if (selectedFile) {
          await handleUploadFile(sfxId)
        } else {
          await fetchSfx()
          setShowUploadModal(false)
          resetUploadForm()
        }
      }
    } catch (error) {
      console.error('Failed to create SFX:', error)
      setIsUploading(false)
    }
  }

  const handleUploadFile = async (sfxId: string) => {
    if (!selectedFile) return

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await apiFetch(`/api/sfx/${sfxId}/upload`, {
        method: 'POST',
        body: formData,
        headers: {},
      })

      if (response.ok) {
        await fetchSfx()
        setShowUploadModal(false)
        resetUploadForm()
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setUploadForm({
      name: '',
      description: '',
      category: '',
      subcategory: '',
      volume: '100',
      priority: '5',
      tags: '',
    })
  }

  const getSfxBadges = (sfx: SoundEffect) => {
    const badges: Array<'featured' | 'template' | 'published' | 'draft'> = []
    if (sfx.status === 'draft') badges.push('draft')
    else if (sfx.status === 'published') badges.push('published')
    return badges
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'success'
      case 'processing':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'secondary'
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'Unknown'
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    const kb = bytes / 1024
    return kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(2)} KB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredSfx = sfx.filter((sfx) => {
    const matchesSearch =
      !searchQuery ||
      sfx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sfx.description && sfx.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || sfx.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || sfx.status === selectedStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <Volume2 size={28} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Sound Effects</h1>
                <p className="text-gray-400 mt-1">
                  Generate AI sound effects or upload your own
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
              <Button variant="secondary" onClick={() => setShowUploadModal(true)} className="gap-2">
                <Upload size={18} />
                Upload
              </Button>
              <Button variant="primary" onClick={() => setShowGenerateModal(true)} className="gap-2">
                <Wand2 size={18} />
                Generate with AI
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sound effects..."
                className="pl-10"
              />
            </div>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="ui">UI</option>
              <option value="ambient">Ambient</option>
              <option value="combat">Combat</option>
              <option value="character">Character</option>
              <option value="environment">Environment</option>
              <option value="magic">Magic</option>
            </Select>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
        </Card>

        {/* Sound Effects Grid */}
        {isLoading && sfx.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading sound effects...</p>
          </div>
        ) : filteredSfx.length === 0 ? (
          <Card className="p-12 text-center">
            <Volume2 size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {sfx.length === 0 ? 'No sound effects yet' : 'No matching sound effects'}
            </h3>
            <p className="text-gray-400 mb-4">
              {sfx.length === 0
                ? 'Generate AI sound effects or upload your first SFX to get started!'
                : 'Try adjusting your filters'}
            </p>
            {sfx.length === 0 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => setShowUploadModal(true)} className="gap-2">
                  <Upload size={18} />
                  Upload SFX
                </Button>
                <Button variant="primary" onClick={() => setShowGenerateModal(true)} className="gap-2">
                  <Wand2 size={18} />
                  Generate with AI
                </Button>
              </div>
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
            {filteredSfx.map((sfx) => (
              <CharacterCard
                key={sfx.id}
                id={sfx.id}
                name={sfx.name}
                description={sfx.description || `${sfx.category || 'Sound'} effect`}
                badges={getSfxBadges(sfx)}
                tags={[
                  sfx.category,
                  sfx.subcategory,
                  sfx.duration ? formatDuration(sfx.duration) : null,
                ].filter(Boolean) as string[]}
                onClick={() => setSelectedSfx(sfx)}
                onInfo={() => setSelectedSfx(sfx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate AI SFX Modal */}
      <Modal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} size="lg">
        <ModalHeader title="Generate Sound Effect with AI" onClose={() => setShowGenerateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">SFX Name *</label>
              <Input
                type="text"
                value={generateForm.name}
                onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                placeholder="e.g., Sword Swing"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Generation Prompt *</label>
              <Textarea
                value={generateForm.prompt}
                onChange={(e) => setGenerateForm({ ...generateForm, prompt: e.target.value })}
                placeholder="Describe the sound effect... e.g., 'Sharp metallic sword swish through air'"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category (Optional)</label>
                <Select
                  value={generateForm.category}
                  onChange={(e) => setGenerateForm({ ...generateForm, category: e.target.value })}
                >
                  <option value="">Select category</option>
                  <option value="ui">UI</option>
                  <option value="ambient">Ambient</option>
                  <option value="combat">Combat</option>
                  <option value="character">Character</option>
                  <option value="environment">Environment</option>
                  <option value="magic">Magic</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Subcategory (Optional)</label>
                <Input
                  type="text"
                  value={generateForm.subcategory}
                  onChange={(e) => setGenerateForm({ ...generateForm, subcategory: e.target.value })}
                  placeholder="e.g., Melee, Spell"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Duration (seconds, optional)</label>
              <Input
                type="number"
                value={generateForm.duration}
                onChange={(e) => setGenerateForm({ ...generateForm, duration: e.target.value })}
                placeholder="2"
                min="1"
                max="10"
              />
            </div>
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-300">
                AI SFX generation uses ElevenLabs Sound Effects API. Generation may take a few moments.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowGenerateModal(false)
              setGenerateForm({
                name: '',
                prompt: '',
                category: '',
                subcategory: '',
                duration: '',
              })
            }}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerateSfx}
            disabled={isGenerating || !generateForm.name.trim() || !generateForm.prompt.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate SFX'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Upload SFX Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} size="lg">
        <ModalHeader title="Upload Sound Effect" onClose={() => setShowUploadModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">SFX Name *</label>
              <Input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g., Button Click"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Description</label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Describe the sound effect..."
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Audio File</label>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-green-600 file:text-white
                  hover:file:bg-green-700
                  file:cursor-pointer cursor-pointer
                  bg-slate-800 border border-slate-700 rounded-lg
                "
              />
              {selectedFile && (
                <p className="text-xs text-gray-400 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category (Optional)</label>
                <Select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                >
                  <option value="">Select category</option>
                  <option value="ui">UI</option>
                  <option value="ambient">Ambient</option>
                  <option value="combat">Combat</option>
                  <option value="character">Character</option>
                  <option value="environment">Environment</option>
                  <option value="magic">Magic</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Subcategory (Optional)</label>
                <Input
                  type="text"
                  value={uploadForm.subcategory}
                  onChange={(e) => setUploadForm({ ...uploadForm, subcategory: e.target.value })}
                  placeholder="e.g., Button, Spell"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Volume (0-100, optional)</label>
                <Input
                  type="number"
                  value={uploadForm.volume}
                  onChange={(e) => setUploadForm({ ...uploadForm, volume: e.target.value })}
                  placeholder="100"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Priority (1-10, optional)</label>
                <Input
                  type="number"
                  value={uploadForm.priority}
                  onChange={(e) => setUploadForm({ ...uploadForm, priority: e.target.value })}
                  placeholder="5"
                  min="1"
                  max="10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tags (comma-separated, optional)</label>
              <Input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                placeholder="e.g., short, crisp, impact"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowUploadModal(false)
              resetUploadForm()
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateSfxForUpload}
            disabled={isUploading || !uploadForm.name.trim()}
          >
            {isUploading ? 'Uploading...' : selectedFile ? 'Create & Upload' : 'Create SFX'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* SFX Detail Modal */}
      {selectedSfx && (
        <DetailModal
          open={!!selectedSfx}
          onClose={() => setSelectedSfx(null)}
          entity={{
            id: selectedSfx.id,
            name: selectedSfx.name,
            type: 'asset',
            description: selectedSfx.description || 'No description',
            badges: getSfxBadges(selectedSfx),
            overview: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    SFX Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500">Status</span>
                      <p className="text-white">
                        <Badge variant={getStatusBadgeVariant(selectedSfx.status)} size="sm">
                          {selectedSfx.status}
                        </Badge>
                      </p>
                    </div>
                    {selectedSfx.duration && (
                      <div>
                        <span className="text-xs text-gray-500">Duration</span>
                        <p className="text-white">{formatDuration(selectedSfx.duration)}</p>
                      </div>
                    )}
                    {selectedSfx.category && (
                      <div>
                        <span className="text-xs text-gray-500">Category</span>
                        <p className="text-white capitalize">{selectedSfx.category}</p>
                      </div>
                    )}
                    {selectedSfx.subcategory && (
                      <div>
                        <span className="text-xs text-gray-500">Subcategory</span>
                        <p className="text-white capitalize">{selectedSfx.subcategory}</p>
                      </div>
                    )}
                    {selectedSfx.volume !== null && (
                      <div>
                        <span className="text-xs text-gray-500">Volume</span>
                        <p className="text-white">{selectedSfx.volume}%</p>
                      </div>
                    )}
                    {selectedSfx.priority !== null && (
                      <div>
                        <span className="text-xs text-gray-500">Priority</span>
                        <p className="text-white">{selectedSfx.priority}/10</p>
                      </div>
                    )}
                  </div>
                </div>
                {selectedSfx.generationType === 'ai' && selectedSfx.generationPrompt && (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      AI Generation Prompt
                    </h3>
                    <p className="text-gray-300 text-sm">{selectedSfx.generationPrompt}</p>
                  </div>
                )}
                {selectedSfx.audioUrl && selectedSfx.status === 'published' && (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      Audio Playback
                    </h3>
                    <AudioPlayer url={selectedSfx.audioUrl} title={selectedSfx.name} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    File Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedSfx.format && (
                      <div>
                        <span className="text-xs text-gray-500">Format</span>
                        <p className="text-white uppercase">{selectedSfx.format}</p>
                      </div>
                    )}
                    {selectedSfx.fileSize && (
                      <div>
                        <span className="text-xs text-gray-500">File Size</span>
                        <p className="text-white">{formatFileSize(selectedSfx.fileSize)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Created</span>
                      <p className="text-white">{formatDate(selectedSfx.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Updated</span>
                      <p className="text-white">{formatDate(selectedSfx.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ),
          }}
        />
      )}
    </DashboardLayout>
  )
}
