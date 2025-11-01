import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, aiContextPreferences, previewManifests } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('AI Context Routes - E2E Tests', () => {
  let userUserId: string
  let userToken: string
  let otherUserId: string
  let otherToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'ai-context-test-user')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'ai-context-test-other')
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'ai-context-test-user',
      email: 'contextmember@test.com',
      displayName: 'AI Context Test User',
      role: 'member',
    }).returning()

    userUserId = user.id
    userToken = 'mock-contextmember-token'

    // Create other user
    const [other] = await testServer.db.insert(users).values({
      privyUserId: 'ai-context-test-other',
      email: 'contextother@test.com',
      displayName: 'AI Context Other User',
      role: 'member',
    }).returning()

    otherUserId = other.id
    otherToken = 'mock-contextother-token'

    // Create AI context preferences for user
    await testServer.db.insert(aiContextPreferences).values({
      userId: userUserId,
      useOwnPreview: true,
      useCdnContent: false,
      useTeamPreview: true,
      useAllSubmissions: false,
      maxContextItems: 50,
      preferRecent: true,
    })

    // Create some preview manifests for user
    await testServer.db.insert(previewManifests).values([
      {
        userId: userUserId,
        manifestType: 'npc',
        content: [
          { id: 'npc1', name: 'Guard', personality: 'stern' },
          { id: 'npc2', name: 'Merchant', personality: 'friendly' }
        ],
        version: 1,
        isActive: true,
      },
      {
        userId: userUserId,
        manifestType: 'quest',
        content: [
          { id: 'quest1', title: 'The Lost Sword', difficulty: 'medium' }
        ],
        version: 1,
        isActive: true,
      },
    ])

    // Create a preview manifest for other user (to test isolation)
    await testServer.db.insert(previewManifests).values({
      userId: otherUserId,
      manifestType: 'npc',
      content: [
        { id: 'npc3', name: 'Wizard', personality: 'mysterious' }
      ],
      version: 1,
      isActive: true,
    })
  })

  // =====================================================
  // PREFERENCES TESTS
  // =====================================================

  test('GET /api/ai-context/preferences returns user preferences', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.preferences).toBeDefined()
    expect(body.preferences.useOwnPreview).toBe(true)
    expect(body.preferences.useCdnContent).toBe(false)
    expect(body.preferences.useTeamPreview).toBe(true)
    expect(body.preferences.useAllSubmissions).toBe(false)
    expect(body.preferences.maxContextItems).toBe(50)
    expect(body.preferences.preferRecent).toBe(true)
  })

  test('GET /api/ai-context/preferences returns default if no preferences exist', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.preferences).toBeDefined()
    // Should have default values
    expect(body.preferences.useOwnPreview).toBe(true)
    expect(body.preferences.maxContextItems).toBe(100)
  })

  test('GET /api/ai-context/preferences requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-context/preferences'
    })

    expect(response.statusCode).toBe(401)
  })

  test('PUT /api/ai-context/preferences updates user preferences', async () => {
    const response = await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        useOwnPreview: false,
        useCdnContent: true,
        useTeamPreview: false,
        useAllSubmissions: true,
        maxContextItems: 75,
        preferRecent: false,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.preferences).toBeDefined()
    expect(body.preferences.useOwnPreview).toBe(false)
    expect(body.preferences.useCdnContent).toBe(true)
    expect(body.preferences.useTeamPreview).toBe(false)
    expect(body.preferences.useAllSubmissions).toBe(true)
    expect(body.preferences.maxContextItems).toBe(75)
    expect(body.preferences.preferRecent).toBe(false)

    // Verify the change persists
    const getResponse = await testServer.inject({
      method: 'GET',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    const getBody = JSON.parse(getResponse.body)
    expect(getBody.preferences.maxContextItems).toBe(75)
  })

  test('PUT /api/ai-context/preferences validates maxContextItems must be positive', async () => {
    const response = await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        maxContextItems: -10
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('PUT /api/ai-context/preferences allows partial updates', async () => {
    const response = await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        maxContextItems: 60
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.preferences.maxContextItems).toBe(60)
  })

  test('PUT /api/ai-context/preferences requires authentication', async () => {
    const response = await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      payload: {
        maxContextItems: 100
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // BUILD CONTEXT TESTS
  // =====================================================

  test('POST /api/ai-context/build builds combined context', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {}
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.context).toBeDefined()
    expect(Array.isArray(body.context)).toBe(true)
    expect(body.totalItems).toBeDefined()
    expect(typeof body.totalItems).toBe('number')
    expect(body.sources).toBeDefined()
    expect(body.metadata).toBeDefined()
  })

  test('POST /api/ai-context/build includes user preview manifests', async () => {
    // Reset preferences to include own preview
    await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        useOwnPreview: true
      }
    })

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {}
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.context.length).toBeGreaterThan(0)
    expect(body.sources.ownPreview).toBeGreaterThan(0)

    // Check that user's NPCs are included
    const npcContext = body.context.find((item: any) =>
      item.type === 'npc' && item.data.some((npc: any) => npc.name === 'Guard')
    )
    expect(npcContext).toBeDefined()
  })

  test('POST /api/ai-context/build respects maxContextItems setting', async () => {
    // Set a very low limit
    await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        maxContextItems: 1
      }
    })

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {}
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.totalItems).toBeLessThanOrEqual(1)
  })

  test('POST /api/ai-context/build does not include other users data', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {}
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Check that other user's NPCs are NOT included
    const wizardContext = body.context.find((item: any) =>
      item.type === 'npc' && item.data.some((npc: any) => npc.name === 'Wizard')
    )
    expect(wizardContext).toBeUndefined()
  })

  test('POST /api/ai-context/build allows filtering by types', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        types: ['npc']
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Should only include NPCs
    body.context.forEach((item: any) => {
      expect(item.type).toBe('npc')
    })
  })

  test('POST /api/ai-context/build requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      payload: {}
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai-context/build validates types array', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        types: 'invalid' // Should be array
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  test('AI context workflow: create preferences, build context', async () => {
    // Step 1: Set preferences
    const prefsResponse = await testServer.inject({
      method: 'PUT',
      url: '/api/ai-context/preferences',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        useOwnPreview: true,
        maxContextItems: 100,
        preferRecent: true,
      }
    })

    expect(prefsResponse.statusCode).toBe(200)

    // Step 2: Build context with those preferences
    const contextResponse = await testServer.inject({
      method: 'POST',
      url: '/api/ai-context/build',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {}
    })

    expect(contextResponse.statusCode).toBe(200)

    const body = JSON.parse(contextResponse.body)
    expect(body.context).toBeDefined()
    expect(body.totalItems).toBeLessThanOrEqual(100)
  })
})
