import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, assets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Search Routes - Real E2E Tests', () => {
  let testUserId: string
  let testToken: string
  let publicAssetId: string
  let privateAssetId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'search-test-privy-id')
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'search-test-privy-id',
      email: 'search@test.com',
      displayName: 'Search Tester',
      farcasterUsername: 'searchtester',
      role: 'member',
    }).returning()

    testUserId = user.id
    testToken = 'mock-search-token'

    // Create searchable assets with different properties
    const [publicAsset] = await testServer.db.insert(assets).values({
      ownerId: testUserId,
      name: 'Robot Model',
      description: 'A cool robot for testing',
      type: 'model',
      status: 'published',
      visibility: 'public',
      fileSize: 5000000, // 5MB
      tags: ['robot', 'sci-fi'],
    }).returning()

    publicAssetId = publicAsset.id

    // Create private asset
    const [privateAsset] = await testServer.db.insert(assets).values({
      ownerId: testUserId,
      name: 'Secret Texture',
      description: 'Private texture',
      type: 'texture',
      status: 'draft',
      visibility: 'private',
      fileSize: 1000000, // 1MB
      tags: ['secret'],
    }).returning()

    privateAssetId = privateAsset.id

    // Create large audio file
    await testServer.db.insert(assets).values({
      ownerId: testUserId,
      name: 'Big Audio File',
      type: 'audio',
      status: 'published',
      visibility: 'public',
      fileSize: 20000000, // 20MB
    })
  })

  test('GET /api/search/assets finds assets by text query', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?q=robot'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.assets).toBeDefined()
    expect(Array.isArray(body.assets)).toBe(true)

    // Should find our robot model
    const foundRobot = body.assets.find((a: any) => a.name === 'Robot Model')
    expect(foundRobot).toBeDefined()
    expect(foundRobot.description).toContain('robot')
  })

  test('GET /api/search/assets filters by type', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?type=model'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // All results should be models
    body.assets.forEach((asset: any) => {
      expect(asset.type).toBe('model')
    })
  })

  test('GET /api/search/assets filters by file size range', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?minSize=2000000&maxSize=10000000'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // All results should be within size range
    body.assets.forEach((asset: any) => {
      if (asset.fileSize) {
        expect(asset.fileSize).toBeGreaterThanOrEqual(2000000)
        expect(asset.fileSize).toBeLessThanOrEqual(10000000)
      }
    })
  })

  test('GET /api/search/assets filters by status', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?status=published'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // All results should be published
    body.assets.forEach((asset: any) => {
      expect(asset.status).toBe('published')
    })
  })

  test('GET /api/search/assets sorts by fileSize descending', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?sortBy=fileSize&sortOrder=desc'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Verify descending order
    let previousSize = Infinity
    body.assets.forEach((asset: any) => {
      if (asset.fileSize) {
        expect(asset.fileSize).toBeLessThanOrEqual(previousSize)
        previousSize = asset.fileSize
      }
    })
  })

  test('GET /api/search/assets hides private assets from unauthenticated users', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/search/assets?ownerId=${testUserId}`
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Should only see public assets
    const privateFound = body.assets.find((a: any) => a.id === privateAssetId)
    expect(privateFound).toBeUndefined()

    // Should see public asset
    const publicFound = body.assets.find((a: any) => a.id === publicAssetId)
    expect(publicFound).toBeDefined()
  })

  test('GET /api/search/assets shows private assets to owner when authenticated', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/search/assets?ownerId=${testUserId}`,
      headers: {
        authorization: `Bearer ${testToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Should see both public and private assets when authenticated as owner
    const privateFound = body.assets.find((a: any) => a.id === privateAssetId)
    const publicFound = body.assets.find((a: any) => a.id === publicAssetId)

    expect(privateFound).toBeDefined()
    expect(publicFound).toBeDefined()
  })

  test('GET /api/search/assets includes pagination metadata', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?page=1&limit=2'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.pagination).toBeDefined()
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.total).toBeGreaterThan(0)
    expect(body.pagination.totalPages).toBeGreaterThan(0)
    expect(body.assets.length).toBeLessThanOrEqual(2)
  })

  test('GET /api/search/users finds users by display name', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/users?q=Search',
      headers: {
        authorization: `Bearer ${testToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.users).toBeDefined()
    expect(Array.isArray(body.users)).toBe(true)

    // Should find our test user
    const foundUser = body.users.find((u: any) => u.id === testUserId)
    expect(foundUser).toBeDefined()
    expect(foundUser.displayName).toContain('Search')
  })

  test('GET /api/search/users finds users by Farcaster username', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/users?q=searchtester',
      headers: {
        authorization: `Bearer ${testToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    const foundUser = body.users.find((u: any) => u.farcasterUsername === 'searchtester')
    expect(foundUser).toBeDefined()
  })

  test('GET /api/search/users requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/users?q=test'
    })

    // Should fail without auth
    expect(response.statusCode).toBe(401)
  })

  test('GET /api/search/assets includes applied filters in response', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/search/assets?q=robot&type=model&minSize=1000'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.filters).toBeDefined()
    expect(body.filters.applied).toBeDefined()
    expect(body.filters.applied.q).toBe('robot')
    expect(body.filters.applied.type).toBe('model')
    expect(body.filters.applied.minSize).toBeDefined()
  })
})
