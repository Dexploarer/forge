import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Authentication Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let adminToken: string
  let adminUserId: string
  let guestToken: string
  let guestUserId: string
  let testTeamId: string

  beforeAll(async () => {
    // Cleanup existing test users
    await testServer.db.delete(users).where(eq(users.privyUserId, 'auth-test-member'))
    await testServer.db.delete(users).where(eq(users.privyUserId, 'auth-test-admin'))
    await testServer.db.delete(users).where(eq(users.privyUserId, 'auth-test-guest'))

    // Create member user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'auth-test-member',
      email: 'member@test.com',
      displayName: 'Member User',
      role: 'member',
      walletAddress: '0x1234567890abcdef',
      farcasterFid: 12345,
      farcasterUsername: 'testmember',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-member-token'

    // Create admin user
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'auth-test-admin',
      email: 'admin@test.com',
      displayName: 'Admin User',
      role: 'admin',
    }).returning()

    adminUserId = adminUser.id
    adminToken = 'mock-admin-token'

    // Create guest user
    const [guestUser] = await testServer.db.insert(users).values({
      privyUserId: 'auth-test-guest',
      email: 'guest@test.com',
      displayName: 'Guest User',
      role: 'guest',
    }).returning()

    guestUserId = guestUser.id
    guestToken = 'mock-guest-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Auth Test Team',
      ownerId: memberUserId,
    }).returning()

    testTeamId = team.id

    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: memberUserId,
      role: 'owner',
      invitedBy: memberUserId,
    })
  })

  // =====================================================
  // AUTHENTICATION TESTS
  // =====================================================

  test('GET /api/auth/me without token returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me'
    })

    expect(response.statusCode).toBe(401)

    const body = JSON.parse(response.body)
    expect(body.message).toBeDefined()
    expect(body.code).toBeDefined()
  })

  test('GET /api/auth/me with invalid token returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'Bearer invalid-token-12345'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/auth/me with malformed authorization header returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'InvalidFormat token'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/auth/me without Bearer prefix returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: memberToken // Missing 'Bearer ' prefix
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // SUCCESSFUL AUTHENTICATION TESTS
  // =====================================================

  test('GET /api/auth/me with valid member token returns user profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user).toBeDefined()
    expect(body.user.id).toBe(memberUserId)
    expect(body.user.privyUserId).toBe('auth-test-member')
    expect(body.user.email).toBe('member@test.com')
    expect(body.user.displayName).toBe('Member User')
    expect(body.user.role).toBe('member')
    expect(body.user.walletAddress).toBe('0x1234567890abcdef')
    expect(body.user.farcasterFid).toBe(12345)
    expect(body.user.farcasterUsername).toBe('testmember')
    expect(body.user.createdAt).toBeDefined()
  })

  test('GET /api/auth/me with valid admin token returns admin profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user.id).toBe(adminUserId)
    expect(body.user.role).toBe('admin')
    expect(body.user.email).toBe('admin@test.com')
  })

  test('GET /api/auth/me with valid guest token returns guest profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user.id).toBe(guestUserId)
    expect(body.user.role).toBe('guest')
  })

  test('GET /api/auth/me returns ISO datetime strings', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user.createdAt).toBeDefined()
    expect(typeof body.user.createdAt).toBe('string')

    // Verify it's a valid ISO datetime
    const createdAt = new Date(body.user.createdAt)
    expect(createdAt.toISOString()).toBe(body.user.createdAt)
  })

  test('GET /api/auth/me includes nullable fields', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user).toBeDefined()

    // These fields can be null
    if (body.user.avatarUrl !== null) {
      expect(typeof body.user.avatarUrl).toBe('string')
    }

    if (body.user.lastLoginAt !== null) {
      expect(typeof body.user.lastLoginAt).toBe('string')
    }
  })

  // =====================================================
  // LOGOUT TESTS
  // =====================================================

  test('POST /api/auth/logout without token returns 401', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/auth/logout'
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/auth/logout with invalid token returns 401', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: 'Bearer invalid-token'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/auth/logout with valid token succeeds', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.message).toBe('Logged out successfully')
  })

  test('POST /api/auth/logout as admin succeeds', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  test('POST /api/auth/logout as guest succeeds', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  // =====================================================
  // ROLE-BASED ACCESS TESTS
  // =====================================================

  test('Member can access their profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user.role).toBe('member')
  })

  test('Admin can access their profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user.role).toBe('admin')
  })

  test('Guest can access their profile', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user.role).toBe('guest')
  })

  // =====================================================
  // PROTECTED ROUTE TESTS (using teams as example)
  // =====================================================

  test('Protected route requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/teams'
    })

    expect(response.statusCode).toBe(401)
  })

  test('Protected route accepts valid token', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/teams',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  test('Protected route rejects invalid token', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/teams',
      headers: {
        authorization: 'Bearer fake-invalid-token'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // EDGE CASES
  // =====================================================

  test('Empty authorization header returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: ''
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('Authorization header with only Bearer returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'Bearer '
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('Case-sensitive Bearer prefix', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `bearer ${memberToken}` // lowercase 'bearer'
      }
    })

    // Should fail as most implementations expect 'Bearer' with capital B
    expect(response.statusCode).toBe(401)
  })

  test('Multiple authentication attempts with same token succeed', async () => {
    // First request
    const response1 = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response1.statusCode).toBe(200)

    // Second request with same token
    const response2 = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response2.statusCode).toBe(200)

    const body1 = JSON.parse(response1.body)
    const body2 = JSON.parse(response2.body)
    expect(body1.user.id).toBe(body2.user.id)
  })
})
