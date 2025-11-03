import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { randomUUID } from 'crypto'
import { queryLogger } from '../database/db'

// =====================================================
// REQUEST/RESPONSE LOGGING PLUGIN
// =====================================================

const requestLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  const slowRequestThreshold = 1000 // ms

  // Hook: Request received
  fastify.addHook('onRequest', async (request, reply) => {
    // Add correlation ID for request tracking
    const requestId = randomUUID()
    ;(request as any).requestId = requestId
    reply.header('X-Request-ID', requestId)

    // Store request start time
    ;(request as any).startTime = Date.now()

    // Reset query counter for this request
    queryLogger.reset()

    // Log incoming request
    const logData: Record<string, any> = {
      method: request.method,
      url: request.url,
      requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }

    // Add user info if authenticated
    if (request.user) {
      logData.userId = request.user.id
      logData.userRole = (request.user as any).role
    }

    // Log query parameters (sanitized)
    if (Object.keys(request.query as object).length > 0) {
      logData.query = request.query
    }

    // Log request body size (not content for security)
    if (request.body) {
      const bodyStr = JSON.stringify(request.body)
      logData.bodySize = `${(bodyStr.length / 1024).toFixed(2)} KB`

      // Log specific fields if they're safe
      if (typeof request.body === 'object' && request.body !== null) {
        const body = request.body as Record<string, any>
        if (body.name) logData.name = body.name
        if (body.projectId) logData.projectId = body.projectId
      }
    }

    fastify.log.info(logData, '[Route] 📥 Incoming request')
  })

  // Hook: Response sent
  fastify.addHook('onResponse', async (request, reply) => {
    const requestId = (request as any).requestId
    const startTime = (request as any).startTime
    const responseTime = Date.now() - startTime
    const queryCount = queryLogger.getQueryCount()

    const logData: Record<string, any> = {
      method: request.method,
      url: request.url,
      requestId,
      statusCode: reply.statusCode,
      responseTime: `${responseTime}ms`,
      queryCount,
    }

    // Add user info if authenticated
    if (request.user) {
      logData.userId = request.user.id
    }

    // Calculate response size from headers if available
    const contentLength = reply.getHeader('content-length')
    if (contentLength) {
      const sizeKB = parseInt(contentLength as string) / 1024
      logData.responseSize = sizeKB > 1 ? `${sizeKB.toFixed(2)} KB` : `${contentLength} B`
    }

    // Log as warning if slow request
    if (responseTime > slowRequestThreshold) {
      fastify.log.warn(logData, '[Route] 🐌 Slow request completed')
    } else {
      fastify.log.info(logData, '[Route] 📤 Response sent')
    }
  })

  // Hook: Error handling
  fastify.addHook('onError', async (request, _reply, error) => {
    const requestId = (request as any).requestId
    const startTime = (request as any).startTime
    const responseTime = startTime ? Date.now() - startTime : 0

    fastify.log.error({
      method: request.method,
      url: request.url,
      requestId,
      userId: request.user?.id,
      error: error.message,
      errorName: error.name,
      errorCode: (error as any).code,
      stack: error.stack,
      responseTime: `${responseTime}ms`,
      queryCount: queryLogger.getQueryCount(),
    }, '[Route] ❌ Request failed with error')
  })

  fastify.log.info('✅ Request logger configured')
}

export default fp(requestLoggerPlugin, {
  name: 'request-logger-plugin',
  dependencies: ['database-plugin'] // Ensure database is loaded first
})
