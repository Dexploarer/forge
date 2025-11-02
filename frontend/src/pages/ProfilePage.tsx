/**
 * Profile Page
 * User profile and personal API credentials
 */

import { User, Wallet, Key, Save, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from '../components/common'
import { useApiFetch } from '../utils/api'

interface UserProfile {
  displayName: string
  email: string
  walletAddress: string
}

interface UserCredentials {
  openaiApiKey: string
  anthropicApiKey: string
  meshyApiKey: string
  elevenLabsApiKey: string
}

export default function ProfilePage() {
  const { user, login, logout } = usePrivy()
  const apiFetch = useApiFetch()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    email: '',
    walletAddress: '',
  })

  const [credentials, setCredentials] = useState<UserCredentials>({
    openaiApiKey: '',
    anthropicApiKey: '',
    meshyApiKey: '',
    elevenLabsApiKey: '',
  })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiFetch('/api/users/me')
        if (response.ok) {
          const data = await response.json()
          setProfile({
            displayName: data.displayName || '',
            email: data.email || '',
            walletAddress: data.walletAddress || '',
          })
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
      }
    }

    const loadCredentials = async () => {
      try {
        const response = await apiFetch('/api/credentials')
        if (response.ok) {
          const data = await response.json()
          setCredentials(data)
        }
      } catch (error) {
        console.error('Failed to load credentials:', error)
      }
    }

    loadProfile()
    loadCredentials()
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      const response = await apiFetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: profile.displayName,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      setSaveSuccess('Profile saved successfully!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCredentials = async () => {
    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      const response = await apiFetch('/api/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save credentials')
      }

      setSaveSuccess('API credentials saved successfully!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save credentials')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
      )
    ) {
      try {
        const response = await apiFetch('/api/users/me', {
          method: 'DELETE',
        })

        if (response.ok) {
          await logout()
        }
      } catch (error) {
        console.error('Failed to delete account:', error)
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <User size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Profile</h1>
              <p className="text-gray-400 mt-1">
                Manage your profile and API credentials
              </p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User size={20} className="text-blue-400" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <User size={40} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avatar</p>
                <p className="text-xs text-gray-500 mt-1">Default avatar</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Display Name</label>
              <Input
                type="text"
                placeholder="Enter your display name"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Email</label>
              <Input
                type="email"
                value={profile.email}
                disabled
                className="opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="primary"
                className="gap-2"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Address */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet size={20} className="text-purple-400" />
              <CardTitle>Wallet Connection</CardTitle>
            </div>
            <CardDescription>Manage your connected wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.wallet ? (
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">Connected Wallet</h4>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    {user.wallet.address}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => logout()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">No Wallet Connected</h4>
                  <p className="text-xs text-gray-400 mt-1">Connect a wallet to use Web3 features</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => login()}>
                  Connect Wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Credentials */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key size={20} className="text-green-400" />
              <CardTitle>Personal API Credentials</CardTitle>
            </div>
            <CardDescription>Your personal API keys for AI services (encrypted)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">OpenAI API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={credentials.openaiApiKey}
                onChange={(e) => setCredentials({ ...credentials, openaiApiKey: e.target.value })}
                className="font-mono"
              />
              {credentials.openaiApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{credentials.openaiApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Anthropic API Key</label>
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={credentials.anthropicApiKey}
                onChange={(e) => setCredentials({ ...credentials, anthropicApiKey: e.target.value })}
                className="font-mono"
              />
              {credentials.anthropicApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{credentials.anthropicApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">Meshy API Key</label>
              <Input
                type="password"
                placeholder="meshy_..."
                value={credentials.meshyApiKey}
                onChange={(e) => setCredentials({ ...credentials, meshyApiKey: e.target.value })}
                className="font-mono"
              />
              {credentials.meshyApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{credentials.meshyApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">ElevenLabs API Key</label>
              <Input
                type="password"
                placeholder="el_..."
                value={credentials.elevenLabsApiKey}
                onChange={(e) => setCredentials({ ...credentials, elevenLabsApiKey: e.target.value })}
                className="font-mono"
              />
              {credentials.elevenLabsApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Current key: ****{credentials.elevenLabsApiKey.slice(-4)}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="primary"
                className="gap-2"
                onClick={handleSaveCredentials}
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Credentials'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 size={20} className="text-red-400" />
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
            </div>
            <CardDescription>Irreversible account actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-red-950/30 rounded-lg border border-red-500/30">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Delete Account</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {(saveSuccess || saveError) && (
          <div className="flex justify-center items-center gap-4 pt-4">
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
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
