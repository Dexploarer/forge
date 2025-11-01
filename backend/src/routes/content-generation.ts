/**
 * Content Generation API Routes
 * AI-powered content generation for NPCs, quests, dialogue, and lore
 *
 * Integrated with embeddings for memory-augmented generation
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateText } from 'ai'
import { AISDKService } from '../services/ai-sdk.service'
import { EmbeddingsService } from '../services/embeddings.service'
import { errorResponse } from '../helpers/responses'

// ============================================================================
// Schemas
// ============================================================================

const GenerateDialogueSchema = z.object({
  npcName: z.string().min(1),
  npcPersonality: z.string().min(1),
  context: z.string().optional(),
  existingNodes: z.array(z.any()).default([]),
  model: z.string().optional(),
  projectId: z.string().min(1)
})

const GenerateNPCSchema = z.object({
  archetype: z.string().min(1),
  prompt: z.string().min(1),
  context: z.string().optional(),
  model: z.string().optional(),
  projectId: z.string().min(1)
})

const GenerateQuestSchema = z.object({
  questType: z.string().min(1),
  difficulty: z.string().min(1),
  theme: z.string().optional(),
  context: z.string().optional(),
  model: z.string().optional(),
  projectId: z.string().min(1)
})

// ============================================================================
// Helper Functions - Prompt Building
// ============================================================================

function buildDialoguePrompt(npcName: string, personality: string, context: string, existingNodes: any[]): string {
  return `You are a dialogue writer for an RPG game. Generate dialogue tree nodes for an NPC.

NPC Name: ${npcName}
Personality: ${personality}
${context ? `Context: ${context}` : ''}
${existingNodes.length > 0 ? `Existing Nodes: ${JSON.stringify(existingNodes, null, 2)}` : ''}

Generate 3-5 dialogue nodes in JSON format:
[
  {
    "id": "unique_id",
    "text": "dialogue text",
    "responses": [
      {"text": "player response", "nextNodeId": "next_node_id"}
    ]
  }
]

Return ONLY the JSON array, no explanation.`
}

function buildNPCPrompt(archetype: string, userPrompt: string, context?: string): string {
  return `You are an NPC character designer for an RPG game. Generate a complete NPC character.

Archetype: ${archetype}
Requirements: ${userPrompt}
${context ? `Context: ${context}` : ''}

Generate a complete NPC in JSON format:
{
  "name": "NPC Name",
  "archetype": "${archetype}",
  "personality": {
    "traits": ["trait1", "trait2", "trait3"],
    "background": "background story",
    "motivations": ["motivation1", "motivation2"]
  },
  "appearance": {
    "description": "physical description",
    "equipment": ["item1", "item2"]
  },
  "dialogue": {
    "greeting": "greeting text",
    "farewell": "farewell text",
    "idle": ["idle line 1", "idle line 2"]
  },
  "behavior": {
    "role": "their role in the world",
    "schedule": "daily routine",
    "relationships": []
  }
}

Return ONLY the JSON object, no explanation.`
}

function buildQuestPrompt(questType: string, difficulty: string, theme?: string, context?: string): string {
  return `You are a quest designer for an RPG game. Generate a complete quest.

Quest Type: ${questType}
Difficulty: ${difficulty}
${theme ? `Theme: ${theme}` : ''}
${context ? `Context: ${context}` : ''}

Generate a quest in JSON format:
{
  "title": "Quest Title",
  "description": "Quest description",
  "objectives": [
    {"description": "objective 1", "type": "kill|collect|talk|explore", "target": "target", "count": 1}
  ],
  "rewards": {
    "experience": 100,
    "gold": 50,
    "items": ["item1"]
  },
  "requirements": {
    "level": 1,
    "previousQuests": []
  },
  "npcs": ["NPC Name"],
  "location": "Location Name",
  "story": "Quest narrative"
}

Return ONLY the JSON object, no explanation.`
}

// ============================================================================
// Helper Functions - Response Parsing
// ============================================================================

function cleanJSONResponse(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

function parseDialogueResponse(text: string): any[] {
  try {
    const cleaned = cleanJSONResponse(text)
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error: any) {
    console.error('[Parse Error] Failed to parse dialogue response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

function parseNPCResponse(text: string): any {
  try {
    const cleaned = cleanJSONResponse(text)
    return JSON.parse(cleaned)
  } catch (error: any) {
    console.error('[Parse Error] Failed to parse NPC response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

function parseQuestResponse(text: string): any {
  try {
    const cleaned = cleanJSONResponse(text)
    return JSON.parse(cleaned)
  } catch (error: any) {
    console.error('[Parse Error] Failed to parse quest response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

// ============================================================================
// Helper Functions - Embedding Context
// ============================================================================

async function buildEmbeddingContext(
  server: any,
  db: any,
  searchQuery: string,
  projectId: string,
  contentType: 'npc' | 'quest' | 'lore',
  options: { limit: number; threshold: number; contextTemplate: string }
): Promise<string> {
  try {
    server.log.info(`[Content Generation] Building context from similar ${contentType}s: "${searchQuery}"`)

    const embeddingsService = new EmbeddingsService()
    const results = await embeddingsService.findSimilar(
      db,
      searchQuery,
      projectId,
      options.threshold,
      options.limit
    )

    const hasContext = results.length > 0

    if (hasContext) {
      server.log.info(`[Content Generation] Found ${results.length} similar ${contentType}s for context`)
      const contextText = results.map(r => `[${r.type}] ${r.content}`).join('\n\n')
      return `\n\n${options.contextTemplate}\n${contextText}\n--- END ${contentType.toUpperCase()}S ---\n\n`
    } else {
      server.log.info(`[Content Generation] No similar ${contentType}s found, generating without context`)
      return ''
    }
  } catch (error: any) {
    server.log.warn(`[Content Generation] Failed to build embedding context (continuing without it):`, error.message)
    return '' // Continue without embeddings - they enhance but aren't required
  }
}

async function autoEmbedContent(
  server: any,
  contentId: string,
  content: any,
  contentType: string
) {
  try {
    const embeddingsService = new EmbeddingsService()
    const textContent = JSON.stringify(content)
    await embeddingsService.embedText(textContent)
    server.log.info(`[Content Generation] Embedded ${contentType}: ${contentId}`)
  } catch (error: any) {
    server.log.warn(`[Content Generation] Failed to embed ${contentType} (continuing):`, error.message)
    // Don't fail the request if embedding fails
  }
}

// ============================================================================
// Routes
// ============================================================================

const contentGenerationRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/content-generation/generate-dialogue
   * Generate NPC dialogue tree nodes
   */
  server.post('/generate-dialogue', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['content-generation'],
      description: 'Generate NPC dialogue tree nodes',
      body: GenerateDialogueSchema
    }
  }, async (request, reply) => {
    try {
      const { npcName, npcPersonality, context, existingNodes, model: customModel, projectId } = GenerateDialogueSchema.parse(request.body)

      // Create AI service with user's API key if available
      const aiService = new AISDKService({
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        db: undefined
      })

      // Get configured model for dialogue generation
      const aiModel = await aiService.getConfiguredModel(
        'dialogue-generation',
        customModel || 'gpt-4o-mini',
        'openai'
      )

      // Build context from similar NPCs for dialogue inspiration
      const embeddingContext = await buildEmbeddingContext(
        server,
        server.db,
        `${npcName} ${npcPersonality} dialogue conversation`,
        projectId,
        'npc',
        {
          limit: 2,
          threshold: 0.75,
          contextTemplate: '--- SIMILAR NPC DIALOGUE EXAMPLES ---'
        }
      )

      // Build prompt with embedding context
      const prompt = buildDialoguePrompt(npcName, npcPersonality, context || '', existingNodes) + embeddingContext

      // Generate dialogue with AI
      server.log.info(`[Content Generation] Generating dialogue for NPC: ${npcName}`)
      const result = await generateText({
        model: aiModel,
        prompt,
        temperature: 0.8,
        maxSteps: 2000
      } as any)

      // Parse AI response
      const nodes = parseDialogueResponse(result.text)

      server.log.info(`[Content Generation] Generated ${nodes.length} dialogue nodes`)

      return {
        nodes,
        model: customModel || 'gpt-4o-mini',
        rawResponse: result.text
      }
    } catch (error: any) {
      server.log.error('[Content Generation] Dialogue generation error:', error)
      return reply.status(500).send(errorResponse('Failed to generate dialogue', 'CONTENT_5000', error.message))
    }
  })

  /**
   * POST /api/content-generation/generate-npc
   * Generate complete NPC character
   */
  server.post('/generate-npc', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['content-generation'],
      description: 'Generate complete NPC character',
      body: GenerateNPCSchema
    }
  }, async (request, reply) => {
    try {
      const { archetype, prompt: userPrompt, context, model: customModel, projectId } = GenerateNPCSchema.parse(request.body)

      // Create AI service
      const aiService = new AISDKService({
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        db: undefined
      })

      // Get configured model
      const aiModel = await aiService.getConfiguredModel(
        'npc-generation',
        customModel || 'gpt-4o',
        'openai'
      )

      // Build context from similar NPCs (memory-augmented generation)
      const embeddingContext = await buildEmbeddingContext(
        server,
        server.db,
        userPrompt || `${archetype} NPC character`,
        projectId,
        'npc',
        {
          limit: 3,
          threshold: 0.7,
          contextTemplate: '--- SIMILAR NPCs FOR INSPIRATION ---'
        }
      )

      // Build prompt with embedding context
      const aiPrompt = buildNPCPrompt(archetype, userPrompt, context) + embeddingContext

      // Generate NPC with AI
      server.log.info(`[Content Generation] Generating NPC with archetype: ${archetype}`)
      const result = await generateText({
        model: aiModel,
        prompt: aiPrompt,
        temperature: 0.8,
        maxSteps: 3000
      } as any)

      // Parse AI response
      const npcData = parseNPCResponse(result.text)

      // Add metadata
      const completeNPC = {
        id: `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...npcData,
        metadata: {
          generatedBy: 'AI',
          model: customModel || 'gpt-4o',
          timestamp: new Date().toISOString(),
          archetype
        }
      }

      server.log.info(`[Content Generation] Generated NPC: ${completeNPC.name}`)

      // Auto-embed the generated NPC for future context
      await autoEmbedContent(server, completeNPC.id, completeNPC, 'NPC')

      return {
        npc: completeNPC,
        model: customModel || 'gpt-4o',
        rawResponse: result.text
      }
    } catch (error: any) {
      server.log.error('[Content Generation] NPC generation error:', error)
      return reply.status(500).send(errorResponse('Failed to generate NPC', 'CONTENT_5010', error.message))
    }
  })

  /**
   * POST /api/content-generation/generate-quest
   * Generate game quest
   */
  server.post('/generate-quest', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['content-generation'],
      description: 'Generate game quest',
      body: GenerateQuestSchema
    }
  }, async (request, reply) => {
    try {
      const { questType, difficulty, theme, context, model: customModel, projectId } = GenerateQuestSchema.parse(request.body)

      // Create AI service
      const aiService = new AISDKService({
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        db: undefined
      })

      // Get configured model
      const aiModel = await aiService.getConfiguredModel(
        'quest-generation',
        customModel || 'gpt-4o',
        'openai'
      )

      // Build context from similar quests (memory-augmented generation)
      const embeddingContext = await buildEmbeddingContext(
        server,
        server.db,
        theme || `${difficulty} ${questType} quest`,
        projectId,
        'quest',
        {
          limit: 3,
          threshold: 0.7,
          contextTemplate: '--- SIMILAR QUESTS FOR INSPIRATION ---'
        }
      )

      // Build prompt with embedding context
      const aiPrompt = buildQuestPrompt(questType, difficulty, theme, context) + embeddingContext

      // Generate quest with AI
      server.log.info(`[Content Generation] Generating ${difficulty} ${questType} quest`)
      const result = await generateText({
        model: aiModel,
        prompt: aiPrompt,
        temperature: 0.7,
        maxSteps: 3000
      } as any)

      // Parse AI response
      const questData = parseQuestResponse(result.text)

      // Add metadata
      const completeQuest = {
        id: `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...questData,
        difficulty,
        questType,
        metadata: {
          generatedBy: 'AI',
          model: customModel || 'gpt-4o',
          timestamp: new Date().toISOString()
        }
      }

      server.log.info(`[Content Generation] Generated quest: ${completeQuest.title}`)

      // Auto-embed the generated quest for future context
      await autoEmbedContent(server, completeQuest.id, completeQuest, 'quest')

      return {
        quest: completeQuest,
        model: customModel || 'gpt-4o',
        rawResponse: result.text
      }
    } catch (error: any) {
      server.log.error('[Content Generation] Quest generation error:', error)
      return reply.status(500).send(errorResponse('Failed to generate quest', 'CONTENT_5020', error.message))
    }
  })
}

export default contentGenerationRoutes
