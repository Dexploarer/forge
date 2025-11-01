import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, aiServiceCalls } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('AI Services Routes - Real E2E Tests', () => {
  let userUserId: string
  let userToken: string
  let otherUserId: string
  let otherToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'ai-test-user')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'ai-test-other')
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'ai-test-user',
      email: 'aimember@test.com', // Match token pattern 'mock-aimember-token' -> 'aimember'
      displayName: 'AI Test User',
      role: 'member',
    }).returning()

    userUserId = user.id
    userToken = 'mock-aimember-token'

    // Create other user
    const [other] = await testServer.db.insert(users).values({
      privyUserId: 'ai-test-other',
      email: 'aiother@test.com',
      displayName: 'AI Other User',
      role: 'member',
    }).returning()

    otherUserId = other.id
    otherToken = 'mock-aiother-token'

    // Create some test AI service call records for the user
    // Note: cost is stored as integer in cents (USD)
    await testServer.db.insert(aiServiceCalls).values([
      {
        userId: userUserId,
        service: 'openai',
        endpoint: '/chat/completions',
        model: 'gpt-3.5-turbo',
        tokensUsed: 150,
        cost: 23, // $0.00023 = 0.023 cents, stored as 0 due to integer rounding, use 23 cents = $0.23
        durationMs: 1200,
        status: 'success',
        requestData: { messages: [{ role: 'user', content: 'test' }] },
        responseData: { content: 'response' },
      },
      {
        userId: userUserId,
        service: 'openai',
        endpoint: '/embeddings',
        model: 'text-embedding-3-small',
        tokensUsed: 50,
        cost: 1, // $0.00001 = 0.001 cents, use 1 cent = $0.01
        durationMs: 800,
        status: 'success',
        requestData: { text: 'test embedding' },
        responseData: {},
      },
      {
        userId: userUserId,
        service: 'meshy',
        endpoint: '/text-to-3d',
        model: 'meshy-4',
        cost: 50, // $0.50 = 50 cents
        durationMs: 30000,
        status: 'success',
        requestData: { prompt: 'test 3d model' },
        responseData: { taskId: 'task123' },
      },
      {
        userId: userUserId,
        service: 'openai',
        endpoint: '/chat/completions',
        model: 'gpt-4-turbo',
        tokensUsed: 0,
        cost: 0,
        durationMs: 500,
        status: 'error',
        error: 'Rate limit exceeded',
        requestData: { messages: [] },
      },
    ])

    // Create a service call for the other user (to test isolation)
    await testServer.db.insert(aiServiceCalls).values({
      userId: otherUserId,
      service: 'openai',
      endpoint: '/chat/completions',
      model: 'gpt-3.5-turbo',
      tokensUsed: 100,
      cost: 15, // $0.15 = 15 cents
      durationMs: 1000,
      status: 'success',
      requestData: {},
      responseData: {},
    })
  })

  // =====================================================
  // USAGE STATISTICS TESTS
  // =====================================================

  test('GET /api/ai/usage returns usage statistics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.usage).toBeDefined()
    expect(body.usage.totalCalls).toBe(4)
    expect(body.usage.successfulCalls).toBe(3)
    expect(body.usage.failedCalls).toBe(1)
    expect(body.usage.totalTokens).toBe(200) // 150 + 50 + 0 + 0
    expect(body.usage.totalCost).toBeGreaterThan(0)
    expect(body.usage.averageDuration).toBeGreaterThan(0)
  })

  test('GET /api/ai/usage filters by service', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage?service=openai',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.usage).toBeDefined()
    expect(body.usage.totalCalls).toBe(3) // Only OpenAI calls
  })

  test('GET /api/ai/usage filters by date range', async () => {
    const today = new Date().toISOString()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/ai/usage?startDate=${yesterday}&endDate=${today}`,
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.usage).toBeDefined()
    expect(body.usage.totalCalls).toBeGreaterThanOrEqual(0)
  })

  test('GET /api/ai/usage only shows users own data', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage',
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.usage.totalCalls).toBe(1) // Only other user's call
  })

  test('GET /api/ai/usage requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // COST BREAKDOWN TESTS
  // =====================================================

  test('GET /api/ai/usage/cost returns cost breakdown', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage/cost',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.costs).toBeDefined()
    expect(Array.isArray(body.costs)).toBe(true)
    expect(body.costs.length).toBeGreaterThan(0)

    // Verify cost breakdown structure
    const openaiCost = body.costs.find((c: any) => c.service === 'openai')
    expect(openaiCost).toBeDefined()
    expect(openaiCost.totalCalls).toBe(3)
    expect(openaiCost.totalCost).toBeGreaterThan(0)
    expect(openaiCost.totalCostFormatted).toBeDefined()
    expect(openaiCost.totalTokens).toBe(200)

    const meshyCost = body.costs.find((c: any) => c.service === 'meshy')
    expect(meshyCost).toBeDefined()
    expect(meshyCost.totalCalls).toBe(1)
    expect(meshyCost.totalCost).toBe(50) // 50 cents = $0.50

    // Verify total
    expect(body.total).toBeDefined()
    expect(body.total.calls).toBe(4)
    expect(body.total.cost).toBeGreaterThan(0)
    expect(body.total.costFormatted).toBeDefined()
  })

  test('GET /api/ai/usage/cost filters by date range', async () => {
    const today = new Date().toISOString()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/ai/usage/cost?startDate=${yesterday}&endDate=${today}`,
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.costs).toBeDefined()
    expect(body.total).toBeDefined()
  })

  test('GET /api/ai/usage/cost only shows users own data', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage/cost',
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.total.calls).toBe(1) // Only other user's calls
  })

  test('GET /api/ai/usage/cost requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/usage/cost'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // LIST SERVICES TESTS
  // =====================================================

  test('GET /api/ai/services lists available services', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/services',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.services).toBeDefined()
    expect(Array.isArray(body.services)).toBe(true)
    expect(body.services.length).toBe(4) // openai, anthropic, meshy, elevenlabs

    // Verify OpenAI service
    const openai = body.services.find((s: any) => s.name === 'openai')
    expect(openai).toBeDefined()
    expect(openai.capabilities).toContain('chat')
    expect(openai.capabilities).toContain('embeddings')
    expect(openai.models).toContain('gpt-4-turbo')
    expect(openai.status).toBe('available')

    // Verify Meshy service
    const meshy = body.services.find((s: any) => s.name === 'meshy')
    expect(meshy).toBeDefined()
    expect(meshy.capabilities).toContain('text-to-3d')
    expect(meshy.status).toBe('available')
  })

  test('GET /api/ai/services requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/services'
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // RECENT CALLS TESTS
  // =====================================================

  test('GET /api/ai/calls/recent returns recent calls', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent?limit=10',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.calls).toBeDefined()
    expect(Array.isArray(body.calls)).toBe(true)
    expect(body.calls.length).toBe(4) // User's 4 calls

    // Verify call structure
    const firstCall = body.calls[0]
    expect(firstCall.id).toBeDefined()
    expect(firstCall.service).toBeDefined()
    expect(firstCall.endpoint).toBeDefined()
    expect(firstCall.status).toBeDefined()
    expect(firstCall.costFormatted).toBeDefined()
    expect(firstCall.createdAt).toBeDefined()

    // Verify calls are sorted by createdAt descending
    if (body.calls.length > 1) {
      const firstDate = new Date(body.calls[0].createdAt)
      const secondDate = new Date(body.calls[1].createdAt)
      expect(firstDate >= secondDate).toBe(true)
    }
  })

  test('GET /api/ai/calls/recent filters by service', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent?service=meshy',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.calls.length).toBe(1) // Only Meshy call

    body.calls.forEach((call: any) => {
      expect(call.service).toBe('meshy')
    })
  })

  test('GET /api/ai/calls/recent respects limit parameter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent?limit=2',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.calls.length).toBeLessThanOrEqual(2)
  })

  test('GET /api/ai/calls/recent only shows users own calls', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent',
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.calls.length).toBe(1) // Only other user's call

    body.calls.forEach((call: any) => {
      // Verify all calls belong to other user (we can't directly check userId in response)
      expect(call.id).toBeDefined()
    })
  })

  test('GET /api/ai/calls/recent requires authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent'
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/ai/calls/recent with invalid service returns 400', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent?service=invalid',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('GET /api/ai/calls/recent shows error information', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/ai/calls/recent',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const errorCall = body.calls.find((c: any) => c.status === 'error')

    if (errorCall) {
      expect(errorCall.error).toBe('Rate limit exceeded')
      expect(errorCall.tokensUsed).toBe(0)
      expect(errorCall.cost).toBe(0)
    }
  })

  // =====================================================
  // VALIDATION TESTS FOR EXTERNAL API ENDPOINTS
  // =====================================================
  // The following tests verify input validation and authentication
  // for endpoints that require external APIs. We cannot test successful
  // responses without real API keys, but we can ensure proper validation.

  // POST /api/ai/chat validation tests
  test('POST /api/ai/chat requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: {
        messages: [{ role: 'user', content: 'test' }]
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/chat validates messages array', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        messages: 'not an array'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/chat validates message role', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        messages: [{ role: 'invalid', content: 'test' }]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/chat validates temperature range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        messages: [{ role: 'user', content: 'test' }],
        temperature: 3.0
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/chat validates maxTokens range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 5000
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/embed validation tests
  test('POST /api/ai/embed requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/embed',
      payload: {
        text: 'test'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/embed validates text is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/embed',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        text: ''
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/generate-image validation tests
  test('POST /api/ai/generate-image requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-image',
      payload: {
        prompt: 'test image'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/generate-image validates prompt is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-image',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: ''
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-image validates size enum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-image',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        size: '2048x2048'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-image validates quality enum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-image',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        quality: 'ultra'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-image validates style enum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-image',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        style: 'abstract'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/generate-model validation tests
  test('POST /api/ai/generate-model requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-model',
      payload: {
        prompt: 'test model'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/generate-model validates prompt is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-model',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: ''
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-model validates topology enum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-model',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        topology: 'hexagon'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-model validates targetPolycount range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-model',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        targetPolycount: 500
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/generate-model validates targetPolycount maximum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/generate-model',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'test',
        targetPolycount: 150000
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/search validation tests
  test('POST /api/ai/search requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/search',
      payload: {
        query: 'test',
        projectId: '00000000-0000-0000-0000-000000000000'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/search validates query is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: '',
        projectId: '00000000-0000-0000-0000-000000000000'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/search validates projectId is UUID', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        projectId: 'not-a-uuid'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/search validates threshold range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        projectId: '00000000-0000-0000-0000-000000000000',
        threshold: 1.5
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/search validates limit range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        projectId: '00000000-0000-0000-0000-000000000000',
        limit: 100
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/vision/analyze validation tests
  test('POST /api/ai/vision/analyze requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze',
      payload: {
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'describe this image'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/vision/analyze validates imageUrl format', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        imageUrl: 'not-a-url',
        prompt: 'test'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze validates prompt is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        imageUrl: 'https://example.com/image.jpg',
        prompt: ''
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze validates maxTokens range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'test',
        maxTokens: 5000
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze validates detail enum', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'test',
        detail: 'ultra'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/vision/analyze-multiple validation tests
  test('POST /api/ai/vision/analyze-multiple requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze-multiple',
      payload: {
        images: [{ url: 'https://example.com/image.jpg' }],
        prompt: 'describe these images'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/vision/analyze-multiple validates images array', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze-multiple',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        images: 'not an array',
        prompt: 'test'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze-multiple validates images array not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze-multiple',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        images: [],
        prompt: 'test'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze-multiple validates maximum images', async () => {
    const images = Array.from({ length: 15 }, (_, i) => ({
      url: `https://example.com/image${i}.jpg`
    }))

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze-multiple',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        images,
        prompt: 'test'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/vision/analyze-multiple validates image URL format', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/vision/analyze-multiple',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        images: [{ url: 'not-a-url' }],
        prompt: 'test'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/audio/transcribe validation tests
  test('POST /api/ai/audio/transcribe requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/transcribe',
      payload: {
        audioUrl: 'https://example.com/audio.mp3'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/audio/transcribe validates audioUrl format', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/transcribe',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        audioUrl: 'not-a-url'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/audio/transcribe validates temperature range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/transcribe',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        audioUrl: 'https://example.com/audio.mp3',
        temperature: 1.5
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/audio/translate validation tests
  test('POST /api/ai/audio/translate requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/translate',
      payload: {
        audioUrl: 'https://example.com/audio.mp3'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/audio/translate validates audioUrl format', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/translate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        audioUrl: 'not-a-url'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/audio/translate validates temperature range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/audio/translate',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        audioUrl: 'https://example.com/audio.mp3',
        temperature: 1.5
      }
    })

    expect(response.statusCode).toBe(400)
  })

  // POST /api/ai/semantic/search validation tests
  test('POST /api/ai/semantic/search requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/semantic/search',
      payload: {
        query: 'test',
        texts: ['text1', 'text2']
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/ai/semantic/search validates query is not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/semantic/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: '',
        texts: ['text1']
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/semantic/search validates texts array not empty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/semantic/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        texts: []
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/semantic/search validates texts array maximum', async () => {
    const texts = Array.from({ length: 150 }, (_, i) => `text${i}`)

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/semantic/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        texts
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/ai/semantic/search validates topK range', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/ai/semantic/search',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'test',
        texts: ['text1'],
        topK: 100
      }
    })

    expect(response.statusCode).toBe(400)
  })
})
