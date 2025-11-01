import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { gameManifests, manifestBuilds } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { verifyProjectMembership } from '../helpers/project-access'
import { serializeAllTimestamps } from '../helpers/serialization'
import {
  buildManifest,
  validateManifest,
  generateManifestHash,
} from '../helpers/manifest-builder'

const manifestRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // LIST MANIFESTS
  // =====================================================
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List game manifests',
      tags: ['manifests'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid().optional(),
        status: z.enum(['draft', 'building', 'published', 'archived']).optional(),
      }),
      response: {
        200: z.object({
          manifests: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            version: z.string(),
            projectId: z.string().uuid(),
            status: z.string(),
            assetCount: z.number(),
            buildNumber: z.number(),
            publishedAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
            project: z.object({
              id: z.string().uuid(),
              name: z.string(),
            }),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { page, limit, projectId, status } = request.query as {
      page: number
      limit: number
      projectId?: string
      status?: string
    }
    const offset = (page - 1) * limit

    const conditions = [eq(gameManifests.ownerId, request.user!.id)]

    if (projectId) {
      conditions.push(eq(gameManifests.projectId, projectId))
    }

    if (status) {
      conditions.push(eq(gameManifests.status, status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const manifestsList = await fastify.db.query.gameManifests.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(gameManifests.createdAt)],
      with: {
        project: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(gameManifests)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      manifests: manifestsList.map(m => ({
        ...serializeAllTimestamps(m),
        project: m.project,
      })),
      pagination: { page, limit, total },
    }
  })

  // =====================================================
  // CREATE MANIFEST
  // =====================================================
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new game manifest',
      tags: ['manifests'],
      body: z.object({
        name: z.string().min(1).max(255),
        version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version (e.g., 1.0.0)'),
        description: z.string().optional(),
        projectId: z.string().uuid(),
        tags: z.array(z.string()).default([]),
      }),
      response: {
        201: z.object({
          manifest: z.object({
            id: z.string().uuid(),
            name: z.string(),
            version: z.string(),
            projectId: z.string().uuid(),
            status: z.string(),
            createdAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      version: string
      description?: string
      projectId: string
      tags?: string[]
    }

    // Verify project membership
    await verifyProjectMembership(fastify, data.projectId, request)

    // Check for duplicate version
    const existing = await fastify.db.query.gameManifests.findFirst({
      where: and(
        eq(gameManifests.projectId, data.projectId),
        eq(gameManifests.version, data.version)
      ),
    })

    if (existing) {
      throw new ValidationError(`Manifest version ${data.version} already exists for this project`)
    }

    const [manifest] = await fastify.db.insert(gameManifests).values({
      name: data.name,
      version: data.version,
      description: data.description,
      projectId: data.projectId,
      ownerId: request.user!.id,
      manifestData: {}, // Will be populated during build
      tags: data.tags || [],
      status: 'draft',
    }).returning()

    if (!manifest) {
      throw new Error('Failed to create manifest')
    }

    reply.code(201).send({ manifest: serializeAllTimestamps(manifest) })
  })

  // =====================================================
  // GET MANIFEST DETAILS
  // =====================================================
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get manifest details',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          manifest: z.object({
            id: z.string().uuid(),
            name: z.string(),
            version: z.string(),
            description: z.string().nullable(),
            projectId: z.string().uuid(),
            ownerId: z.string().uuid(),
            manifestData: z.record(z.string(), z.any()),
            manifestUrl: z.string().nullable(),
            manifestHash: z.string().nullable(),
            assetCount: z.number(),
            questCount: z.number(),
            npcCount: z.number(),
            loreCount: z.number(),
            musicCount: z.number(),
            sfxCount: z.number(),
            buildNumber: z.number(),
            tags: z.array(z.string()),
            status: z.string(),
            publishedAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            project: z.object({
              id: z.string().uuid(),
              name: z.string(),
            }),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
      with: {
        project: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    // Verify access
    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    return {
      manifest: {
        ...serializeAllTimestamps(manifest),
        project: manifest.project,
      },
    }
  })

  // =====================================================
  // UPDATE MANIFEST
  // =====================================================
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update manifest (owner only)',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          manifest: z.object({
            id: z.string().uuid(),
            name: z.string(),
            updatedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      description?: string
      tags?: string[]
    }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner can update this manifest')
    }

    const [updated] = await fastify.db
      .update(gameManifests)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(gameManifests.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundError('Manifest not found')
    }

    return { manifest: serializeAllTimestamps(updated) }
  })

  // =====================================================
  // DELETE MANIFEST
  // =====================================================
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete manifest (owner only)',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        204: z.null(),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner can delete this manifest')
    }

    await fastify.db.delete(gameManifests).where(eq(gameManifests.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // BUILD MANIFEST
  // =====================================================
  fastify.post('/:id/build', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Build manifest from project data',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          build: z.object({
            id: z.string().uuid(),
            manifestId: z.string().uuid(),
            buildNumber: z.number(),
            status: z.string(),
            startedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner can build this manifest')
    }

    // Create build record
    const [build] = await fastify.db.insert(manifestBuilds).values({
      manifestId: id,
      buildNumber: manifest.buildNumber,
      status: 'building',
    }).returning()

    if (!build) {
      throw new Error('Failed to create build')
    }

    // Start async build process
    setImmediate(async () => {
      try {
        // Build manifest data
        const manifestData = await buildManifest(
          fastify.db,
          manifest.projectId,
          manifest.version,
          manifest.buildNumber
        )

        // Validate manifest
        const validation = validateManifest(manifestData)
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
        }

        // Generate hash
        const hash = generateManifestHash(manifestData)

        // Count content
        const counts = {
          assetCount: manifestData.assets.length,
          questCount: manifestData.quests.length,
          npcCount: manifestData.npcs.length,
          loreCount: manifestData.lore.length,
          musicCount: manifestData.music.length,
          sfxCount: manifestData.soundEffects.length,
        }

        // Update manifest
        await fastify.db
          .update(gameManifests)
          .set({
            manifestData: manifestData as unknown as Record<string, unknown>,
            manifestHash: hash,
            ...counts,
            status: 'published',
            updatedAt: new Date(),
          })
          .where(eq(gameManifests.id, id))

        // Update build status
        await fastify.db
          .update(manifestBuilds)
          .set({
            status: 'completed',
            completedAt: new Date(),
            buildLog: `Successfully built manifest with ${counts.assetCount} assets`,
          })
          .where(eq(manifestBuilds.id, build.id))
      } catch (error) {
        // Update build with error
        await fastify.db
          .update(manifestBuilds)
          .set({
            status: 'failed',
            completedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(manifestBuilds.id, build.id))

        // Update manifest status
        await fastify.db
          .update(gameManifests)
          .set({
            status: 'draft',
            updatedAt: new Date(),
          })
          .where(eq(gameManifests.id, id))
      }
    })

    return { build: serializeAllTimestamps(build) }
  })

  // =====================================================
  // DOWNLOAD MANIFEST JSON
  // =====================================================
  fastify.get('/:id/download', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Download manifest as JSON',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    if (!manifest.manifestData || Object.keys(manifest.manifestData).length === 0) {
      throw new ValidationError('Manifest has not been built yet')
    }

    const filename = `${manifest.name.replace(/\s+/g, '-')}-v${manifest.version}.json`

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(manifest.manifestData)
  })

  // =====================================================
  // PUBLISH MANIFEST
  // =====================================================
  fastify.post('/:id/publish', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Publish manifest',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          manifest: z.object({
            id: z.string().uuid(),
            status: z.string(),
            publishedAt: z.string().datetime(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Only the owner can publish this manifest')
    }

    if (!manifest.manifestData || Object.keys(manifest.manifestData).length === 0) {
      throw new ValidationError('Manifest must be built before publishing')
    }

    const [updated] = await fastify.db
      .update(gameManifests)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gameManifests.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundError('Manifest not found')
    }

    return { manifest: serializeAllTimestamps(updated) }
  })

  // =====================================================
  // LIST BUILDS
  // =====================================================
  fastify.get('/:id/builds', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List builds for a manifest',
      tags: ['manifests'],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          builds: z.array(z.object({
            id: z.string().uuid(),
            buildNumber: z.number(),
            status: z.string(),
            buildLog: z.string().nullable(),
            error: z.string().nullable(),
            startedAt: z.string().datetime(),
            completedAt: z.string().datetime().nullable(),
          })),
        }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }

    const manifest = await fastify.db.query.gameManifests.findFirst({
      where: eq(gameManifests.id, id),
    })

    if (!manifest) {
      throw new NotFoundError('Manifest not found')
    }

    if (manifest.ownerId !== request.user!.id && request.user!.role !== 'admin') {
      throw new ForbiddenError('Access denied')
    }

    const builds = await fastify.db.query.manifestBuilds.findMany({
      where: eq(manifestBuilds.manifestId, id),
      orderBy: [desc(manifestBuilds.startedAt)],
    })

    return {
      builds: builds.map(b => serializeAllTimestamps(b)),
    }
  })
}

export default manifestRoutes
