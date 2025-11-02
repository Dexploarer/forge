/**
 * Settings Page
 * Application settings and preferences
 */

import { Settings as SettingsIcon, Palette, Bell, Zap, Lock, Globe, Save, CheckCircle, AlertCircle } from 'lucide-react'
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
} from '../components/common'
import { useApiFetch } from '../utils/api'

export default function SettingsPage() {
  const apiFetch = useApiFetch()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [settings, setSettings] = useState({
    // Appearance
    theme: 'dark' as 'dark' | 'light' | 'auto',
    compactMode: false,
    animationsEnabled: true,

    // Notifications
    emailNotifications: true,
    browserNotifications: false,
    generationNotifications: true,

    // Performance
    autoSaveEnabled: true,
    lowPowerMode: false,
    preloadModels: true,

    // Privacy
    analyticsEnabled: true,
    crashReportsEnabled: true,

    // Language
    language: 'en' as 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh',

    // API Configuration
    aiGatewayUrl: '',
  })

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiFetch('/api/users/me')
        if (response.ok) {
          const data = await response.json()
          if (data.settings) {
            setSettings((prev) => ({ ...prev, ...data.settings }))
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      const response = await apiFetch('/api/users/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      // Also save to localStorage for faster loading
      localStorage.setItem('app-settings', JSON.stringify(settings))

      setSaveSuccess('Settings saved successfully!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
              <SettingsIcon size={28} className="text-gray-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-gray-400 mt-1">
                Customize your Forge experience
              </p>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette size={20} className="text-purple-400" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize the look and feel of the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-3 block">Theme</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'dark', label: 'Dark', description: 'Classic dark theme' },
                  { value: 'light', label: 'Light', description: 'Clean light theme' },
                  { value: 'auto', label: 'Auto', description: 'Match system' },
                ].map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() => setSettings({ ...settings, theme: theme.value as any })}
                    className={`p-4 bg-slate-800 rounded-lg border-2 transition-all ${
                      settings.theme === theme.value
                        ? 'border-blue-500'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`w-full h-16 rounded mb-3 border border-slate-700 ${
                        theme.value === 'dark'
                          ? 'bg-gradient-to-br from-gray-900 to-gray-800'
                          : theme.value === 'light'
                          ? 'bg-gradient-to-br from-gray-100 to-gray-200'
                          : 'bg-gradient-to-br from-gray-900 via-gray-700 to-gray-100'
                      }`}
                    ></div>
                    <p className="text-sm font-medium text-white">{theme.label}</p>
                    <p className="text-xs text-gray-400">{theme.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Compact Mode</h4>
                <p className="text-xs text-gray-400 mt-1">Reduce spacing for a denser layout</p>
              </div>
              <Checkbox
                checked={settings.compactMode}
                onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Animations</h4>
                <p className="text-xs text-gray-400 mt-1">Enable smooth transitions and animations</p>
              </div>
              <Checkbox
                checked={settings.animationsEnabled}
                onChange={(e) => setSettings({ ...settings, animationsEnabled: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-blue-400" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Manage how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Email Notifications</h4>
                <p className="text-xs text-gray-400 mt-1">Receive updates via email</p>
              </div>
              <Checkbox
                checked={settings.emailNotifications}
                onChange={(e) =>
                  setSettings({ ...settings, emailNotifications: e.target.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Browser Notifications</h4>
                <p className="text-xs text-gray-400 mt-1">Get real-time alerts in your browser</p>
              </div>
              <Checkbox
                checked={settings.browserNotifications}
                onChange={(e) =>
                  setSettings({ ...settings, browserNotifications: e.target.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Generation Completion</h4>
                <p className="text-xs text-gray-400 mt-1">Notify when asset generation completes</p>
              </div>
              <Checkbox
                checked={settings.generationNotifications}
                onChange={(e) =>
                  setSettings({ ...settings, generationNotifications: e.target.checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-yellow-400" />
              <CardTitle>Performance</CardTitle>
            </div>
            <CardDescription>Optimize application performance and resource usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Auto-Save</h4>
                <p className="text-xs text-gray-400 mt-1">Automatically save your work</p>
              </div>
              <Checkbox
                checked={settings.autoSaveEnabled}
                onChange={(e) => setSettings({ ...settings, autoSaveEnabled: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Low Power Mode</h4>
                <p className="text-xs text-gray-400 mt-1">Reduce resource usage for better battery life</p>
              </div>
              <Checkbox
                checked={settings.lowPowerMode}
                onChange={(e) => setSettings({ ...settings, lowPowerMode: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Preload 3D Models</h4>
                <p className="text-xs text-gray-400 mt-1">Load models in advance for faster viewing</p>
              </div>
              <Checkbox
                checked={settings.preloadModels}
                onChange={(e) => setSettings({ ...settings, preloadModels: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock size={20} className="text-red-400" />
              <CardTitle>Privacy & Security</CardTitle>
            </div>
            <CardDescription>Control your data and privacy preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Anonymous Analytics</h4>
                <p className="text-xs text-gray-400 mt-1">Help improve the app by sharing usage data</p>
              </div>
              <Checkbox
                checked={settings.analyticsEnabled}
                onChange={(e) => setSettings({ ...settings, analyticsEnabled: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Crash Reports</h4>
                <p className="text-xs text-gray-400 mt-1">Automatically send crash reports to help fix bugs</p>
              </div>
              <Checkbox
                checked={settings.crashReportsEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, crashReportsEnabled: e.target.checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe size={20} className="text-green-400" />
              <CardTitle>Language & Region</CardTitle>
            </div>
            <CardDescription>Set your preferred language and regional settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium text-white mb-3 block">Display Language</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { code: 'en', name: 'English' },
                  { code: 'es', name: 'Español' },
                  { code: 'fr', name: 'Français' },
                  { code: 'de', name: 'Deutsch' },
                  { code: 'ja', name: '日本語' },
                  { code: 'zh', name: '中文' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSettings({ ...settings, language: lang.code as any })}
                    className={`p-3 bg-slate-800 rounded-lg border-2 transition-all ${
                      settings.language === lang.code
                        ? 'border-blue-500'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{lang.name}</p>
                  </button>
                ))}
              </div>
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
