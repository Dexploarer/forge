/**
 * System Settings Page
 * System-wide configuration and API keys
 */

import { Shield, Save, CheckCircle, AlertCircle, Key, Database, Settings, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Checkbox,
  Input,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface SystemSettings {
  // API Keys (encrypted)
  openaiApiKey: string
  anthropicApiKey: string
  meshyApiKey: string
  elevenLabsApiKey: string

  // Feature Flags
  enableAiGeneration: boolean
  enable3dProcessing: boolean
  enableVoiceGeneration: boolean
  enableMultiAgent: boolean

  // Rate Limits
  maxRequestsPerMinute: number
  maxConcurrentGenerations: number
  maxUploadSizeMb: number
}

export default function SystemSettingsPage() {
  const apiFetch = useApiFetch()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [settings, setSettings] = useState<SystemSettings>({
    openaiApiKey: '',
    anthropicApiKey: '',
    meshyApiKey: '',
    elevenLabsApiKey: '',
    enableAiGeneration: true,
    enable3dProcessing: true,
    enableVoiceGeneration: true,
    enableMultiAgent: false,
    maxRequestsPerMinute: 60,
    maxConcurrentGenerations: 5,
    maxUploadSizeMb: 100,
  })

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiFetch('/api/system-settings')
        if (response.ok) {
          const data = await response.json()
          setSettings((prev) => ({ ...prev, ...data }))
        }
      } catch (error) {
        console.error('Failed to load system settings:', error)
      }
    }
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      const response = await apiFetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save system settings')
      }

      setSaveSuccess('System settings saved successfully!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportBackup = () => {
    console.log('Export backup')
  }

  const handleResetSystem = () => {
    if (confirm('Are you sure you want to reset system settings? This action cannot be undone.')) {
      console.log('Reset system')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <Shield size={28} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">System Settings</h1>
              <p className="text-gray-400 mt-1">
                Configure system-wide settings and API keys
              </p>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key size={20} className="text-purple-400" />
              <CardTitle>API Configuration</CardTitle>
            </div>
            <CardDescription>Manage system-wide API keys (encrypted)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">OpenAI API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  className="font-mono"
                />
              </div>
              {settings.openaiApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{settings.openaiApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Anthropic API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-..."
                  value={settings.anthropicApiKey}
                  onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                  className="font-mono"
                />
              </div>
              {settings.anthropicApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{settings.anthropicApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Meshy API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="meshy_..."
                  value={settings.meshyApiKey}
                  onChange={(e) => setSettings({ ...settings, meshyApiKey: e.target.value })}
                  className="font-mono"
                />
              </div>
              {settings.meshyApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{settings.meshyApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">ElevenLabs API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="el_..."
                  value={settings.elevenLabsApiKey}
                  onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
                  className="font-mono"
                />
              </div>
              {settings.elevenLabsApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{settings.elevenLabsApiKey.slice(-4)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-blue-400" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
            <CardDescription>Enable or disable system features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">AI Generation</h4>
                <p className="text-xs text-gray-400 mt-1">Enable AI-powered content generation</p>
              </div>
              <Checkbox
                checked={settings.enableAiGeneration}
                onChange={(e) => setSettings({ ...settings, enableAiGeneration: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">3D Processing</h4>
                <p className="text-xs text-gray-400 mt-1">Enable 3D asset processing and generation</p>
              </div>
              <Checkbox
                checked={settings.enable3dProcessing}
                onChange={(e) => setSettings({ ...settings, enable3dProcessing: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Voice Generation</h4>
                <p className="text-xs text-gray-400 mt-1">Enable ElevenLabs voice synthesis</p>
              </div>
              <Checkbox
                checked={settings.enableVoiceGeneration}
                onChange={(e) => setSettings({ ...settings, enableVoiceGeneration: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Multi-Agent System</h4>
                <p className="text-xs text-gray-400 mt-1">Enable collaborative AI agent workflows</p>
              </div>
              <Checkbox
                checked={settings.enableMultiAgent}
                onChange={(e) => setSettings({ ...settings, enableMultiAgent: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database size={20} className="text-yellow-400" />
              <CardTitle>Rate Limits</CardTitle>
            </div>
            <CardDescription>Configure system resource limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Max Requests Per Minute
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={settings.maxRequestsPerMinute}
                onChange={(e) =>
                  setSettings({ ...settings, maxRequestsPerMinute: parseInt(e.target.value) || 60 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">Global API rate limit per user</p>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Max Concurrent Generations
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                value={settings.maxConcurrentGenerations}
                onChange={(e) =>
                  setSettings({ ...settings, maxConcurrentGenerations: parseInt(e.target.value) || 5 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">Maximum parallel AI generations</p>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Max Upload Size (MB)
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={settings.maxUploadSizeMb}
                onChange={(e) =>
                  setSettings({ ...settings, maxUploadSizeMb: parseInt(e.target.value) || 100 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">Maximum file upload size in megabytes</p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-400" />
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
            </div>
            <CardDescription>Irreversible system operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-950/30 rounded-lg border border-red-500/30">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Export System Backup</h4>
                <p className="text-xs text-gray-400 mt-1">Download complete system configuration</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExportBackup}>
                Export Backup
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-950/30 rounded-lg border border-red-500/30">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Reset System Settings</h4>
                <p className="text-xs text-gray-400 mt-1">Restore all settings to defaults</p>
              </div>
              <Button variant="danger" size="sm" onClick={handleResetSystem}>
                Reset System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-700">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} />
              {saveSuccess}
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {saveError}
            </div>
          )}
          <Button
            variant="primary"
            className="gap-2"
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
