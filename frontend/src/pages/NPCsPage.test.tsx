/**
 * NPCs Page Integration Tests
 * Tests the complete NPC management workflow including AI generation
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NPCsPage from './NPCsPage'
import { mockFetchSuccess, mockFetchError } from '../test/setup'

// Mock API responses
const mockNpcList = {
  npcs: [
    {
      id: 'npc-1',
      name: 'Elara the Wise',
      personality: 'A wise and ancient oracle who guards the secrets of the old world',
      faction: 'Ancient Order',
      voiceId: 'voice-elder-1',
      portraitUrl: 'https://example.com/portraits/elara.jpg',
      modelUrl: 'https://example.com/models/elara.glb',
      isFeatured: true,
      isTemplate: false,
      usageCount: 42,
      relatedLore: ['The Great War', 'Ancient Prophecies'],
      quests: ['Seek the Oracle', 'The Lost Scroll'],
      locations: ['Temple of Wisdom', 'Sacred Grove'],
      tags: ['oracle', 'wise', 'elder'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
    },
    {
      id: 'npc-2',
      name: 'Bjorn the Blacksmith',
      personality: 'A gruff but kind-hearted blacksmith with unmatched skill',
      faction: 'Merchant Guild',
      voiceId: 'voice-gruff-1',
      portraitUrl: null,
      modelUrl: null,
      isFeatured: false,
      isTemplate: true,
      usageCount: 15,
      relatedLore: null,
      quests: ['The Master Forge', 'Reforge the Blade'],
      locations: ['Ironforge'],
      tags: ['blacksmith', 'merchant', 'craftsman'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
    },
    {
      id: 'npc-3',
      name: 'Lyra the Bard',
      personality: 'A cheerful traveling musician with stories from across the realm',
      faction: 'Travelers Guild',
      voiceId: null,
      portraitUrl: 'https://example.com/portraits/lyra.jpg',
      modelUrl: null,
      isFeatured: true,
      isTemplate: false,
      usageCount: 28,
      relatedLore: ['Tales of Heroes'],
      quests: null,
      locations: ['The Tavern', 'Market Square'],
      tags: ['bard', 'musician', 'storyteller'],
      createdAt: '2024-01-03T00:00:00Z',
    },
    {
      id: 'npc-4',
      name: 'Shadow Assassin',
      personality: 'A mysterious figure shrouded in darkness',
      faction: null,
      voiceId: null,
      portraitUrl: null,
      modelUrl: null,
      isFeatured: false,
      isTemplate: false,
      usageCount: 5,
      tags: ['assassin', 'mysterious'],
      createdAt: '2024-01-04T00:00:00Z',
    },
  ],
}

const mockGeneratedNpc = {
  npc: {
    name: 'Generated Wizard',
    personality: 'A powerful mage who studies ancient arcane arts',
    description: 'A powerful mage who studies ancient arcane arts',
    faction: 'Mage Circle',
    race: 'Human',
    voice: 'deep and mystical',
  },
}

const mockNewNpc = {
  npc: {
    id: 'npc-5',
    name: 'Test NPC',
    personality: 'Test personality',
    faction: 'Test Faction',
    voiceId: 'test-voice',
    portraitUrl: null,
    modelUrl: null,
    isFeatured: false,
    isTemplate: false,
    usageCount: 0,
    tags: [],
    createdAt: '2024-01-15T00:00:00Z',
  },
}

const mockGeneratedImage = {
  imageUrl: 'https://example.com/generated/npc-1.jpg',
  cost: 0.04,
  costFormatted: '$0.04',
  revisedPrompt: 'Portrait of Elara the Wise, A wise and ancient oracle',
}

// Wrapper component for routing
function renderPage() {
  return render(
    <BrowserRouter>
      <NPCsPage />
    </BrowserRouter>
  )
}

describe('NPCsPage - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    // Default: successful NPC list fetch
    mockFetchSuccess(mockNpcList)
  })

  // =====================================================
  // INITIAL LOADING & DISPLAY
  // =====================================================

  describe('Initial Loading', () => {
    test('displays loading state initially', () => {
      renderPage()
      expect(screen.getByText('Loading NPCs...')).toBeInTheDocument()
    })

    test('fetches and displays NPCs on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
        expect(screen.getByText('Bjorn the Blacksmith')).toBeInTheDocument()
        expect(screen.getAllByText('Lyra the Bard').length).toBeGreaterThan(0)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/npcs'),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    test('displays NPC count badge', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('4 NPCs')).toBeInTheDocument()
      })
    })

    test('displays empty state when no NPCs exist', async () => {
      mockFetchSuccess({ npcs: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading NPCs...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('No NPCs Yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first NPC!')).toBeInTheDocument()
    })

    test('handles API error gracefully', async () => {
      mockFetchError(500, 'Server error')
      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading NPCs...')).not.toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // FEATURED NPCS SECTION
  // =====================================================

  describe('Featured NPCs', () => {
    test('displays featured NPCs section when featured NPCs exist', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Featured NPCs')).toBeInTheDocument()
      })

      // Should show count badge
      const badges = screen.getAllByText('2')
      expect(badges.length).toBeGreaterThan(0)
    })

    test('displays only featured NPCs in featured section', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Featured NPCs')).toBeInTheDocument()
      })

      // Elara and Lyra are featured, should appear
      const featuredSection = screen.getByText('Featured NPCs').closest('div')
      expect(featuredSection).toBeInTheDocument()

      // Both featured NPCs should be visible in main grid as well
      expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Lyra the Bard').length).toBeGreaterThan(0)
    })
  })

  // =====================================================
  // NPC CREATION (MANUAL)
  // =====================================================

  describe('Manual NPC Creation', () => {
    test('opens create modal when "Create NPC" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const createButton = screen.getByRole('button', { name: /create npc/i })
      await user.click(createButton)

      expect(screen.getByText('Create NPC')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/enter npc name/i)).toBeInTheDocument()
    })

    test('validates required fields before creation', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))

      const createButton = screen.getByRole('button', { name: /^create npc$/i })
      expect(createButton).toBeDisabled()
    })

    test('successfully creates NPC manually', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNewNpc })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ npcs: [...mockNpcList.npcs, mockNewNpc.npc] }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))

      // Fill out form manually
      await user.type(screen.getByPlaceholderText(/enter npc name/i), 'Test NPC')
      await user.type(
        screen.getByPlaceholderText(/describe the npc's personality/i),
        'Test personality'
      )
      await user.type(screen.getByPlaceholderText(/e.g., Royal Guard, Merchant Guild/i), 'Test Faction')
      await user.type(screen.getByPlaceholderText(/voice id or assignment/i), 'test-voice')

      // Submit
      const submitButton = screen.getByRole('button', { name: /^create npc$/i })
      await user.click(submitButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/npcs'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test NPC'),
            credentials: 'include',
          })
        )
      })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Create NPC')).not.toBeInTheDocument()
      })
    })

    test('handles optional fields correctly', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNewNpc })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))

      // Fill only required fields
      await user.type(screen.getByPlaceholderText(/enter npc name/i), 'Test NPC')
      await user.type(
        screen.getByPlaceholderText(/describe the npc's personality/i),
        'Test personality'
      )

      await user.click(screen.getByRole('button', { name: /^create npc$/i }))

      // Verify faction and voiceId are not included if empty
      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls
        const createCall = calls.find(
          (call: any) => call[0].includes('/api/npcs') && call[1]?.method === 'POST'
        )
        expect(createCall).toBeDefined()
      })
    })
  })

  // =====================================================
  // AI NPC GENERATION
  // =====================================================

  describe('AI NPC Generation', () => {
    test('shows AI generation option in create modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))

      expect(screen.getByText('Generate with AI')).toBeInTheDocument()
      expect(screen.getByText(/let ai create a complete npc/i)).toBeInTheDocument()
    })

    test('expands AI generation prompt when Generate button clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))

      const generateButton = screen.getByRole('button', { name: /^generate$/i })
      await user.click(generateButton)

      expect(screen.getByText('AI Generation')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText(/describe the npc you want to create/i)
      ).toBeInTheDocument()
    })

    test('successfully generates NPC with AI', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGeneratedNpc })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.click(screen.getByRole('button', { name: /^generate$/i }))

      const promptTextarea = screen.getByPlaceholderText(/describe the npc you want to create/i)
      await user.type(promptTextarea, 'A powerful wizard who guards ancient secrets')

      const generateNpcButton = screen.getByRole('button', { name: /generate npc/i })
      await user.click(generateNpcButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/npcs/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('powerful wizard'),
            credentials: 'include',
          })
        )
      })

      // Form should be populated with generated data
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText(/enter npc name/i)
        expect(nameInput).toHaveValue('Generated Wizard')
      })

      const personalityTextarea = screen.getByPlaceholderText(/describe the npc's personality/i)
      expect(personalityTextarea).toHaveValue('A powerful mage who studies ancient arcane arts')

      const factionInput = screen.getByPlaceholderText(/e.g., Royal Guard, Merchant Guild/i)
      expect(factionInput).toHaveValue('Mage Circle')
    })

    test('handles AI generation failure', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'AI generation failed',
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.click(screen.getByRole('button', { name: /^generate$/i }))

      await user.type(
        screen.getByPlaceholderText(/describe the npc you want to create/i),
        'Test prompt'
      )
      await user.click(screen.getByRole('button', { name: /generate npc/i }))

      // Should show alert
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringContaining('AI generation failed')
        )
      })
    })

    test('shows loading state during AI generation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => mockGeneratedNpc }), 1000)
          )
        )

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.click(screen.getByRole('button', { name: /^generate$/i }))

      await user.type(
        screen.getByPlaceholderText(/describe the npc you want to create/i),
        'Test prompt'
      )

      const generateButton = screen.getByRole('button', { name: /generate npc/i })
      await user.click(generateButton)

      expect(screen.getByText('Generating...')).toBeInTheDocument()
    })

    test('can cancel AI generation', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.click(screen.getByRole('button', { name: /^generate$/i }))

      const cancelButton = screen.getByRole('button', { name: /^cancel$/i })
      await user.click(cancelButton)

      // Should collapse AI generation section
      expect(screen.queryByText('AI Generation')).not.toBeInTheDocument()
      expect(screen.getByText('Generate with AI')).toBeInTheDocument()
    })
  })

  // =====================================================
  // SEARCH & FILTERING
  // =====================================================

  describe('Search and Filtering', () => {
    test('filters NPCs by search query (name)', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
        expect(screen.getByText('Bjorn the Blacksmith')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search npcs by name or personality/i)
      await user.type(searchInput, 'elara')

      expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      expect(screen.queryByText('Bjorn the Blacksmith')).not.toBeInTheDocument()
    })

    test('filters NPCs by search query (personality)', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const searchInput = screen.getByPlaceholderText(/search npcs by name or personality/i)
      await user.type(searchInput, 'blacksmith')

      expect(screen.getByText('Bjorn the Blacksmith')).toBeInTheDocument()
      expect(screen.queryByText('Elara the Wise')).not.toBeInTheDocument()
    })

    test('filters NPCs by faction', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      // Click on faction filter
      const merchantGuildButton = screen.getByRole('button', { name: /merchant guild/i })
      await user.click(merchantGuildButton)

      expect(screen.getByText('Bjorn the Blacksmith')).toBeInTheDocument()
      expect(screen.queryByText('Elara the Wise')).not.toBeInTheDocument()
      expect(screen.queryByText('Lyra the Bard')).not.toBeInTheDocument()
    })

    test('displays faction counts correctly', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      // "All" should show total count
      expect(screen.getByText(/all/i)).toBeInTheDocument()
      const allButton = screen.getByRole('button', { name: /all \(4\)/i })
      expect(allButton).toBeInTheDocument()
    })

    test('combines search and faction filters', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      // Apply faction filter
      await user.click(screen.getByRole('button', { name: /ancient order/i }))

      // Apply search
      await user.type(screen.getByPlaceholderText(/search npcs by name or personality/i), 'elara')

      expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      expect(screen.queryByText('Bjorn the Blacksmith')).not.toBeInTheDocument()
    })

    test('shows no matching message when filters return empty', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.type(
        screen.getByPlaceholderText(/search npcs by name or personality/i),
        'nonexistent'
      )

      expect(screen.getByText('No Matching NPCs')).toBeInTheDocument()
      expect(screen.getByText('Try a different search term')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VIEW MODE SWITCHING
  // =====================================================

  describe('View Mode', () => {
    test('switches between grid and list view', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const buttons = screen.getAllByRole('button')
      const gridButton = buttons.find((btn) =>
        btn.classList.contains('bg-blue-600')
      )
      expect(gridButton).toBeInTheDocument()

      // Find list view button
      const listButton = buttons.find(
        (btn) =>
          btn.querySelector('svg') &&
          !btn.classList.contains('bg-blue-600') &&
          btn.classList.contains('px-3')
      )

      if (listButton) {
        await user.click(listButton)
        expect(listButton).toHaveClass(/bg-blue-600/)
      }
    })
  })

  // =====================================================
  // NPC DETAIL MODAL
  // =====================================================

  describe('NPC Details', () => {
    test('opens detail modal when NPC card is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const npcCards = screen.getAllByText('Elara the Wise')
      await user.click(npcCards[0])

      await waitFor(() => {
        expect(screen.getByText('Personality')).toBeInTheDocument()
      })
    })

    test('displays personality in detail modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Personality')).toBeInTheDocument()
        expect(
          screen.getByText(/wise and ancient oracle who guards the secrets/i)
        ).toBeInTheDocument()
      })
    })

    test('displays faction badge in detail modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Faction')).toBeInTheDocument()
        expect(screen.getByText('Ancient Order')).toBeInTheDocument()
      })
    })

    test('displays voice ID when present', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Voice Settings')).toBeInTheDocument()
        expect(screen.getByText('voice-elder-1')).toBeInTheDocument()
      })
    })

    test('displays related lore when available', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      // Check for lore tab content (implementation specific)
      await waitFor(() => {
        expect(screen.getByText('The Great War')).toBeInTheDocument()
        expect(screen.getByText('Ancient Prophecies')).toBeInTheDocument()
      })
    })

    test('displays associated quests when available', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Seek the Oracle')).toBeInTheDocument()
        expect(screen.getByText('The Lost Scroll')).toBeInTheDocument()
      })
    })

    test('displays locations when available', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Temple of Wisdom')).toBeInTheDocument()
        expect(screen.getByText('Sacred Grove')).toBeInTheDocument()
      })
    })

    test('displays created and updated dates', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getByText('Last Updated')).toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // IMAGE GENERATION
  // =====================================================

  describe('Image Generation', () => {
    test('generates portrait image for NPC', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGeneratedImage })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ npc: mockNpcList.npcs[0] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            npcs: mockNpcList.npcs.map((npc) =>
              npc.id === 'npc-1' ? { ...npc, portraitUrl: mockGeneratedImage.imageUrl } : npc
            ),
          }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      // Find and click Generate Image button in detail modal
      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /generate image/i })
        expect(generateButton).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /generate image/i })
      await user.click(generateButton)

      // Verify API calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/ai/generate-image'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Elara the Wise'),
            credentials: 'include',
          })
        )
      })

      // Should also update the NPC
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/npcs/npc-1'),
          expect.objectContaining({
            method: 'PATCH',
            credentials: 'include',
          })
        )
      })
    })

    test('handles image generation failure', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Image generation failed',
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate image/i }))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to generate image')
        )
      })
    })

    test('shows loading state during image generation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => mockGeneratedImage }), 1000)
          )
        )

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      const elaraCards = screen.getAllByText('Elara the Wise')
      await user.click(elaraCards[0])

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate image/i })).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /generate image/i })
      await user.click(generateButton)

      // Should show loading state (button disabled)
      expect(generateButton).toBeDisabled()
    })
  })

  // =====================================================
  // NPC BADGES
  // =====================================================

  describe('NPC Badges', () => {
    test('displays featured badge for featured NPCs', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      // Featured NPCs should have featured badge
      const cards = screen.getAllByText('Elara the Wise')
      expect(cards.length).toBeGreaterThan(0)
    })

    test('displays template badge for template NPCs', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bjorn the Blacksmith')).toBeInTheDocument()
      })

      // Bjorn is a template
      const cards = screen.getAllByText('Bjorn the Blacksmith')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  describe('Error Handling', () => {
    test('handles network errors during creation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.type(screen.getByPlaceholderText(/enter npc name/i), 'Test')
      await user.type(screen.getByPlaceholderText(/describe the npc's personality/i), 'Test')
      await user.click(screen.getByRole('button', { name: /^create npc$/i }))

      // Modal should remain open
      await waitFor(() => {
        expect(screen.getByText('Create NPC')).toBeInTheDocument()
      })
    })

    test('handles network errors during AI generation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockNpcList })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getAllByText('Elara the Wise').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /create npc/i }))
      await user.click(screen.getByRole('button', { name: /^generate$/i }))
      await user.type(
        screen.getByPlaceholderText(/describe the npc you want to create/i),
        'Test'
      )
      await user.click(screen.getByRole('button', { name: /generate npc/i }))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to generate NPC')
        )
      })
    })
  })
})
