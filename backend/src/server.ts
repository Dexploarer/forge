import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { env } from './config/env'

// Plugins
import databasePlugin from './plugins/database'
import corsPlugin from './plugins/cors'
import requestLoggerPlugin from './plugins/request-logger'
import authPlugin from './plugins/auth'
import swaggerPlugin from './plugins/swagger'
import multipartPlugin from './plugins/multipart'
import apiKeyAuthPlugin from './plugins/api-key-auth'
import activityLoggerPlugin from './plugins/activity-logger-plugin'

// Routes
import healthRoutes from './routes/health'
import earlyAccessRoutes from './routes/early-access'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import teamRoutes from './routes/teams'
import projectRoutes from './routes/projects'
import assetRoutes from './routes/assets'
import adminRoutes from './routes/admin'
import searchRoutes from './routes/search'
import analyticsRoutes from './routes/analytics'
import notificationRoutes from './routes/notifications'
import activityRoutes from './routes/activity'
import apiKeyRoutes from './routes/api-keys'
import credentialsRoutes from './routes/credentials'
import systemSettingsRoutes from './routes/system-settings'
import musicRoutes from './routes/music'
import soundEffectsRoutes from './routes/sound-effects'
import voiceRoutes from './routes/voice'
import voiceAssignmentsRoutes from './routes/voice-assignments'
import loreRoutes from './routes/lore'
import questRoutes from './routes/quests'
import npcRoutes from './routes/npcs'
import manifestRoutes from './routes/manifests'
import threeDFeaturesRoutes from './routes/3d-features'
import aiServicesRoutes from './routes/ai-services'
import aiContextRoutes from './routes/ai-context'
import aiGatewayRoutes from './routes/ai-gateway'
import multiAgentRoutes from './routes/multi-agent'
import modelsRoutes from './routes/models'
import promptsRoutes from './routes/prompts'
import embeddingsRoutes from './routes/embeddings'
import contentGenerationRoutes from './routes/content-generation'
import weaponDetectionRoutes from './routes/weapon-detection'
import bootstrapRoutes from './routes/bootstrap'
import frontendErrorRoutes from './routes/frontend-errors'
import importAssetsRoutes from './routes/import-assets'
import { cleanupInvalidAssetsRoute } from './routes/cleanup-invalid-assets'
import { publicAssetManagementRoute } from './routes/public-asset-management'
import { analyze3DModelsRoute } from './routes/analyze-3d-models'
import { importGitHubAssetsRoute } from './routes/import-github-assets'

// Utils
import { AppError } from './utils/errors'

export async function buildServer() {
  // Create Fastify instance
  const server = Fastify({
    logger: env.NODE_ENV === 'development' ? {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: env.LOG_LEVEL,
    },
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: env.NODE_ENV === 'production',
    connectionTimeout: 60000,
    keepAliveTimeout: 65000,
    bodyLimit: 10 * 1024 * 1024, // 10MB
    pluginTimeout: 60000, // 60 seconds for plugin registration (database can be slow in tests)
  }).withTypeProvider<ZodTypeProvider>()

  // Set Zod validation
  server.setValidatorCompiler(validatorCompiler)
  server.setSerializerCompiler(serializerCompiler)

  // Register plugins
  await server.register(corsPlugin)
  await server.register(databasePlugin)
  await server.register(requestLoggerPlugin)
  await server.register(authPlugin)
  await server.register(apiKeyAuthPlugin)
  await server.register(swaggerPlugin)
  await server.register(multipartPlugin)
  await server.register(activityLoggerPlugin)

  // Register static file serving for uploaded assets
  await server.register(fastifyStatic, {
    root: join(process.cwd(), env.FILE_STORAGE_PATH),
    prefix: '/files/',
  })

  // Register routes
  await server.register(healthRoutes)
  await server.register(earlyAccessRoutes, { prefix: '/api/early-access' })
  await server.register(authRoutes, { prefix: '/api/auth' })
  await server.register(userRoutes, { prefix: '/api/users' })
  await server.register(teamRoutes, { prefix: '/api/teams' })
  await server.register(projectRoutes, { prefix: '/api/projects' })
  await server.register(assetRoutes, { prefix: '/api/assets' })
  await server.register(adminRoutes, { prefix: '/api/admin' })
  await server.register(searchRoutes, { prefix: '/api/search' })
  await server.register(analyticsRoutes, { prefix: '/api/analytics' })
  await server.register(notificationRoutes, { prefix: '/api/notifications' })
  await server.register(activityRoutes, { prefix: '/api/activity' })
  await server.register(apiKeyRoutes, { prefix: '/api/api-keys' })
  await server.register(credentialsRoutes, { prefix: '/api/credentials' })
  await server.register(systemSettingsRoutes, { prefix: '/api/system/settings' })

  // Bootstrap & Error Logging
  await server.register(bootstrapRoutes, { prefix: '/api/bootstrap' })
  await server.register(frontendErrorRoutes, { prefix: '/api/errors' })

  // Audio routes
  await server.register(musicRoutes, { prefix: '/api/music' })
  await server.register(soundEffectsRoutes, { prefix: '/api/sfx' })
  await server.register(voiceRoutes, { prefix: '/api/voice' })
  await server.register(voiceAssignmentsRoutes, { prefix: '/api/voice-assignments' })

  // Game content routes
  await server.register(loreRoutes, { prefix: '/api/lore' })
  await server.register(questRoutes, { prefix: '/api/quests' })
  await server.register(npcRoutes, { prefix: '/api/npcs' })

  // Advanced features routes
  await server.register(manifestRoutes, { prefix: '/api/manifests' })
  await server.register(threeDFeaturesRoutes, { prefix: '/api/3d' })

  // AI routes
  await server.register(aiServicesRoutes, { prefix: '/api/ai' })
  await server.register(aiContextRoutes, { prefix: '/api/ai-context' })
  await server.register(aiGatewayRoutes, { prefix: '/api/ai-gateway' })
  await server.register(multiAgentRoutes, { prefix: '/api/multi-agent' })

  // AI Models & Prompts
  await server.register(modelsRoutes, { prefix: '/api/models' })
  await server.register(promptsRoutes, { prefix: '/api/prompts' })

  // Vector Embeddings & Content Generation
  await server.register(embeddingsRoutes, { prefix: '/api/embeddings' })
  await server.register(contentGenerationRoutes, { prefix: '/api/content-generation' })

  // 3D Asset AI Features
  await server.register(weaponDetectionRoutes, { prefix: '/api' })

  // Asset Import (admin/system)
  await server.register(importAssetsRoutes, { prefix: '/api/import' })

  // Asset Management & Analysis
  await server.register(cleanupInvalidAssetsRoute, { prefix: '/api' })
  await server.register(analyze3DModelsRoute, { prefix: '/api' })

  // GitHub Asset Import
  await server.register(importGitHubAssetsRoute, { prefix: '/api' })

  // Public Asset Management (no auth required)
  await server.register(publicAssetManagementRoute, { prefix: '/api' })

  // Global error handler
  server.setErrorHandler(async (error, request, reply) => {
    // Log error
    server.log.error({
      err: error,
      req: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
      }
    }, error.message || 'Request error')

    // Handle AppError instances - let Fastify use its default error format
    // Fastify's format: { statusCode, code, error: name, message: message }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(error)
    }

    // Handle validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: error.validation,
      })
    }

    // Default error response (don't expose internal errors in production)
    if (env.NODE_ENV === 'production') {
      return reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      })
    }

    // Development: send full error
    return reply.code(500).send({
      error: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      stack: error.stack,
    })
  })

  // 404 handler
  server.setNotFoundHandler(async (request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    })
  })

  server.log.info('✅ Server built successfully')

  return server
}
