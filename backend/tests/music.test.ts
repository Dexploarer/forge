import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { musicTracks, users, teams, teamMembers, projects } from '../src/database/schema'
import { eq, or } from 'drizzle-orm'

describe('Music API', () => {
  let authToken: string
  let userId: string
  let trackId: string
  let otherUserId: string
  let otherToken: string

  beforeAll(async () => {
    // Cleanup existing test data
    const existingUsers = await testServer.db.query.users.findMany({
      where: (users, { or, eq }) => or(
        eq(users.privyUserId, 'music-test-member'),
        eq(users.privyUserId, 'music-test-other')
      )
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const uid of userIds) {
        await testServer.db.delete(musicTracks).where(eq(musicTracks.ownerId, uid))
        await testServer.db.delete(projects).where(eq(projects.ownerId, uid))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, uid))
        await testServer.db.delete(teams).where(eq(teams.ownerId, uid))
      }
    }

    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'music-test-member'),
        eq(users.privyUserId, 'music-test-other')
      )
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'music-test-member',
      email: 'musicmember@test.com',
      displayName: 'Music Member',
      role: 'member',
    }).returning()

    userId = user.id
    authToken = 'mock-musicmember-token'

    // Create another user for access control tests
    const [otherUser] = await testServer.db.insert(users).values({
      privyUserId: 'music-test-other',
      email: 'musicother@test.com',
      displayName: 'Other User',
      role: 'member',
    }).returning()

    otherUserId = otherUser.id
    otherToken = 'mock-musicother-token'
  })

  test('GET /api/music returns paginated results', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/music?page=1&limit=20'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('tracks')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.tracks)).toBe(true)
  })

  test('POST /api/music creates a new track', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'Epic Battle Theme',
        description: 'High energy orchestral music for combat',
        genre: 'orchestral',
        mood: 'epic',
        bpm: 140,
        key: 'C Major',
        loopable: true,
        usageContext: 'combat',
        tags: ['battle', 'orchestral', 'energetic']
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.track).toHaveProperty('id')
    expect(body.track.name).toBe('Epic Battle Theme')
    expect(body.track.status).toBe('draft')

    trackId = body.track.id
  })

  test('GET /api/music/:id returns single track', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/music/${trackId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.track.id).toBe(trackId)
    expect(body.track.name).toBe('Epic Battle Theme')
    expect(body.track.owner).toHaveProperty('id')
  })

  test('PATCH /api/music/:id updates track', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/music/${trackId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        description: 'Updated description',
        bpm: 150,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.track.id).toBe(trackId)
  })

  test('GET /api/music with genre filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/music?genre=orchestral',
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.tracks)).toBe(true)
  })

  test('GET /api/music with mood filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/music?mood=epic',
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(Array.isArray(body.tracks)).toBe(true)
  })

  test('POST /api/music/generate creates AI generation request', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music/generate',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'AI Generated Theme',
        prompt: 'Create an epic orchestral theme with heroic brass and soaring strings',
        genre: 'orchestral',
        mood: 'epic',
        bpm: 120,
        duration: 120,
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.track).toHaveProperty('id')
    expect(['processing', 'published', 'failed']).toContain(body.track.status)
    expect(body.track.generationPrompt).toBe('Create an epic orchestral theme with heroic brass and soaring strings')
  }, 60000)

  test('POST /api/music without auth returns 401', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/music',
      payload: {
        name: 'Should Fail',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/music/:id with invalid ID returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/music/00000000-0000-0000-0000-000000000000'
    })

    expect(response.statusCode).toBe(404)
  })

  test('PATCH /api/music/:id by non-owner returns 403', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/music/${trackId}`,
      headers: {
        authorization: `Bearer ${otherToken}`,
      },
      payload: {
        name: 'Hacked',
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('DELETE /api/music/:id deletes track', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/music/${trackId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deletion
    const getResponse = await testServer.inject({
      method: 'GET',
      url: `/api/music/${trackId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      }
    })

    expect(getResponse.statusCode).toBe(404)
  })
})
