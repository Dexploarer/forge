import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  createJsonSchemaTransform,
} from 'fastify-type-provider-zod'
import { env } from '../config/env'

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Forge API',
        description: 'Production-ready backend API for Forge - Asset management with Privy authentication',
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@forge.io',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: env.NODE_ENV === 'production'
            ? 'https://api.forge.io'
            : `http://localhost:${env.PORT}`,
          description: env.NODE_ENV === 'production' ? 'Production' : 'Development',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Privy JWT access token',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'users', description: 'User management' },
        { name: 'assets', description: 'Asset CRUD operations' },
        { name: 'admin', description: 'Admin operations (requires admin role)' },
        { name: 'search', description: 'Advanced search and filtering' },
        { name: 'analytics', description: 'Analytics and statistics' },
      ],
    },
    transform: jsonSchemaTransform as any,
    transformObject: createJsonSchemaTransform({
      skipList: [
        '/health',
        '/health/detailed',
      ],
    }) as any,
  })

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    uiHooks: {
      onRequest: (_request, _reply, next) => {
        if (env.NODE_ENV === 'production') {
          // Add basic auth here if needed in production
        }
        next()
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  })

  fastify.log.info('✅ Swagger documentation available at /docs')
}

export default fp(swaggerPlugin, {
  name: 'swagger-plugin'
})
