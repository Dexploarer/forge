import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, assets } from '../src/database/schema'
import { eq, like, or } from 'drizzle-orm'

describe('Admin Routes - Real E2E Tests', () => {
  let adminToken: string
  let memberToken: string
  let adminUserId: string
  let memberUserId: string
  let testAssetId: string

  // Setup: Create real users and get real tokens
  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'test-admin-privy-id'),
        eq(users.privyUserId, 'test-member-privy-id'),
        eq(users.privyUserId, 'test-delete-privy-id'),
        eq(users.privyUserId, 'test-target-privy-id')
      )
    )

    // Create admin user directly in database
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'test-admin-privy-id',
      email: 'admin@test.com',
      displayName: 'Test Admin',
      role: 'admin',
    }).returning()

    adminUserId = adminUser.id

    // Create member user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'test-member-privy-id',
      email: 'member@test.com',
      displayName: 'Test Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id

    // Create test asset
    const [asset] = await testServer.db.insert(assets).values({
      ownerId: memberUserId,
      name: 'Test Asset',
      type: 'model',
      status: 'draft',
      visibility: 'private',
    }).returning()

    testAssetId = asset.id

    // For real tests, we'd use Privy tokens, but for E2E we'll mock the authenticate decorator
    // In production, get real tokens from Privy auth flow
    adminToken = 'mock-admin-token'
    memberToken = 'mock-member-token'
  })

  test('GET /api/admin/stats returns dashboard statistics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Verify real data structure - fail fast if wrong
    expect(body.stats).toBeDefined()
    expect(body.stats.totalUsers).toBeGreaterThan(0)
    expect(body.stats.totalAssets).toBeGreaterThan(0)
    expect(body.stats.assetsByType).toBeDefined()

    // Verify actual data matches what we created
    expect(body.stats.totalUsers).toBeGreaterThanOrEqual(2) // admin + member
    expect(body.stats.totalAssets).toBeGreaterThanOrEqual(1) // our test asset
  })

  test('GET /api/admin/stats rejects non-admin users', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    // Should fail with 403
    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('Admin')
  })

  test('PATCH /api/admin/users/:id/role changes user role in database', async () => {
    // Create a separate user for this test to avoid affecting other tests
    const [targetUser] = await testServer.db.insert(users).values({
      privyUserId: 'test-target-privy-id',
      email: 'target@test.com',
      displayName: 'Target User',
      role: 'guest',
    }).returning()

    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/admin/users/${targetUser.id}/role`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        role: 'admin'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.user.role).toBe('admin')

    // Verify actual database change
    const updatedUser = await testServer.db.query.users.findFirst({
      where: eq(users.id, targetUser.id)
    })

    expect(updatedUser!.role).toBe('admin')
  })

  test('PATCH /api/admin/users/:id/role rejects non-admin', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/admin/users/${memberUserId}/role`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        role: 'guest'
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('DELETE /api/admin/users/:id actually deletes user from database', async () => {
    // Create a user to delete
    const [userToDelete] = await testServer.db.insert(users).values({
      privyUserId: 'test-delete-privy-id',
      email: 'delete@test.com',
      displayName: 'Delete Me',
      role: 'guest',
    }).returning()

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/admin/users/${userToDelete.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify actual deletion from database
    const deletedUser = await testServer.db.query.users.findFirst({
      where: eq(users.id, userToDelete.id)
    })

    expect(deletedUser).toBeUndefined()
  })

  test('DELETE /api/admin/users/:id prevents admin self-deletion', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/admin/users/${adminUserId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('own account')

    // Verify admin still exists
    const stillExists = await testServer.db.query.users.findFirst({
      where: eq(users.id, adminUserId)
    })

    expect(stillExists).toBeDefined()
  })

  test('PATCH /api/admin/assets/bulk-status updates multiple assets in database', async () => {
    // Create multiple test assets
    const asset1 = await testServer.db.insert(assets).values({
      ownerId: memberUserId,
      name: 'Bulk Asset 1',
      type: 'model',
      status: 'draft',
    }).returning()

    const asset2 = await testServer.db.insert(assets).values({
      ownerId: memberUserId,
      name: 'Bulk Asset 2',
      type: 'texture',
      status: 'draft',
    }).returning()

    const assetIds = [asset1[0].id, asset2[0].id]

    const response = await testServer.inject({
      method: 'PATCH',
      url: '/api/admin/assets/bulk-status',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        assetIds,
        status: 'published'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.updated).toBe(2)

    // Verify actual database updates
    const updatedAsset1 = await testServer.db.query.assets.findFirst({
      where: eq(assets.id, assetIds[0])
    })

    const updatedAsset2 = await testServer.db.query.assets.findFirst({
      where: eq(assets.id, assetIds[1])
    })

    expect(updatedAsset1!.status).toBe('published')
    expect(updatedAsset2!.status).toBe('published')
  })

  test('GET /api/admin/activity returns real platform activity', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/admin/activity?limit=10',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.activity).toBeDefined()
    expect(Array.isArray(body.activity)).toBe(true)
    expect(body.activity.length).toBeGreaterThan(0)

    // Verify activity has correct structure
    const firstActivity = body.activity[0]
    expect(firstActivity.type).toBeDefined()
    expect(firstActivity.timestamp).toBeDefined()
    expect(['user_created', 'asset_created', 'asset_published']).toContain(firstActivity.type)
  })
})
