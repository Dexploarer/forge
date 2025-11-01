import { test, expect, describe } from 'bun:test'
import { testServer } from './setup'

describe('Authentication', () => {
  test('GET /api/auth/me without token returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me'
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/auth/me with invalid token returns 401', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'Bearer invalid-token'
      }
    })

    expect(response.statusCode).toBe(401)
  })
})
