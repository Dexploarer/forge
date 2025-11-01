import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql, ilike } from 'drizzle-orm'
import { loreEntries } from '../database/schema'
import { NotFoundError } from '../utils/errors'
import { verifyProjectMembership } from '../helpers/project-access'
import { serializeAllTimestamps } from '../helpers/serialization'
import { buildTimeline, findRelatedContent } from '../helpers/lore-timeline'

const loreRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // LIST LORE ENTRIES
  // =====================================================
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List lore entries (paginated, filterable)',
      tags: ['lore'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid(),
        category: z.string().optional(),
        era: z.string().optional(),
        region: z.string().optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        search: z.string().optional(),
      }),
      response: {
        200: z.object({
          loreEntries: z.array(z.object({
            id: z.string().uuid(),
            title: z.string(),
            summary: z.string().nullable(),
            category: z.string().nullable(),
            era: z.string().nullable(),
            region: z.string().nullable(),
            importanceLevel: z.number(),
            tags: z.array(z.string()),
            status: z.string(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        })
      }
    }
  }, async (request) => {
    const { page, limit, projectId, category, era, region, status, search } = request.query as {
      page: number
      limit: number
      projectId: string
      category?: string
      era?: string
      region?: string
      status?: string
      search?: string
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, projectId, request)

    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = [eq(loreEntries.projectId, projectId)]

    if (category) {
      conditions.push(eq(loreEntries.category, category))
    }
    if (era) {
      conditions.push(eq(loreEntries.era, era))
    }
    if (region) {
      conditions.push(eq(loreEntries.region, region))
    }
    if (status) {
      conditions.push(eq(loreEntries.status, status))
    }
    if (search) {
      conditions.push(
        or(
          ilike(loreEntries.title, `%${search}%`),
          ilike(loreEntries.content, `%${search}%`)
        )!
      )
    }

    const whereClause = and(...conditions)

    const entries = await fastify.db.query.loreEntries.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(loreEntries.createdAt)],
      columns: {
        id: true,
        title: true,
        summary: true,
        category: true,
        era: true,
        region: true,
        importanceLevel: true,
        tags: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(loreEntries)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      loreEntries: entries.map(e => serializeAllTimestamps(e)),
      pagination: { page, limit, total }
    }
  })

  // =====================================================
  // CREATE LORE ENTRY
  // =====================================================
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new lore entry',
      tags: ['lore'],
      body: z.object({
        title: z.string().min(1).max(255),
        content: z.string().min(1).max(50000),
        summary: z.string().optional(),
        projectId: z.string().uuid(),
        category: z.string().max(100).optional(),
        tags: z.array(z.string()).default([]),
        era: z.string().max(255).optional(),
        region: z.string().max(255).optional(),
        timelinePosition: z.number().int().optional(),
        importanceLevel: z.number().int().min(1).max(10).default(5),
        relatedCharacters: z.array(z.string().uuid()).default([]),
        relatedLocations: z.array(z.string().uuid()).default([]),
        relatedEvents: z.array(z.string().uuid()).default([]),
        metadata: z.record(z.string(), z.any()).default({}),
        status: z.enum(['draft', 'published', 'archived']).default('draft'),
      }),
      response: {
        201: z.object({
          loreEntry: z.object({
            id: z.string().uuid(),
            title: z.string(),
            projectId: z.string().uuid(),
            createdAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      title: string
      content: string
      summary?: string
      projectId: string
      category?: string
      tags?: string[]
      era?: string
      region?: string
      timelinePosition?: number
      importanceLevel?: number
      relatedCharacters?: string[]
      relatedLocations?: string[]
      relatedEvents?: string[]
      metadata?: Record<string, any>
      status?: string
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, data.projectId, request)

    const [entry] = await fastify.db.insert(loreEntries).values({
      title: data.title,
      content: data.content,
      summary: data.summary,
      projectId: data.projectId,
      ownerId: request.user!.id,
      category: data.category,
      tags: data.tags || [],
      era: data.era,
      region: data.region,
      timelinePosition: data.timelinePosition,
      importanceLevel: data.importanceLevel ?? 5,
      relatedCharacters: data.relatedCharacters || [],
      relatedLocations: data.relatedLocations || [],
      relatedEvents: data.relatedEvents || [],
      metadata: data.metadata || {},
      status: data.status || 'draft',
    }).returning()

    if (!entry) {
      throw new Error('Failed to create lore entry')
    }

    reply.code(201).send({ loreEntry: serializeAllTimestamps(entry) })
  })

  // =====================================================
  // GET LORE ENTRY DETAILS
  // =====================================================
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get lore entry details',
      tags: ['lore'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          loreEntry: z.object({
            id: z.string().uuid(),
            title: z.string(),
            content: z.string(),
            summary: z.string().nullable(),
            projectId: z.string().uuid(),
            ownerId: z.string().uuid(),
            category: z.string().nullable(),
            tags: z.array(z.string()),
            era: z.string().nullable(),
            region: z.string().nullable(),
            timelinePosition: z.number().nullable(),
            importanceLevel: z.number(),
            relatedCharacters: z.array(z.string()),
            relatedLocations: z.array(z.string()),
            relatedEvents: z.array(z.string()),
            metadata: z.record(z.string(), z.any()),
            status: z.string(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const entry = await fastify.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, id)
    })

    if (!entry) {
      throw new NotFoundError('Lore entry not found')
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, entry.projectId, request)

    return {
      loreEntry: serializeAllTimestamps(entry)
    }
  })

  // =====================================================
  // UPDATE LORE ENTRY
  // =====================================================
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update lore entry',
      tags: ['lore'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).max(50000).optional(),
        summary: z.string().optional(),
        category: z.string().max(100).optional(),
        tags: z.array(z.string()).optional(),
        era: z.string().max(255).optional(),
        region: z.string().max(255).optional(),
        timelinePosition: z.number().int().optional(),
        importanceLevel: z.number().int().min(1).max(10).optional(),
        relatedCharacters: z.array(z.string().uuid()).optional(),
        relatedLocations: z.array(z.string().uuid()).optional(),
        relatedEvents: z.array(z.string().uuid()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
      }),
      response: {
        200: z.object({
          loreEntry: z.object({
            id: z.string().uuid(),
            title: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as Record<string, any>

    const entry = await fastify.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, id)
    })

    if (!entry) {
      throw new NotFoundError('Lore entry not found')
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, entry.projectId, request)

    const [updatedEntry] = await fastify.db
      .update(loreEntries)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(loreEntries.id, id))
      .returning()

    if (!updatedEntry) {
      throw new NotFoundError('Lore entry not found')
    }

    return { loreEntry: serializeAllTimestamps(updatedEntry) }
  })

  // =====================================================
  // DELETE LORE ENTRY
  // =====================================================
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete lore entry',
      tags: ['lore'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const entry = await fastify.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, id)
    })

    if (!entry) {
      throw new NotFoundError('Lore entry not found')
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, entry.projectId, request)

    await fastify.db.delete(loreEntries).where(eq(loreEntries.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // GET TIMELINE VIEW
  // =====================================================
  fastify.get('/timeline', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get timeline view of lore entries',
      tags: ['lore'],
      querystring: z.object({
        projectId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          timeline: z.array(z.object({
            id: z.string().uuid(),
            title: z.string(),
            era: z.string().nullable(),
            timelinePosition: z.number().nullable(),
            importanceLevel: z.number(),
            category: z.string().nullable(),
            summary: z.string().nullable(),
            relatedCharacters: z.array(z.string()),
            relatedLocations: z.array(z.string()),
            relatedEvents: z.array(z.string()),
          }))
        })
      }
    }
  }, async (request) => {
    const { projectId } = request.query as { projectId: string }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, projectId, request)

    const entries = await fastify.db.query.loreEntries.findMany({
      where: eq(loreEntries.projectId, projectId)
    })

    const timeline = buildTimeline(entries)

    return { timeline }
  })

  // =====================================================
  // SEARCH LORE ENTRIES
  // =====================================================
  fastify.get('/search', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Full-text search of lore entries',
      tags: ['lore'],
      querystring: z.object({
        q: z.string().min(1),
        projectId: z.string().uuid(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      response: {
        200: z.object({
          results: z.array(z.object({
            id: z.string().uuid(),
            title: z.string(),
            summary: z.string().nullable(),
            category: z.string().nullable(),
            relevance: z.string().optional(),
          }))
        })
      }
    }
  }, async (request) => {
    const { q, projectId, limit } = request.query as {
      q: string
      projectId: string
      limit: number
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, projectId, request)

    const results = await fastify.db.query.loreEntries.findMany({
      where: and(
        eq(loreEntries.projectId, projectId),
        or(
          ilike(loreEntries.title, `%${q}%`),
          ilike(loreEntries.content, `%${q}%`),
          ilike(loreEntries.summary, `%${q}%`)
        )!
      ),
      limit,
      columns: {
        id: true,
        title: true,
        summary: true,
        category: true,
      }
    })

    return {
      results: results.map(r => ({
        ...r,
        relevance: 'match',
      }))
    }
  })

  // =====================================================
  // GET RELATED CONTENT
  // =====================================================
  fastify.get('/:id/related', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get related content for a lore entry',
      tags: ['lore'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          related: z.object({
            characters: z.array(z.object({
              id: z.string().uuid(),
              title: z.string(),
            })),
            locations: z.array(z.object({
              id: z.string().uuid(),
              title: z.string(),
            })),
            events: z.array(z.object({
              id: z.string().uuid(),
              title: z.string(),
            })),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const entry = await fastify.db.query.loreEntries.findFirst({
      where: eq(loreEntries.id, id)
    })

    if (!entry) {
      throw new NotFoundError('Lore entry not found')
    }

    // Verify user has access to the project
    await verifyProjectMembership(fastify, entry.projectId, request)

    const related = await findRelatedContent(fastify, id, entry.projectId)

    return { related }
  })
}

export default loreRoutes
