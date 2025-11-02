/**
 * Assets Page
 * Browse and manage 3D models, textures, audio files, and other game assets
 */

import { Database, Grid, List, Upload, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  Button,
  Input,
  Select,
} from '../components/common'
import { CharacterCard } from '../components/common/CharacterCard'
import { DetailModal } from '../components/common/DetailModal'
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
  isFeatured?: boolean
  tags?: string[]
  usageCount?: number
}

export default function AssetsPage() {
  const apiFetch = useApiFetch()
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/assets')
      if (response.ok) {
        const data = await response.json()
        setAssets(data.assets || [])
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb > 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset)
    setShowDetailModal(true)
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === 'all' || asset.type === selectedType
    const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <Database size={28} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Assets</h1>
                <p className="text-gray-400 mt-1">
                  Browse and manage your game assets
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
                Upload Asset
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
                placeholder="Search assets..."
                className="pl-10"
              />
            </div>
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="model">3D Models</option>
              <option value="texture">Textures</option>
              <option value="audio">Audio</option>
              <option value="other">Other</option>
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

        {/* Assets Grid/List */}
        {isLoading && assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading assets...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <Card className="p-12 text-center">
            <Database size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {assets.length === 0 ? 'No assets yet' : 'No matching assets'}
            </h3>
            <p className="text-gray-400 mb-4">
              {assets.length === 0
                ? 'Upload your first asset to get started!'
                : 'Try adjusting your filters'}
            </p>
            {assets.length === 0 && (
              <Button variant="primary" className="gap-2">
                <Upload size={18} />
                Upload Asset
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset) => (
              <CharacterCard
                key={asset.id}
                id={asset.id}
                name={asset.name}
                description={`${asset.type} asset${asset.metadata?.fileSize ? ` - ${formatFileSize(asset.metadata.fileSize)}` : ''}`}
                avatarUrl={asset.thumbnailUrl}
                badges={[
                  ...(asset.isFeatured ? ['featured' as const] : []),
                  asset.status === 'published' ? 'published' as const : 'draft' as const,
                ]}
                tags={[
                  asset.type,
                  ...(asset.metadata?.format ? [asset.metadata.format.toUpperCase()] : []),
                  ...(asset.tags || []),
                ].slice(0, 3)}
                stats={{
                  usageCount: asset.usageCount,
                }}
                onClick={() => handleAssetClick(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAsset && (
        <DetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          entity={{
            id: selectedAsset.id,
            name: selectedAsset.name,
            type: 'asset',
            avatarUrl: selectedAsset.thumbnailUrl,
            description: `${selectedAsset.type} asset`,
            badges: [
              ...(selectedAsset.isFeatured ? ['featured' as const] : []),
              selectedAsset.status === 'published' ? 'published' as const : 'draft' as const,
            ],
            overview: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Asset Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Type</p>
                      <p className="text-white font-medium">{selectedAsset.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Status</p>
                      <p className="text-white font-medium capitalize">{selectedAsset.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">File Size</p>
                      <p className="text-white font-medium">
                        {formatFileSize(selectedAsset.metadata?.fileSize)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Format</p>
                      <p className="text-white font-medium">
                        {selectedAsset.metadata?.format?.toUpperCase() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                {selectedAsset.metadata?.dimensions && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Dimensions</h3>
                    <p className="text-gray-300">
                      {selectedAsset.metadata.dimensions.width} x{' '}
                      {selectedAsset.metadata.dimensions.height}
                      {selectedAsset.metadata.dimensions.depth &&
                        ` x ${selectedAsset.metadata.dimensions.depth}`}
                    </p>
                  </div>
                )}
                {selectedAsset.metadata?.duration && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Duration</h3>
                    <p className="text-gray-300">{selectedAsset.metadata.duration}s</p>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Dates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Created</p>
                      <p className="text-white">{formatDate(selectedAsset.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Updated</p>
                      <p className="text-white">{formatDate(selectedAsset.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ),
            technical: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Times Used</p>
                      <p className="text-white font-medium text-2xl">
                        {selectedAsset.usageCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Related Content (Coming Soon)
                  </h3>
                  <p className="text-gray-400 text-sm">
                    View NPCs, quests, and locations that use this asset
                  </p>
                </div>
                {selectedAsset.metadata && Object.keys(selectedAsset.metadata).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Metadata</h3>
                    <pre className="bg-slate-900 p-4 rounded-lg text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedAsset.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ),
          }}
        />
      )}
    </DashboardLayout>
  )
}
