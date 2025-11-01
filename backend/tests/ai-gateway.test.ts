import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('AI Gateway Routes - E2E Tests', () => {
  let userUserId: string
  let userToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'ai-gateway-test-user')
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'ai-gateway-test-user',
      email: 'gatewaymember@test.com',
      displayName: 'AI Gateway Test User',
      role: 'member',
    }).returning()

    userUserId = user.id
    userToken = 'mock-gatewaymember-token'
  })

  // =====================================================
  // GATEWAY STATUS TESTS
  // =====================================================

  test('GET /api/ai-gateway/status returns gateway status', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/status',
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.enabled).toBeDefined()
    expect(typeof body.enabled).toBe('boolean')
    expect(body.provider).toBeDefined()
    expect(body.message).toBeDefined()
  })

  test('GET /api/ai-gateway/status does not require authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/status',
    })

    // Should succeed without auth
    expect(response.statusCode).toBe(200)
  })

  // =====================================================
  // MODELS LIST TESTS
  // =====================================================

  test('GET /api/ai-gateway/models returns available models', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/models',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    // May return 200 with mock data or 400 if gateway not enabled
    expect([200, 400]).toContain(response.statusCode)

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body)
      expect(body.count).toBeDefined()
      expect(body.models).toBeDefined()
      expect(Array.isArray(body.models)).toBe(true)

      if (body.models.length > 0) {
        const model = body.models[0]
        expect(model.id).toBeDefined()
        expect(model.name).toBeDefined()
        expect(model.pricing).toBeDefined()
      }
    }
  })

  test('GET /api/ai-gateway/models requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/models'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // MODEL PRICING TESTS
  // =====================================================

  test('GET /api/ai-gateway/models/:modelId/pricing returns model pricing', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/models/openai-gpt-4o/pricing',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    // May return 200, 400 (no gateway), or 404 (model not found)
    expect([200, 400, 404]).toContain(response.statusCode)

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body)
      expect(body.modelId).toBeDefined()
      expect(body.pricing).toBeDefined()
    }
  })

  test('GET /api/ai-gateway/models/:modelId/pricing requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/models/openai-gpt-4o/pricing'
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/ai-gateway/models/:modelId/pricing with invalid model returns 404 or 400', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/models/nonexistent-model/pricing',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    // Should return 400 (no gateway) or 404 (model not found)
    expect([400, 404]).toContain(response.statusCode)
  })

  // =====================================================
  // CREDITS TESTS
  // =====================================================

  test('GET /api/ai-gateway/credits returns credit balance', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/credits',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    // May return 200 with mock data or 400 if gateway not enabled
    expect([200, 400]).toContain(response.statusCode)

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body)
      expect(body.balance).toBeDefined()
      expect(typeof body.balance).toBe('number')
      expect(body.totalUsed).toBeDefined()
      expect(typeof body.totalUsed).toBe('number')
      expect(body.unit).toBe('USD')
    }
  })

  test('GET /api/ai-gateway/credits requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/credits'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // PROVIDERS LIST TESTS
  // =====================================================

  test('GET /api/ai-gateway/providers returns supported providers', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/providers',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    // May return 200 with mock data or 400 if gateway not enabled
    expect([200, 400]).toContain(response.statusCode)

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body)
      expect(body.count).toBeDefined()
      expect(body.providers).toBeDefined()
      expect(Array.isArray(body.providers)).toBe(true)
    }
  })

  test('GET /api/ai-gateway/providers requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai-gateway/providers'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // COST ESTIMATION TESTS
  // =====================================================

  test('POST /api/ai-gateway/estimate returns cost estimate', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        model: 'openai/gpt-4o',
        inputTokens: 1000,
        outputTokens: 500
      }
    })

    // May return 200 with estimate or 400 if gateway not enabled
    expect([200, 400]).toContain(response.statusCode)

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body)
      expect(body.model).toBe('openai/gpt-4o')
      expect(body.estimate).toBeDefined()
      expect(body.estimate.inputTokens).toBe(1000)
      expect(body.estimate.outputTokens).toBe(500)
      expect(body.estimate.costs).toBeDefined()
      expect(body.estimate.costs.input).toBeDefined()
      expect(body.estimate.costs.output).toBeDefined()
      expect(body.estimate.costs.total).toBeDefined()
      expect(body.estimate.unit).toBe('USD')
      expect(body.pricing).toBeDefined()
    }
  })

  test('POST /api/ai-gateway/estimate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      payload: {
        model: 'openai/gpt-4o',
        inputTokens: 1000,
        outputTokens: 500
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai-gateway/estimate validates input tokens must be positive', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        model: 'openai/gpt-4o',
        inputTokens: -100,
        outputTokens: 500
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai-gateway/estimate validates output tokens must be positive', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        model: 'openai/gpt-4o',
        inputTokens: 1000,
        outputTokens: 0
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai-gateway/estimate requires model parameter', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        inputTokens: 1000,
        outputTokens: 500
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai-gateway/estimate with invalid model returns 404 or 400', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai-gateway/estimate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        model: 'invalid/model',
        inputTokens: 1000,
        outputTokens: 500
      }
    })

    // Should return 400 (no gateway) or 404 (model not found)
    expect([400, 404]).toContain(response.statusCode)
  })
})
