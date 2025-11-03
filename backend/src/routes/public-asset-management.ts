/**
 * Public Asset Management - Simple endpoints for managing public assets
 * Allows editing/deleting public assets without strict authentication
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { assets } from '../database/schema'
import { NotFoundError } from '../utils/errors'

export const publicAssetManagementRoute: FastifyPluginAsync = async (server) => {
  // Update public asset (no auth required for public assets)
  server.patch('/public-assets/:id', {
    schema: {
      description: 'Update public asset name/metadata',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          asset: z.object({
            id: z.string().uuid(),
            name: z.string(),
            type: z.string(),
            status: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      description?: string
      metadata?: Record<string, any>
      tags?: string[]
    }

    const asset = await server.db.query.assets.findFirst({
      where: eq(assets.id, id)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    // Only allow editing public assets
    if (asset.visibility !== 'public') {
      throw new NotFoundError('Asset not found')
    }

    const [updatedAsset] = await server.db
      .update(assets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
      .returning()

    return {
      asset: {
        id: updatedAsset!.id,
        name: updatedAsset!.name,
        type: updatedAsset!.type,
        status: updatedAsset!.status,
        updatedAt: updatedAsset!.updatedAt.toISOString(),
      }
    }
  })

  // Delete public asset (no auth required for public assets)
  server.delete('/public-assets/:id', {
    schema: {
      description: 'Delete public asset',
      tags: ['assets'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const asset = await server.db.query.assets.findFirst({
      where: eq(assets.id, id)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    // Only allow deleting public assets
    if (asset.visibility !== 'public') {
      throw new NotFoundError('Asset not found')
    }

    await server.db.delete(assets).where(eq(assets.id, id))

    reply.code(204).send()
  })
}
