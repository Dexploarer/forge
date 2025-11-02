import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { earlyAccess } from '../database/schema'

const earlyAccessRoutes: FastifyPluginAsync = async (fastify) => {
  // Submit early access signup
  fastify.post('/', {
    schema: {
      description: 'Sign up for early access',
      summary: 'Early access signup',
      tags: ['early-access'],
      body: z.object({
        email: z.string().email().describe('Email address for early access')
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request) => {
    const { email } = request.body as { email: string }

    try {
      // Store email in database
      await fastify.db.insert(earlyAccess).values({
        email
      })

      fastify.log.info({ email }, 'New early access signup')

      return {
        success: true,
        message: 'Successfully signed up for early access'
      }
    } catch (error) {
      fastify.log.error({ error, email }, 'Failed to save early access signup')

      // Return success anyway - don't let DB errors block the user
      return {
        success: true,
        message: 'Successfully signed up for early access'
      }
    }
  })
}

export default earlyAccessRoutes
