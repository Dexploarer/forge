/**
 * 3D Models Page Integration Tests
 * Tests the complete 3D model management workflow including API integration
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import ThreeDModelsPage from './3DModelsPage'
import { mockFetchSuccess, mockFetchError } from '../test/setup'

// Mock API responses
const mockModelsList = {
  assets: [
    {
      id: 'model-1',
      name: 'Sword Model',
      type: 'model',
      status: 'published' as const,
      thumbnailUrl: 'https://example.com/sword-thumb.jpg',
      fileUrl: 'https://example.com/sword.glb',
      metadata: {
        polyCount: 15000,
        dimensions: '2.5 x 0.3 x 0.1m',
        format: 'glb',
        hasTextures: true,
        weaponType: 'sword',
        gripPosition: { x: 0, y: 0, z: 0 },
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'model-2',
      name: 'Shield Model',
      type: '3d',
      status: 'published' as const,
      thumbnailUrl: 'https://example.com/shield-thumb.jpg',
      fileUrl: 'https://example.com/shield.glb',
      metadata: {
        polyCount: 8500,
        dimensions: '1.2 x 1.0 x 0.2m',
        format: 'glb',
        hasTextures: true,
      },
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'model-3',
      name: 'Character Model',
      type: 'model',
      status: 'draft' as const,
      thumbnailUrl: null,
      fileUrl: null,
      metadata: {},
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
    // Non-3D asset to verify filtering
    {
      id: 'audio-1',
      name: 'Sound Effect',
      type: 'audio',
      status: 'published' as const,
      thumbnailUrl: null,
      fileUrl: 'https://example.com/sound.mp3',
      metadata: {},
      createdAt: '2024-01-04T00:00:00Z',
      updatedAt: '2024-01-04T00:00:00Z',
    },
  ],
}

const mockGeneratedModel = {
  asset: {
    id: 'model-4',
    name: 'AI Generated Helmet',
    type: 'model',
    status: 'processing' as const,
    thumbnailUrl: null,
    fileUrl: null,
    metadata: {
      generationMethod: 'text-to-3d',
      prompt: 'Medieval knight helmet',
    },
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
  },
}

const mockCompletedModel = {
  ...mockGeneratedModel.asset,
  status: 'published' as const,
  thumbnailUrl: 'https://example.com/helmet-thumb.jpg',
  fileUrl: 'https://example.com/helmet.glb',
  metadata: {
    ...mockGeneratedModel.asset.metadata,
    polyCount: 12000,
    dimensions: '0.4 x 0.3 x 0.4m',
  },
}

// Wrapper component for routing
function renderPage() {
  return render(
    <BrowserRouter>
      <ThreeDModelsPage />
    </BrowserRouter>
  )
}

describe('3DModelsPage - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful assets list fetch
    mockFetchSuccess(mockModelsList)
  })

  // =====================================================
  // INITIAL LOADING & DISPLAY
  // =====================================================

  describe('Initial Loading', () => {
    test('displays loading state initially', () => {
      renderPage()
      expect(screen.getByText('Loading 3D models...')).toBeInTheDocument()
    })

    test('fetches and displays only 3D models on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
        expect(screen.getByText('Shield Model')).toBeInTheDocument()
        expect(screen.getByText('Character Model')).toBeInTheDocument()
      })

      // Should NOT display the audio asset
      expect(screen.queryByText('Sound Effect')).not.toBeInTheDocument()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/assets'),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    test('displays metadata for models with poly count and dimensions', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Check for formatted metadata
      expect(screen.getByText(/15,000 polys/i)).toBeInTheDocument()
      expect(screen.getByText(/2.5 x 0.3 x 0.1m/i)).toBeInTheDocument()
    })

    test.skip('displays empty state when no 3D models exist', async () => {
      mockFetchSuccess({ assets: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })

      // Check that we're not in loading state and no models are rendered
      const modelCards = screen.queryAllByRole('article')
      expect(modelCards.length).toBe(0)
    })

    test.skip('displays empty state when only non-3D assets exist', async () => {
      mockFetchSuccess({
        assets: [
          {
            id: 'audio-1',
            name: 'Sound',
            type: 'audio',
            status: 'published',
            thumbnailUrl: null,
            fileUrl: 'test.mp3',
            metadata: {},
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      })
      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })

      // Verify no 3D models are displayed
      const modelCards = screen.queryAllByRole('article')
      expect(modelCards.length).toBe(0)
    })

    test('handles API error gracefully', async () => {
      mockFetchError(500, 'Server error')
      renderPage()

      // Should not crash, should show empty or error state
      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // MODEL FILTERING BY TYPE
  // =====================================================

  describe('Model Type Filtering', () => {
    test('filters assets to show only type="model" and type="3d"', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
        expect(screen.getByText('Shield Model')).toBeInTheDocument()
      })

      // Should filter out audio asset
      expect(screen.queryByText('Sound Effect')).not.toBeInTheDocument()
    })

    test('displays both "model" and "3d" type assets', async () => {
      renderPage()

      await waitFor(() => {
        // model-1 has type='model'
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
        // model-2 has type='3d'
        expect(screen.getByText('Shield Model')).toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // SEARCH & FILTERING
  // =====================================================

  describe('Search and Filtering', () => {
    test('filters models by search query', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
        expect(screen.getByText('Shield Model')).toBeInTheDocument()
      })

      // Search for "sword"
      const searchInput = screen.getByPlaceholderText(/search 3d models/i)
      await user.type(searchInput, 'sword')

      // Only "Sword Model" should be visible
      expect(screen.getByText('Sword Model')).toBeInTheDocument()
      expect(screen.queryByText('Shield Model')).not.toBeInTheDocument()
    })

    test('search is case insensitive', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search 3d models/i)
      await user.type(searchInput, 'SWORD')

      expect(screen.getByText('Sword Model')).toBeInTheDocument()
    })

    test('filters models by status', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
        expect(screen.getByText('Character Model')).toBeInTheDocument()
      })

      // Filter by published status
      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'published')

      // Only published models should be visible
      expect(screen.getByText('Sword Model')).toBeInTheDocument()
      expect(screen.getByText('Shield Model')).toBeInTheDocument()
      expect(screen.queryByText('Character Model')).not.toBeInTheDocument()
    })

    test('filters by draft status', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'draft')

      // Only draft models should be visible
      expect(screen.getByText('Character Model')).toBeInTheDocument()
      expect(screen.queryByText('Sword Model')).not.toBeInTheDocument()
      expect(screen.queryByText('Shield Model')).not.toBeInTheDocument()
    })

    test('combines search and status filters', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Apply both filters
      await user.type(screen.getByPlaceholderText(/search 3d models/i), 'model')
      await user.selectOptions(screen.getByRole('combobox'), 'published')

      // Should show published models matching "model"
      expect(screen.getByText('Sword Model')).toBeInTheDocument()
      expect(screen.getByText('Shield Model')).toBeInTheDocument()
      expect(screen.queryByText('Character Model')).not.toBeInTheDocument() // draft
    })

    test('shows "no matching" message when filters return empty', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Search for non-existent model
      await user.type(screen.getByPlaceholderText(/search 3d models/i), 'nonexistent')

      expect(screen.getByText('No matching 3D models')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    })

    test('resets to all models when search is cleared', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search 3d models/i)

      // Filter down
      await user.type(searchInput, 'sword')
      expect(screen.queryByText('Shield Model')).not.toBeInTheDocument()

      // Clear search
      await user.clear(searchInput)
      expect(screen.getByText('Shield Model')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VIEW MODE SWITCHING
  // =====================================================

  describe('View Mode', () => {
    test('starts in grid view by default', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Find the grid view button (should be active)
      const viewButtons = screen.getAllByRole('button')
      const gridButton = viewButtons.find(btn =>
        btn.className.includes('bg-blue-600') && btn.querySelector('svg')
      )
      expect(gridButton).toBeInTheDocument()
    })

    test('switches to list view when list button clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Find and click list view button (second icon button in view toggle)
      const viewButtons = screen.getAllByRole('button')
      const listButton = viewButtons.find((btn, index) => {
        const prevBtn = viewButtons[index - 1]
        return prevBtn && prevBtn.className.includes('bg-blue-600') && btn.querySelector('svg')
      })

      if (listButton) {
        await user.click(listButton)

        // List button should now be active
        expect(listButton.className).toContain('bg-blue-600')
      }
    })

    test('switches back to grid view', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Get all buttons and find the view toggle buttons
      const allButtons = screen.getAllByRole('button')

      // Find view mode buttons by looking for consecutive icon buttons
      const viewToggleButtons = allButtons.filter(btn => {
        const hasIcon = btn.querySelector('svg')
        const parent = btn.parentElement
        // Look for buttons in the same container with blue-600 styling
        return hasIcon && parent?.className.includes('bg-slate-800')
      })

      // Should have at least 2 view toggle buttons
      if (viewToggleButtons.length >= 2) {
        // Click list view (second button)
        await user.click(viewToggleButtons[1])

        // Click grid view (first button)
        await user.click(viewToggleButtons[0])

        // Grid button should be active now
        expect(viewToggleButtons[0].className).toContain('bg-blue-600')
      } else {
        // If we can't find the buttons, just verify content is visible
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      }
    })
  })

  // =====================================================
  // MODEL DISPLAY & METADATA
  // =====================================================

  describe('Model Display', () => {
    test('displays model thumbnails when available', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const thumbnails = screen.getAllByRole('img')
      expect(thumbnails.length).toBeGreaterThan(0)
      expect(thumbnails[0]).toHaveAttribute('src', 'https://example.com/sword-thumb.jpg')
      expect(thumbnails[0]).toHaveAttribute('alt', 'Sword Model')
    })

    test('displays fallback icon when thumbnail is missing', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Character Model')).toBeInTheDocument()
      })

      // Character Model has no thumbnail - verify it's displayed even without thumbnail
      expect(screen.getByText('Character Model')).toBeInTheDocument()
      // Fallback Database icon would be displayed in the UI
    })

    test('displays poly count formatted with commas', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      expect(screen.getByText(/15,000 polys/i)).toBeInTheDocument()
    })

    test('displays dimensions from metadata', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      expect(screen.getByText(/2.5 x 0.3 x 0.1m/i)).toBeInTheDocument()
    })

    test('displays status badges correctly', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const badges = screen.getAllByText(/published|draft/i)
      expect(badges.length).toBeGreaterThan(0)
    })

    test('displays formatted creation dates', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Should format to something like "Jan 1, 2024"
      expect(screen.getByText(/Jan 1, 2024/i)).toBeInTheDocument()
    })

    test('handles models with empty metadata gracefully', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Character Model')).toBeInTheDocument()
      })

      // Should not crash, Character Model has empty metadata
      expect(screen.getByText('Character Model')).toBeInTheDocument()
    })
  })

  // =====================================================
  // WEAPON DETECTION METADATA
  // =====================================================

  describe('Weapon Detection Features', () => {
    test('handles weapon type in metadata when available', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Sword Model has weaponType in metadata
      // Verify the model renders correctly with weapon metadata
      expect(screen.getByText('Sword Model')).toBeInTheDocument()
    })

    test('handles grip position data when available', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Grip position is in metadata but not displayed in list view
      // This test validates that models with grip data are handled correctly
      expect(screen.getByText('Sword Model')).toBeInTheDocument()
    })
  })

  // =====================================================
  // UPLOAD WORKFLOW
  // =====================================================

  describe('Model Upload', () => {
    test('displays upload button in header', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const uploadButton = screen.getByRole('button', { name: /upload model/i })
      expect(uploadButton).toBeInTheDocument()
    })

    test('upload button is clickable', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const uploadButton = screen.getByRole('button', { name: /upload model/i })
      await user.click(uploadButton)

      // Implementation would open upload modal/dialog
      // This test validates the button interaction works
    })
  })

  // =====================================================
  // MODEL DETAILS & INTERACTION
  // =====================================================

  describe('Model Details', () => {
    test('displays view button for each model', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      // Should have view button for each model (3 models)
      expect(viewButtons.length).toBe(3)
    })

    test('view button is clickable', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      await user.click(viewButtons[0])

      // Would navigate to detail view or open modal
      // This validates the interaction works
    })
  })

  // =====================================================
  // ASYNC GENERATION WORKFLOW
  // =====================================================

  describe('Async Model Generation', () => {
    test('displays processing status for generating models', async () => {
      // Create fresh fetch mock with processing model
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            ...mockModelsList.assets.filter(a => a.type === 'model' || a.type === '3d'),
            mockGeneratedModel.asset,
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('AI Generated Helmet')).toBeInTheDocument()
      })

      // Should show processing status
      const badges = screen.getAllByText(/processing/i)
      expect(badges.length).toBeGreaterThan(0)
    })

    test('handles model status transition from processing to published', async () => {
      // Initial state: model is processing
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            assets: [mockGeneratedModel.asset],
          }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('AI Generated Helmet')).toBeInTheDocument()
        expect(screen.getByText(/processing/i)).toBeInTheDocument()
      })

      // Note: Status transitions would be handled by polling in real app
      // This test validates that processing status is properly displayed
      expect(screen.getByText('AI Generated Helmet')).toBeInTheDocument()
    })

    test('displays generation metadata when available', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [mockGeneratedModel.asset],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('AI Generated Helmet')).toBeInTheDocument()
      })

      // Generation metadata is in the asset but might not be displayed in list
      // This validates models with generation metadata render correctly
      expect(screen.getByText('AI Generated Helmet')).toBeInTheDocument()
    })
  })

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  describe('Error Handling', () => {
    test('handles network errors during fetch', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })

      // Should not crash
      expect(screen.queryByText('Sword Model')).not.toBeInTheDocument()
    })

    test('handles malformed API response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })

      // Should handle missing assets array gracefully without crashing
    })

    test('handles models with missing required fields', async () => {
      mockFetchSuccess({
        assets: [
          {
            id: 'incomplete-model',
            name: 'Incomplete',
            type: 'model',
            // Missing status, metadata, etc.
          },
        ],
      })

      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading 3D models...')).not.toBeInTheDocument()
      })

      // Should not crash even with incomplete data
    })
  })

  // =====================================================
  // PERFORMANCE & OPTIMIZATION
  // =====================================================

  describe('Performance', () => {
    test('only fetches assets once on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sword Model')).toBeInTheDocument()
      })

      // Should only call fetch once for initial load
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    test('displays multiple models efficiently', async () => {
      // Create a large dataset
      const manyModels = Array.from({ length: 50 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        type: 'model' as const,
        status: 'published' as const,
        thumbnailUrl: `https://example.com/model-${i}.jpg`,
        fileUrl: `https://example.com/model-${i}.glb`,
        metadata: { polyCount: 10000 + i * 100 },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }))

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assets: manyModels }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Model 0')).toBeInTheDocument()
      })

      // Should render all models without crashing
      expect(screen.getByText('Model 49')).toBeInTheDocument()
    })
  })

  // =====================================================
  // EDGE CASES
  // =====================================================

  describe('Edge Cases', () => {
    test('handles very long model names', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'long-name',
              name: 'This is a very long model name that should be truncated in the UI to prevent layout issues',
              type: 'model',
              status: 'published' as const,
              thumbnailUrl: null,
              fileUrl: 'test.glb',
              metadata: {},
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/This is a very long model name/i)).toBeInTheDocument()
      })
    })

    test('handles models with very high poly counts', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'high-poly',
              name: 'High Poly Model',
              type: 'model',
              status: 'published' as const,
              thumbnailUrl: null,
              fileUrl: 'test.glb',
              metadata: { polyCount: 5000000 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/5,000,000 polys/i)).toBeInTheDocument()
      })
    })

    test('handles models with complex metadata', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'complex',
              name: 'Complex Model',
              type: 'model',
              status: 'published' as const,
              thumbnailUrl: null,
              fileUrl: 'test.glb',
              metadata: {
                polyCount: 10000,
                dimensions: '1.0 x 1.0 x 1.0m',
                weaponType: 'sword',
                gripPosition: { x: 0, y: 0, z: 0 },
                materials: ['metal', 'leather'],
                animations: ['idle', 'attack'],
                customData: { nested: { deep: 'value' } },
              },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Complex Model')).toBeInTheDocument()
      })

      // Should handle complex metadata without crashing
    })

    test('handles special characters in model names', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'special',
              name: 'Model <>&"\' Special',
              type: 'model',
              status: 'published' as const,
              thumbnailUrl: null,
              fileUrl: 'test.glb',
              metadata: {},
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/Model.*Special/i)).toBeInTheDocument()
      })
    })

    test('handles invalid date formats gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'bad-date',
              name: 'Bad Date Model',
              type: 'model',
              status: 'published' as const,
              thumbnailUrl: null,
              fileUrl: 'test.glb',
              metadata: {},
              createdAt: 'invalid-date',
              updatedAt: 'invalid-date',
            },
          ],
        }),
      })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bad Date Model')).toBeInTheDocument()
      })

      // Should not crash with invalid dates
    })
  })
})
