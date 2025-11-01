import { test, expect } from 'bun:test'
import { testServer } from './setup'

test('GET /health returns 200', async () => {
  const response = await testServer.inject({
    method: 'GET',
    url: '/health'
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.status).toBe('healthy')
  expect(body).toHaveProperty('timestamp')
  expect(body).toHaveProperty('uptime')
})

test('GET /health/detailed returns database status', async () => {
  const response = await testServer.inject({
    method: 'GET',
    url: '/health/detailed'
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body).toHaveProperty('checks')
  expect(body.checks).toHaveProperty('database')
})
