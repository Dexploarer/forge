import { beforeAll, afterAll } from 'bun:test'
import { buildServer } from '../src/server'
import type { FastifyInstance } from 'fastify'
import { fileStorageService } from '../src/services/file.service'

export let testServer: FastifyInstance

beforeAll(async () => {
  // Initialize file storage
  await fileStorageService.initialize()

  // Build server in test mode
  // The auth plugin will detect test tokens and look up real users from database
  testServer = await buildServer()
})

afterAll(async () => {
  await testServer.close()
})
