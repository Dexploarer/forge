/**
 * Audio Assets Page
 * Browse and manage audio assets
 */

import { Music, Grid, List, Upload, Search } from 'lucide-react'
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
  Select,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface Asset {
  id: string
  name: string
  type: string
  status: 'draft' | 'published'
  thumbnailUrl: string | null
  fileUrl: string | null
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export default function AudioAssetsPage() {
  const apiFetch = useApiFetch()
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAudioType, setSelectedAudioType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/assets')
      if (response.ok) {
        const data = await response.json()
        const allAssets = data.assets || []
        // Filter for audio assets only (type='audio', 'music', 'sfx', 'voice')
        const audioAssets = allAssets.filter((asset: Asset) =>
          ['audio', 'music', 'sfx', 'voice'].includes(asset.type.toLowerCase())
        )
        setAssets(audioAssets)
      }
    } catch (error) {
      console.error('Failed to fetch audio assets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatMetadata = (metadata: Record<string, any>) => {
    const parts: string[] = []
    if (metadata.duration) {
      parts.push(`${metadata.duration}s`)
    }
    if (metadata.format) {
      parts.push(metadata.format.toUpperCase())
    }
    return parts.join(' • ')
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesAudioType = selectedAudioType === 'all' || asset.type === selectedAudioType
    const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus
    return matchesSearch && matchesAudioType && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Music size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Audio Files</h1>
                <p className="text-gray-400 mt-1">
                  Browse and manage audio assets
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
              <Button variant="primary" className="gap-2">
                <Upload size={18} />
                Upload Audio
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
                placeholder="Search audio files..."
                className="pl-10"
              />
            </div>
            <Select
              value={selectedAudioType}
              onChange={(e) => setSelectedAudioType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="music">Music</option>
              <option value="sfx">SFX</option>
              <option value="voice">Voice</option>
              <option value="audio">Audio</option>
            </Select>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </div>
        </Card>

        {/* Audio Assets Grid/List */}
        {isLoading && assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading audio files...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <Card className="p-12 text-center">
            <Music size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {assets.length === 0 ? 'No audio files yet' : 'No matching audio files'}
            </h3>
            <p className="text-gray-400 mb-4">
              {assets.length === 0
                ? 'Upload your first audio file to get started!'
                : 'Try adjusting your filters'}
            </p>
            {assets.length === 0 && (
              <Button variant="primary" className="gap-2">
                <Upload size={18} />
                Upload Audio
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
            {filteredAssets.map((asset) => (
              <Card key={asset.id} variant="hover" className="group">
                {viewMode === 'grid' ? (
                  <>
                    {/* Grid View */}
                    <div className="aspect-square bg-slate-900 rounded-t-lg overflow-hidden border-b border-slate-700">
                      {asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music size={40} className="text-purple-400" />
                        </div>
                      )}
                    </div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base truncate">{asset.name}</CardTitle>
                        <Badge
                          variant={asset.status === 'published' ? 'success' : 'secondary'}
                          size="sm"
                        >
                          {asset.status}
                        </Badge>
                      </div>
                      <CardDescription className="truncate">
                        {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
                        {asset.metadata && Object.keys(asset.metadata).length > 0 && (
                          <> • {formatMetadata(asset.metadata)}</>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{formatDate(asset.createdAt)}</span>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </CardFooter>
                  </>
                ) : (
                  <>
                    {/* List View */}
                    <CardContent className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                        {asset.thumbnailUrl ? (
                          <img
                            src={asset.thumbnailUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Music size={24} className="text-purple-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{asset.name}</h3>
                        <p className="text-sm text-gray-400">
                          {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
                          {asset.metadata && Object.keys(asset.metadata).length > 0 && (
                            <> • {formatMetadata(asset.metadata)}</>
                          )}
                        </p>
                      </div>
                      <Badge variant={asset.status === 'published' ? 'success' : 'secondary'}>
                        {asset.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{formatDate(asset.createdAt)}</span>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
