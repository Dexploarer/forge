import { useState } from 'react'

interface PasswordGateProps {
  onAuthenticated: () => void
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showSignup, setShowSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === 'Hyperscap3!') {
      // Store auth in localStorage
      localStorage.setItem('authenticated', 'true')
      setError('')
      setShowSignup(true)
    } else {
      setError('Incorrect password')
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://forge-staging.up.railway.app'}/api/early-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setSignupSuccess(true)
        setTimeout(() => {
          onAuthenticated()
        }, 1500)
      }
    } catch (err) {
      console.error('Signup error:', err)
    }
  }

  const handleSkipSignup = () => {
    onAuthenticated()
  }

  if (showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Welcome to Forge</h1>
            <p className="text-gray-400 text-center mb-8">Sign up for early access updates</p>

            {signupSuccess ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg text-white mb-2">You're all set!</p>
                <p className="text-gray-400 text-sm">Redirecting to dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSignupSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                >
                  Sign Up for Early Access
                </button>

                <button
                  type="button"
                  onClick={handleSkipSignup}
                  className="w-full text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  Skip for now →
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Forge</h1>
            <p className="text-gray-400">Game Asset Management Platform</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Access Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Enter
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Invite-only access</p>
          </div>
        </div>
      </div>
    </div>
  )
}
