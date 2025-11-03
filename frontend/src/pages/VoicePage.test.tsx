/**
 * Voice Page Integration Tests
 * Tests the complete voice generation workflow including ElevenLabs integration
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import VoicePage from './VoicePage'
import { mockFetchSuccess, mockFetchError } from '../test/setup'

// Mock API responses
const mockVoiceProfiles = {
  profiles: [
    {
      id: 'profile-1',
      name: 'Wise Elder',
      description: 'Deep, authoritative voice with warm undertones',
      gender: 'male',
      age: 'elderly',
      accent: 'British',
      tone: 'Warm',
      serviceProvider: 'elevenlabs',
      serviceVoiceId: 'voice_abc123',
      sampleAudioUrl: 'https://example.com/samples/elder.mp3',
      tags: ['wise', 'mentor', 'elder'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'profile-2',
      name: 'Cheerful Merchant',
      description: 'Upbeat and friendly voice',
      gender: 'female',
      age: 'adult',
      accent: 'Southern',
      tone: 'Cheerful',
      serviceProvider: 'elevenlabs',
      serviceVoiceId: 'voice_xyz789',
      sampleAudioUrl: null,
      tags: ['merchant', 'friendly'],
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'profile-3',
      name: 'Inactive Voice',
      description: 'Test inactive profile',
      gender: 'neutral',
      age: 'young',
      accent: null,
      tone: 'Neutral',
      serviceProvider: 'elevenlabs',
      serviceVoiceId: null,
      sampleAudioUrl: null,
      tags: [],
      isActive: false,
      createdAt: '2024-01-03T00:00:00Z',
    },
  ],
}

const mockGenerations = {
  generations: [
    {
      id: 'gen-1',
      text: 'Welcome, traveler. What brings you to my shop today?',
      voiceProfileId: 'profile-2',
      npcId: 'npc-1',
      audioUrl: 'https://example.com/generations/gen1.mp3',
      duration: 4500,
      context: 'dialog',
      emotion: 'neutral',
      status: 'completed' as const,
      error: null,
      createdAt: '2024-01-10T00:00:00Z',
    },
    {
      id: 'gen-2',
      text: 'The ancient scrolls speak of great power...',
      voiceProfileId: 'profile-1',
      npcId: null,
      audioUrl: null,
      duration: null,
      context: 'narration',
      emotion: 'mysterious',
      status: 'processing' as const,
      error: null,
      createdAt: '2024-01-11T00:00:00Z',
    },
    {
      id: 'gen-3',
      text: 'Test failed generation',
      voiceProfileId: 'profile-1',
      npcId: null,
      audioUrl: null,
      duration: null,
      context: 'dialog',
      emotion: 'neutral',
      status: 'failed' as const,
      error: 'API key invalid',
      createdAt: '2024-01-12T00:00:00Z',
    },
  ],
}

const mockNewProfile = {
  profile: {
    id: 'profile-4',
    name: 'Test Profile',
    description: 'Test description',
    gender: 'male',
    age: 'adult',
    accent: 'British',
    tone: 'Authoritative',
    serviceProvider: 'elevenlabs',
    serviceVoiceId: 'voice_test123',
    sampleAudioUrl: null,
    tags: [],
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
  },
}

const mockNewGeneration = {
  generation: {
    id: 'gen-4',
    text: 'This is a test generation',
    voiceProfileId: 'profile-1',
    npcId: null,
    audioUrl: 'https://example.com/generations/test.mp3',
    duration: 3000,
    context: 'dialog',
    emotion: 'neutral',
    status: 'completed' as const,
    error: null,
    createdAt: '2024-01-15T00:00:00Z',
  },
}

// Wrapper component for routing
function renderPage() {
  return render(
    <BrowserRouter>
      <VoicePage />
    </BrowserRouter>
  )
}

describe('VoicePage - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful fetch of profiles and generations
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
  })

  // =====================================================
  // INITIAL LOADING & DISPLAY
  // =====================================================

  describe('Initial Loading', () => {
    test('displays loading state initially', () => {
      renderPage()
      expect(screen.getByText('Loading voice profiles...')).toBeInTheDocument()
    })

    test('fetches and displays voice profiles on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
        expect(screen.getByText('Cheerful Merchant')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/profiles'),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    test('fetches and displays generations on mount', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      // Switch to generations tab
      const user = userEvent.setup()
      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await waitFor(() => {
        expect(screen.getByText('Welcome, traveler. What brings you to my shop today?')).toBeInTheDocument()
      })
    })

    test('displays empty state when no profiles exist', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ profiles: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })

      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading voice profiles...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('No voice profiles yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first voice profile to get started!')).toBeInTheDocument()
    })

    test('handles API error gracefully', async () => {
      mockFetchError(500, 'Server error')
      renderPage()

      await waitFor(() => {
        expect(screen.queryByText('Loading voice profiles...')).not.toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // VOICE PROFILE CREATION
  // =====================================================

  describe('Voice Profile Creation', () => {
    test('opens create profile modal when "Create Profile" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /create profile/i })
      await user.click(createButton)

      expect(screen.getByText('Create Voice Profile')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/e.g., Wise Elder, Cheerful Merchant/i)).toBeInTheDocument()
    })

    test('validates required fields before creation', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create profile/i }))

      const createButton = screen.getByRole('button', { name: /^create profile$/i })
      expect(createButton).toBeDisabled()
    })

    test('successfully creates voice profile', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNewProfile })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            profiles: [...mockVoiceProfiles.profiles, mockNewProfile.profile],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create profile/i }))

      // Fill out form
      const nameInput = screen.getByPlaceholderText(/e.g., Wise Elder, Cheerful Merchant/i)
      const descriptionTextarea = screen.getByPlaceholderText(/describe the voice characteristics/i)

      await user.type(nameInput, 'Test Profile')
      await user.type(descriptionTextarea, 'Test description')

      // Select gender
      const genderSelect = screen.getByRole('combobox', { name: /gender/i })
      await user.selectOptions(genderSelect, 'male')

      // Select age
      const ageSelect = screen.getByRole('combobox', { name: /age/i })
      await user.selectOptions(ageSelect, 'adult')

      // Fill accent
      const accentInput = screen.getByPlaceholderText(/e.g., British, Southern, French/i)
      await user.type(accentInput, 'British')

      // Fill tone
      const toneInput = screen.getByPlaceholderText(/e.g., Warm, Mysterious, Authoritative/i)
      await user.type(toneInput, 'Authoritative')

      // Submit
      const submitButton = screen.getByRole('button', { name: /^create profile$/i })
      await user.click(submitButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/voice/profiles'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test Profile'),
            credentials: 'include',
          })
        )
      })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Create Voice Profile')).not.toBeInTheDocument()
      })
    })

    test('displays error when creation fails', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Creation failed' }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create profile/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Wise Elder, Cheerful Merchant/i), 'Test')

      await user.click(screen.getByRole('button', { name: /^create profile$/i }))

      // Modal should stay open (creation failed)
      await waitFor(() => {
        expect(screen.getByText('Create Voice Profile')).toBeInTheDocument()
      })
    })

    test('shows loading state during creation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => mockNewProfile }), 1000)
          )
        )

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create profile/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Wise Elder, Cheerful Merchant/i), 'Test')

      const submitButton = screen.getByRole('button', { name: /^create profile$/i })
      await user.click(submitButton)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VOICE GENERATION WORKFLOW
  // =====================================================

  describe('Voice Generation', () => {
    test('opens generation modal when "Generate Voice" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      // Switch to generations tab
      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      const generateButton = screen.getByRole('button', { name: /generate voice/i })
      await user.click(generateButton)

      expect(screen.getByText('Generate Voice')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/enter the text you want to convert to speech/i)).toBeInTheDocument()
    })

    test('validates required fields before generation', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await user.click(screen.getByRole('button', { name: /generate voice/i }))

      const submitButton = screen.getByRole('button', { name: /^generate voice$/i })
      expect(submitButton).toBeDisabled()
    })

    test('successfully generates voice', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNewGeneration })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            generations: [...mockGenerations.generations, mockNewGeneration.generation],
          }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await user.click(screen.getByRole('button', { name: /generate voice/i }))

      // Select voice profile
      const profileSelect = screen.getByRole('combobox', { name: /voice profile/i })
      await user.selectOptions(profileSelect, 'profile-1')

      // Enter text
      const textInput = screen.getByPlaceholderText(/enter the text you want to convert to speech/i)
      await user.type(textInput, 'This is a test generation')

      // Select context
      const contextSelect = screen.getByRole('combobox', { name: /context/i })
      await user.selectOptions(contextSelect, 'dialog')

      // Submit
      const submitButton = screen.getByRole('button', { name: /^generate voice$/i })
      await user.click(submitButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/voice/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('This is a test generation'),
            credentials: 'include',
          })
        )
      })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Generate Voice')).not.toBeInTheDocument()
      })
    })

    test('filters active profiles in generation modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await user.click(screen.getByRole('button', { name: /generate voice/i }))

      const profileSelect = screen.getByRole('combobox', { name: /voice profile/i })
      const options = within(profileSelect).getAllByRole('option')

      // Should only show active profiles (2 active + 1 placeholder)
      expect(options).toHaveLength(3)
      expect(within(profileSelect).queryByText('Inactive Voice')).not.toBeInTheDocument()
    })

    test('shows different emotion and context options', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await user.click(screen.getByRole('button', { name: /generate voice/i }))

      // Check context options
      const contextSelect = screen.getByRole('combobox', { name: /context/i })
      expect(within(contextSelect).getByText('Dialog')).toBeInTheDocument()
      expect(within(contextSelect).getByText('Narration')).toBeInTheDocument()
      expect(within(contextSelect).getByText('Combat Bark')).toBeInTheDocument()

      // Check emotion options
      const emotionSelect = screen.getByRole('combobox', { name: /emotion/i })
      expect(within(emotionSelect).getByText('Neutral')).toBeInTheDocument()
      expect(within(emotionSelect).getByText('Happy')).toBeInTheDocument()
      expect(within(emotionSelect).getByText('Sad')).toBeInTheDocument()
      expect(within(emotionSelect).getByText('Angry')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VOICE TESTING
  // =====================================================

  describe('Voice Testing', () => {
    test('can test a voice profile from detail modal', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ generation: mockNewGeneration.generation }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            generations: [...mockGenerations.generations, mockNewGeneration.generation],
          }),
        })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      // Click on a profile card
      const profileCard = screen.getByText('Wise Elder')
      await user.click(profileCard)

      // Find and click Test Voice button
      const testButton = screen.getByRole('button', { name: /test voice/i })
      await user.click(testButton)

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/voice/profiles/profile-1/test'),
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
          })
        )
      })

      // Should switch to generations tab
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generations \(/i })).toHaveClass(/bg-blue-600/)
      })
    })
  })

  // =====================================================
  // SEARCH & FILTERING
  // =====================================================

  describe('Search and Filtering', () => {
    test('filters profiles by search query', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
        expect(screen.getByText('Cheerful Merchant')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search profiles/i)
      await user.type(searchInput, 'elder')

      expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      expect(screen.queryByText('Cheerful Merchant')).not.toBeInTheDocument()
    })

    test('filters generations by search query', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await waitFor(() => {
        expect(screen.getByText('Welcome, traveler. What brings you to my shop today?')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search generations/i)
      await user.type(searchInput, 'ancient scrolls')

      expect(screen.getByText(/ancient scrolls speak of great power/i)).toBeInTheDocument()
      expect(screen.queryByText(/welcome, traveler/i)).not.toBeInTheDocument()
    })

    test('shows no matching message when search returns empty', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search profiles/i)
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No matching profiles')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search')).toBeInTheDocument()
    })
  })

  // =====================================================
  // TAB SWITCHING
  // =====================================================

  describe('Tab Navigation', () => {
    test('switches between profiles and generations tabs', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      // Initially on profiles tab
      expect(screen.getByRole('button', { name: /voice profiles \(/i })).toHaveClass(/bg-blue-600/)

      // Switch to generations
      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      expect(generationsTab).toHaveClass(/bg-blue-600/)
      await waitFor(() => {
        expect(screen.getByText('Welcome, traveler. What brings you to my shop today?')).toBeInTheDocument()
      })
    })

    test('displays correct action button based on active tab', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      // Profiles tab shows Create Profile button
      expect(screen.getByRole('button', { name: /create profile/i })).toBeInTheDocument()

      // Switch to generations
      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      // Generations tab shows Generate Voice button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate voice/i })).toBeInTheDocument()
      })
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
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const buttons = screen.getAllByRole('button')
      const gridButton = buttons.find((btn) => btn.querySelector('svg') && btn.classList.contains('bg-blue-600'))
      expect(gridButton).toBeInTheDocument()

      // Both view mode buttons should be present
      const viewModeButtons = buttons.filter((btn) => {
        const classes = Array.from(btn.classList).join(' ')
        return classes.includes('px-3') && classes.includes('py-1.5')
      })
      expect(viewModeButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  // =====================================================
  // GENERATION STATUS DISPLAY
  // =====================================================

  describe('Generation Status', () => {
    test('displays different status badges correctly', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument()
        expect(screen.getByText('processing')).toBeInTheDocument()
        expect(screen.getByText('failed')).toBeInTheDocument()
      })
    })

    test('displays error message for failed generations', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await waitFor(() => {
        expect(screen.getByText('API key invalid')).toBeInTheDocument()
      })
    })

    test('displays audio player only for completed generations', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await waitFor(() => {
        // AudioPlayer component should be rendered for completed generation
        const completedCard = screen
          .getByText('Welcome, traveler. What brings you to my shop today?')
          .closest('[class*="p-4"]')
        expect(completedCard).toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // PROFILE DETAIL MODAL
  // =====================================================

  describe('Profile Details', () => {
    test('opens detail modal when profile card is clicked', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const profileCard = screen.getByText('Wise Elder')
      await user.click(profileCard)

      // Should show profile details in modal
      await waitFor(() => {
        expect(screen.getByText('Voice Characteristics')).toBeInTheDocument()
        expect(screen.getByText('Service Configuration')).toBeInTheDocument()
      })
    })

    test('displays voice characteristics in detail modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Wise Elder'))

      await waitFor(() => {
        expect(screen.getByText('Gender')).toBeInTheDocument()
        expect(screen.getByText('male')).toBeInTheDocument()
        expect(screen.getByText('Age')).toBeInTheDocument()
        expect(screen.getByText('elderly')).toBeInTheDocument()
        expect(screen.getByText('Accent')).toBeInTheDocument()
        expect(screen.getByText('British')).toBeInTheDocument()
      })
    })

    test('displays service configuration in detail modal', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Wise Elder'))

      await waitFor(() => {
        expect(screen.getByText('Provider')).toBeInTheDocument()
        expect(screen.getByText('elevenlabs')).toBeInTheDocument()
        expect(screen.getByText('Voice ID')).toBeInTheDocument()
        expect(screen.getByText('voice_abc123')).toBeInTheDocument()
      })
    })

    test('displays sample audio player if available', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Wise Elder'))

      await waitFor(() => {
        expect(screen.getByText('Sample Audio')).toBeInTheDocument()
      })
    })
  })

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  describe('Error Handling', () => {
    test('handles network errors during generation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      const generationsTab = screen.getByRole('button', { name: /generations \(/i })
      await user.click(generationsTab)

      await user.click(screen.getByRole('button', { name: /generate voice/i }))

      const profileSelect = screen.getByRole('combobox', { name: /voice profile/i })
      await user.selectOptions(profileSelect, 'profile-1')

      await user.type(
        screen.getByPlaceholderText(/enter the text you want to convert to speech/i),
        'Test'
      )

      await user.click(screen.getByRole('button', { name: /^generate voice$/i }))

      // Should remain on modal (error occurred)
      await waitFor(() => {
        expect(screen.getByText('Generate Voice')).toBeInTheDocument()
      })
    })

    test('handles network errors during profile creation', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockVoiceProfiles })
        .mockResolvedValueOnce({ ok: true, json: async () => mockGenerations })
        .mockRejectedValueOnce(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Wise Elder')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create profile/i }))
      await user.type(screen.getByPlaceholderText(/e.g., Wise Elder, Cheerful Merchant/i), 'Test')
      await user.click(screen.getByRole('button', { name: /^create profile$/i }))

      // Should remain on modal (error occurred)
      await waitFor(() => {
        expect(screen.getByText('Create Voice Profile')).toBeInTheDocument()
      })
    })
  })
})
