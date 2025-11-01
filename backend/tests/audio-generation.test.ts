import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, musicTracks, soundEffects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Audio Generation Tests', () => {
  let ownerUserId: string
  let ownerToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'audio-gen-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'audio-gen-test-owner',
      email: 'audiogenowner@test.com',
      displayName: 'Audio Gen Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-audiogenowner-token'
  })

  // =====================================================
  // MUSIC GENERATION TESTS
  // =====================================================

  test('POST /api/music/generate returns proper status code', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Test Battle Music',
        prompt: 'Epic orchestral battle music with drums and strings',
        genre: 'orchestral',
        mood: 'epic',
        duration: 30,
      }
    })

    // Should be 201 whether successful or failed
    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.track).toBeDefined()
    expect(body.track.id).toBeDefined()
    expect(body.track.name).toBe('Test Battle Music')

    // Status should be 'processing', 'published' (success), or 'failed' (no API key/paid plan)
    expect(['processing', 'published', 'failed']).toContain(body.track.status)
  }, 60000)

  test('POST /api/music/generate creates database record', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Test Ambient Music',
        prompt: 'Calm ambient music for exploration',
        genre: 'ambient',
        mood: 'calm',
      }
    })

    const { track } = JSON.parse(response.body)

    // Verify database record
    const dbTrack = await testServer.db.query.musicTracks.findFirst({
      where: eq(musicTracks.id, track.id)
    })

    expect(dbTrack).toBeDefined()
    expect(dbTrack!.name).toBe('Test Ambient Music')
    expect(dbTrack!.generationService).toBe('elevenlabs')
    expect(dbTrack!.generationType).toBe('ai')
    expect(dbTrack!.generationPrompt).toBe('Calm ambient music for exploration')
  }, 60000)

  test('POST /api/music/generate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music/generate',
      payload: {
        name: 'Test Music',
        prompt: 'Test prompt',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/music/generate validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: '', // Invalid: empty name
        prompt: 'Test prompt',
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // =====================================================
  // SFX GENERATION TESTS
  // =====================================================

  test('POST /api/sfx/generate returns proper status code', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Test Sword Clash',
        prompt: 'Metal sword clashing sound effect',
        category: 'combat',
        duration: 2,
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.sfx).toBeDefined()
    expect(body.sfx.id).toBeDefined()
    expect(body.sfx.name).toBe('Test Sword Clash')

    // Status should be 'processing', 'published' (success), or 'failed' (no API key/paid plan)
    expect(['processing', 'published', 'failed']).toContain(body.sfx.status)
  }, 30000)

  test('POST /api/sfx/generate creates database record', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Test Door Creak',
        prompt: 'Old wooden door creaking open slowly',
        category: 'environment',
        subcategory: 'doors',
        duration: 3,
      }
    })

    const { sfx } = JSON.parse(response.body)

    // Verify database record
    const dbSfx = await testServer.db.query.soundEffects.findFirst({
      where: eq(soundEffects.id, sfx.id)
    })

    expect(dbSfx).toBeDefined()
    expect(dbSfx!.name).toBe('Test Door Creak')
    expect(dbSfx!.generationService).toBe('elevenlabs')
    expect(dbSfx!.generationType).toBe('ai')
    expect(dbSfx!.generationPrompt).toBe('Old wooden door creaking open slowly')
    expect(dbSfx!.category).toBe('environment')
  }, 30000)

  test('POST /api/sfx/generate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx/generate',
      payload: {
        name: 'Test SFX',
        prompt: 'Test prompt',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/sfx/generate validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: '', // Invalid: empty name
        prompt: 'Test prompt',
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // =====================================================
  // NOTE: Integration Tests with Real ElevenLabs API
  // =====================================================
  // Testing actual music and SFX generation requires ELEVENLABS_API_KEY
  // and would make real API calls. These tests verify the route structure,
  // database operations, and API contract. Actual ElevenLabs integration
  // can be tested manually with a valid API key.
})
