/**
 * Projects Page
 * Project management and collaboration
 */

import { FolderOpen, Plus, Grid, List, Clock, Star } from 'lucide-react'
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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  ownerId: string
  createdAt: string
  updatedAt: string
  assetCount?: number
}

export default function ProjectsPage() {
  const apiFetch = useApiFetch()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return

    setIsCreating(true)
    try {
      const response = await apiFetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProject.name,
          description: newProject.description || null,
          status: 'active',
        }),
      })

      if (response.ok) {
        await fetchProjects()
        setShowCreateModal(false)
        setNewProject({ name: '', description: '' })
      }
    } catch (error) {
      console.error('Failed to create project:', error)
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <FolderOpen size={28} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Projects</h1>
                <p className="text-gray-400 mt-1">
                  Organize and manage your asset collections
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
              <Button
                variant="primary"
                className="gap-2"
                onClick={() => setShowCreateModal(true)}
                disabled={isLoading}
              >
                <Plus size={18} />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Grid/List */}
        {isLoading && projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first project to organize your assets!
            </p>
            <Button
              variant="primary"
              className="gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              Create Project
            </Button>
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {projects.map((project) => (
              <Card
                key={project.id}
                variant="hover"
                className="group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={20} className="text-purple-400" />
                      <CardTitle>{project.name}</CardTitle>
                    </div>
                    <Star
                      size={16}
                      className="text-gray-600 group-hover:text-yellow-400 cursor-pointer transition-colors"
                    />
                  </div>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Grid size={14} />
                      <span>{project.assetCount || 0} assets</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={14} />
                      <span>{formatDate(project.updatedAt)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <Badge variant={project.status === 'active' ? 'success' : 'secondary'}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="md">
        <ModalHeader title="Create New Project" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Project Name
              </label>
              <Input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Enter project name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProject.name.trim()) {
                    handleCreateProject()
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Enter project description (optional)"
                rows={4}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false)
              setNewProject({ name: '', description: '' })
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateProject}
            disabled={isCreating || !newProject.name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </ModalFooter>
      </Modal>
    </DashboardLayout>
  )
}
