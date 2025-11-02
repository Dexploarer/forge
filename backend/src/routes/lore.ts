import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql, ilike } from 'drizzle-orm'
import { loreEntries } from '../database/schema'
import { NotFoundError } from '../utils/errors'
import { verifyProjectMembership } from '../helpers/project-access'
import { serializeAllTimestamps } from '../helpers/serialization'
import { buildTimeline, findRelatedContent } from '../helpers/lore-timeline'
import { AISDKService } from '../services/ai-sdk.service'
import { embeddingsService } from '../services/embeddings.service'
import { getOrCreateDefaultProject } from '../helpers/default-project'

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
        projectId: z.string().uuid().optional(),
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
      projectId?: string
      category?: string
      era?: string
      region?: string
      status?: string
      search?: string
    }

    fastify.log.info({
      userId: request.user!.id,
      page,
      limit,
      projectId,
      category,
      era,
      region,
      status,
      search,
    }, '[Lore API] GET /api/lore - Fetching lore entries')

    // Verify user has access to the project if projectId is provided
    if (projectId) {
      await verifyProjectMembership(fastify, projectId, request)
    }

    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = []

    // Filter by projectId if provided, otherwise filter by ownerId
    if (projectId) {
      conditions.push(eq(loreEntries.projectId, projectId))
    } else {
      conditions.push(eq(loreEntries.ownerId, request.user!.id))
    }

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

    fastify.log.info({
      entriesCount: entries.length,
      total,
      page,
      limit,
    }, '[Lore API] GET /api/lore - Returning lore entries')

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
        projectId: z.string().uuid().optional(),
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
      projectId?: string
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

    fastify.log.info({
      userId: request.user!.id,
      title: data.title.substring(0, 50),
      contentLength: data.content.length,
      category: data.category,
      tagsCount: data.tags?.length || 0,
      hasProjectId: !!data.projectId,
    }, '[Lore API] POST /api/lore - Creating lore entry')

    // Get or create default project if projectId not provided
    const projectId = data.projectId || await getOrCreateDefaultProject(fastify, request.user!.id)

    // Verify user has access to the project
    await verifyProjectMembership(fastify, projectId, request)

    const [entry] = await fastify.db.insert(loreEntries).values({
      title: data.title,
      content: data.content,
      summary: data.summary,
      projectId,
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

    fastify.log.info({
      loreEntryId: entry.id,
      projectId: entry.projectId,
    }, '[Lore API] POST /api/lore - Lore entry created, generating embedding')

    // Auto-generate and store embedding for semantic search
    try {
      const embeddingText = [
        entry.title,
        entry.summary,
        entry.content,
        entry.category,
        entry.era,
        entry.region,
        ...(entry.tags || []),
      ]
        .filter(Boolean)
        .join(' | ')

      if (embeddingText) {
        await embeddingsService.storeEmbedding({
          contentType: 'lore',
          contentId: entry.id,
          text: embeddingText,
          metadata: {
            title: entry.title,
            category: entry.category,
            era: entry.era,
            region: entry.region,
            importanceLevel: entry.importanceLevel,
            projectId: entry.projectId,
          },
        })
        fastify.log.info({
          loreEntryId: entry.id,
          embeddingTextLength: embeddingText.length,
        }, '[Lore API] POST /api/lore - Embedding stored successfully')
      }
    } catch (error) {
      fastify.log.error({ error, loreEntryId: entry.id }, '[Lore API] POST /api/lore - Failed to store lore embedding')
      // Don't fail the request if embedding fails
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

  // =====================================================
  // GENERATE LORE WITH AI
  // =====================================================
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate lore entry using AI (Claude via AI Gateway)',
      tags: ['lore'],
      body: z.object({
        prompt: z.string().min(1),
        projectId: z.string().uuid().optional(),
        category: z.string().max(100).optional(),
        era: z.string().max(255).optional(),
        region: z.string().max(255).optional(),
        useContext: z.boolean().default(true),
        contextLimit: z.number().int().min(1).max(10).default(5),
      }),
      response: {
        201: z.object({
          lore: z.object({
            title: z.string(),
            content: z.string(),
            summary: z.string(),
            category: z.string().nullable(),
            era: z.string().nullable(),
            region: z.string().nullable(),
            importanceLevel: z.number(),
            tags: z.array(z.string()),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { prompt, projectId: providedProjectId, category, era, region, useContext, contextLimit } = request.body as {
      prompt: string
      projectId?: string
      category?: string
      era?: string
      region?: string
      useContext: boolean
      contextLimit: number
    }

    fastify.log.info({
      userId: request.user!.id,
      promptLength: prompt.length,
      category,
      era,
      region,
      useContext,
      contextLimit,
      hasProjectId: !!providedProjectId,
    }, '[Lore API] POST /api/lore/generate - Starting AI lore generation')

    // Use provided projectId or create a temporary context-less generation
    const projectId = providedProjectId || null

    // Only verify project membership if projectId is provided
    if (projectId) {
      await verifyProjectMembership(fastify, projectId, request)
    }

    try {
      const aiService = new AISDKService({ db: fastify.db })

      // Get context if requested and projectId is available
      let contextText = ''
      if (useContext && projectId) {
        fastify.log.info({
          projectId,
          contextLimit,
        }, '[Lore API] POST /api/lore/generate - Fetching similar lore for context')

        const similarContent = await embeddingsService.findSimilarLore(
          fastify.db,
          await aiService.generateEmbedding(prompt),
          projectId,
          0.7,
          contextLimit
        )

        if (similarContent.length > 0) {
          contextText = '\n\nRelevant existing lore for continuity:\n'
          similarContent.forEach((item) => {
            contextText += `\n${item.content.substring(0, 300)}...\n`
          })
          fastify.log.info({
            similarContentCount: similarContent.length,
          }, '[Lore API] POST /api/lore/generate - Found similar content for context')
        } else {
          fastify.log.info('[Lore API] POST /api/lore/generate - No similar content found for context')
        }
      }

      // Build system prompt
      const systemPrompt = `You are a game lore writer creating rich world-building content for an RPG game. Generate detailed lore based on the user's description.

Return a JSON object with the following structure:
{
  "title": "Compelling Title",
  "content": "Detailed lore content (3-5 paragraphs, rich in detail)",
  "summary": "Brief 1-2 sentence summary",
  "category": "${category || 'history'}",
  "era": "${era || 'ancient'}",
  "region": "${region || 'unknown'}",
  "importanceLevel": 7,
  "tags": ["tag1", "tag2", "tag3"]
}

Make the lore engaging, internally consistent${useContext ? ', and compatible with the existing lore provided' : ''}.${contextText}`

      fastify.log.info({
        systemPromptLength: systemPrompt.length,
      }, '[Lore API] POST /api/lore/generate - Calling Claude API')

      // Generate lore with Claude
      const responseText = await aiService.generateWithClaude(
        prompt,
        systemPrompt,
        {
          taskType: 'lore-generation',
          temperature: 0.75,
          maxTokens: 2500,
        }
      )

      fastify.log.info({
        responseLength: responseText.length,
      }, '[Lore API] POST /api/lore/generate - Received Claude response')

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        fastify.log.error({
          responseText: responseText.substring(0, 500),
        }, '[Lore API] POST /api/lore/generate - Failed to parse JSON from response')
        throw new Error('Failed to parse AI response')
      }

      const generatedLore = JSON.parse(jsonMatch[0])

      fastify.log.info({
        hasTitle: !!generatedLore.title,
        hasContent: !!generatedLore.content,
        contentLength: generatedLore.content?.length || 0,
        category: generatedLore.category,
        tagsCount: generatedLore.tags?.length || 0,
      }, '[Lore API] POST /api/lore/generate - Successfully generated lore')

      reply.code(201).send({ lore: generatedLore })
    } catch (error) {
      fastify.log.error({ error, prompt: prompt.substring(0, 100) }, '[Lore API] POST /api/lore/generate - Lore generation failed')
      throw new Error(`Lore generation failed: ${(error as Error).message}`)
    }
  })
}

export default loreRoutes
