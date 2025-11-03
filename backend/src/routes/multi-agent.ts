/**
 * Multi-Agent API Routes
 * Collaborative AI content generation with multiple agents
 *
 * Features:
 * - Multi-NPC collaborative content generation
 * - AI playtester swarm for content validation
 * - Automated fix generation from playtester feedback
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import {
  MultiAgentOrchestrator,
  type AgentConfig,
} from '../services/multi-agent-orchestrator.service'
import {
  makeNPCCollaborationPrompt,
} from '../utils/collaboration-prompts'
import {
  TESTER_PERSONAS,
} from '../utils/playtester-prompts'

// =====================================================
// NOTE: PlaytesterSwarmOrchestrator
// =====================================================
// The PlaytesterSwarmOrchestrator service needs to be created in
// /Users/home/forge/backend/src/services/playtester-swarm-orchestrator.service.ts
// Reference: /Users/home/hyperscape-4/apps/api-fastify/src/services/playtester-swarm-orchestrator.service.ts
//
// Temporarily commenting out playtester routes until service is migrated

// =====================================================
// TYPES
// =====================================================

type CollaborationType = 'dialogue' | 'quest' | 'lore' | 'relationship' | 'freeform'

// =====================================================
// SCHEMAS
// =====================================================

const NPCPersonaSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  personality: z.string(),
  archetype: z.string().optional(),
  goals: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  background: z.string().optional(),
  relationships: z.record(z.string(), z.any()).optional(),
})

const NPCCollaborationRequestSchema = z.object({
  npcPersonas: z.array(NPCPersonaSchema).min(2),
  collaborationType: z.enum(['dialogue', 'quest', 'lore', 'relationship', 'freeform']),
  context: z.object({
    description: z.string().optional(),
    scenario: z.string().optional(),
    questSeed: z.string().optional(),
    loreTopic: z.string().optional(),
    location: z.string().optional(),
    situation: z.string().optional(),
    quests: z.array(z.any()).optional(),
    relationships: z.array(z.any()).optional(),
    lore: z.array(z.any()).optional(),
  }).optional(),
  rounds: z.number().optional(),
  model: z.string().optional(),
  enableCrossValidation: z.boolean().optional(),
})

const PlaytesterSwarmRequestSchema = z.object({
  contentToTest: z.any(),
  contentType: z.enum(['quest', 'dialogue', 'npc', 'combat', 'puzzle']),
  testerProfiles: z.array(z.union([
    z.string(), // predefined persona name
    z.object({
      id: z.string().optional(),
      name: z.string(),
      archetype: z.string().optional(),
      knowledgeLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
      personality: z.string(),
      expectations: z.array(z.string()).optional(),
    })
  ])).optional(),
  testConfig: z.object({
    parallel: z.boolean().optional(),
    temperature: z.number().optional(),
    autoGenerateFixes: z.boolean().optional(),
  }).optional(),
  model: z.string().optional(),
})

const PlaytesterPersonasResponseSchema = z.object({
  availablePersonas: z.array(z.string()),
  personas: z.record(z.string(), z.object({
    name: z.string(),
    personality: z.string(),
    expectations: z.array(z.string()),
  })),
  defaultSwarm: z.array(z.string()),
  description: z.string(),
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// =====================================================
// MULTI-AGENT ROUTES
// =====================================================

export default async function multiAgentRoutes(server: FastifyInstance) {
  /**
   * POST /api/multi-agent/generate-npc-collaboration
   * Multi-agent NPC collaboration for emergent content
   */
  server.post('/generate-npc-collaboration', {
    schema: {
      tags: ['multi-agent'],
      description: 'Multi-agent NPC collaboration for emergent content',
      body: NPCCollaborationRequestSchema,
      response: {
        200: z.object({
          sessionId: z.string(),
          collaborationType: z.string(),
          npcCount: z.number(),
          rounds: z.number(),
          conversation: z.array(z.any()),
          emergentContent: z.object({
            relationships: z.array(z.any()),
            questIdeas: z.array(z.any()),
            loreFragments: z.array(z.any()),
            dialogueSnippets: z.array(z.any()),
            voiceProfiles: z.array(z.object({
              agentId: z.string(),
              agentName: z.string(),
              recommendation: z.object({
                name: z.string(),
                description: z.string(),
                gender: z.enum(['male', 'female', 'neutral']),
                age: z.enum(['child', 'young', 'adult', 'elderly']),
                accent: z.string().optional(),
                tone: z.string(),
                reasoning: z.string(),
              }),
            })).optional(),
          }),
          validation: z.any().optional(),
          stats: z.any(),
          metadata: z.any(),
        }),
        400: z.object({ error: z.string() }),
        500: z.object({ error: z.string(), details: z.string().optional() }),
      },
    },
  }, async (request, reply) => {
    const {
      npcPersonas,
      collaborationType,
      context,
      rounds,
      model,
      enableCrossValidation
    } = request.body as any

    const startTime = Date.now()
    const sessionId = `collab_${randomBytes(8).toString('hex')}`

    try {
      server.log.info(
        {
          sessionId,
          npcCount: npcPersonas.length,
          collaborationType,
          rounds: rounds || 5,
          model: model || 'default',
          enableCrossValidation: enableCrossValidation !== false,
          npcNames: npcPersonas.map((n: any) => n.name),
        },
        '[MultiAgent] Starting NPC collaboration'
      )

      // Create multi-agent orchestrator
      const orchestrator = new MultiAgentOrchestrator({
        maxRounds: rounds || 5,
        temperature: 0.8,
        enableCrossValidation: enableCrossValidation !== false,
        model: model || '',
        generateVoiceProfiles: true, // Enable voice profile generation
      })

      server.log.info({ sessionId, npcCount: npcPersonas.length }, '[MultiAgent] Registering NPC agents')

      // Register each NPC as an agent
      for (const npc of npcPersonas) {
        const systemPrompt = makeNPCCollaborationPrompt(
          npc.name,
          npc.archetype || npc.personality.split(',')[0]!.trim(),
          {
            topic: collaborationType,
            participants: npcPersonas.map((n: any) => ({
              id: n.id || '',
              name: n.name,
              role: n.archetype || n.personality.split(',')[0]!.trim()
            })),
            goal: context?.scenario || `Engage in ${collaborationType} collaboration`,
            constraints: []
          }
        )

        const agentConfig: AgentConfig = {
          id: npc.id || `npc_${randomBytes(8).toString('hex')}`,
          name: npc.name,
          role: npc.archetype || npc.personality.split(',')[0]!.trim(),
          systemPrompt,
          persona: {
            personality: npc.personality,
            goals: npc.goals || [],
            specialties: npc.specialties || [],
            background: npc.background || '',
            relationships: npc.relationships || {}
          }
        }

        orchestrator.registerAgent(agentConfig)
      }

      // Generate initial collaboration prompt based on type
      const npcNames = npcPersonas.map((n: any) => n.name).join(', ')
      let initialPrompt = ''

      switch (collaborationType as CollaborationType) {
        case 'dialogue':
          initialPrompt = `${npcNames} are meeting for the first time. ${
            context?.scenario || 'They begin a natural conversation based on their personalities and goals.'
          }`
          break
        case 'quest':
          initialPrompt = `${npcNames} are discussing a problem in the world that could become a quest. ${
            context?.questSeed ||
            'They brainstorm objectives, challenges, and rewards that fit their roles and the world setting.'
          }`
          break
        case 'lore':
          initialPrompt = `${npcNames} are gathered to share stories and knowledge about ${
            context?.loreTopic || 'the history and mysteries of their world'
          }. Each contributes what they know from their unique perspective.`
          break
        case 'relationship':
          initialPrompt = `${npcNames} are interacting in ${context?.location || 'a social setting'}. ${
            context?.situation || 'Their relationship develops through authentic conversation and shared experiences.'
          }`
          break
        case 'freeform':
        default:
          initialPrompt = `${npcNames} are ${
            context?.situation || 'interacting in the world'
          }. They respond naturally based on their personalities and goals.`
      }

      // Run multi-agent conversation
      server.log.info({
        sessionId,
        initialPrompt: initialPrompt.substring(0, 100),
        maxRounds: rounds || 5,
      }, '[MultiAgent] Running conversation rounds')
      const result = await orchestrator.runConversationRound(initialPrompt)

      const duration = Date.now() - startTime
      server.log.info(
        {
          sessionId,
          actualRounds: result.rounds.length,
          durationMs: duration,
          hasEmergentContent: Boolean(result.emergentContent),
          emergentContentTypes: Object.keys(result.emergentContent || {}),
        },
        '[MultiAgent] Collaboration completed'
      )

      // Get orchestrator stats
      const stats = orchestrator.getStats()

      server.log.info({
        sessionId,
        stats,
      }, '[MultiAgent] Orchestrator stats collected')

      return {
        sessionId,
        collaborationType,
        npcCount: npcPersonas.length,
        rounds: result.rounds.length,
        conversation: result.rounds,
        emergentContent: result.emergentContent,
        validation: result.validation,
        stats,
        metadata: {
          generatedBy: 'Multi-Agent Collaboration',
          model: model || 'default',
          timestamp: new Date().toISOString(),
          crossValidated: enableCrossValidation !== false,
          duration
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({
        error,
        sessionId,
        durationMs: duration,
        npcCount: npcPersonas.length,
        collaborationType,
        errorMessage: error.message,
        errorStack: error.stack,
      }, '[MultiAgent] Collaboration failed')
      return reply.code(500).send({
        error: 'Failed to generate multi-agent NPC collaboration',
        details: error.message
      })
    }
  })

  /**
   * POST /api/multi-agent/generate-playtester-swarm
   * Generate playtester swarm to test game content
   *
   * NOTE: This endpoint requires PlaytesterSwarmOrchestrator service
   * Temporarily disabled until service is migrated from api-fastify
   */
  server.post('/generate-playtester-swarm', {
    schema: {
      tags: ['multi-agent'],
      description: 'Generate playtester swarm to test game content (DISABLED - service migration pending)',
      body: PlaytesterSwarmRequestSchema,
      response: {
        503: z.object({ error: z.string(), details: z.string() }),
      },
    },
  }, async (_request, reply) => {
    return reply.code(503).send({
      error: 'Service Unavailable',
      details: 'PlaytesterSwarmOrchestrator service needs to be migrated. See /Users/home/hyperscape-4/apps/api-fastify/src/services/playtester-swarm-orchestrator.service.ts'
    })
  })

  /**
   * GET /api/multi-agent/playtester-personas
   * Get predefined playtester personas
   */
  server.get('/playtester-personas', {
    schema: {
      tags: ['multi-agent'],
      description: 'Get predefined playtester personas',
      response: {
        200: PlaytesterPersonasResponseSchema,
      },
    },
  }, async () => {
    const startTime = Date.now()

    server.log.info('[MultiAgent] Fetching playtester personas')

    // Transform TESTER_PERSONAS to match response schema
    const transformedPersonas: Record<string, {
      name: string
      personality: string
      expectations: string[]
    }> = {}

    for (const [key, persona] of Object.entries(TESTER_PERSONAS)) {
      if (!persona.persona) continue
      transformedPersonas[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize the name
        personality: persona.persona.playstyle || '',
        expectations: persona.persona.goals || [],
      }
    }

    const duration = Date.now() - startTime
    server.log.info({
      totalPersonas: Object.keys(TESTER_PERSONAS).length,
      validPersonas: Object.keys(transformedPersonas).length,
      durationMs: duration,
    }, '[MultiAgent] Personas fetched and transformed')

    return {
      availablePersonas: Object.keys(TESTER_PERSONAS),
      personas: transformedPersonas,
      defaultSwarm: ['completionist', 'casual', 'breaker', 'speedrunner', 'explorer'],
      description: 'Predefined AI playtester personas based on common player archetypes'
    }
  })
}
