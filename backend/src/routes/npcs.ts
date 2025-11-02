import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { npcs } from '../database/schema'
import { NotFoundError } from '../utils/errors'
import { verifyProjectMembership } from '../helpers/project-access'
import { serializeAllTimestamps } from '../helpers/serialization'
import { generateNPCStats, generateLootTable, generateBasicDialog } from '../helpers/npc-generator'
import { AISDKService } from '../services/ai-sdk.service'
import { embeddingsService } from '../services/embeddings.service'

const npcRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // LIST NPCS
  // =====================================================
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List NPCs (paginated, filterable)',
      tags: ['npcs'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        projectId: z.string().uuid(),
        race: z.string().optional(),
        class: z.string().optional(),
        faction: z.string().optional(),
        behavior: z.enum(['friendly', 'neutral', 'hostile', 'merchant']).optional(),
        location: z.string().optional(),
        status: z.enum(['draft', 'active', 'archived']).optional(),
      }),
      response: {
        200: z.object({
          npcs: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            title: z.string().nullable(),
            race: z.string().nullable(),
            class: z.string().nullable(),
            level: z.number(),
            faction: z.string().nullable(),
            behavior: z.string(),
            location: z.string().nullable(),
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
    const { page, limit, projectId, race, faction, behavior, location, status } = request.query as {
      page: number
      limit: number
      projectId: string
      race?: string
      class?: string
      faction?: string
      behavior?: string
      location?: string
      status?: string
    }

    await verifyProjectMembership(fastify, projectId, request)

    const offset = (page - 1) * limit
    const conditions = [eq(npcs.projectId, projectId)]

    if (race) conditions.push(eq(npcs.race, race))
    if ((request.query as any).class) conditions.push(eq(npcs.class, (request.query as any).class))
    if (faction) conditions.push(eq(npcs.faction, faction))
    if (behavior) conditions.push(eq(npcs.behavior, behavior))
    if (location) conditions.push(eq(npcs.location, location))
    if (status) conditions.push(eq(npcs.status, status))

    const whereClause = and(...conditions)

    const npcsList = await fastify.db.query.npcs.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(npcs.createdAt)],
      columns: {
        id: true,
        name: true,
        title: true,
        race: true,
        class: true,
        level: true,
        faction: true,
        behavior: true,
        location: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(npcs)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      npcs: npcsList.map(n => serializeAllTimestamps(n)),
      pagination: { page, limit, total }
    }
  })

  // =====================================================
  // CREATE NPC
  // =====================================================
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new NPC',
      tags: ['npcs'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        projectId: z.string().uuid(),
        title: z.string().max(255).optional(),
        race: z.string().max(100).optional(),
        class: z.string().max(100).optional(),
        level: z.number().int().min(1).max(100).default(1),
        faction: z.string().max(100).optional(),
        personality: z.string().optional(),
        backstory: z.string().optional(),
        behavior: z.enum(['friendly', 'neutral', 'hostile', 'merchant']).default('neutral'),
        dialogLines: z.array(z.any()).default([]),
        voiceId: z.string().uuid().optional(),
        voiceSettings: z.record(z.string(), z.any()).default({}),
        appearance: z.record(z.string(), z.any()).default({}),
        modelAssetId: z.string().uuid().optional(),
        portraitUrl: z.string().optional(),
        location: z.string().max(255).optional(),
        spawnPoints: z.array(z.any()).default([]),
        patrolRoute: z.array(z.any()).default([]),
        health: z.number().int().min(0).default(100),
        armor: z.number().int().min(0).default(0),
        damage: z.number().int().min(0).default(10),
        abilities: z.array(z.any()).default([]),
        lootTable: z.array(z.any()).default([]),
        questIds: z.array(z.string().uuid()).default([]),
        sells: z.array(z.any()).default([]),
        teaches: z.array(z.any()).default([]),
        tags: z.array(z.string()).default([]),
        metadata: z.record(z.string(), z.any()).default({}),
        status: z.enum(['draft', 'active', 'archived']).default('draft'),
      }),
      response: {
        201: z.object({
          npc: z.object({
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

    const [npc] = await fastify.db.insert(npcs).values({
      ...data,
      ownerId: request.user!.id,
    }).returning()

    if (!npc) {
      throw new Error('Failed to create NPC')
    }

    reply.code(201).send({ npc: serializeAllTimestamps(npc) })
  })

  // =====================================================
  // GET NPC DETAILS
  // =====================================================
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get NPC details',
      tags: ['npcs'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          npc: z.any(),
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const npc = await fastify.db.query.npcs.findFirst({
      where: eq(npcs.id, id)
    })

    if (!npc) {
      throw new NotFoundError('NPC not found')
    }

    await verifyProjectMembership(fastify, npc.projectId, request)

    return { npc: serializeAllTimestamps(npc) }
  })

  // =====================================================
  // UPDATE NPC
  // =====================================================
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update NPC',
      tags: ['npcs'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.any(),
      response: {
        200: z.object({
          npc: z.object({
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

    const npc = await fastify.db.query.npcs.findFirst({
      where: eq(npcs.id, id)
    })

    if (!npc) {
      throw new NotFoundError('NPC not found')
    }

    await verifyProjectMembership(fastify, npc.projectId, request)

    const [updatedNpc] = await fastify.db
      .update(npcs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(npcs.id, id))
      .returning()

    if (!updatedNpc) {
      throw new NotFoundError('NPC not found')
    }

    return { npc: serializeAllTimestamps(updatedNpc) }
  })

  // =====================================================
  // DELETE NPC
  // =====================================================
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete NPC',
      tags: ['npcs'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const npc = await fastify.db.query.npcs.findFirst({
      where: eq(npcs.id, id)
    })

    if (!npc) {
      throw new NotFoundError('NPC not found')
    }

    await verifyProjectMembership(fastify, npc.projectId, request)

    await fastify.db.delete(npcs).where(eq(npcs.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // GET NPC DIALOG
  // =====================================================
  fastify.get('/:id/dialog', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get NPC dialog tree',
      tags: ['npcs'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          dialog: z.array(z.any())
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const npc = await fastify.db.query.npcs.findFirst({
      where: eq(npcs.id, id),
      columns: {
        id: true,
        projectId: true,
        dialogLines: true,
      }
    })

    if (!npc) {
      throw new NotFoundError('NPC not found')
    }

    await verifyProjectMembership(fastify, npc.projectId, request)

    return { dialog: npc.dialogLines || [] }
  })

  // =====================================================
  // ASSIGN VOICE TO NPC
  // =====================================================
  fastify.post('/:id/voice', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Assign voice to NPC',
      tags: ['npcs'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        voiceId: z.string().uuid(),
        voiceSettings: z.record(z.string(), z.any()).default({}),
      }),
      response: {
        200: z.object({
          npc: z.object({
            id: z.string().uuid(),
            voiceId: z.string().uuid().nullable(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { voiceId, voiceSettings } = request.body as {
      voiceId: string
      voiceSettings: Record<string, any>
    }

    const npc = await fastify.db.query.npcs.findFirst({
      where: eq(npcs.id, id)
    })

    if (!npc) {
      throw new NotFoundError('NPC not found')
    }

    await verifyProjectMembership(fastify, npc.projectId, request)

    const [updatedNpc] = await fastify.db
      .update(npcs)
      .set({
        voiceId,
        voiceSettings,
        updatedAt: new Date(),
      })
      .where(eq(npcs.id, id))
      .returning({
        id: npcs.id,
        voiceId: npcs.voiceId,
      })

    if (!updatedNpc) {
      throw new NotFoundError('NPC not found')
    }

    return { npc: updatedNpc }
  })

  // =====================================================
  // GET NPCS BY LOCATION
  // =====================================================
  fastify.get('/location/:location', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get NPCs by location',
      tags: ['npcs'],
      params: z.object({
        location: z.string()
      }),
      querystring: z.object({
        projectId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          npcs: z.array(z.any())
        })
      }
    }
  }, async (request) => {
    const { location } = request.params as { location: string }
    const { projectId } = request.query as { projectId: string }

    await verifyProjectMembership(fastify, projectId, request)

    const npcsList = await fastify.db.query.npcs.findMany({
      where: and(
        eq(npcs.projectId, projectId),
        eq(npcs.location, location)
      )
    })

    return {
      npcs: npcsList.map(n => serializeAllTimestamps(n))
    }
  })

  // =====================================================
  // GENERATE NPC STATS
  // =====================================================
  fastify.post('/generate-stats', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate NPC stats based on level and class',
      tags: ['npcs'],
      body: z.object({
        level: z.number().int().min(1).max(100),
        class: z.string(),
      }),
      response: {
        200: z.object({
          stats: z.object({
            health: z.number(),
            armor: z.number(),
            damage: z.number(),
            level: z.number(),
          })
        })
      }
    }
  }, async (request) => {
    const { level, class: npcClass } = request.body as {
      level: number
      class: string
    }

    const stats = generateNPCStats(level, npcClass)

    return { stats }
  })

  // =====================================================
  // GENERATE LOOT TABLE
  // =====================================================
  fastify.post('/generate-loot', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate loot table for NPC',
      tags: ['npcs'],
      body: z.object({
        level: z.number().int().min(1).max(100),
        rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
      }),
      response: {
        200: z.object({
          lootTable: z.object({
            items: z.array(z.any())
          })
        })
      }
    }
  }, async (request) => {
    const { level, rarity } = request.body as {
      level: number
      rarity: string
    }

    const lootTable = generateLootTable(level, rarity)

    return { lootTable }
  })

  // =====================================================
  // GENERATE BASIC DIALOG
  // =====================================================
  fastify.post('/generate-dialog', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate basic dialog for NPC',
      tags: ['npcs'],
      body: z.object({
        name: z.string(),
        behavior: z.enum(['friendly', 'neutral', 'hostile', 'merchant']),
      }),
      response: {
        200: z.object({
          dialog: z.array(z.any())
        })
      }
    }
  }, async (request) => {
    const { name, behavior } = request.body as {
      name: string
      behavior: string
    }

    const dialog = generateBasicDialog(name, behavior)

    return { dialog }
  })

  // =====================================================
  // GENERATE NPC WITH AI
  // =====================================================
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate complete NPC using AI (Claude via AI Gateway)',
      tags: ['npcs'],
      body: z.object({
        prompt: z.string().min(1),
        projectId: z.string().uuid().optional(),
        useContext: z.boolean().default(true),
        contextLimit: z.number().int().min(1).max(10).default(5),
      }),
      response: {
        201: z.object({
          npc: z.object({
            name: z.string(),
            description: z.string().nullable(),
            personality: z.string().nullable(),
            backstory: z.string().nullable(),
            race: z.string().nullable(),
            class: z.string().nullable(),
            level: z.number(),
            behavior: z.string(),
            dialogLines: z.array(z.any()),
            appearance: z.record(z.string(), z.any()),
            health: z.number(),
            armor: z.number(),
            damage: z.number(),
            abilities: z.array(z.any()),
            lootTable: z.array(z.any()),
            tags: z.array(z.string()),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { prompt, projectId: providedProjectId, useContext, contextLimit } = request.body as {
      prompt: string
      projectId?: string
      useContext: boolean
      contextLimit: number
    }

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
        const similarContent = await embeddingsService.findSimilar(
          fastify.db,
          prompt,
          projectId,
          0.7,
          contextLimit
        )

        if (similarContent.length > 0) {
          contextText = '\n\nRelevant context from existing game content:\n'
          similarContent.forEach((item) => {
            contextText += `\n[${item.type.toUpperCase()}] ${item.content.substring(0, 200)}...\n`
          })
        }
      }

      // Build system prompt
      const systemPrompt = `You are a game design AI that creates detailed NPC characters for RPG games. Generate a complete NPC based on the user's description.

Return a JSON object with the following structure:
{
  "name": "NPC Name",
  "description": "Brief description (1-2 sentences)",
  "personality": "Detailed personality traits and demeanor",
  "backstory": "Character background and history",
  "race": "Character race/species",
  "class": "Character class/profession",
  "level": 10,
  "behavior": "friendly" | "neutral" | "hostile" | "merchant",
  "dialogLines": [
    {"id": "greeting", "text": "Hello traveler!", "condition": null},
    {"id": "farewell", "text": "Safe travels!", "condition": null}
  ],
  "appearance": {
    "physicalTraits": "Description of physical appearance",
    "clothing": "Description of clothing and equipment"
  },
  "health": 100,
  "armor": 50,
  "damage": 20,
  "abilities": [
    {"name": "Ability Name", "description": "What it does", "cooldown": 10}
  ],
  "lootTable": [
    {"itemName": "Item", "dropChance": 0.5, "quantity": [1, 3]}
  ],
  "tags": ["tag1", "tag2"]
}

Make the NPC interesting, balanced, and appropriate for an RPG game.${contextText}`

      // Generate NPC with Claude
      const responseText = await aiService.generateWithClaude(
        prompt,
        systemPrompt,
        {
          taskType: 'npc-generation',
          temperature: 0.8,
          maxTokens: 2000,
        }
      )

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response')
      }

      const generatedNpc = JSON.parse(jsonMatch[0])

      reply.code(201).send({ npc: generatedNpc })
    } catch (error) {
      fastify.log.error({ error, prompt }, 'NPC generation failed')
      throw new Error(`NPC generation failed: ${(error as Error).message}`)
    }
  })
}

export default npcRoutes
