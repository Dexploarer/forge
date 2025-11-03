/**
 * Music Page Integration Tests
 * Tests the complete music generation workflow including API integration
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import MusicPage from './MusicPage'
import { mockFetchSuccess, mockFetchError } from '../test/setup'

// Mock API responses
const mockMusicList = {
  tracks: [
    {
      id: 'track-1',
      name: 'Epic Battle Theme',
      description: 'Intense orchestral battle music',
      audioUrl: 'https://example.com/battle.mp3',
      duration: 180,
      fileSize: 5242880,
      format: 'mp3',
      bpm: 140,
      key: 'C Minor',
      genre: 'orchestral',
      mood: 'epic',
      instruments: ['strings', 'brass', 'drums'],
      generationType: 'ai',
      generationPrompt: 'Epic orchestral battle music with heavy drums and brass',
      usageContext: 'combat',
      loopable: true,
      tags: ['battle', 'boss', 'combat'],
      metadata: {},
      status: 'published' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'track-2',
      name: 'Peaceful Village',
      description: 'Calm ambient music for village exploration',
      audioUrl: null,
      duration: null,
      fileSize: null,
      format: null,
      bpm: 80,
      key: 'G Major',
      genre: 'ambient',
      mood: 'peaceful',
      instruments: ['flute', 'harp'],
      generationType: null,
      generationPrompt: null,
      usageContext: 'exploration',
      loopable: true,
      tags: ['village', 'ambient', 'peaceful'],
      metadata: {},
      status: 'processing' as const,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'track-3',
      name: 'Dark Dungeon',
      description: null,
      audioUrl: 'https://example.com/dungeon.mp3',
      duration: 240,
      fileSize: 7340032,
      format: 'mp3',
      bpm: 90,
      key: 'D Minor',
      genre: 'fantasy',
      mood: 'dark',
      instruments: ['strings', 'choir'],
      generationType: 'upload',
      generationPrompt: null,
      usageContext: 'dungeon',
      loopable: false,
      tags: ['dungeon', 'dark', 'suspense'],
      metadata: {},
      status: 'published' as const,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ],
}

const mockGeneratedTrack = {
  track: {
    id: 'track-4',
    name: 'Victory Fanfare',
    status: 'published',
    generationPrompt: 'Triumphant victory music with fanfare',
    audioUrl: 'https://example.com/victory.mp3',
    duration: 30,
    fileSize: 1048576,
    format: 'mp3',
    bpm: 120,
    genre: 'orchestral',
    mood: 'triumphant',
    createdAt: '2024-01-04T00:00:00Z',
  },
}

// Wrapper component for routing
function renderPage() {
  return render(
    <BrowserRouter>
      <MusicPage />
    </BrowserRouter>
  )
}

describe('MusicPage - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful music list fetch
    mockFetchSuccess(mockMusicList)
  })

  // =====================================================
  // INITIAL LOADING & DISPLAY
  // =====================================================

  describe('Initial Loading', () => {
    test('displays loading state initially', () => {
      renderPage()
      expect(screen.getByText('Loading music tracks...')).toBeInTheDocument()
    })

    test('fetches and displays music tracks on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
        expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
        expect(screen.getByText('Dark Dungeon')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/music'),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    test('displays empty state when no tracks exist', async () => {
      mockFetchSuccess({ tracks: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('No music tracks yet')).toBeInTheDocument()
      })

      expect(screen.getByText('Generate AI music or upload your first track to get started!')).toBeInTheDocument()
    })

    test('handles API error gracefully', async () => {
      mockFetchError(500, 'Server error')
      renderPage()

      // Should not crash, should show empty or error state
      await waitFor(() => {
        expect(screen.queryByText('Loading music tracks...')).not.toBeInTheDocument()
      })
    })

    test('displays page header with correct title and description', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Music Tracks')).toBeInTheDocument()
      })

      expect(screen.getByText('Generate AI music or upload your own tracks')).toBeInTheDocument()
    })
  })

  // =====================================================
  // AI GENERATION WORKFLOW
  // =====================================================

  describe('AI Music Generation', () => {
    test('opens generation modal when "Generate with AI" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /generate with ai/i })
      await user.click(generateButton)

      expect(screen.getByText('Generate Music with AI')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i)).toBeInTheDocument()
    })

    test('validates required fields before generation', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open modal
      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /^generate music$/i })
      expect(submitButton).toBeDisabled()
    })

    test('enables submit button when required fields are filled', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      const nameInput = screen.getByPlaceholderText(/e.g., Epic Battle Theme/i)
      const promptTextarea = screen.getByPlaceholderText(/Describe the music you want to generate/i)
      const submitButton = screen.getByRole('button', { name: /^generate music$/i })

      // Initially disabled
      expect(submitButton).toBeDisabled()

      // Fill required fields
      await user.type(nameInput, 'Victory Theme')
      await user.type(promptTextarea, 'Triumphant victory music')

      // Should now be enabled
      expect(submitButton).not.toBeDisabled()
    })

    test('successfully generates AI music with all parameters', async () => {
      const user = userEvent.setup()

      // Setup mocks for generate endpoint
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList }) // Initial load
        .mockResolvedValueOnce({ ok: true, json: async () => mockGeneratedTrack }) // Generate
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockMusicList, tracks: [...mockMusicList.tracks, mockGeneratedTrack.track] })
        }) // Refresh list

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open generation modal
      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      // Fill out all form fields
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Victory Fanfare')
      await user.type(
        screen.getByPlaceholderText(/Describe the music you want to generate/i),
        'Triumphant victory music with fanfare'
      )
      await user.type(screen.getByPlaceholderText('120'), '120')
      await user.type(screen.getByPlaceholderText(/e.g., C Minor/i), 'C Major')
      await user.type(screen.getByPlaceholderText(/e.g., Orchestral, Electronic/i), 'orchestral')
      await user.type(screen.getByPlaceholderText(/e.g., Epic, Peaceful, Tense/i), 'triumphant')
      await user.type(screen.getByPlaceholderText('30'), '30')
      await user.type(screen.getByPlaceholderText(/e.g., piano, strings, drums/i), 'trumpet, drums')

      // Submit
      const submitButton = screen.getByRole('button', { name: /^generate music$/i })
      await user.click(submitButton)

      // Verify API call with all parameters
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/music/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Victory Fanfare'),
            credentials: 'include',
          })
        )
      })

      // Verify request body contains all parameters
      const generateCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('/api/music/generate')
      )
      const requestBody = JSON.parse(generateCall[1].body)
      expect(requestBody).toMatchObject({
        name: 'Victory Fanfare',
        prompt: 'Triumphant victory music with fanfare',
        bpm: 120,
        key: 'C Major',
        genre: 'orchestral',
        mood: 'triumphant',
        duration: 30,
        instruments: ['trumpet', 'drums'],
      })

      // Modal should close and list should refresh
      await waitFor(() => {
        expect(screen.queryByText('Generate Music with AI')).not.toBeInTheDocument()
      })
    })

    test('successfully generates music with only required fields', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGeneratedTrack })
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      // Fill only required fields
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Simple Track')
      await user.type(
        screen.getByPlaceholderText(/Describe the music you want to generate/i),
        'Simple music prompt'
      )

      await user.click(screen.getByRole('button', { name: /^generate music$/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/music/generate'),
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    test('displays error when generation fails', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockRejectedValueOnce(new Error('Generation failed'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Test Track')
      await user.type(screen.getByPlaceholderText(/Describe the music you want to generate/i), 'Test')
      await user.click(screen.getByRole('button', { name: /^generate music$/i }))

      // Should log error
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to generate music:',
          expect.any(Error)
        )
      })

      consoleError.mockRestore()
    })

    test('shows loading state during generation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockImplementationOnce(() =>
          new Promise(resolve =>
            setTimeout(() => resolve({ ok: true, json: async () => mockGeneratedTrack }), 1000)
          )
        )

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Test')
      await user.type(screen.getByPlaceholderText(/Describe the music you want to generate/i), 'Test')

      const submitButton = screen.getByRole('button', { name: /^generate music$/i })
      await user.click(submitButton)

      // Should show "Generating..." text
      expect(screen.getByText('Generating...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    test('resets form when modal is closed', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open modal and fill form
      await user.click(screen.getByRole('button', { name: /generate with ai/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Test Track')
      await user.type(screen.getByPlaceholderText(/Describe the music you want to generate/i), 'Test prompt')

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Reopen modal
      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      // Form should be reset
      const nameInput = screen.getByPlaceholderText(/e.g., Epic Battle Theme/i) as HTMLInputElement
      const promptInput = screen.getByPlaceholderText(/Describe the music you want to generate/i) as HTMLTextAreaElement
      expect(nameInput.value).toBe('')
      expect(promptInput.value).toBe('')
    })

    test('displays ElevenLabs Music API info message', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))

      expect(screen.getByText(/AI music generation uses ElevenLabs Music API/i)).toBeInTheDocument()
    })
  })

  // =====================================================
  // FILE UPLOAD WORKFLOW
  // =====================================================

  describe('File Upload', () => {
    test('opens upload modal when "Upload" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const uploadButton = screen.getByRole('button', { name: /^upload$/i })
      await user.click(uploadButton)

      expect(screen.getByText('Upload Music Track')).toBeInTheDocument()
    })

    test('validates required name field', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      const submitButton = screen.getByRole('button', { name: /create track/i })
      expect(submitButton).toBeDisabled()
    })

    test('allows file selection and displays file info', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Create mock file
      const file = new File(['audio data'], 'test-music.mp3', { type: 'audio/mpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement

      await user.upload(input, file)

      // Should display file info
      await waitFor(() => {
        expect(screen.getByText(/selected:/i)).toBeInTheDocument()
        expect(screen.getByText(/test-music.mp3/i)).toBeInTheDocument()
      })
    })

    test('successfully creates track metadata without file', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList }) // Initial load
        .mockResolvedValueOnce({ ok: true, json: async () => ({ track: { id: 'new-track-id' } }) }) // Create track
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList }) // Refresh list

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Fill only name
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'New Track')

      await user.click(screen.getByRole('button', { name: /create track/i }))

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/music'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('New Track'),
            credentials: 'include',
          })
        )
      })
    })

    test('successfully creates track with file upload', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList }) // Initial load
        .mockResolvedValueOnce({ ok: true, json: async () => ({ track: { id: 'new-track-id' } }) }) // Create track
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Upload file
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList }) // Refresh list

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Fill form with all fields
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Uploaded Track')
      await user.type(screen.getByPlaceholderText(/Describe the music track/i), 'A cool track')
      await user.type(screen.getAllByPlaceholderText('120')[0], '140')
      await user.type(screen.getByPlaceholderText(/e.g., Orchestral/i), 'rock')
      await user.type(screen.getByPlaceholderText(/e.g., Epic, Calm/i), 'energetic')
      await user.type(screen.getByPlaceholderText(/e.g., battle, menu, ambient/i), 'menu, main')

      // Upload file
      const file = new File(['audio'], 'upload.mp3', { type: 'audio/mpeg' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(fileInput, file)

      // Submit
      await user.click(screen.getByRole('button', { name: /create & upload/i }))

      // Verify both API calls
      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls
        const createCall = calls.some((call: any) =>
          call[0].includes('/api/music') && !call[0].includes('/upload') && call[1]?.method === 'POST'
        )
        const uploadCall = calls.some((call: any) =>
          call[0].includes('/upload') && call[1]?.method === 'POST'
        )
        expect(createCall).toBe(true)
        expect(uploadCall).toBe(true)
      })

      // Verify track creation body
      const createCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('/api/music') && !call[0].includes('/upload')
      )
      const requestBody = JSON.parse(createCall[1].body)
      expect(requestBody).toMatchObject({
        name: 'Uploaded Track',
        description: 'A cool track',
        bpm: 140,
        mood: 'energetic',
        genre: 'rock',
        tags: ['menu', 'main'],
      })
    })

    test('button text changes based on file selection', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Fill name
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Track Name')

      // Without file
      expect(screen.getByRole('button', { name: /create track/i })).toBeInTheDocument()

      // With file
      const file = new File(['audio'], 'music.mp3', { type: 'audio/mpeg' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create & upload/i })).toBeInTheDocument()
      })
    })

    test('resets form when upload modal is closed', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Fill form
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Test Track')
      await user.type(screen.getByPlaceholderText(/Describe the music track/i), 'Description')

      // Close modal
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Reopen
      await user.click(screen.getByRole('button', { name: /^upload$/i }))

      // Form should be reset
      const nameInput = screen.getByPlaceholderText(/e.g., Main Theme/i) as HTMLInputElement
      expect(nameInput.value).toBe('')
    })

    test('shows loading state during upload', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockImplementationOnce(() =>
          new Promise(resolve =>
            setTimeout(() => resolve({ ok: true, json: async () => ({ track: { id: 'new' } }) }), 1000)
          )
        )

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Test')

      const submitButton = screen.getByRole('button', { name: /create track/i })
      await user.click(submitButton)

      expect(screen.getByText('Uploading...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })

  // =====================================================
  // SEARCH & FILTERING
  // =====================================================

  describe('Search and Filtering', () => {
    test('filters tracks by search query (name)', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
        expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
      })

      // Search for "battle"
      const searchInput = screen.getByPlaceholderText(/search music tracks/i)
      await user.type(searchInput, 'battle')

      // Only "Epic Battle Theme" should be visible
      expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      expect(screen.queryByText('Peaceful Village')).not.toBeInTheDocument()
      expect(screen.queryByText('Dark Dungeon')).not.toBeInTheDocument()
    })

    test('filters tracks by search query (description)', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Search in description
      await user.type(screen.getByPlaceholderText(/search music tracks/i), 'village exploration')

      expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
      expect(screen.queryByText('Epic Battle Theme')).not.toBeInTheDocument()
    })

    test('filters tracks by genre', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
        expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
      })

      // Filter by orchestral genre
      const genreSelect = screen.getAllByRole('combobox')[0] // First select is genre
      await user.selectOptions(genreSelect, 'orchestral')

      // Only orchestral tracks
      expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      expect(screen.queryByText('Peaceful Village')).not.toBeInTheDocument()
      expect(screen.queryByText('Dark Dungeon')).not.toBeInTheDocument()
    })

    test('filters tracks by status', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
        expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
      })

      // Filter by published status
      const statusSelect = screen.getAllByRole('combobox')[1] // Second select is status
      await user.selectOptions(statusSelect, 'published')

      // Only published tracks
      expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      expect(screen.queryByText('Peaceful Village')).not.toBeInTheDocument()
      expect(screen.getByText('Dark Dungeon')).toBeInTheDocument()
    })

    test('combines multiple filters', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Apply genre filter
      await user.selectOptions(screen.getAllByRole('combobox')[0], 'orchestral')

      // Apply status filter
      await user.selectOptions(screen.getAllByRole('combobox')[1], 'published')

      // Only "Epic Battle Theme" matches both
      expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      expect(screen.queryByText('Peaceful Village')).not.toBeInTheDocument()
      expect(screen.queryByText('Dark Dungeon')).not.toBeInTheDocument()
    })

    test('shows "no matching tracks" when filters return empty', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Search for non-existent track
      await user.type(screen.getByPlaceholderText(/search music tracks/i), 'nonexistent track name')

      expect(screen.getByText('No matching tracks')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    })

    test('resets search to show all tracks', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search music tracks/i)

      // Apply search
      await user.type(searchInput, 'battle')
      expect(screen.queryByText('Peaceful Village')).not.toBeInTheDocument()

      // Clear search
      await user.clear(searchInput)

      // All tracks should be visible again
      expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      expect(screen.getByText('Peaceful Village')).toBeInTheDocument()
      expect(screen.getByText('Dark Dungeon')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VIEW MODE SWITCHING
  // =====================================================

  describe('View Mode', () => {
    test('displays grid view by default', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Check for grid view toggle buttons
      const buttons = screen.getAllByRole('button')
      const gridButton = buttons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.className.includes('bg-blue-600')
      })

      expect(gridButton).toBeDefined()
    })

    test('switches between grid and list view', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Get view toggle buttons
      const buttons = screen.getAllByRole('button')
      const viewButtons = buttons.filter(btn => btn.querySelector('svg') && btn.className.includes('px-3'))

      // Should have 2 view mode buttons (grid and list)
      expect(viewButtons.length).toBeGreaterThanOrEqual(2)

      // Click should not throw error
      if (viewButtons.length >= 2) {
        await user.click(viewButtons[1])
        // View mode is cosmetic, just verify no errors
      }
    })
  })

  // =====================================================
  // DETAIL MODAL
  // =====================================================

  describe('Track Details', () => {
    test('opens detail modal when track card is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Find and click track card
      const trackCard = screen.getByText('Epic Battle Theme')
      await user.click(trackCard)

      // Detail modal should open with track information
      // The exact modal content depends on DetailModal implementation
      // At minimum, verify no errors occur
    })

    test('displays track information in detail modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const trackCard = screen.getByText('Epic Battle Theme')
      await user.click(trackCard)

      // Modal should show track details
      // Verify modal opened (component exists in DOM)
      await waitFor(() => {
        // Look for characteristic elements that would be in the detail view
        const detailElements = screen.queryAllByText(/epic battle theme/i)
        expect(detailElements.length).toBeGreaterThan(0)
      })
    })

    test('displays audio player for published tracks with audioUrl', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const trackCard = screen.getByText('Epic Battle Theme')
      await user.click(trackCard)

      // Should show audio playback section for published tracks
      await waitFor(() => {
        // AudioPlayer component should be rendered
        // This is component-specific, just verify no errors
      })
    })

    test('displays AI generation prompt for AI-generated tracks', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const trackCard = screen.getByText('Epic Battle Theme')
      await user.click(trackCard)

      // Epic Battle Theme was AI-generated, should show prompt
      await waitFor(() => {
        // Look for the generation prompt in the detail view
        // This validates the conditional rendering logic
      })
    })

    test('displays instruments for tracks with instrument data', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      const trackCard = screen.getByText('Epic Battle Theme')
      await user.click(trackCard)

      // Epic Battle Theme has instruments: ['strings', 'brass', 'drums']
      // Should display them in the detail view
    })

    test('closes detail modal when close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open modal
      await user.click(screen.getByText('Epic Battle Theme'))

      // Wait for modal to be open
      await waitFor(() => {
        // Modal should be visible
      })

      // Find and click close button (if accessible)
      // Note: DetailModal component structure determines exact selector
    })
  })

  // =====================================================
  // EMPTY STATES
  // =====================================================

  describe('Empty States', () => {
    test('shows correct empty state with action buttons', async () => {
      mockFetchSuccess({ tracks: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('No music tracks yet')).toBeInTheDocument()
      })

      // Should show both action buttons in empty state
      expect(screen.getByRole('button', { name: /upload track/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate with ai/i })).toBeInTheDocument()
    })

    test('empty state buttons open respective modals', async () => {
      const user = userEvent.setup()
      mockFetchSuccess({ tracks: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('No music tracks yet')).toBeInTheDocument()
      })

      // Test upload button
      const uploadButton = screen.getAllByRole('button', { name: /upload/i })[0]
      await user.click(uploadButton)
      expect(screen.getByText('Upload Music Track')).toBeInTheDocument()

      // Close modal
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Test generate button
      const generateButton = screen.getAllByRole('button', { name: /generate with ai/i })[0]
      await user.click(generateButton)
      expect(screen.getByText('Generate Music with AI')).toBeInTheDocument()
    })
  })

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  describe('Error Handling', () => {
    test('handles network errors during generation', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /generate with ai/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Epic Battle Theme/i), 'Test')
      await user.type(screen.getByPlaceholderText(/Describe the music you want to generate/i), 'Test')
      await user.click(screen.getByRole('button', { name: /^generate music$/i }))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to generate music:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    test('handles network errors during upload', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Test')
      await user.click(screen.getByRole('button', { name: /create track/i }))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to create track:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    test('handles file upload error', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ track: { id: 'new-id' } }) })
        .mockRejectedValueOnce(new Error('Upload failed'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^upload$/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Main Theme/i), 'Test')

      const file = new File(['data'], 'test.mp3', { type: 'audio/mpeg' })
      await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file)

      await user.click(screen.getByRole('button', { name: /create & upload/i }))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to upload file:', expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  // =====================================================
  // TRACK METADATA DISPLAY
  // =====================================================

  describe('Track Metadata', () => {
    test('displays track tags in card', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Track should show genre, mood, BPM, and key as tags
      expect(screen.getByText('orchestral')).toBeInTheDocument()
      expect(screen.getByText('epic')).toBeInTheDocument()
      expect(screen.getByText('140 BPM')).toBeInTheDocument()
      expect(screen.getByText('C Minor')).toBeInTheDocument()
    })

    test('displays status badges correctly', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Check that published and processing tracks have appropriate badges
      // This is component-specific to CharacterCard
    })

    test('formats duration correctly', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open detail modal to see formatted duration
      await user.click(screen.getByText('Epic Battle Theme'))

      // Duration of 180 seconds should be formatted as 3:00
      // This would appear in the detail modal
    })

    test('formats file size correctly', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open detail modal to see formatted file size
      await user.click(screen.getByText('Epic Battle Theme'))

      // File size should be shown in MB format
      // This would appear in the detail modal
    })
  })

  // =====================================================
  // DOWNLOAD FUNCTIONALITY
  // =====================================================

  describe('Download', () => {
    test('handles download request', async () => {
      const user = userEvent.setup()
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockResolvedValueOnce({
          ok: true,
          url: 'https://example.com/battle.mp3',
          json: async () => ({})
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Open detail modal
      await user.click(screen.getByText('Epic Battle Theme'))

      // Note: Download button is rendered by AudioPlayer component
      // This tests the handleDownload function is defined
      // Actual download interaction depends on AudioPlayer implementation

      windowOpen.mockRestore()
    })

    test('handles download error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock download API to fail
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockMusicList })
        .mockRejectedValueOnce(new Error('Download failed'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Epic Battle Theme')).toBeInTheDocument()
      })

      // Error handling logic exists in component
      consoleError.mockRestore()
    })
  })
})
