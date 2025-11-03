/**
 * Vitest Test Setup
 * Configures testing environment for React components
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// =====================================================
// CLEANUP
// =====================================================

// Automatically cleanup after each test
afterEach(() => {
  cleanup()
})

// =====================================================
// BROWSER API MOCKS
// =====================================================

beforeAll(() => {
  // Mock window.matchMedia (used by responsive components)
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }

  // Mock IntersectionObserver (used by lazy loading)
  global.IntersectionObserver = class IntersectionObserver {
    callback: IntersectionObserverCallback
    options?: IntersectionObserverInit

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback
      this.options = options
    }
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    readonly root: Element | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    takeRecords = vi.fn(() => [])
  }

  // Mock ResizeObserver (used by responsive components)
  global.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  // Mock localStorage
  if (typeof window !== 'undefined') {
    const localStorageMock = {
      getItem: vi.fn((_key: string) => null),
      setItem: vi.fn((_key: string, _value: string) => {}),
      removeItem: vi.fn((_key: string) => {}),
      clear: vi.fn(() => {}),
      key: vi.fn((_index: number) => null),
      length: 0,
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })

    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: vi.fn((_key: string) => null),
      setItem: vi.fn((_key: string, _value: string) => {}),
      removeItem: vi.fn((_key: string) => {}),
      clear: vi.fn(() => {}),
      key: vi.fn((_index: number) => null),
      length: 0,
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    })
  }

  // Mock fetch (for API calls)
  global.fetch = vi.fn()

  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    // Uncomment to suppress specific console methods during tests
    // log: vi.fn(),
    // debug: vi.fn(),
    // info: vi.fn(),
    // warn: vi.fn(),
    // error: vi.fn(),
  }
})

// =====================================================
// TEST UTILITIES
// =====================================================

/**
 * Wait for a specific amount of time
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Create a mock file for file upload testing
 */
export const createMockFile = (
  name: string,
  size: number,
  type: string
): File => {
  const blob = new Blob(['a'.repeat(size)], { type })
  return new File([blob], name, { type })
}

/**
 * Mock successful fetch response
 */
export const mockFetchSuccess = (data: any) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  })
}

/**
 * Mock failed fetch response
 */
export const mockFetchError = (status: number, message: string) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  })
}

/**
 * Reset all mocks
 */
export const resetAllMocks = () => {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
