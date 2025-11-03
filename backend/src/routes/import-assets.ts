import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { exec } from 'child_process'

const importAssetsRoutes: FastifyPluginAsync = async (fastify) => {
  // Trigger asset import
  fastify.post('/trigger', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Trigger Hyperscape assets import (requires authentication)',
      tags: ['import'],
      querystring: z.object({
        dryRun: z.enum(['true', 'false']).optional(),
      }),
      response: {
        202: z.object({
          message: z.string(),
          status: z.literal('started'),
        })
      }
    }
  }, async (request, reply) => {
    const { dryRun } = request.query as { dryRun?: string }
    const dryRunFlag = dryRun === 'true' ? '--dry-run' : ''

    fastify.log.info('🚀 Triggering Hyperscape assets import...')

    // Run import script in background
    const scriptPath = '/app/scripts/import-hyperscape-assets.ts'
    const command = `bun ${scriptPath} ${dryRunFlag}`

    // Don't await - run in background
    exec(command, (error, stdout, stderr) => {
      if (error) {
        fastify.log.error({ error, stderr }, 'Import script failed')
      } else {
        fastify.log.info({ stdout }, 'Import script completed')
      }
    })

    reply.code(202).send({
      message: 'Asset import started in background',
      status: 'started',
    })
  })

  // Get import status (placeholder - could be enhanced with actual tracking)
  fastify.get('/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get asset import status',
      tags: ['import'],
      response: {
        200: z.object({
          message: z.string(),
        })
      }
    }
  }, async () => {
    return {
      message: 'Check Railway logs for import status',
    }
  })
}

export default importAssetsRoutes
