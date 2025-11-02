import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PasswordGate from './pages/PasswordGate'
import AdminPage from './pages/AdminPage'
import UsersPage from './pages/UsersPage'
import ProjectsPage from './pages/ProjectsPage'
import AssetsPage from './pages/AssetsPage'
import ThreeDModelsPage from './pages/3DModelsPage'
import AudioAssetsPage from './pages/AudioAssetsPage'
import NPCsPage from './pages/NPCsPage'
import QuestsPage from './pages/QuestsPage'
import LorePage from './pages/LorePage'
import VoicePage from './pages/VoicePage'
import MusicPage from './pages/MusicPage'
import SoundEffectsPage from './pages/SoundEffectsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AIUsagePage from './pages/AIUsagePage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'
import SystemSettingsPage from './pages/SystemSettingsPage'
import SystemLogsPage from './pages/SystemLogsPage'
import ProfilePage from './pages/ProfilePage'
import HelpPage from './pages/HelpPage'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check if already authenticated
  useEffect(() => {
    const isAuth = localStorage.getItem('authenticated') === 'true'
    setAuthenticated(isAuth)
    setLoading(false)
  }, [])

  const handleAuthenticated = () => {
    setAuthenticated(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <PasswordGate onAuthenticated={handleAuthenticated} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AdminPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/projects" element={<ProjectsPage />} />

        {/* Assets */}
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/3d" element={<ThreeDModelsPage />} />
        <Route path="/assets/audio" element={<AudioAssetsPage />} />

        {/* Game Content */}
        <Route path="/content/npcs" element={<NPCsPage />} />
        <Route path="/content/quests" element={<QuestsPage />} />
        <Route path="/content/lore" element={<LorePage />} />

        {/* Voice & Audio */}
        <Route path="/voice" element={<VoicePage />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/sfx" element={<SoundEffectsPage />} />

        {/* Analytics */}
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/analytics/ai" element={<AIUsagePage />} />

        {/* Activity */}
        <Route path="/activity" element={<ActivityPage />} />

        {/* Admin */}
        <Route path="/admin/settings" element={<SystemSettingsPage />} />
        <Route path="/admin/logs" element={<SystemLogsPage />} />

        {/* User */}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/help" element={<HelpPage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
