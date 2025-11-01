import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { logActivity } from '../helpers/activity-logger'

/**
 * Activity Logger Plugin
 * Automatically logs all authenticated requests to activity_log table
 */

const activityLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Add onResponse hook to log activity after request completes
  fastify.addHook('onResponse', async (request, reply) => {
    // Only log authenticated requests
    if (!request.user) return

    // Skip health checks and other system endpoints
    if (request.url.startsWith('/health')) return
    if (request.url.startsWith('/api/activity')) return // Avoid logging the activity endpoint itself

    // Determine action based on HTTP method
    const method = request.method
    let action = 'unknown'

    switch (method) {
      case 'GET':
        action = 'read'
        break
      case 'POST':
        action = 'create'
        break
      case 'PUT':
      case 'PATCH':
        action = 'update'
        break
      case 'DELETE':
        action = 'delete'
        break
    }

    // Extract entity type from URL
    // Example: /api/teams/123 -> entityType: 'team', entityId: '123'
    const urlParts = request.url.split('?')[0]!.split('/').filter(p => p)
    let entityType = 'api'
    let entityId: string | null = null

    if (urlParts.length >= 2 && urlParts[0] === 'api') {
      entityType = urlParts[1]! // e.g., 'teams', 'projects', 'assets'

      // Try to extract entity ID (UUID pattern)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (urlParts.length >= 3 && uuidPattern.test(urlParts[2]!)) {
        entityId = urlParts[2]!
      }
    }

    // Build details object
    const details: Record<string, unknown> = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    }

    // Add query params if present
    if (Object.keys(request.query as object).length > 0) {
      details.query = request.query
    }

    // Log the activity (fire and forget - don't block response)
    logActivity(
      fastify.db,
      request.user.id,
      entityType,
      entityId,
      action,
      details,
      request
    ).catch(err => {
      fastify.log.error({ err }, 'Failed to log activity')
    })
  })
}

export default fp(activityLoggerPlugin, {
  name: 'activity-logger-plugin',
  dependencies: ['database-plugin', 'auth-plugin']
})
