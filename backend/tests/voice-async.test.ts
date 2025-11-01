import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, voiceProfiles, voiceGenerations } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Voice Generation Async Tests', () => {
  let ownerUserId: string
  let ownerToken: string
  let testVoiceProfileId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'voice-async-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'voice-async-test-owner',
      email: 'voiceasyncowner@test.com',
      displayName: 'Voice Async Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-voiceasyncowner-token'

    // Create test voice profile
    const [profile] = await testServer.db.insert(voiceProfiles).values({
      name: 'Test Voice Profile',
      ownerId: ownerUserId,
      serviceProvider: 'elevenlabs',
      serviceVoiceId: 'test-voice-id',
      isActive: true,
    }).returning()

    testVoiceProfileId = profile.id
  })

  // =====================================================
  // VOICE GENERATION ASYNC FLOW TESTS
  // =====================================================

  test('POST /api/voice/generate returns 202 Accepted', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Hello, this is a test.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    expect(body.generation).toBeDefined()
    expect(body.generation.id).toBeDefined()
    expect(body.generation.status).toBe('processing')
    expect(body.generation.statusUrl).toBeDefined()
    expect(body.generation.statusUrl).toContain('/api/voice/generations/')
  })

  test('POST /api/voice/generate creates generation with processing status', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Test voice generation.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    const generationId = body.generation.id

    // Check database for generation
    const generation = await testServer.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, generationId)
    })

    expect(generation).toBeDefined()
    expect(generation!.status).toBe('processing')
    expect(generation!.text).toBe('Test voice generation.')
    expect(generation!.voiceProfileId).toBe(testVoiceProfileId)
    expect(generation!.ownerId).toBe(ownerUserId)
  })

  test('GET /api/voice/generations/:id returns generation status', async () => {
    // Create generation
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Another test.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    const { generation } = JSON.parse(createResponse.body)

    // Check status immediately (should still be processing before async processor runs)
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations/${generation.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(statusResponse.statusCode).toBe(200)
    const body = JSON.parse(statusResponse.body)
    expect(body.generation).toBeDefined()
    // Status could be 'processing' or 'failed' depending on how fast the processor runs
    expect(['processing', 'failed']).toContain(body.generation.status)
    expect(body.generation.text).toBe('Another test.')
  })

  test('GET /api/voice/generations/:id requires ownership', async () => {
    // Cleanup: Delete any existing test user from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'voice-async-other')
    )

    // Create another user
    const [otherUser] = await testServer.db.insert(users).values({
      privyUserId: 'voice-async-other',
      email: 'voiceasyncother@test.com',
      role: 'member',
    }).returning()
    const otherToken = 'mock-voiceasyncother-token'

    // Create generation as owner
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Secret message.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    const { generation } = JSON.parse(createResponse.body)

    // Try to access as other user
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations/${generation.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })

    expect(statusResponse.statusCode).toBe(403)
  })

  test('POST /api/voice/generate validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: '', // Invalid: empty text
        voiceProfileId: testVoiceProfileId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/voice/generate requires valid voice profile', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Test text.',
        voiceProfileId: '00000000-0000-0000-0000-000000000000',
      }
    })

    expect(response.statusCode).toBe(404)
  })

  test('POST /api/voice/generate stores optional parameters', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Test with parameters.',
        voiceProfileId: testVoiceProfileId,
        speed: 1.2,
        pitch: 5,
        stability: 0.7,
        clarity: 0.8,
        context: 'dialog',
        emotion: 'happy',
      }
    })

    expect(response.statusCode).toBe(202)
    const { generation } = JSON.parse(response.body)

    // Check database immediately (before async processor modifies it)
    const gen = await testServer.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, generation.id)
    })

    expect(gen).toBeDefined()
    // Parameters should be stored from the initial insert
    expect(parseFloat(gen!.speed!)).toBe(1.2)
    expect(gen!.pitch).toBe(5)
    expect(parseFloat(gen!.stability!)).toBe(0.7)
    expect(parseFloat(gen!.clarity!)).toBe(0.8)
    expect(gen!.context).toBe('dialog')
    expect(gen!.emotion).toBe('happy')
    // Status could be 'processing' or 'failed' depending on async processor timing
    expect(['processing', 'failed']).toContain(gen!.status)
  })

  test('Completed generation shows audio URL', async () => {
    // Create generation manually with completed status
    const [generation] = await testServer.db.insert(voiceGenerations).values({
      text: 'Completed audio.',
      voiceProfileId: testVoiceProfileId,
      ownerId: ownerUserId,
      serviceProvider: 'elevenlabs',
      status: 'completed',
      audioUrl: 'https://example.com/audio.mp3',
      duration: 3000,
      fileSize: 48000,
      format: 'mp3',
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations/${generation.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.generation.status).toBe('completed')
    expect(body.generation.audioUrl).toBe('https://example.com/audio.mp3')
    expect(body.generation.duration).toBe(3000)
    expect(body.generation.format).toBe('mp3')
  })

  test('Failed generation shows error message', async () => {
    // Create generation manually with failed status
    const [generation] = await testServer.db.insert(voiceGenerations).values({
      text: 'Failed audio.',
      voiceProfileId: testVoiceProfileId,
      ownerId: ownerUserId,
      serviceProvider: 'elevenlabs',
      status: 'failed',
      error: 'ElevenLabs API error: Rate limit exceeded',
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations/${generation.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.generation.status).toBe('failed')
    expect(body.generation.error).toBe('ElevenLabs API error: Rate limit exceeded')
  })

  test('GET /api/voice/generations lists all user generations', async () => {
    // Create a few generations
    await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'First generation.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Second generation.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    // List generations
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/voice/generations',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.generations).toBeDefined()
    expect(Array.isArray(body.generations)).toBe(true)
    expect(body.generations.length).toBeGreaterThanOrEqual(2)
  })

  test('POST /api/voice/generate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      payload: {
        text: 'Test.',
        voiceProfileId: testVoiceProfileId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // NOTE: Integration Tests with Real ElevenLabs API
  // =====================================================
  // Testing actual voice generation requires ELEVENLABS_API_KEY
  // and would make real API calls. These tests verify the async
  // pattern, database updates, and API contract. Actual ElevenLabs
  // integration is tested separately.
})
