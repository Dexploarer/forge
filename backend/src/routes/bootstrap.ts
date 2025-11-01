/**
 * Bootstrap Admin Endpoint
 * ONE-TIME endpoint to create the first admin user
 * Disabled after first admin is created
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { users } from '../database/schema'
import { eq, sql } from 'drizzle-orm'

const BootstrapAdminSchema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().optional(),
  privyUserId: z.string().optional(),
  reason: z.string().optional(),
})

const bootstrapRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/bootstrap/admin
   * Create the FIRST admin user (disabled after any admin exists)
   */
  server.post('/admin', {
    schema: {
      tags: ['bootstrap'],
      description: 'Bootstrap first admin (only works if no admins exist)',
      body: BootstrapAdminSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          admin: z.object({
            id: z.string().uuid(),
            email: z.string(),
            displayName: z.string().nullable(),
            role: z.string(),
          }),
        }),
        403: z.object({
          error: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, displayName, privyUserId, reason } = request.body as {
      email: string
      displayName?: string
      privyUserId?: string
      reason?: string
    }

    try {
      // Check if any admin already exists
      const results = await server.db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, 'admin'))

      const adminCount = results[0]
      if (adminCount && adminCount.total > 0) {
        return reply.code(403).send({
          error: 'Bootstrap endpoint disabled: Admin already exists. Use /api/admin routes instead.',
        })
      }

      // Create first admin user
      const [newAdmin] = await server.db
        .insert(users)
        .values({
          email,
          displayName: displayName || 'Admin',
          privyUserId: privyUserId || `bootstrap-admin-${Date.now()}`,
          role: 'admin',
          lastLoginAt: new Date(),
        })
        .returning()

      if (!newAdmin) {
        throw new Error('Failed to create admin user')
      }

      server.log.info({ email, reason }, 'Bootstrap admin created')

      return {
        success: true,
        message: `First admin ${email} created successfully`,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          displayName: newAdmin.displayName,
          role: newAdmin.role,
        },
      }
    } catch (error: any) {
      server.log.error({ error }, 'Failed to create bootstrap admin')
      return reply.code(403).send({
        error: 'Failed to create admin user',
      })
    }
  })
}

export default bootstrapRoutes
