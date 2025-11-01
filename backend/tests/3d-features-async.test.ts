import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, assets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('3D Features Async Generation Tests', () => {
  let ownerUserId: string
  let ownerToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, '3d-async-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: '3d-async-test-owner',
      email: '3dasyncowner@test.com',
      displayName: '3D Async Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-3dasyncowner-token'
  })

  // =====================================================
  // 3D GENERATION ASYNC FLOW TESTS
  // =====================================================

  test('POST /api/3d/generate returns 202 Accepted with taskId', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A fantasy sword',
        name: 'Test Sword',
        artStyle: 'realistic',
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('taskId')
    expect(body.status).toBe('processing')
    expect(body).toHaveProperty('statusUrl')
    expect(body.statusUrl).toContain('/api/3d/generate/')
    expect(body.statusUrl).toContain('/status')
    expect(body).toHaveProperty('message')
  })

  test('POST /api/3d/generate creates asset with processing status', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A magical staff',
        name: 'Test Staff',
        artStyle: 'cartoon',
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    const taskId = body.taskId

    // Check database for asset
    const asset = await testServer.db.query.assets.findFirst({
      where: eq(assets.id, taskId)
    })

    expect(asset).toBeDefined()
    expect(asset!.status).toBe('processing')
    expect(asset!.type).toBe('model')
    expect(asset!.name).toBe('Test Staff')
    expect(asset!.prompt).toBe('A magical staff')
    expect(asset!.ownerId).toBe(ownerUserId)
  })

  test('GET /api/3d/generate/:taskId/status returns status', async () => {
    // First create generation
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A fantasy shield',
        name: 'Test Shield',
      }
    })

    const { taskId } = JSON.parse(createResponse.body)

    // Check status
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/3d/generate/${taskId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(statusResponse.statusCode).toBe(200)
    const body = JSON.parse(statusResponse.body)
    expect(body.status).toBe('processing')
    expect(body.taskId).toBe(taskId)
    expect(body).toHaveProperty('createdAt')
    expect(body).toHaveProperty('updatedAt')
  })

  test('GET /api/3d/generate/:taskId/status requires ownership', async () => {
    // Cleanup: Delete any existing test user from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, '3d-async-other')
    )

    // Create another user
    const [otherUser] = await testServer.db.insert(users).values({
      privyUserId: '3d-async-other',
      email: '3dasyncother@test.com',
      role: 'member',
    }).returning()
    const otherToken = 'mock-3dasyncother-token'

    // Create generation as owner
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A secret item',
        name: 'Secret Item',
      }
    })

    const { taskId } = JSON.parse(createResponse.body)

    // Try to access as other user
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/3d/generate/${taskId}/status`,
      headers: { authorization: `Bearer ${otherToken}` },
    })

    expect(statusResponse.statusCode).toBe(403)
  })

  test('GET /api/3d/generate/:taskId/status returns 404 for non-existent task', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/3d/generate/00000000-0000-0000-0000-000000000000/status',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(404)
  })

  test('POST /api/3d/generate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      payload: {
        prompt: 'A test item',
        name: 'Test Item',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/3d/generate validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: '', // Invalid: empty prompt
        name: 'Test',
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/3d/generate stores generation parameters', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A detailed helmet',
        name: 'Test Helmet',
        artStyle: 'low-poly',
        negativePrompt: 'ugly, distorted',
        aiModel: 'meshy-5',
        topology: 'quad',
        targetPolycount: 50000,
      }
    })

    expect(response.statusCode).toBe(202)
    const { taskId } = JSON.parse(response.body)

    // Check database
    const asset = await testServer.db.query.assets.findFirst({
      where: eq(assets.id, taskId)
    })

    expect(asset).toBeDefined()
    expect(asset!.generationParams).toBeDefined()
    expect(asset!.generationParams.artStyle).toBe('low-poly')
    expect(asset!.generationParams.negativePrompt).toBe('ugly, distorted')
    expect(asset!.generationParams.aiModel).toBe('meshy-5')
    expect(asset!.generationParams.topology).toBe('quad')
    expect(asset!.generationParams.targetPolycount).toBe(50000)
  })

  test('Asset status transitions are tracked', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A simple cube',
        name: 'Test Cube',
      }
    })

    const { taskId } = JSON.parse(response.body)

    // Check initial status
    const asset1 = await testServer.db.query.assets.findFirst({
      where: eq(assets.id, taskId)
    })
    expect(asset1!.status).toBe('processing')

    // Metadata should indicate generation started
    expect(asset1!.metadata).toBeDefined()
    expect(asset1!.metadata.generationStarted).toBeDefined()
  })

  test('Status endpoint shows progress when available', async () => {
    // Create asset manually with progress (don't trigger processor)
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Progress Test',
      type: 'model',
      status: 'processing',
      ownerId: ownerUserId,
      prompt: 'A test object',
      metadata: {
        progress: 50,
        stage: 'generating',
      },
    }).returning()

    // Check status
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/3d/generate/${asset.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(statusResponse.statusCode).toBe(200)
    const body = JSON.parse(statusResponse.body)
    expect(body.progress).toBe(50)
  })

  test('Status endpoint shows completed result', async () => {
    // Create asset with completed status manually
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Completed Model',
      type: 'model',
      status: 'published',
      ownerId: ownerUserId,
      prompt: 'A completed model',
      fileUrl: 'https://example.com/model.glb',
      metadata: {
        progress: 100,
        thumbnailUrl: 'https://example.com/thumb.jpg',
      },
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/generate/${asset.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('completed')
    expect(body.result).toBeDefined()
    expect(body.result.assetId).toBe(asset.id)
    expect(body.result.modelUrl).toBe('https://example.com/model.glb')
    expect(body.result.thumbnailUrl).toBe('https://example.com/thumb.jpg')
  })

  test('Status endpoint shows failed status with error', async () => {
    // Create asset with failed status manually
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Failed Model',
      type: 'model',
      status: 'failed',
      ownerId: ownerUserId,
      prompt: 'A failed model',
      metadata: {
        error: 'Generation failed: API error',
        progress: 0,
        stage: 'failed',
      },
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/generate/${asset.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('failed')
    expect(body.error).toBe('Generation failed: API error')
    expect(body.result).toBeUndefined()
  })

  // =====================================================
  // NOTE: Integration Tests with Real Meshy API
  // =====================================================
  // Testing actual generation flow requires MESHY_API_KEY
  // and would take 30-90 seconds per test. These tests
  // verify the async pattern, database updates, and API
  // contract. Actual Meshy integration is tested separately.
})
