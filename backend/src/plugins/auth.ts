import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify'
import fp from 'fastify-plugin'
import { PrivyClient } from '@privy-io/server-auth'
import { env } from '../config/env'
import { db } from '../database/db'
import { users } from '../database/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from '../utils/errors'

// Extended user type with admin flag
type PrivyAuthUser = typeof users.$inferSelect & {
  isAdmin: boolean
}

// Type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user?: PrivyAuthUser
  }

  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    optionalAuth: preHandlerHookHandler
    auth: {
      verifyToken(token: string): Promise<any>
    }
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize Privy client
  const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET)

  // Decorate fastify with auth utilities
  fastify.decorate('auth', {
    async verifyToken(token: string) {
      try {
        const claims = await privy.verifyAuthToken(token)
        return claims
      } catch (error) {
        throw new Error('Invalid token')
      }
    }
  })

  // Authentication preHandler hook
  fastify.decorate('authenticate', async function(request, _reply) {
    try {
      // TEST MODE: Use mock tokens for testing
      if (env.NODE_ENV === 'test') {
        const authHeader = request.headers.authorization
        if (!authHeader) {
          throw new UnauthorizedError('Missing authorization header')
        }

        // Parse mock token format: 'Bearer mock-{privyUserId}-token'
        const token = authHeader.replace('Bearer ', '')
        if (!token.startsWith('mock-')) {
          throw new UnauthorizedError('Invalid test token format')
        }

        // Extract identifier from token
        // Token patterns:
        // 1. mock-systemadmin-token → system-test-admin
        // 2. mock-admin-token → {any}-test-admin
        // 3. mock-teamowner-token → teams-test-owner
        const identifier = token.replace('mock-', '').replace('-token', '')

        // Try to find the user by matching identifier pattern
        const allUsers = await db.query.users.findMany()

        // Try multiple matching strategies
        const user = allUsers.find(u => {
          if (!u.privyUserId.includes('-test-')) return false

          // Strategy 1: Full match (mock-systemadmin-token → system-test-admin)
          const parts = u.privyUserId.split('-test-')
          if (parts.length === 2) {
            const category = parts[0].replace(/-/g, '')
            const role = parts[1].replace(/-/g, '')
            const combined = `${category}${role}`
            if (identifier === combined) return true
          }

          // Strategy 2: Simple role match (mock-admin-token → *-test-admin)
          const roleOnly = u.privyUserId.split('-test-')[1]?.replace(/-/g, '')
          if (roleOnly && identifier === roleOnly) return true

          // Strategy 3: Role-based match (mock-teamowner-token → teams-test-owner)
          // Check if identifier ends with the role and category is similar
          if (parts.length === 2) {
            const category = parts[0]
            const role = parts[1].replace(/-/g, '')

            // Check if identifier ends with the role
            if (identifier.endsWith(role)) {
              const categoryFromIdentifier = identifier.replace(role, '')
              const categoryNormalized = category.replace(/-/g, '')

              // Check if categories are similar (allow plural/singular differences)
              if (categoryFromIdentifier === categoryNormalized) return true
              if (categoryFromIdentifier + 's' === categoryNormalized) return true
              if (categoryFromIdentifier === categoryNormalized + 's') return true
              if (categoryNormalized.startsWith(categoryFromIdentifier)) return true
              if (categoryFromIdentifier.startsWith(categoryNormalized)) return true
            }
          }

          // Strategy 4: Flexible substring match
          const normalized = u.privyUserId.replace('-test-', '').replace(/-/g, '')
          const identifierNorm = identifier.replace(/-/g, '')

          if (normalized.includes(identifierNorm) || identifierNorm.includes(normalized)) return true
          if (normalized.endsWith(identifierNorm)) return true

          return false
        })

        if (!user) {
          fastify.log.error({
            token,
            identifier,
            availableUsers: allUsers.map(u => u.privyUserId)
          }, 'No test user found for token')
          throw new UnauthorizedError(`No test user found for token: ${token}`)
        }

        const isAdmin = user.role === 'admin'

        request.user = {
          ...user,
          isAdmin
        }

        fastify.log.debug({
          userId: user.id,
          role: user.role,
          isAdmin
        }, 'Test authentication successful')

        return
      }

      // PRODUCTION MODE: NO AUTH (password-protected frontend)
      // Since the frontend is password-protected, everyone who reaches the backend is admin
      const dummyPrivyId = 'password-gate-admin'

      let user = await db.query.users.findFirst({
        where: eq(users.privyUserId, dummyPrivyId)
      })

      if (!user) {
        // Create dummy admin user on first request
        const [newUser] = await db.insert(users).values({
          privyUserId: dummyPrivyId,
          email: 'admin@forge.local',
          displayName: 'Admin',
          role: 'admin',
          lastLoginAt: new Date(),
        }).returning()
        user = newUser
        fastify.log.info('Created password-gate admin user')
      } else {
        // Update last login
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))
      }

      if (!user) {
        throw new UnauthorizedError('Failed to create or find user')
      }

      // Everyone is admin in password-protected mode
      const isAdmin = true

      // Attach user with admin flag to request
      request.user = {
        ...user,
        isAdmin
      }

      fastify.log.debug({
        userId: user.id,
        isAdmin
      }, 'Password-gate authentication successful')

    } catch (error) {
      fastify.log.error({ error }, 'Authentication failed')
      throw new UnauthorizedError('Unauthorized')
    }
  })

  // Optional authentication
  fastify.decorate('optionalAuth', async function(request, _reply) {
    try {
      // TEST MODE: Use mock tokens for testing
      if (env.NODE_ENV === 'test') {
        const authHeader = request.headers.authorization
        if (!authHeader) {
          // Optional auth - no error if missing
          return
        }

        const token = authHeader.replace('Bearer ', '')
        if (!token.startsWith('mock-')) {
          // Invalid format but optional - just skip
          return
        }

        const identifier = token.replace('mock-', '').replace('-token', '')

        // Try to find the user by matching identifier pattern
        const allUsers = await db.query.users.findMany()
        const user = allUsers.find(u => {
          if (!u.privyUserId.includes('-test-')) return false

          // Strategy 1: Full match (mock-systemadmin-token → system-test-admin)
          const parts = u.privyUserId.split('-test-')
          if (parts.length === 2) {
            const category = parts[0].replace(/-/g, '')
            const role = parts[1].replace(/-/g, '')
            const combined = `${category}${role}`
            if (identifier === combined) return true
          }

          // Strategy 2: Simple role match (mock-admin-token → *-test-admin)
          const roleOnly = u.privyUserId.split('-test-')[1]?.replace(/-/g, '')
          if (roleOnly && identifier === roleOnly) return true

          // Strategy 3: Role-based match (mock-teamowner-token → teams-test-owner)
          if (parts.length === 2) {
            const category = parts[0]
            const role = parts[1].replace(/-/g, '')

            if (identifier.endsWith(role)) {
              const categoryFromIdentifier = identifier.replace(role, '')
              const categoryNormalized = category.replace(/-/g, '')

              if (categoryFromIdentifier === categoryNormalized) return true
              if (categoryFromIdentifier + 's' === categoryNormalized) return true
              if (categoryFromIdentifier === categoryNormalized + 's') return true
              if (categoryNormalized.startsWith(categoryFromIdentifier)) return true
              if (categoryFromIdentifier.startsWith(categoryNormalized)) return true
            }
          }

          // Strategy 4: Flexible substring match
          const normalized = u.privyUserId.replace('-test-', '').replace(/-/g, '')
          const identifierNorm = identifier.replace(/-/g, '')

          if (normalized.includes(identifierNorm) || identifierNorm.includes(normalized)) return true
          if (normalized.endsWith(identifierNorm)) return true

          return false
        })

        if (user) {
          const isAdmin = user.role === 'admin'
          request.user = {
            ...user,
            isAdmin
          }

          fastify.log.debug({
            userId: user.id,
            role: user.role,
            isAdmin
          }, 'Optional test authentication successful')
        }

        return
      }

      // PRODUCTION MODE: In password-gate mode, treat optional auth the same as required auth
      const dummyPrivyId = 'password-gate-admin'

      let user = await db.query.users.findFirst({
        where: eq(users.privyUserId, dummyPrivyId)
      })

      if (!user) {
        // Create dummy admin user on first request
        const [newUser] = await db.insert(users).values({
          privyUserId: dummyPrivyId,
          email: 'admin@forge.local',
          displayName: 'Admin',
          role: 'admin',
          lastLoginAt: new Date(),
        }).returning()
        user = newUser
        fastify.log.info('Created password-gate admin user (via optionalAuth)')
      } else {
        // Update last login
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))
      }

      if (user) {
        request.user = {
          ...user,
          isAdmin: true
        }
      }
    } catch (error) {
      // Silent fail for optional auth
      fastify.log.debug({ error }, 'Optional authentication failed')
    }
  })
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: []
})
