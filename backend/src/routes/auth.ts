import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current user info
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get current authenticated user profile',
      summary: 'Get current user',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          user: z.object({
            id: z.string().uuid().describe('Unique user identifier'),
            privyUserId: z.string().describe('Privy user ID'),
            email: z.string().email().nullable().describe('User email address'),
            displayName: z.string().nullable().describe('Display name'),
            avatarUrl: z.string().url().nullable().describe('Avatar URL'),
            walletAddress: z.string().nullable().describe('Wallet address'),
            farcasterFid: z.number().nullable().describe('Farcaster FID'),
            farcasterUsername: z.string().nullable().describe('Farcaster username'),
            role: z.enum(['admin', 'member', 'guest']).describe('User role'),
            createdAt: z.string().datetime().describe('Account creation timestamp'),
            lastLoginAt: z.string().datetime().nullable().describe('Last login timestamp'),
          })
        }).describe('User profile retrieved successfully'),
        401: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Unauthorized - Invalid or missing token')
      }
    }
  }, async (request) => {
    const user = request.user!
    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }
    }
  })

  // Logout (optional - mainly for frontend state)
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Logout current user (clears frontend state)',
      summary: 'Logout user',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          message: z.string().describe('Success message')
        }).describe('Logged out successfully'),
        401: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Unauthorized - Invalid or missing token')
      }
    }
  }, async () => {
    return { message: 'Logged out successfully' }
  })
}

export default authRoutes
