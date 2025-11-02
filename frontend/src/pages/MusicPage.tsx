/**
 * Music Page
 * Manage game music and soundtracks
 */

import { Music, Plus, Search, Grid, List } from 'lucide-react'
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
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface MusicTrack {
  id: string
  title: string
  bpm: number | null
  duration: number | null
  mood: string | null
  tags: string[]
  fileUrl: string | null
  createdAt: string
}

export default function MusicPage() {
  const apiFetch = useApiFetch()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [newTrack, setNewTrack] = useState({
    title: '',
    bpm: '',
    mood: '',
    tags: '',
  })

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

  const handleUploadTrack = async () => {
    if (!newTrack.title.trim()) return

    setIsUploading(true)
    try {
      const response = await apiFetch('/api/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTrack.title,
          bpm: newTrack.bpm ? parseInt(newTrack.bpm, 10) : null,
          mood: newTrack.mood || null,
          tags: newTrack.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        await fetchTracks()
        setShowUploadModal(false)
        setNewTrack({ title: '', bpm: '', mood: '', tags: '' })
      }
    } catch (error) {
      console.error('Failed to upload track:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.mood && track.mood.toLowerCase().includes(searchQuery.toLowerCase())) ||
      track.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
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
                  Manage game music and soundtracks
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
              <Button variant="primary" onClick={() => setShowUploadModal(true)} className="gap-2">
                <Plus size={18} />
                Upload Track
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
              placeholder="Search tracks by name, mood, or tags..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Music Tracks Grid/List */}
        {isLoading && tracks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading tracks...</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <Card className="p-12 text-center">
            <Music size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {tracks.length === 0 ? 'No music tracks yet' : 'No matching tracks'}
            </h3>
            <p className="text-gray-400 mb-4">
              {tracks.length === 0
                ? 'Upload your first music track to get started!'
                : 'Try adjusting your search'}
            </p>
            {tracks.length === 0 && (
              <Button variant="primary" onClick={() => setShowUploadModal(true)} className="gap-2">
                <Plus size={18} />
                Upload Track
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
            {filteredTracks.map((track) => (
              <Card key={track.id} variant="hover" className="group">
                {viewMode === 'grid' ? (
                  <>
                    {/* Grid View */}
                    <div className="aspect-square bg-slate-900 rounded-t-lg overflow-hidden border-b border-slate-700 flex items-center justify-center">
                      <Music size={48} className="text-blue-400" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-base truncate">{track.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {track.bpm && (
                          <span className="text-xs">
                            {track.bpm} BPM
                          </span>
                        )}
                        {track.duration && (
                          <span className="text-xs">
                            {formatDuration(track.duration)}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {track.mood && (
                        <Badge variant="secondary" size="sm" className="mb-2">
                          {track.mood}
                        </Badge>
                      )}
                      {track.tags && track.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {track.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" size="sm">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{formatDate(track.createdAt)}</span>
                      {track.fileUrl && (
                        <Badge variant="success" size="sm">
                          File
                        </Badge>
                      )}
                    </CardFooter>
                  </>
                ) : (
                  <>
                    {/* List View */}
                    <CardContent className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                        <Music size={24} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{track.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          {track.bpm && <span>{track.bpm} BPM</span>}
                          {track.duration && <span>{formatDuration(track.duration)}</span>}
                          {track.mood && <Badge variant="secondary" size="sm">{track.mood}</Badge>}
                        </div>
                        {track.tags && track.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {track.tags.slice(0, 4).map((tag, idx) => (
                              <Badge key={idx} variant="secondary" size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {track.fileUrl && (
                        <Badge variant="success" size="sm">
                          File
                        </Badge>
                      )}
                      <span className="text-sm text-gray-500">{formatDate(track.createdAt)}</span>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Track Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} size="lg">
        <ModalHeader title="Upload Music Track" onClose={() => setShowUploadModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Track Title</label>
              <Input
                type="text"
                value={newTrack.title}
                onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                placeholder="Enter track title"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">BPM (Optional)</label>
              <Input
                type="number"
                value={newTrack.bpm}
                onChange={(e) => setNewTrack({ ...newTrack, bpm: e.target.value })}
                placeholder="120"
                min="1"
                max="300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Mood (Optional)</label>
              <Input
                type="text"
                value={newTrack.mood}
                onChange={(e) => setNewTrack({ ...newTrack, mood: e.target.value })}
                placeholder="Epic, Ambient, Intense, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Tags (comma-separated, optional)
              </label>
              <Input
                type="text"
                value={newTrack.tags}
                onChange={(e) => setNewTrack({ ...newTrack, tags: e.target.value })}
                placeholder="battle, orchestral, fantasy"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowUploadModal(false)
              setNewTrack({ title: '', bpm: '', mood: '', tags: '' })
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUploadTrack}
            disabled={isUploading || !newTrack.title.trim()}
          >
            {isUploading ? 'Uploading...' : 'Upload Track'}
          </Button>
        </ModalFooter>
      </Modal>
    </DashboardLayout>
  )
}
