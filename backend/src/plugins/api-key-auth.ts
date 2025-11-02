import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify'
import fp from 'fastify-plugin'
import { eq } from 'drizzle-orm'
import { apiKeys } from '../database/schema/system'
import { users } from '../database/schema'
import { validateApiKey } from '../helpers/api-key-generator'
import { UnauthorizedError } from '../utils/errors'

/**
 * API Key Authentication Plugin
 * Alternative authentication method using API keys
 */

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticateApiKey: preHandlerHookHandler
  }
}

const apiKeyAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // API Key authentication preHandler hook
  fastify.decorate('authenticateApiKey', async function(request, _reply) {
    try {
      // Extract API key from X-API-Key header
      const apiKeyHeader = request.headers['x-api-key']
      if (!apiKeyHeader) {
        throw new UnauthorizedError('Missing X-API-Key header')
      }

      const apiKeyValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader
      if (!apiKeyValue) {
        throw new UnauthorizedError('Invalid X-API-Key format')
      }

      // Look up API key in database
      // We need to check all active keys and validate the hash
      const allActiveKeys = await fastify.db.query.apiKeys.findMany({
        where: eq(apiKeys.isActive, true),
      })

      // Find matching key by validating hash
      let matchedKey: typeof apiKeys.$inferSelect | undefined
      for (const key of allActiveKeys) {
        if (validateApiKey(apiKeyValue, key.keyHash)) {
          matchedKey = key
          break
        }
      }

      if (!matchedKey) {
        throw new UnauthorizedError('Invalid API key')
      }

      // Check if key is expired
      if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
        throw new UnauthorizedError('API key has expired')
      }

      // Get the user associated with this API key
      let userId: string
      if (matchedKey.userId) {
        userId = matchedKey.userId
      } else if (matchedKey.teamId) {
        // For team keys, we could use a system user or the team owner
        // For now, we'll throw an error as team-based auth needs more context
        throw new UnauthorizedError('Team API keys not yet supported for authentication')
      } else {
        throw new UnauthorizedError('API key has no associated user')
      }

      // Look up user
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        throw new UnauthorizedError('User not found for API key')
      }

      // Everyone who is authenticated has full access
      const isAdmin = true

      // Attach user with admin flag to request
      request.user = {
        ...user,
        isAdmin
      }

      // Update last used timestamp (fire and forget)
      fastify.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, matchedKey.id))
        .catch(err => {
          fastify.log.error({ err }, 'Failed to update API key lastUsedAt')
        })

    } catch (error) {
      // If it's already an UnauthorizedError, rethrow it
      if (error instanceof UnauthorizedError) {
        throw error
      }
      // For other errors, wrap in UnauthorizedError
      fastify.log.error({ error }, 'API key authentication failed')
      throw new UnauthorizedError('Unauthorized')
    }
  })
}

export default fp(apiKeyAuthPlugin, {
  name: 'api-key-auth-plugin',
  dependencies: ['database-plugin']
})
