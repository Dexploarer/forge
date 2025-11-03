/**
 * Music Page
 * Manage music tracks with AI generation and upload capabilities
 */

import { Music, Search, Grid, List, Wand2, Upload } from 'lucide-react'
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

interface MusicTrack {
  id: string
  name: string
  description: string | null
  audioUrl: string | null
  duration: number | null
  fileSize: number | null
  format: string | null
  bpm: number | null
  key: string | null
  genre: string | null
  mood: string | null
  instruments: string[]
  generationType: string | null
  generationPrompt: string | null
  usageContext: string | null
  loopable: boolean
  tags: string[]
  metadata: Record<string, any>
  status: 'draft' | 'processing' | 'published' | 'failed'
  createdAt: string
  updatedAt: string
}

export default function MusicPage() {
  const apiFetch = useApiFetch()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // AI Generation
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    name: '',
    prompt: '',
    bpm: '',
    key: '',
    genre: '',
    mood: '',
    duration: '',
    instruments: '',
  })

  // Upload
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    bpm: '',
    mood: '',
    genre: '',
    tags: '',
  })

  // Detail modal
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null)

  useEffect(() => {
    fetchTracks()
  }, [])

  const fetchTracks = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/music')
      if (response.ok) {
        const data = await response.json()
        setTracks(data.tracks || [])
      }
    } catch (error) {
      console.error('Failed to fetch music tracks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateMusic = async () => {
    if (!generateForm.name.trim() || !generateForm.prompt.trim()) return

    setIsGenerating(true)
    try {
      const response = await apiFetch('/api/music/generate', {
        method: 'POST',
        body: JSON.stringify({
          name: generateForm.name,
          prompt: generateForm.prompt,
          bpm: generateForm.bpm ? parseInt(generateForm.bpm, 10) : undefined,
          key: generateForm.key || undefined,
          genre: generateForm.genre || undefined,
          mood: generateForm.mood || undefined,
          duration: generateForm.duration ? parseInt(generateForm.duration, 10) : undefined,
          instruments: generateForm.instruments
            ? generateForm.instruments.split(',').map(i => i.trim()).filter(Boolean)
            : [],
        }),
      })

      if (response.ok) {
        await fetchTracks()
        setShowGenerateModal(false)
        setGenerateForm({
          name: '',
          prompt: '',
          bpm: '',
          key: '',
          genre: '',
          mood: '',
          duration: '',
          instruments: '',
        })
      }
    } catch (error) {
      console.error('Failed to generate music:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateTrackForUpload = async () => {
    if (!uploadForm.name.trim()) return

    setIsUploading(true)
    try {
      // First create the track metadata
      const response = await apiFetch('/api/music', {
        method: 'POST',
        body: JSON.stringify({
          name: uploadForm.name,
          description: uploadForm.description || null,
          bpm: uploadForm.bpm ? parseInt(uploadForm.bpm, 10) : null,
          mood: uploadForm.mood || null,
          genre: uploadForm.genre || null,
          tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const trackId = data.track.id

        // Then upload the file if one is selected
        if (selectedFile) {
          await handleUploadFile(trackId)
        } else {
          await fetchTracks()
          setShowUploadModal(false)
          resetUploadForm()
        }
      }
    } catch (error) {
      console.error('Failed to create track:', error)
      setIsUploading(false)
    }
  }

  const handleUploadFile = async (trackId: string) => {
    if (!selectedFile) return

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await apiFetch(`/api/music/${trackId}/upload`, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      })

      if (response.ok) {
        await fetchTracks()
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
      bpm: '',
      mood: '',
      genre: '',
      tags: '',
    })
  }

  const handleDownload = async (trackId: string) => {
    try {
      const response = await apiFetch(`/api/music/download/${trackId}`)
      if (response.ok) {
        // The backend redirects to the file URL
        const url = response.url
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('Failed to download track:', error)
    }
  }

  const handleDeleteTrack = async () => {
    if (!selectedTrack) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedTrack.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/music/${selectedTrack.id}`, {
        method: 'DELETE',
      })

      if (response.ok || response.status === 204) {
        // Remove from list
        setTracks(tracks.filter((track) => track.id !== selectedTrack.id))
        // Close modal
        setSelectedTrack(null)
      } else {
        const error = await response.text()
        console.error('Failed to delete music track:', error)
        alert(`Failed to delete music track: ${error}`)
      }
    } catch (error) {
      console.error('Failed to delete music track:', error)
      alert('Failed to delete music track. Please try again.')
    }
  }

  const getTrackBadges = (track: MusicTrack) => {
    const badges: Array<'featured' | 'template' | 'published' | 'draft'> = []
    if (track.status === 'draft') badges.push('draft')
    else if (track.status === 'published') badges.push('published')
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb > 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredTracks = tracks.filter((track) => {
    const matchesSearch =
      !searchQuery ||
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.description && track.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesGenre = selectedGenre === 'all' || track.genre === selectedGenre
    const matchesStatus = selectedStatus === 'all' || track.status === selectedStatus
    return matchesSearch && matchesGenre && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Music size={28} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Music Tracks</h1>
                <p className="text-gray-400 mt-1">
                  Generate AI music or upload your own tracks
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
                placeholder="Search music tracks..."
                className="pl-10"
              />
            </div>
            <Select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
            >
              <option value="all">All Genres</option>
              <option value="orchestral">Orchestral</option>
              <option value="electronic">Electronic</option>
              <option value="ambient">Ambient</option>
              <option value="rock">Rock</option>
              <option value="fantasy">Fantasy</option>
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

        {/* Music Tracks Grid */}
        {isLoading && tracks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading music tracks...</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <Card className="p-12 text-center">
            <Music size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {tracks.length === 0 ? 'No music tracks yet' : 'No matching tracks'}
            </h3>
            <p className="text-gray-400 mb-4">
              {tracks.length === 0
                ? 'Generate AI music or upload your first track to get started!'
                : 'Try adjusting your filters'}
            </p>
            {tracks.length === 0 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => setShowUploadModal(true)} className="gap-2">
                  <Upload size={18} />
                  Upload Track
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
            {filteredTracks.map((track) => (
              <CharacterCard
                key={track.id}
                id={track.id}
                name={track.name}
                description={track.description || `${track.genre || 'Music'} track`}
                badges={getTrackBadges(track)}
                tags={[
                  track.genre,
                  track.mood,
                  track.bpm ? `${track.bpm} BPM` : null,
                  track.key,
                ].filter(Boolean) as string[]}
                stats={{
                  usageCount: track.duration ? Math.floor(track.duration) : undefined,
                }}
                onClick={() => setSelectedTrack(track)}
                onInfo={() => setSelectedTrack(track)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate AI Music Modal */}
      <Modal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} size="lg">
        <ModalHeader title="Generate Music with AI" onClose={() => setShowGenerateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Track Name *</label>
              <Input
                type="text"
                value={generateForm.name}
                onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                placeholder="e.g., Epic Battle Theme"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Generation Prompt *</label>
              <Textarea
                value={generateForm.prompt}
                onChange={(e) => setGenerateForm({ ...generateForm, prompt: e.target.value })}
                placeholder="Describe the music you want to generate... e.g., 'Epic orchestral battle music with heavy drums and brass'"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">BPM (Optional)</label>
                <Input
                  type="number"
                  value={generateForm.bpm}
                  onChange={(e) => setGenerateForm({ ...generateForm, bpm: e.target.value })}
                  placeholder="120"
                  min="20"
                  max="300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Key (Optional)</label>
                <Input
                  type="text"
                  value={generateForm.key}
                  onChange={(e) => setGenerateForm({ ...generateForm, key: e.target.value })}
                  placeholder="e.g., C Minor"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Genre (Optional)</label>
                <Input
                  type="text"
                  value={generateForm.genre}
                  onChange={(e) => setGenerateForm({ ...generateForm, genre: e.target.value })}
                  placeholder="e.g., Orchestral, Electronic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Mood (Optional)</label>
                <Input
                  type="text"
                  value={generateForm.mood}
                  onChange={(e) => setGenerateForm({ ...generateForm, mood: e.target.value })}
                  placeholder="e.g., Epic, Peaceful, Tense"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Duration (seconds, optional)</label>
                <Input
                  type="number"
                  value={generateForm.duration}
                  onChange={(e) => setGenerateForm({ ...generateForm, duration: e.target.value })}
                  placeholder="30"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Instruments (comma-separated)</label>
                <Input
                  type="text"
                  value={generateForm.instruments}
                  onChange={(e) => setGenerateForm({ ...generateForm, instruments: e.target.value })}
                  placeholder="e.g., piano, strings, drums"
                />
              </div>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300">
                AI music generation uses ElevenLabs Music API. The generation may take a few moments to complete.
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
                bpm: '',
                key: '',
                genre: '',
                mood: '',
                duration: '',
                instruments: '',
              })
            }}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerateMusic}
            disabled={isGenerating || !generateForm.name.trim() || !generateForm.prompt.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Music'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Upload Track Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} size="lg">
        <ModalHeader title="Upload Music Track" onClose={() => setShowUploadModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Track Name *</label>
              <Input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g., Main Theme"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Description</label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Describe the music track..."
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
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700
                  file:cursor-pointer cursor-pointer
                  bg-slate-800 border border-slate-700 rounded-lg
                "
              />
              {selectedFile && (
                <p className="text-xs text-gray-400 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">BPM (Optional)</label>
                <Input
                  type="number"
                  value={uploadForm.bpm}
                  onChange={(e) => setUploadForm({ ...uploadForm, bpm: e.target.value })}
                  placeholder="120"
                  min="20"
                  max="300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Genre (Optional)</label>
                <Input
                  type="text"
                  value={uploadForm.genre}
                  onChange={(e) => setUploadForm({ ...uploadForm, genre: e.target.value })}
                  placeholder="e.g., Orchestral"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Mood (Optional)</label>
              <Input
                type="text"
                value={uploadForm.mood}
                onChange={(e) => setUploadForm({ ...uploadForm, mood: e.target.value })}
                placeholder="e.g., Epic, Calm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tags (comma-separated, optional)</label>
              <Input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                placeholder="e.g., battle, menu, ambient"
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
            onClick={handleCreateTrackForUpload}
            disabled={isUploading || !uploadForm.name.trim()}
          >
            {isUploading ? 'Uploading...' : selectedFile ? 'Create & Upload' : 'Create Track'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Track Detail Modal */}
      {selectedTrack && (
        <DetailModal
          open={!!selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onDelete={handleDeleteTrack}
          entity={{
            id: selectedTrack.id,
            name: selectedTrack.name,
            type: 'asset',
            description: selectedTrack.description || 'No description',
            badges: getTrackBadges(selectedTrack),
            overview: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    Track Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500">Status</span>
                      <p className="text-white">
                        <Badge variant={getStatusBadgeVariant(selectedTrack.status)} size="sm">
                          {selectedTrack.status}
                        </Badge>
                      </p>
                    </div>
                    {selectedTrack.duration && (
                      <div>
                        <span className="text-xs text-gray-500">Duration</span>
                        <p className="text-white">{formatDuration(selectedTrack.duration)}</p>
                      </div>
                    )}
                    {selectedTrack.bpm && (
                      <div>
                        <span className="text-xs text-gray-500">BPM</span>
                        <p className="text-white">{selectedTrack.bpm}</p>
                      </div>
                    )}
                    {selectedTrack.key && (
                      <div>
                        <span className="text-xs text-gray-500">Key</span>
                        <p className="text-white">{selectedTrack.key}</p>
                      </div>
                    )}
                    {selectedTrack.genre && (
                      <div>
                        <span className="text-xs text-gray-500">Genre</span>
                        <p className="text-white">{selectedTrack.genre}</p>
                      </div>
                    )}
                    {selectedTrack.mood && (
                      <div>
                        <span className="text-xs text-gray-500">Mood</span>
                        <p className="text-white">{selectedTrack.mood}</p>
                      </div>
                    )}
                  </div>
                </div>
                {selectedTrack.generationType === 'ai' && selectedTrack.generationPrompt && (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      AI Generation Prompt
                    </h3>
                    <p className="text-gray-300 text-sm">{selectedTrack.generationPrompt}</p>
                  </div>
                )}
                {selectedTrack.instruments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      Instruments
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrack.instruments.map((instrument, idx) => (
                        <Badge key={idx} variant="secondary" size="sm">
                          {instrument}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedTrack.audioUrl && selectedTrack.status === 'published' && (
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                      Audio Playback
                    </h3>
                    <AudioPlayer
                      url={selectedTrack.audioUrl}
                      title={selectedTrack.name}
                      onDownload={() => handleDownload(selectedTrack.id)}
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    File Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTrack.format && (
                      <div>
                        <span className="text-xs text-gray-500">Format</span>
                        <p className="text-white uppercase">{selectedTrack.format}</p>
                      </div>
                    )}
                    {selectedTrack.fileSize && (
                      <div>
                        <span className="text-xs text-gray-500">File Size</span>
                        <p className="text-white">{formatFileSize(selectedTrack.fileSize)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Created</span>
                      <p className="text-white">{formatDate(selectedTrack.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Updated</span>
                      <p className="text-white">{formatDate(selectedTrack.updatedAt)}</p>
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
