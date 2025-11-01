import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { db, checkDatabaseHealth, closeDatabaseConnections } from '../database/db'

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  // Add database to fastify instance
  fastify.decorate('db', db)

  // Health check
  const isHealthy = await checkDatabaseHealth()
  if (!isHealthy) {
    throw new Error('Database connection failed')
  }

  fastify.log.info('✅ Database connected')

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await closeDatabaseConnections()
    fastify.log.info('Database connections closed')
  })
}

export default fp(databasePlugin, {
  name: 'database-plugin'
})
