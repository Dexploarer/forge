import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { voiceProfiles, voiceGenerations, users, teams, teamMembers, projects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Voice API', () => {
  let authToken: string
  let userId: string
  let profileId: string
  let generationId: string

  beforeAll(async () => {
    // Cleanup existing test data
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'voice-test-member')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const uid of userIds) {
        await testServer.db.delete(voiceGenerations).where(eq(voiceGenerations.ownerId, uid))
        await testServer.db.delete(voiceProfiles).where(eq(voiceProfiles.ownerId, uid))
        await testServer.db.delete(projects).where(eq(projects.ownerId, uid))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, uid))
        await testServer.db.delete(teams).where(eq(teams.ownerId, uid))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'voice-test-member'))

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'voice-test-member',
      email: 'voicemember@test.com',
      displayName: 'Voice Member',
      role: 'member',
    }).returning()

    userId = user.id
    authToken = 'mock-voicemember-token'
  })

  // ===== VOICE PROFILES =====

  test('GET /api/voice/profiles returns paginated results', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/voice/profiles?page=1&limit=20'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('profiles')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.profiles)).toBe(true)
  })

  test('POST /api/voice/profiles creates a new voice profile', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/profiles',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'Wise Elder',
        description: 'Deep, authoritative voice for elderly character',
        gender: 'male',
        age: 'elderly',
        accent: 'British',
        tone: 'warm',
        serviceProvider: 'elevenlabs',
        serviceVoiceId: 'test-voice-id-123',
        characterIds: [],
        tags: ['elderly', 'wisdom', 'authoritative']
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.profile).toHaveProperty('id')
    expect(body.profile.name).toBe('Wise Elder')
    expect(body.profile.serviceProvider).toBe('elevenlabs')

    profileId = body.profile.id
  })

  test('GET /api/voice/profiles/:id returns single profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice/profiles/${profileId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.profile.id).toBe(profileId)
    expect(body.profile.name).toBe('Wise Elder')
    expect(body.profile.gender).toBe('male')
  })

  test('PATCH /api/voice/profiles/:id updates profile', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/voice/profiles/${profileId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        description: 'Updated description',
        tone: 'professional',
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.profile.id).toBe(profileId)
  })

  test('POST /api/voice/profiles/:id/test creates test generation', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/voice/profiles/${profileId}/test`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        text: 'This is a test of the voice profile.',
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.generation).toHaveProperty('id')
    expect(body.generation.status).toBe('processing')
  })

  test('GET /api/voice/profiles with provider filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/voice/profiles?provider=elevenlabs',
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.profiles)).toBe(true)
  })

  // ===== VOICE GENERATIONS =====

  test('POST /api/voice/generate creates voice generation', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        text: 'Greetings, traveler. What brings you to these ancient halls?',
        voiceProfileId: profileId,
        speed: 1.0,
        pitch: 0,
        stability: 0.8,
        clarity: 0.9,
        context: 'dialog',
        emotion: 'neutral',
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    expect(body.generation).toHaveProperty('id')
    expect(body.generation.voiceProfileId).toBe(profileId)
    expect(body.generation.status).toBe('processing')
    expect(body.generation).toHaveProperty('statusUrl')

    generationId = body.generation.id
  })

  test('GET /api/voice/generations returns user generations', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/voice/generations',
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('generations')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.generations)).toBe(true)
  })

  test('GET /api/voice/generations/:id returns single generation', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations/${generationId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.generation.id).toBe(generationId)
    expect(body.generation.text).toContain('Greetings, traveler')
  })

  test('GET /api/voice/generations with voiceProfileId filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice/generations?voiceProfileId=${profileId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.generations)).toBe(true)
  })

  test('POST /api/voice/batch-generate creates multiple generations', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/batch-generate',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        lines: [
          {
            text: 'Welcome to the guild.',
            voiceProfileId: profileId,
            context: 'dialog',
            emotion: 'neutral',
          },
          {
            text: 'I have a quest for you.',
            voiceProfileId: profileId,
            context: 'dialog',
            emotion: 'neutral',
          },
          {
            text: 'Be careful out there!',
            voiceProfileId: profileId,
            context: 'dialog',
            emotion: 'happy',
          }
        ]
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.generations)).toBe(true)
    expect(body.generations.length).toBe(3)
  })

  test('POST /api/voice/generate with invalid voiceProfileId returns 404', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/generate',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        text: 'Test',
        voiceProfileId: '00000000-0000-0000-0000-000000000000',
      }
    })

    expect(response.statusCode).toBe(404)
  })

  test('POST /api/voice/profiles without auth returns 401', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice/profiles',
      payload: {
        name: 'Should Fail',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/voice/profiles/:id with invalid ID returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/voice/profiles/00000000-0000-0000-0000-000000000000'
    })

    expect(response.statusCode).toBe(404)
  })

  test('DELETE /api/voice/generations/:id deletes generation', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/voice/generations/${generationId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(204)
  })

  test('DELETE /api/voice/profiles/:id deletes profile', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/voice/profiles/${profileId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deletion
    const getResponse = await testServer.inject({
      method: 'GET',
      url: `/api/voice/profiles/${profileId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(getResponse.statusCode).toBe(404)
  })
})
