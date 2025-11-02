import { useState, useEffect } from 'react'
import PasswordGate from './pages/PasswordGate'
import AdminPage from './pages/AdminPage'

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

  // Always show admin page when authenticated
  return <AdminPage />
}

export default App
