import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users } from '../src/database/schema'
import { eq, or } from 'drizzle-orm'

describe('User Routes - Real E2E Tests', () => {
  let adminToken: string
  let memberToken: string
  let otherMemberToken: string
  let adminUserId: string
  let memberUserId: string
  let otherMemberUserId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'users-test-admin'),
        eq(users.privyUserId, 'users-test-member'),
        eq(users.privyUserId, 'users-test-other')
      )
    )

    // Create admin user
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'users-test-admin',
      email: 'users-admin@test.com',
      displayName: 'Users Admin',
      role: 'admin',
    }).returning()

    adminUserId = adminUser.id
    adminToken = 'mock-admin-token'

    // Create member user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'users-test-member',
      email: 'usertestmember@test.com',
      displayName: 'Users Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-usertestmember-token'

    // Create another member for testing permissions
    const [otherMemberUser] = await testServer.db.insert(users).values({
      privyUserId: 'users-test-other',
      email: 'usertestother@test.com',
      displayName: 'Other Member',
      role: 'member',
    }).returning()

    otherMemberUserId = otherMemberUser.id
    otherMemberToken = 'mock-usertestother-token'
  })

  test('GET /api/users/:id returns user profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/users/${memberUserId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user).toBeDefined()
    expect(body.user.id).toBe(memberUserId)
    expect(body.user.displayName).toBe('Users Member')
    expect(body.user.createdAt).toBeDefined()
    expect(typeof body.user.createdAt).toBe('string')
  })

  test('GET /api/users/:id returns 404 for non-existent user', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/users/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(404)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('not found')
  })

  test('GET /api/users/:id requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/users/${memberUserId}`
    })

    expect(response.statusCode).toBe(401)
  })

  test('PATCH /api/users/:id updates own profile', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/users/${memberUserId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        displayName: 'Updated Member Name'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user.displayName).toBe('Updated Member Name')
    expect(body.user.updatedAt).toBeDefined()
    expect(typeof body.user.updatedAt).toBe('string')

    // Verify actual database change
    const updatedUser = await testServer.db.query.users.findFirst({
      where: eq(users.id, memberUserId)
    })

    expect(updatedUser!.displayName).toBe('Updated Member Name')
  })

  test('PATCH /api/users/:id rejects updating other users profile', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/users/${otherMemberUserId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        displayName: 'Hacked Name'
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('your own profile')

    // Verify profile was NOT changed
    const unchangedUser = await testServer.db.query.users.findFirst({
      where: eq(users.id, otherMemberUserId)
    })

    expect(unchangedUser!.displayName).toBe('Other Member')
  })

  test('GET /api/users lists all users with pagination (admin only)', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=10',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.users).toBeDefined()
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users.length).toBeGreaterThanOrEqual(3) // at least our 3 test users
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBeGreaterThanOrEqual(3)
    expect(typeof body.pagination.total).toBe('number')

    // Verify date serialization
    expect(typeof body.users[0].createdAt).toBe('string')
  })

  test('GET /api/users rejects non-admin users', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=10',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('Admin')
  })

  test('GET /api/users requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=10'
    })

    expect(response.statusCode).toBe(401)
  })
})
