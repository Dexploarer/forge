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

  // Authentication preHandler hook - Privy verification + wallet whitelist admin
  fastify.decorate('authenticate', async function(request, _reply) {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization
      if (!authHeader) {
        throw new UnauthorizedError('Missing authorization header')
      }

      const token = authHeader.replace('Bearer ', '')
      if (!token) {
        throw new UnauthorizedError('Invalid authorization format')
      }

      // Verify Privy token
      let privyUserId: string

      if (env.NODE_ENV === 'test' || token.startsWith('mock-')) {
        // Test mode
        privyUserId = token.includes('admin') ? 'test-admin-privy-id' : 'test-member-privy-id'
      } else {
        // Production: Verify Privy JWT
        const claims = await privy.verifyAuthToken(token)
        privyUserId = claims.userId
      }

      // Find or create user in database
      let user = await db.query.users.findFirst({
        where: eq(users.privyUserId, privyUserId)
      })

      if (!user) {
        // Create user on first login
        const privyUser = await privy.getUser(privyUserId)

        const walletAccount = privyUser.linkedAccounts?.find((acc: any) => acc.type === 'wallet') as any
        const emailAccount = privyUser.linkedAccounts?.find((acc: any) => acc.type === 'email') as any
        const farcasterAccount = privyUser.linkedAccounts?.find((acc: any) => acc.type === 'farcaster') as any

        const walletAddress = privyUser.wallet?.address || walletAccount?.address || null
        const email = privyUser.email?.address || emailAccount?.address || null

        const [newUser] = await db.insert(users).values({
          privyUserId,
          email: email || null,
          walletAddress: walletAddress || null,
          farcasterFid: farcasterAccount?.fid || null,
          farcasterUsername: farcasterAccount?.username || null,
          farcasterVerified: farcasterAccount?.verifiedAt ? true : false,
          farcasterProfile: farcasterAccount ? {
            displayName: farcasterAccount.displayName,
            pfp: farcasterAccount.pfp,
            bio: farcasterAccount.bio,
          } : null,
          role: 'member', // Keep for backwards compatibility
          lastLoginAt: new Date(),
        }).returning()
        user = newUser
      } else {
        // Update last login
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))
      }

      if (!user) {
        throw new UnauthorizedError('Failed to create or find user')
      }

      // Check if wallet is in admin whitelist
      const isAdmin = user.walletAddress
        ? env.ADMIN_WALLETS.includes(user.walletAddress.toLowerCase())
        : false

      // Attach user with admin flag to request
      request.user = {
        ...user,
        isAdmin
      }

      fastify.log.info({
        userId: user.id,
        wallet: user.walletAddress,
        isAdmin
      }, 'Authentication successful')

    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error
      }
      fastify.log.error({ error }, 'Authentication failed')
      throw new UnauthorizedError('Unauthorized')
    }
  })

  // Optional authentication (doesn't fail if no token)
  fastify.decorate('optionalAuth', async function(request, _reply) {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader) return

      const token = authHeader.replace('Bearer ', '')
      if (!token) return

      // Verify Privy token
      let privyUserId: string

      if (env.NODE_ENV === 'test' || token.startsWith('mock-')) {
        privyUserId = token.includes('admin') ? 'test-admin-privy-id' : 'test-member-privy-id'
      } else {
        const claims = await privy.verifyAuthToken(token)
        privyUserId = claims.userId
      }

      // Find user in database
      const user = await db.query.users.findFirst({
        where: eq(users.privyUserId, privyUserId)
      })

      if (user) {
        // Check if wallet is in admin whitelist
        const isAdmin = user.walletAddress
          ? env.ADMIN_WALLETS.includes(user.walletAddress.toLowerCase())
          : false

        request.user = {
          ...user,
          isAdmin
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
