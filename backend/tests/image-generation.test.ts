import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, assets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Image Generation Async Tests', () => {
  let ownerUserId: string
  let ownerToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'image-async-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'image-async-test-owner',
      email: 'imageasyncowner@test.com',
      displayName: 'Image Async Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-imageasyncowner-token'
  })

  // =====================================================
  // IMAGE GENERATION ASYNC FLOW TESTS
  // =====================================================

  test('POST /api/assets/generate-image returns 202 Accepted with taskId', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A fantasy landscape with mountains',
        name: 'Test Landscape',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
      }
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('taskId')
    expect(body.status).toBe('processing')
    expect(body).toHaveProperty('statusUrl')
    expect(body.statusUrl).toContain('/api/assets/')
    expect(body.statusUrl).toContain('/status')
  })

  test('POST /api/assets/generate-image creates asset with processing status', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A magical forest',
        name: 'Test Forest',
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
    expect(asset!.type).toBe('texture')
    expect(asset!.name).toBe('Test Forest')
    expect(asset!.prompt).toBe('A magical forest')
    expect(asset!.ownerId).toBe(ownerUserId)
  })

  test('GET /api/assets/:id/status returns status', async () => {
    // First create generation
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A castle in the clouds',
        name: 'Test Castle',
      }
    })

    const { taskId } = JSON.parse(createResponse.body)

    // Check status
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/assets/${taskId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(statusResponse.statusCode).toBe(200)
    const body = JSON.parse(statusResponse.body)
    expect(body.status).toBe('processing')
    expect(body.taskId).toBe(taskId)
  })

  test('GET /api/assets/:id/status requires ownership', async () => {
    // Cleanup: Delete any existing test user from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'image-async-other')
    )

    // Create another user
    const [otherUser] = await testServer.db.insert(users).values({
      privyUserId: 'image-async-other',
      email: 'imageasyncother@test.com',
      role: 'member',
    }).returning()
    const otherToken = 'mock-imageasyncother-token'

    // Create generation as owner
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A secret image',
        name: 'Secret Image',
      }
    })

    const { taskId } = JSON.parse(createResponse.body)

    // Try to access as other user
    const statusResponse = await testServer.inject({
      method: 'GET',
      url: `/api/assets/${taskId}/status`,
      headers: { authorization: `Bearer ${otherToken}` },
    })

    expect(statusResponse.statusCode).toBe(403)
  })

  test('GET /api/assets/:id/status returns 404 for non-existent asset', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/assets/00000000-0000-0000-0000-000000000000/status',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(404)
  })

  test('POST /api/assets/generate-image requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      payload: {
        prompt: 'A test image',
        name: 'Test Image',
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/assets/generate-image validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: '', // Invalid: empty prompt
        name: 'Test',
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/assets/generate-image stores generation parameters', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A detailed portrait',
        name: 'Test Portrait',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
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
    expect(asset!.generationParams.size).toBe('1792x1024')
    expect(asset!.generationParams.quality).toBe('hd')
    expect(asset!.generationParams.style).toBe('natural')
  })

  test('Status endpoint shows completed result', async () => {
    // Create asset with completed status manually
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Completed Image',
      type: 'texture',
      status: 'published',
      ownerId: ownerUserId,
      prompt: 'A completed image',
      fileUrl: 'https://example.com/image.png',
      metadata: {
        imageUrl: 'https://example.com/image.png',
        revisedPrompt: 'A completed image with details',
      },
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/assets/${asset.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('completed')
    expect(body.result).toBeDefined()
    expect(body.result.assetId).toBe(asset.id)
    expect(body.result.fileUrl).toBe('https://example.com/image.png')
  })

  test('Status endpoint shows failed status with error', async () => {
    // Create asset with failed status manually
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Failed Image',
      type: 'texture',
      status: 'failed',
      ownerId: ownerUserId,
      prompt: 'A failed image',
      metadata: {
        error: 'Image generation failed: Content policy violation',
      },
    }).returning()

    // Check status
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/assets/${asset.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('failed')
    expect(body.error).toBe('Image generation failed: Content policy violation')
    expect(body.result).toBeUndefined()
  })

  test('Default parameters are applied correctly', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/assets/generate-image',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        prompt: 'A simple test',
        name: 'Default Params Test',
        // Omit size, quality, style to test defaults
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
    // Defaults should be: size=1024x1024, quality=standard, style=vivid
    expect(asset!.generationParams.size).toBe('1024x1024')
    expect(asset!.generationParams.quality).toBe('standard')
    expect(asset!.generationParams.style).toBe('vivid')
  })

  test('Multiple concurrent generations can be created', async () => {
    const prompts = [
      'A red dragon',
      'A blue phoenix',
      'A green serpent',
    ]

    const responses = await Promise.all(
      prompts.map(prompt =>
        testServer.inject({
          method: 'POST',
          url: '/api/assets/generate-image',
          headers: { authorization: `Bearer ${ownerToken}` },
          payload: {
            prompt,
            name: `Test: ${prompt}`,
          }
        })
      )
    )

    // All should return 202
    responses.forEach(response => {
      expect(response.statusCode).toBe(202)
    })

    // All should have unique task IDs
    const taskIds = responses.map(r => JSON.parse(r.body).taskId)
    const uniqueTaskIds = new Set(taskIds)
    expect(uniqueTaskIds.size).toBe(3)

    // All should exist in database
    for (const taskId of taskIds) {
      const asset = await testServer.db.query.assets.findFirst({
        where: eq(assets.id, taskId)
      })
      expect(asset).toBeDefined()
      expect(asset!.status).toBe('processing')
    }
  })

  // =====================================================
  // NOTE: Integration Tests with Real OpenAI DALL-E API
  // =====================================================
  // Testing actual image generation requires OPENAI_API_KEY
  // and would make real API calls (expensive). These tests
  // verify the async pattern, database updates, and API
  // contract. Actual OpenAI integration is tested separately.
})
