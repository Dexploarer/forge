import { usePrivy } from '@privy-io/react-auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  const { ready, authenticated } = usePrivy()

  // Show loading state while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Simple routing based on authentication status
  // For production, consider using React Router or similar
  const path = window.location.pathname

  if (path === '/dashboard') {
    return <DashboardPage />
  }

  if (path === '/admin') {
    // Lazy load admin page
    const AdminPage = require('./pages/AdminPage').default
    return <AdminPage />
  }

  // Default to login page
  return authenticated ? <DashboardPage /> : <LoginPage />
}

export default App
