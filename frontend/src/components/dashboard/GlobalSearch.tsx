/**
 * GlobalSearch - Cmd+K powered global search modal
 * Search across users, assets, content, and more
 */

import { useState, useEffect, useRef } from 'react'
import { Search, X, Users, Database, FileText } from 'lucide-react'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

interface SearchResult {
  id: string
  type: 'user' | 'asset' | 'content' | 'activity'
  title: string
  subtitle?: string
  icon: React.ReactNode
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    // Mock search results
    // In production, this would call your search API
    if (query.trim()) {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'user',
          title: 'Admin User',
          subtitle: 'admin@forge.local',
          icon: <Users size={16} className="text-blue-400" />,
        },
        {
          id: '2',
          type: 'asset',
          title: 'Character Model',
          subtitle: '3D Asset',
          icon: <Database size={16} className="text-green-400" />,
        },
        {
          id: '3',
          type: 'content',
          title: 'Quest System',
          subtitle: 'Game Content',
          icon: <FileText size={16} className="text-purple-400" />,
        },
      ]

      setResults(
        mockResults.filter(
          r =>
            r.title.toLowerCase().includes(query.toLowerCase()) ||
            r.subtitle?.toLowerCase().includes(query.toLowerCase())
        )
      )
    } else {
      setResults([])
    }
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-700">
          <Search size={20} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, assets, content..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {results.length > 0 ? (
            <div className="divide-y divide-slate-700">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    // Handle result click
                    onClose()
                  }}
                  className="w-full p-4 text-left hover:bg-slate-800 transition-colors flex items-center gap-3"
                >
                  <div className="p-2 bg-slate-800 border border-slate-700 rounded-lg">
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-sm text-gray-400 truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 uppercase">{result.type}</span>
                </button>
              ))}
            </div>
          ) : query.trim() !== '' ? (
            <div className="p-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Start typing to search...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 bg-slate-800/50 text-xs text-gray-500 flex items-center justify-center gap-4">
          <span>Press <kbd className="px-2 py-0.5 bg-slate-700 rounded font-mono">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
