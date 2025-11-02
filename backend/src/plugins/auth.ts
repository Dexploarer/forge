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

  // Authentication preHandler hook - NO AUTH MODE (password-protected frontend)
  // Since the frontend is password-protected, everyone who reaches the backend is admin
  fastify.decorate('authenticate', async function(request, _reply) {
    try {
      // Create or find a dummy admin user for password-protected access
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

  // Optional authentication - same as authenticate in password-gate mode
  fastify.decorate('optionalAuth', async function(request, _reply) {
    try {
      // In password-gate mode, treat optional auth the same as required auth
      const dummyPrivyId = 'password-gate-admin'

      const user = await db.query.users.findFirst({
        where: eq(users.privyUserId, dummyPrivyId)
      })

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
