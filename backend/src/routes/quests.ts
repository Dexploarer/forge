import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm'
import { quests } from '../database/schema'
import { NotFoundError } from '../utils/errors'
import { verifyProjectMembership } from '../helpers/project-access'
import { serializeAllTimestamps } from '../helpers/serialization'
import { getQuestChain } from '../helpers/quest-chain'
import { AISDKService } from '../services/ai-sdk.service'
import { embeddingsService } from '../services/embeddings.service'

const questRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // LIST QUESTS
  // =====================================================
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List quests (paginated, filterable)',
      tags: ['quests'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid(),
        questType: z.enum(['main', 'side', 'daily', 'event']).optional(),
        difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
        minLevel: z.coerce.number().int().optional(),
        maxLevel: z.coerce.number().int().optional(),
        status: z.enum(['draft', 'active', 'archived']).optional(),
      }),
      response: {
        200: z.object({
          quests: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string(),
            questType: z.string(),
            difficulty: z.string(),
            minLevel: z.number(),
            maxLevel: z.number().nullable(),
            status: z.string(),
            repeatable: z.boolean(),
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
    const { page, limit, projectId, questType, difficulty, minLevel, maxLevel, status } = request.query as {
      page: number
      limit: number
      projectId: string
      questType?: string
      difficulty?: string
      minLevel?: number
      maxLevel?: number
      status?: string
    }

    await verifyProjectMembership(fastify, projectId, request)

    const offset = (page - 1) * limit
    const conditions = [eq(quests.projectId, projectId)]

    if (questType) conditions.push(eq(quests.questType, questType))
    if (difficulty) conditions.push(eq(quests.difficulty, difficulty))
    if (minLevel) conditions.push(gte(quests.minLevel, minLevel))
    if (maxLevel) conditions.push(lte(quests.maxLevel, maxLevel))
    if (status) conditions.push(eq(quests.status, status))

    const whereClause = and(...conditions)

    const questsList = await fastify.db.query.quests.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(quests.createdAt)],
      columns: {
        id: true,
        name: true,
        description: true,
        questType: true,
        difficulty: true,
        minLevel: true,
        maxLevel: true,
        status: true,
        repeatable: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(quests)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      quests: questsList.map(q => serializeAllTimestamps(q)),
      pagination: { page, limit, total }
    }
  })

  // =====================================================
  // CREATE QUEST
  // =====================================================
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new quest',
      tags: ['quests'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().min(1),
        projectId: z.string().uuid(),
        questType: z.enum(['main', 'side', 'daily', 'event']).default('side'),
        difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).default('medium'),
        minLevel: z.number().int().min(1).default(1),
        maxLevel: z.number().int().optional(),
        objectives: z.array(z.object({
          id: z.string(),
          type: z.string(),
          description: z.string(),
          target: z.string().optional(),
          count: z.number().optional(),
          completed: z.boolean().optional(),
        })),
        rewards: z.object({
          experience: z.number().optional(),
          gold: z.number().optional(),
          items: z.array(z.object({
            id: z.string(),
            name: z.string(),
            quantity: z.number(),
          })).optional(),
          reputation: z.record(z.string(), z.number()).optional(),
        }).default({}),
        requirements: z.object({
          level: z.number().optional(),
          previousQuests: z.array(z.string().uuid()).optional(),
          items: z.array(z.string()).optional(),
          reputation: z.record(z.string(), z.number()).optional(),
        }).default({}),
        startDialog: z.string().optional(),
        completeDialog: z.string().optional(),
        failDialog: z.string().optional(),
        questGiverNpcId: z.string().uuid().optional(),
        location: z.string().max(255).optional(),
        relatedNpcs: z.array(z.string().uuid()).default([]),
        estimatedDuration: z.number().int().optional(),
        repeatable: z.boolean().default(false),
        cooldownHours: z.number().int().min(0).default(0),
        tags: z.array(z.string()).default([]),
        metadata: z.record(z.string(), z.any()).default({}),
        status: z.enum(['draft', 'active', 'archived']).default('draft'),
      }),
      response: {
        201: z.object({
          quest: z.object({
            id: z.string().uuid(),
            name: z.string(),
            createdAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as any

    await verifyProjectMembership(fastify, data.projectId, request)

    const [quest] = await fastify.db.insert(quests).values({
      ...data,
      ownerId: request.user!.id,
    }).returning()

    if (!quest) {
      throw new Error('Failed to create quest')
    }

    reply.code(201).send({ quest: serializeAllTimestamps(quest) })
  })

  // =====================================================
  // GET QUEST DETAILS
  // =====================================================
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get quest details',
      tags: ['quests'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          quest: z.any(),
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const quest = await fastify.db.query.quests.findFirst({
      where: eq(quests.id, id)
    })

    if (!quest) {
      throw new NotFoundError('Quest not found')
    }

    await verifyProjectMembership(fastify, quest.projectId, request)

    return { quest: serializeAllTimestamps(quest) }
  })

  // =====================================================
  // UPDATE QUEST
  // =====================================================
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update quest',
      tags: ['quests'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.any(),
      response: {
        200: z.object({
          quest: z.object({
            id: z.string().uuid(),
            name: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as Record<string, any>

    const quest = await fastify.db.query.quests.findFirst({
      where: eq(quests.id, id)
    })

    if (!quest) {
      throw new NotFoundError('Quest not found')
    }

    await verifyProjectMembership(fastify, quest.projectId, request)

    const [updatedQuest] = await fastify.db
      .update(quests)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(quests.id, id))
      .returning()

    if (!updatedQuest) {
      throw new NotFoundError('Quest not found')
    }

    return { quest: serializeAllTimestamps(updatedQuest) }
  })

  // =====================================================
  // DELETE QUEST
  // =====================================================
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete quest',
      tags: ['quests'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const quest = await fastify.db.query.quests.findFirst({
      where: eq(quests.id, id)
    })

    if (!quest) {
      throw new NotFoundError('Quest not found')
    }

    await verifyProjectMembership(fastify, quest.projectId, request)

    await fastify.db.delete(quests).where(eq(quests.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // GET QUEST CHAIN
  // =====================================================
  fastify.get('/:id/chain', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get quest chain',
      tags: ['quests'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          chain: z.array(z.any())
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const quest = await fastify.db.query.quests.findFirst({
      where: eq(quests.id, id)
    })

    if (!quest) {
      throw new NotFoundError('Quest not found')
    }

    await verifyProjectMembership(fastify, quest.projectId, request)

    const chain = await getQuestChain(fastify, id, quest.projectId)

    return { chain }
  })

  // =====================================================
  // DUPLICATE QUEST
  // =====================================================
  fastify.post('/:id/duplicate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Duplicate quest',
      tags: ['quests'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        201: z.object({
          quest: z.object({
            id: z.string().uuid(),
            name: z.string(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const original = await fastify.db.query.quests.findFirst({
      where: eq(quests.id, id)
    })

    if (!original) {
      throw new NotFoundError('Quest not found')
    }

    await verifyProjectMembership(fastify, original.projectId, request)

    const [duplicate] = await fastify.db.insert(quests).values({
      ...original,
      id: undefined,
      name: `${original.name} (Copy)`,
      ownerId: request.user!.id,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any).returning()

    if (!duplicate) {
      throw new Error('Failed to duplicate quest')
    }

    reply.code(201).send({ quest: serializeAllTimestamps(duplicate) })
  })

  // =====================================================
  // GENERATE QUEST WITH AI
  // =====================================================
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate quest using AI (Claude via AI Gateway)',
      tags: ['quests'],
      body: z.object({
        prompt: z.string().min(1),
        projectId: z.string().uuid().optional(),
        questType: z.enum(['main', 'side', 'daily', 'event']).default('side'),
        difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).default('medium'),
        useContext: z.boolean().default(true),
        contextLimit: z.number().int().min(1).max(10).default(5),
      }),
      response: {
        201: z.object({
          quest: z.object({
            name: z.string(),
            description: z.string(),
            questType: z.string(),
            difficulty: z.string(),
            minLevel: z.number(),
            objectives: z.array(z.any()),
            rewards: z.any(),
            requirements: z.any(),
            startDialog: z.string().nullable(),
            completeDialog: z.string().nullable(),
            location: z.string().nullable(),
            relatedNpcs: z.array(z.string()),
            estimatedDuration: z.number().nullable(),
            repeatable: z.boolean(),
            tags: z.array(z.string()),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { prompt, projectId: providedProjectId, questType, difficulty, useContext, contextLimit } = request.body as {
      prompt: string
      projectId?: string
      questType: string
      difficulty: string
      useContext: boolean
      contextLimit: number
    }

    // Use provided projectId or allow context-less generation
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
        const [similarNPCs, similarLore] = await Promise.all([
          embeddingsService.findSimilarNPCs(
            fastify.db,
            await aiService.generateEmbedding(prompt),
            projectId,
            0.7,
            contextLimit
          ),
          embeddingsService.findSimilarLore(
            fastify.db,
            await aiService.generateEmbedding(prompt),
            projectId,
            0.7,
            contextLimit
          )
        ])

        if (similarNPCs.length > 0 || similarLore.length > 0) {
          contextText = '\n\nRelevant NPCs and lore for quest integration:\n'
          similarNPCs.forEach((npc) => {
            contextText += `\n[NPC] ${npc.content.substring(0, 150)}...\n`
          })
          similarLore.forEach((lore) => {
            contextText += `\n[LORE] ${lore.content.substring(0, 150)}...\n`
          })
        }
      }

      // Build system prompt
      const systemPrompt = `You are a game quest designer creating engaging quests for an RPG game. Generate a complete quest based on the user's description.

Return a JSON object with the following structure:
{
  "name": "Quest Title",
  "description": "Quest description explaining the story and goals",
  "questType": "${questType}",
  "difficulty": "${difficulty}",
  "minLevel": 10,
  "objectives": [
    {"id": "obj1", "type": "kill", "description": "Defeat 5 bandits", "target": "bandit", "count": 5, "completed": false}
  ],
  "rewards": {
    "experience": 1000,
    "gold": 500,
    "items": [{"id": "sword1", "name": "Steel Sword", "quantity": 1}],
    "reputation": {"faction1": 10}
  },
  "requirements": {
    "level": 5,
    "previousQuests": [],
    "items": []
  },
  "startDialog": "Quest introduction dialogue",
  "completeDialog": "Quest completion dialogue",
  "location": "Quest location",
  "relatedNpcs": [],
  "estimatedDuration": 30,
  "repeatable": false,
  "tags": ["tag1", "tag2"]
}

Make the quest engaging, balanced, and appropriate for the difficulty level${useContext ? '. Integrate with provided NPCs and lore when relevant' : ''}.${contextText}`

      // Generate quest with Claude
      const responseText = await aiService.generateWithClaude(
        prompt,
        systemPrompt,
        {
          taskType: 'quest-generation',
          temperature: 0.8,
          maxTokens: 2000,
        }
      )

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response')
      }

      const generatedQuest = JSON.parse(jsonMatch[0])

      reply.code(201).send({ quest: generatedQuest })
    } catch (error) {
      fastify.log.error({ error, prompt }, 'Quest generation failed')
      throw new Error(`Quest generation failed: ${(error as Error).message}`)
    }
  })
}

export default questRoutes
