import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, loreEntries } from '../src/database/schema'
import { eq, or } from 'drizzle-orm'

describe('Lore Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string
  let testLoreId: string

  beforeAll(async () => {
    // Cleanup existing test data
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'lore-test-member')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)

      for (const userId of userIds) {
        await testServer.db.delete(loreEntries).where(eq(loreEntries.ownerId, userId))
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'lore-test-member'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'lore-test-member',
      email: 'loremember@test.com',
      displayName: 'Lore Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-loremember-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Lore Test Team',
      ownerId: memberUserId,
    }).returning()

    testTeamId = team.id

    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: memberUserId,
      role: 'owner',
      invitedBy: memberUserId,
    })

    // Create test project
    const [project] = await testServer.db.insert(projects).values({
      name: 'Lore Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  // =====================================================
  // CREATE LORE ENTRY TESTS
  // =====================================================

  test('POST /api/lore creates a lore entry', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/lore',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        title: 'The Ancient War',
        content: 'Long ago, in an age before memory, the ancient kingdoms clashed in a war that would reshape the world.',
        summary: 'A summary of the ancient war.',
        projectId: testProjectId,
        category: 'history',
        era: 'Ancient Times',
        region: 'Northern Kingdoms',
        importanceLevel: 8,
        tags: ['war', 'ancient', 'history'],
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.loreEntry).toBeDefined()
    expect(body.loreEntry.title).toBe('The Ancient War')
    expect(body.loreEntry.projectId).toBe(testProjectId)

    testLoreId = body.loreEntry.id

    // Verify in database
    const dbEntry = await testServer.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, testLoreId)
    })

    expect(dbEntry).toBeDefined()
    expect(dbEntry!.title).toBe('The Ancient War')
    expect(dbEntry!.content).toContain('ancient kingdoms')
  })

  test('POST /api/lore requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/lore',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        title: 'Unauthorized Entry',
        content: 'This should fail.',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // LIST LORE ENTRIES TESTS
  // =====================================================

  test('GET /api/lore lists lore entries', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore?projectId=${testProjectId}&page=1&limit=20`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.loreEntries).toBeDefined()
    expect(Array.isArray(body.loreEntries)).toBe(true)
    expect(body.loreEntries.length).toBeGreaterThan(0)

    const entry = body.loreEntries.find((e: any) => e.id === testLoreId)
    expect(entry).toBeDefined()
    expect(entry.title).toBe('The Ancient War')
  })

  test('GET /api/lore filters by category', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore?projectId=${testProjectId}&category=history`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.loreEntries.forEach((entry: any) => {
      expect(entry.category).toBe('history')
    })
  })

  test('GET /api/lore supports search', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore?projectId=${testProjectId}&search=ancient`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.loreEntries.length).toBeGreaterThan(0)
  })

  // =====================================================
  // GET LORE ENTRY DETAILS TESTS
  // =====================================================

  test('GET /api/lore/:id returns lore entry details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore/${testLoreId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.loreEntry).toBeDefined()
    expect(body.loreEntry.id).toBe(testLoreId)
    expect(body.loreEntry.title).toBe('The Ancient War')
    expect(body.loreEntry.content).toBeDefined()
  })

  test('GET /api/lore/:id returns 404 for non-existent entry', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/lore/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(404)
  })

  // =====================================================
  // UPDATE LORE ENTRY TESTS
  // =====================================================

  test('PATCH /api/lore/:id updates lore entry', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/lore/${testLoreId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        title: 'The Great Ancient War',
        importanceLevel: 10,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.loreEntry.title).toBe('The Great Ancient War')

    // Verify in database
    const dbEntry = await testServer.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, testLoreId)
    })

    expect(dbEntry!.title).toBe('The Great Ancient War')
    expect(dbEntry!.importanceLevel).toBe(10)
  })

  // =====================================================
  // TIMELINE TESTS
  // =====================================================

  test('GET /api/lore/timeline returns timeline view', async () => {
    // Create entry with timeline position
    await testServer.db.insert(loreEntries).values({
      title: 'The First Age',
      content: 'The beginning of recorded history.',
      projectId: testProjectId,
      ownerId: memberUserId,
      timelinePosition: 1,
      importanceLevel: 10,
    })

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore/timeline?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.timeline).toBeDefined()
    expect(Array.isArray(body.timeline)).toBe(true)
  })

  // =====================================================
  // SEARCH TESTS
  // =====================================================

  test('GET /api/lore/search performs full-text search', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore/search?q=war&projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)
  })

  // =====================================================
  // RELATED CONTENT TESTS
  // =====================================================

  test('GET /api/lore/:id/related returns related content', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/lore/${testLoreId}/related`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.related).toBeDefined()
    expect(body.related.characters).toBeDefined()
    expect(body.related.locations).toBeDefined()
    expect(body.related.events).toBeDefined()
  })

  // =====================================================
  // DELETE LORE ENTRY TESTS
  // =====================================================

  test('DELETE /api/lore/:id deletes lore entry', async () => {
    // Create entry to delete
    const [entry] = await testServer.db.insert(loreEntries).values({
      title: 'Entry to Delete',
      content: 'This will be deleted.',
      projectId: testProjectId,
      ownerId: memberUserId,
    }).returning()

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/lore/${entry.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deleted from database
    const dbEntry = await testServer.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, entry.id)
    })

    expect(dbEntry).toBeUndefined()
  })
})
