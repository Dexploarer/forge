/**
 * API utility functions for making requests
 */

import { useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://forge-staging.up.railway.app'

/**
 * Make an API request
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = normalizedEndpoint.startsWith('http') ? normalizedEndpoint : `${API_URL}${normalizedEndpoint}`

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })
}

/**
 * Hook to get an API fetch function
 */
export function useApiFetch() {
  // Memoize the fetch function to prevent re-renders
  return useCallback(async (endpoint: string, options: RequestInit = {}) => {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = normalizedEndpoint.startsWith('http') ? normalizedEndpoint : `${API_URL}${normalizedEndpoint}`

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    })
  }, [])
}
