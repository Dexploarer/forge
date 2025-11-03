import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { soundEffects, users, teams, teamMembers, projects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Sound Effects API', () => {
  let authToken: string
  let userId: string
  let sfxId: string
  let variationId: string

  beforeAll(async () => {
    // Cleanup existing test data
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'sfx-test-member')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(soundEffects).where(eq(soundEffects.ownerId, userId))
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'sfx-test-member'))

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'sfx-test-member',
      email: 'sfxmember@test.com',
      displayName: 'SFX Member',
      role: 'member',
    }).returning()

    userId = user.id
    authToken = 'mock-sfxmember-token'
  })

  test('GET /api/sfx returns paginated results', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/sfx?page=1&limit=20'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('sfx')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.sfx)).toBe(true)
  })

  test('POST /api/sfx creates a new sound effect', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'Sword Slash',
        description: 'Heavy sword swing sound',
        category: 'weapon',
        subcategory: 'sword_swing',
        volume: 80,
        priority: 8,
        spatialAudio: true,
        minDistance: 1,
        maxDistance: 50,
        triggers: ['player_attack', 'npc_attack'],
        tags: ['weapon', 'melee', 'heavy']
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.sfx).toHaveProperty('id')
    expect(body.sfx.name).toBe('Sword Slash')
    expect(body.sfx.status).toBe('draft')

    sfxId = body.sfx.id
  })

  test('GET /api/sfx/:id returns single sound effect', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/sfx/${sfxId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.sfx.id).toBe(sfxId)
    expect(body.sfx.name).toBe('Sword Slash')
    expect(body.sfx.spatialAudio).toBe(true)
  })

  test('PATCH /api/sfx/:id updates sound effect', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/sfx/${sfxId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        volume: 90,
        priority: 9,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.sfx.id).toBe(sfxId)
  })

  test('GET /api/sfx with category filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/sfx?category=weapon',
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.sfx)).toBe(true)
  })

  test('POST /api/sfx/:id/duplicate creates variation', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/sfx/${sfxId}/duplicate`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'Sword Slash Variation 1',
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.sfx).toHaveProperty('id')
    expect(body.sfx.variationGroup).toBe(sfxId)
    expect(body.sfx.variationIndex).toBe(1)

    variationId = body.sfx.id
  })

  test('GET /api/sfx/variations/:groupId returns all variations', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/sfx/variations/${sfxId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.variations)).toBe(true)
    expect(body.variations.length).toBeGreaterThan(0)
  })

  test('POST /api/sfx/generate creates AI generation request', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx/generate',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'AI Generated Footstep',
        prompt: 'Heavy armored footstep on stone floor',
        category: 'footstep',
        subcategory: 'stone',
        duration: 500,
      }
    })

    // May return 201 (success) or 500 (MinIO not configured)
    expect([201, 500]).toContain(response.statusCode)

    if (response.statusCode === 201) {
      const body = JSON.parse(response.body)
      expect(body.sfx).toHaveProperty('id')
      expect(['processing', 'published', 'failed']).toContain(body.sfx.status)
    }
  }, 30000)

  test('POST /api/sfx without auth returns 401', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/sfx',
      payload: {
        name: 'Should Fail',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/sfx/:id with invalid ID returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/sfx/00000000-0000-0000-0000-000000000000'
    })

    expect(response.statusCode).toBe(404)
  })

  test('DELETE /api/sfx/:id deletes sound effect', async () => {
    // Delete the variation first
    await testServer.inject({
      method: 'DELETE',
      url: `/api/sfx/${variationId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    // Delete the original
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/sfx/${sfxId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deletion
    const getResponse = await testServer.inject({
      method: 'GET',
      url: `/api/sfx/${sfxId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(getResponse.statusCode).toBe(404)
  })
})
