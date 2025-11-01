/**
 * API utility functions for making authenticated requests
 */

import { useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Make an authenticated API request
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
    },
    credentials: 'include',
  })
}

/**
 * Hook to get an API fetch function with automatic token injection
 */
export function useApiFetch() {
  const { getAccessToken } = usePrivy()

  // Memoize the fetch function to prevent re-renders
  return useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getAccessToken()
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    })
  }, [getAccessToken])
}
