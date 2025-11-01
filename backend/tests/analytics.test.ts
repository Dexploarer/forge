import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, assets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Analytics Routes - Real E2E Tests', () => {
  let ownerUserId: string
  let ownerToken: string
  let otherUserId: string
  let otherToken: string
  let adminToken: string
  let testAssetId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'analytics-test-owner')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'analytics-test-other')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'analytics-admin-privy-id')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'analytics-test-owner',
      email: 'analyticsowner@test.com',
      displayName: 'Asset Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-analyticsowner-token'

    // Create other user
    const [other] = await testServer.db.insert(users).values({
      privyUserId: 'analytics-test-other',
      email: 'analyticsother@test.com',
      displayName: 'Other User',
      role: 'member',
    }).returning()

    otherUserId = other.id
    otherToken = 'mock-analyticsother-token'

    // Create admin
    await testServer.db.insert(users).values({
      privyUserId: 'analytics-admin-privy-id',
      email: 'admin@analytics.com',
      role: 'admin',
    })

    adminToken = 'mock-admin-token'

    // Create test asset with known properties
    const now = new Date()
    const publishedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    const [asset] = await testServer.db.insert(assets).values({
      ownerId: ownerUserId,
      name: 'Analytics Test Asset',
      description: 'For testing analytics',
      type: 'model',
      status: 'published',
      visibility: 'public',
      fileSize: 2048576, // ~2MB
      publishedAt,
      tags: ['test', 'analytics'],
    }).returning()

    testAssetId = asset.id

    // Create more assets for owner to test stats
    await testServer.db.insert(assets).values([
      {
        ownerId: ownerUserId,
        name: 'Model 2',
        type: 'model',
        status: 'published',
        fileSize: 1024000,
      },
      {
        ownerId: ownerUserId,
        name: 'Texture 1',
        type: 'texture',
        status: 'draft',
        fileSize: 512000,
      },
      {
        ownerId: ownerUserId,
        name: 'Audio 1',
        type: 'audio',
        status: 'published',
        fileSize: 3072000,
      },
    ])
  })

  test('GET /api/analytics/assets/:id returns detailed asset analytics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/assets/${testAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const analytics = body.analytics

    // Verify real data structure
    expect(analytics.assetId).toBe(testAssetId)
    expect(analytics.assetName).toBe('Analytics Test Asset')
    expect(analytics.type).toBe('model')
    expect(analytics.status).toBe('published')
    expect(analytics.visibility).toBe('public')

    // Verify file size
    expect(analytics.fileSize).toBe(2048576)
    expect(analytics.fileSizeFormatted).toContain('MB')

    // Verify dates
    expect(analytics.createdAt).toBeDefined()
    expect(analytics.publishedAt).toBeDefined()
    expect(analytics.lastUpdated).toBeDefined()

    // Verify days published calculation
    expect(analytics.daysPublished).toBeGreaterThanOrEqual(7)

    // Verify tags
    expect(analytics.tags).toContain('test')
    expect(analytics.tags).toContain('analytics')

    // Verify owner info
    expect(analytics.owner.id).toBe(ownerUserId)
  })

  test('GET /api/analytics/assets/:id rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/assets/${testAssetId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('GET /api/analytics/assets/:id allows admin access', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/assets/${testAssetId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    // Admin should be able to view
    expect(response.statusCode).toBe(200)
  })

  test('GET /api/analytics/users/:id/stats returns comprehensive user statistics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/users/${ownerUserId}/stats`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const stats = body.stats

    // Verify user info
    expect(stats.userId).toBe(ownerUserId)
    expect(stats.displayName).toBe('Asset Owner')

    // Verify asset counts - we created 4 assets for this user
    expect(stats.totalAssets).toBe(4)

    // Verify assets by type
    expect(stats.assetsByType.model).toBe(2)
    expect(stats.assetsByType.texture).toBe(1)
    expect(stats.assetsByType.audio).toBe(1)

    // Verify assets by status
    expect(stats.assetsByStatus.published).toBe(3)
    expect(stats.assetsByStatus.draft).toBe(1)

    // Verify storage calculation
    expect(stats.totalStorageBytes).toBeGreaterThan(0)
    expect(stats.totalStorageFormatted).toContain('MB')

    // Calculate expected storage: 2048576 + 1024000 + 512000 + 3072000
    const expectedStorage = 2048576 + 1024000 + 512000 + 3072000
    expect(stats.totalStorageBytes).toBe(expectedStorage)

    // Verify dates
    expect(stats.memberSince).toBeDefined()
  })

  test('GET /api/analytics/users/:id/stats allows users to view own stats', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/users/${ownerUserId}/stats`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  test('GET /api/analytics/users/:id/stats rejects other users', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/users/${ownerUserId}/stats`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    // Should fail - not viewing own stats
    expect(response.statusCode).toBe(403)
  })

  test('GET /api/analytics/users/:id/stats allows admin to view any user', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/users/${ownerUserId}/stats`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    // Admin should be able to view
    expect(response.statusCode).toBe(200)
  })

  test('GET /api/analytics/platform returns platform-wide analytics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/analytics/platform',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const analytics = body.analytics

    // Verify overview stats
    expect(analytics.overview).toBeDefined()
    expect(analytics.overview.totalUsers).toBeGreaterThan(0)
    expect(analytics.overview.totalAssets).toBeGreaterThan(0)
    expect(analytics.overview.totalStorageBytes).toBeGreaterThan(0)
    expect(analytics.overview.totalStorageFormatted).toContain('MB')

    // Verify trends
    expect(analytics.trends).toBeDefined()
    expect(analytics.trends.usersLast7Days).toBeGreaterThanOrEqual(0)
    expect(analytics.trends.usersLast30Days).toBeGreaterThanOrEqual(0)
    expect(analytics.trends.assetsLast7Days).toBeGreaterThanOrEqual(0)
    expect(analytics.trends.assetsLast30Days).toBeGreaterThanOrEqual(0)

    // Verify top asset types
    expect(analytics.topAssetTypes).toBeDefined()
    expect(Array.isArray(analytics.topAssetTypes)).toBe(true)

    if (analytics.topAssetTypes.length > 0) {
      const firstType = analytics.topAssetTypes[0]
      expect(firstType.type).toBeDefined()
      expect(firstType.count).toBeGreaterThan(0)
      expect(firstType.percentage).toBeGreaterThan(0)
      expect(firstType.percentage).toBeLessThanOrEqual(100)
    }

    // Verify top creators
    expect(analytics.topCreators).toBeDefined()
    expect(Array.isArray(analytics.topCreators)).toBe(true)

    if (analytics.topCreators.length > 0) {
      const topCreator = analytics.topCreators[0]
      expect(topCreator.userId).toBeDefined()
      expect(topCreator.assetCount).toBeGreaterThan(0)
    }
  })

  test('GET /api/analytics/platform rejects non-admin users', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/analytics/platform',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    // Should fail - not admin
    expect(response.statusCode).toBe(403)
  })

  test('GET /api/analytics/assets/:id with non-existent asset returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/analytics/assets/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)
  })

  test('Storage calculations are accurate across user stats', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/analytics/users/${ownerUserId}/stats`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const body = JSON.parse(response.body)
    const totalStorage = body.stats.totalStorageBytes

    // Get all user's assets from database
    const userAssets = await testServer.db.query.assets.findMany({
      where: eq(assets.ownerId, ownerUserId)
    })

    // Calculate expected total
    const expectedTotal = userAssets.reduce((sum, asset) => {
      return sum + (asset.fileSize || 0)
    }, 0)

    // Verify calculation matches
    expect(totalStorage).toBe(expectedTotal)
  })
})
