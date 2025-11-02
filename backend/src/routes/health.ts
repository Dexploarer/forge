import { FastifyPluginAsync } from 'fastify'
import { checkDatabaseHealth } from '../database/db'
import { env } from '../config/env'

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Root endpoint
  fastify.get('/', async () => {
    return {
      name: 'Forge Backend API',
      version: '1.0.0',
      status: 'online',
      documentation: '/documentation',
    }
  })

  // Basic health check
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: '1.0.0',
    }
  })

  // Detailed health check
  fastify.get('/health/detailed', async () => {
    const dbHealthy = await checkDatabaseHealth()

    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      checks: {
        database: dbHealthy ? 'ok' : 'failed',
      },
    }
  })
}

export default healthRoutes
