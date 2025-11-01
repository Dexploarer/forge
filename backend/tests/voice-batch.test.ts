import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, voiceProfiles, voiceGenerations } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Voice Batch Generation Tests', () => {
  let ownerUserId: string
  let ownerToken: string
  let testVoiceProfileId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'voice-batch-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'voice-batch-test-owner',
      email: 'voicebatchowner@test.com',
      displayName: 'Voice Batch Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-voicebatchowner-token'

    // Create test voice profile
    const [profile] = await testServer.db.insert(voiceProfiles).values({
      name: 'Batch Test Voice Profile',
      ownerId: ownerUserId,
      serviceProvider: 'elevenlabs',
      serviceVoiceId: 'test-voice-id',
      isActive: true,
    }).returning()

    testVoiceProfileId = profile.id
  })

  // =====================================================
  // VOICE BATCH GENERATION TESTS
  // =====================================================

  test('POST /api/voice/batch-generate creates multiple generations', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        lines: [
          {
            text: 'Hello, welcome to the shop!',
            voiceProfileId: testVoiceProfileId,
            context: 'dialog',
            emotion: 'happy',
          },
          {
            text: 'What can I help you with today?',
            voiceProfileId: testVoiceProfileId,
            context: 'dialog',
            emotion: 'neutral',
          },
          {
            text: 'Thank you for your business!',
            voiceProfileId: testVoiceProfileId,
            context: 'dialog',
            emotion: 'happy',
          },
        ],
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.generations).toHaveLength(3)

    // Verify all generations were created
    for (const gen of body.generations) {
      expect(gen.id).toBeDefined()
      expect(gen.voiceProfileId).toBe(testVoiceProfileId)
      expect(gen.status).toBe('processing')
    }
  })

  test('POST /api/voice/batch-generate triggers async processing', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        lines: [
          {
            text: 'First line for async test',
            voiceProfileId: testVoiceProfileId,
          },
        ],
      }
    })

    const { generations } = JSON.parse(response.body)
    const generationId = generations[0].id

    // Check database immediately
    const generation = await testServer.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, generationId)
    })

    expect(generation).toBeDefined()
    // Status could be 'processing' or 'failed' depending on async processor timing
    expect(['processing', 'failed']).toContain(generation!.status)
  })

  test('POST /api/voice/batch-generate validates max lines', async () => {
    const lines = Array.from({ length: 101 }, (_, i) => ({
      text: `Line ${i + 1}`,
      voiceProfileId: testVoiceProfileId,
    }))

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { lines }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/voice/batch-generate validates voice profile exists', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        lines: [
          {
            text: 'Test line',
            voiceProfileId: '00000000-0000-0000-0000-000000000000',
          },
        ],
      }
    })

    expect(response.statusCode).toBe(404)
  })

  test('POST /api/voice/batch-generate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      payload: {
        lines: [
          {
            text: 'Test line',
            voiceProfileId: testVoiceProfileId,
          },
        ],
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/voice/batch-generate validates line text', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        lines: [
          {
            text: '', // Invalid: empty text
            voiceProfileId: testVoiceProfileId,
          },
        ],
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // =====================================================
  // VOICE PROFILE TEST TESTS
  // =====================================================

  test('POST /api/voice/profiles/:id/test creates test generation', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${testVoiceProfileId}/test`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'This is a test of the voice profile.',
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.generation).toBeDefined()
    expect(body.generation.id).toBeDefined()
    expect(body.generation.text).toBe('This is a test of the voice profile.')
    expect(body.generation.status).toBe('processing')
  })

  test('POST /api/voice/profiles/:id/test uses default text if none provided', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${testVoiceProfileId}/test`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {}
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.generation.text).toBe('Hello, this is a test of the voice profile.')
  })

  test('POST /api/voice/profiles/:id/test triggers async processing', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${testVoiceProfileId}/test`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Async test generation',
      }
    })

    const { generation } = JSON.parse(response.body)

    // Check database immediately
    const dbGeneration = await testServer.db.query.voiceGenerations.findFirst({
      where: eq(voiceGenerations.id, generation.id)
    })

    expect(dbGeneration).toBeDefined()
    expect(dbGeneration!.metadata.isTest).toBe(true)
    // Status could be 'processing' or 'failed' depending on async processor timing
    expect(['processing', 'failed']).toContain(dbGeneration!.status)
  })

  test('POST /api/voice/profiles/:id/test requires profile ownership', async () => {
    // Cleanup: Delete any existing test user from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'voice-batch-other')
    )

    // Create another user
    await testServer.db.insert(users).values({
      privyUserId: 'voice-batch-other',
      email: 'voicebatchother@test.com',
      role: 'member',
    }).returning()
    const otherToken = 'mock-voicebatchother-token'

    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${testVoiceProfileId}/test`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        text: 'Unauthorized test',
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('POST /api/voice/profiles/:id/test requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${testVoiceProfileId}/test`,
      payload: {
        text: 'Test without auth',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/voice/profiles/:id/test validates profile exists', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/profiles/00000000-0000-0000-0000-000000000000/test',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        text: 'Test for non-existent profile',
      }
    })

    expect(response.statusCode).toBe(404)
  })

  // =====================================================
  // NOTE: Integration Tests with Real ElevenLabs API
  // =====================================================
  // Testing actual voice generation requires ELEVENLABS_API_KEY
  // and would make real API calls. These tests verify the async
  // pattern, database updates, and API contract. Actual ElevenLabs
  // integration is tested separately.
})
