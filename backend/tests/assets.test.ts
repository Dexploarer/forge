import { test, expect, describe } from 'bun:test'
import { testServer } from './setup'

describe('Assets API', () => {
  test('GET /api/assets returns paginated results', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/assets?page=1&limit=20'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('assets')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.assets)).toBe(true)
  })

  test('GET /api/assets/:id with invalid ID returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/assets/00000000-0000-0000-0000-000000000000'
    })

    expect(response.statusCode).toBe(404)
  })
})
