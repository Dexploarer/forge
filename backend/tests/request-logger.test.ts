import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Request Logger - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string

  beforeAll(async () => {
    // Cleanup
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'request-logger-test-user')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'request-logger-test-user'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'request-logger-test-user',
      email: 'logger@test.com',
      displayName: 'Logger Test User',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-logger-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Logger Test Team',
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
      name: 'Logger Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  test('X-Request-ID header is returned in response', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBeDefined()
    expect(typeof response.headers['x-request-id']).toBe('string')
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  test('X-Request-ID header is unique for different requests', async () => {
    const response1 = await testServer.inject({
      method: 'GET',
      url: '/health',
    })

    const response2 = await testServer.inject({
      method: 'GET',
      url: '/health',
    })

    const requestId1 = response1.headers['x-request-id']
    const requestId2 = response2.headers['x-request-id']

    expect(requestId1).toBeDefined()
    expect(requestId2).toBeDefined()
    expect(requestId1).not.toBe(requestId2)
  })

  test('Request logger handles authenticated requests', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBeDefined()

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
    expect(body.project.id).toBe(testProjectId)
  })

  test('Request logger handles query parameters', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects?teamId=${testTeamId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBeDefined()

    const body = JSON.parse(response.body)
    expect(body.projects).toBeDefined()
    expect(Array.isArray(body.projects)).toBe(true)
  })

  test('Request logger tracks POST requests with body', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Logger Test Project 2',
        teamId: testTeamId,
        description: 'Test project for request logger'
      }
    })

    expect(response.statusCode).toBe(201)
    expect(response.headers['x-request-id']).toBeDefined()

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
    expect(body.project.name).toBe('Logger Test Project 2')
  })

  test('Request logger handles error responses with request ID', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/projects/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(response.headers['x-request-id']).toBeDefined()
  })

  test('Request logger handles 404 responses', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/non-existent-endpoint',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers['x-request-id']).toBeDefined()

    const body = JSON.parse(response.body)
    expect(body.error).toBe('Not Found')
  })

  test('Request logger handles validation errors', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        // Missing required 'name' field
        teamId: testTeamId,
      }
    })

    expect(response.statusCode).toBe(400)
    expect(response.headers['x-request-id']).toBeDefined()
  })

  test('Request logger handles unauthorized requests', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/projects',
      // No authorization header
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers['x-request-id']).toBeDefined()
  })

  test('Request logger sets Content-Length header', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-length']).toBeDefined()
    expect(parseInt(response.headers['content-length'] as string)).toBeGreaterThan(0)
  })

  test('Request logger handles PATCH requests', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Updated Logger Test Project'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBeDefined()

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
    expect(body.project.id).toBe(testProjectId)
    expect(body.project.name).toBe('Updated Logger Test Project')
    expect(body.project.updatedAt).toBeDefined()
  })

  test('Request logger tracks response times', async () => {
    const startTime = Date.now()

    const response = await testServer.inject({
      method: 'GET',
      url: '/health',
    })

    const endTime = Date.now()
    const actualResponseTime = endTime - startTime

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBeDefined()

    // Response should be relatively fast
    expect(actualResponseTime).toBeLessThan(5000) // 5 seconds max
  })
})
