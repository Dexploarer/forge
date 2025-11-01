/**
 * Frontend Error Logging Routes
 * Provides endpoints for logging frontend errors from the React application
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// =====================================================
// SCHEMAS
// =====================================================

const FrontendErrorSchema = z.object({
  error: z.string().nullable().optional(),
  errorInfo: z.any().nullable().optional(),
  componentStack: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  stack: z.string().nullable().optional(),
})

const ErrorLoggedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

const ErrorFailedResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
})

// =====================================================
// ROUTE REGISTRATION
// =====================================================

const frontendErrorRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/errors/frontend
   * Log frontend errors from the React application
   */
  server.post('/', {
    schema: {
      tags: ['Error Logging'],
      description: 'Log frontend errors from the React application',
      body: FrontendErrorSchema,
      response: {
        200: ErrorLoggedResponseSchema,
        500: ErrorFailedResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const {
        error,
        errorInfo,
        componentStack,
        url,
        timestamp,
        userAgent,
        message,
        stack
      } = request.body as z.infer<typeof FrontendErrorSchema>

      // Truncate long stack traces to prevent log flooding
      const truncatedStack = componentStack?.substring(0, 500)
      const truncatedFullStack = stack?.substring(0, 1000)

      // Use Fastify's built-in logger with structured logging
      server.log.error({
        type: 'frontend-error',
        timestamp: timestamp || new Date().toISOString(),
        error: error || message || 'Unknown error',
        url: url || 'Unknown URL',
        userAgent: userAgent || request.headers['user-agent'],
        errorInfo,
        componentStack: truncatedStack,
        stack: truncatedFullStack,
        ip: request.ip,
        headers: {
          referer: request.headers.referer,
          origin: request.headers.origin,
        }
      }, '[Frontend Error]')

      return {
        success: true,
        message: 'Error logged',
      }
    } catch (err) {
      server.log.error({ err }, '[Frontend Error] Failed to log error')
      return reply.status(500).send({
        success: false,
        error: 'Failed to log error',
      })
    }
  })
}

export default frontendErrorRoutes
