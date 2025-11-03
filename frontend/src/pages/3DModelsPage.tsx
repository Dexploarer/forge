/**
 * 3D Models Page
 * Browse and manage 3D model assets
 */

import { Database, Grid, List, Upload, Search, Edit2, Trash2, X, ExternalLink } from 'lucide-react'
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
import { AssetPreview } from '../components/assets/AssetPreview'
import { useApiFetch } from '../utils/api'

interface Asset {
  id: string
  name: string
  type: string
  status: 'draft' | 'published'
  visibility?: 'public' | 'private'
  thumbnailUrl: string | null
  fileUrl: string | null
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export default function ThreeDModelsPage() {
  const apiFetch = useApiFetch()
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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
        // Filter for 3D models only (type='model' or type='3d')
        const models = allAssets.filter((asset: Asset) =>
          asset.type === 'model' || asset.type === '3d'
        )
        setAssets(models)
      }
    } catch (error) {
      console.error('Failed to fetch 3D models:', error)
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
    if (metadata.polyCount) {
      parts.push(`${metadata.polyCount.toLocaleString()} polys`)
    }
    if (metadata.dimensions) {
      parts.push(`${metadata.dimensions}`)
    }
    return parts.join(' • ')
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const handleViewAsset = (asset: Asset) => {
    setSelectedAsset(asset)
    setEditedName(asset.name)
    setIsEditing(false)
  }

  const handleEditName = async () => {
    if (!selectedAsset || !editedName.trim()) return

    try {
      const response = await apiFetch(`/api/public-assets/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName.trim() }),
      })

      if (response.ok) {
        const { asset: updatedAsset } = await response.json()
        setAssets(assets.map(a => a.id === updatedAsset.id ? { ...a, name: updatedAsset.name } : a))
        setSelectedAsset({ ...selectedAsset, name: updatedAsset.name })
        setIsEditing(false)
        console.log('Model name updated successfully')
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update model name')
      }
    } catch (error) {
      console.error('Failed to update model name:', error)
      alert('Failed to update model name')
    }
  }

  const handleDelete = async () => {
    if (!selectedAsset) return

    if (!confirm(`Are you sure you want to delete "${selectedAsset.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await apiFetch(`/api/public-assets/${selectedAsset.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAssets(assets.filter(a => a.id !== selectedAsset.id))
        setSelectedAsset(null)
        console.log('Model deleted successfully')
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to delete model')
      }
    } catch (error) {
      console.error('Failed to delete model:', error)
      alert('Failed to delete model')
    } finally {
      setIsDeleting(false)
    }
  }

  const closeModal = () => {
    setSelectedAsset(null)
    setIsEditing(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Database size={28} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">3D Models</h1>
                <p className="text-gray-400 mt-1">
                  Browse and manage 3D model assets
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
                Upload Model
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 3D models..."
                className="pl-10"
              />
            </div>
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

        {/* 3D Models Grid/List */}
        {isLoading && assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading 3D models...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <Card className="p-12 text-center">
            <Database size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {assets.length === 0 ? 'No 3D models yet' : 'No matching 3D models'}
            </h3>
            <p className="text-gray-400 mb-4">
              {assets.length === 0
                ? 'Upload your first 3D model to get started!'
                : 'Try adjusting your filters'}
            </p>
            {assets.length === 0 && (
              <Button variant="primary" className="gap-2">
                <Upload size={18} />
                Upload Model
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
                          <Database size={40} className="text-blue-400" />
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
                      {asset.metadata && Object.keys(asset.metadata).length > 0 && (
                        <CardDescription className="truncate">
                          {formatMetadata(asset.metadata)}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{formatDate(asset.createdAt)}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleViewAsset(asset)}>
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
                          <Database size={24} className="text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{asset.name}</h3>
                        {asset.metadata && Object.keys(asset.metadata).length > 0 ? (
                          <p className="text-sm text-gray-400">{formatMetadata(asset.metadata)}</p>
                        ) : (
                          <p className="text-sm text-gray-400">{asset.type}</p>
                        )}
                      </div>
                      <Badge variant={asset.status === 'published' ? 'success' : 'secondary'}>
                        {asset.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{formatDate(asset.createdAt)}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleViewAsset(asset)}>
                        View
                      </Button>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Asset Details Modal */}
        {selectedAsset && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <Database size={24} className="text-blue-400" />
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="text-xl font-bold"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditName()
                          if (e.key === 'Escape') setIsEditing(false)
                        }}
                      />
                      <Button variant="primary" size="sm" onClick={handleEditName}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{selectedAsset.name}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="gap-2"
                      >
                        <Edit2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={closeModal}>
                  <X size={20} />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* 3D Model Preview */}
                {selectedAsset.fileUrl && (
                  <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-700" style={{ height: '500px' }}>
                    <AssetPreview
                      type={selectedAsset.type as 'model' | 'texture' | 'audio' | 'image'}
                      fileUrl={selectedAsset.fileUrl}
                      name={selectedAsset.name}
                      mimeType={selectedAsset.metadata?.mimeType || undefined}
                    />
                  </div>
                )}

                {/* Asset Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Status</p>
                    <Badge variant={selectedAsset.status === 'published' ? 'success' : 'secondary'}>
                      {selectedAsset.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Type</p>
                    <p className="text-white font-medium">{selectedAsset.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Created</p>
                    <p className="text-white">{formatDate(selectedAsset.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Updated</p>
                    <p className="text-white">{formatDate(selectedAsset.updatedAt)}</p>
                  </div>
                </div>

                {/* Metadata */}
                {selectedAsset.metadata && Object.keys(selectedAsset.metadata).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Metadata</p>
                    <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                      <pre className="text-xs text-gray-300 overflow-x-auto">
                        {JSON.stringify(selectedAsset.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* File URL */}
                {selectedAsset.fileUrl && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">File URL</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={selectedAsset.fileUrl}
                        readOnly
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(selectedAsset.fileUrl!, '_blank')}
                        className="gap-2"
                      >
                        <ExternalLink size={16} />
                        Open
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-6 border-t border-slate-700">
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-2"
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete Model'}
                </Button>
                <Button variant="ghost" onClick={closeModal}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
