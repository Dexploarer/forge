import { BaseAgent, type TestScenario, type ScenarioResult } from './base-agent'
import type { FastifyInstance } from 'fastify'
import { users, teams, teamMembers, projects, modelConfigurations, userCredentials, aiServiceCalls, npcs } from '../../src/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ALEX - THE AI POWER USER AGENT
 * Focuses on: AI Gateway, embeddings, content generation, multi-model routing, cost estimation
 * Personality: Tech-savvy, experimental, data-driven, optimization-focused
 */
export class AlexAIPowerUserAgent extends BaseAgent {
  private teamId: string = ''
  private projectId: string = ''

  constructor(server: FastifyInstance) {
    super(server, 'Alex', 'AI Power User', '#E74C3C')
  }

  async initialize(): Promise<void> {
    // Cleanup existing test data
    await this.cleanup()

    // Create test user
    const [user] = await this.server.db.insert(users).values({
      privyUserId: 'alex-ai-power-user',
      email: 'alex@forge-test.com',
      displayName: 'Alex - AI Power User',
      role: 'member',
    }).returning()

    this.userId = user.id

    // Create team
    const [team] = await this.server.db.insert(teams).values({
      name: 'Alex\'s AI Lab',
      description: 'Advanced AI experimentation and optimization',
      ownerId: this.userId,
    }).returning()

    this.teamId = team.id

    // Add to team
    await this.server.db.insert(teamMembers).values({
      teamId: this.teamId,
      userId: this.userId,
      role: 'owner',
      invitedBy: this.userId,
    })

    // Create project
    const [project] = await this.server.db.insert(projects).values({
      name: 'AI-Powered Game Studio',
      description: 'Leveraging cutting-edge AI for game content generation',
      teamId: this.teamId,
      ownerId: this.userId,
    }).returning()

    this.projectId = project.id
  }

  async cleanup(): Promise<void> {
    const existingUsers = await this.server.db.query.users.findMany({
      where: eq(users.privyUserId, 'alex-ai-power-user')
    })

    for (const user of existingUsers) {
      // Delete all related AI data
      await this.server.db.delete(aiServiceCalls).where(eq(aiServiceCalls.userId, user.id))
      await this.server.db.delete(userCredentials).where(eq(userCredentials.userId, user.id))
      await this.server.db.delete(npcs).where(eq(npcs.ownerId, user.id))
      await this.server.db.delete(projects).where(eq(projects.ownerId, user.id))
      await this.server.db.delete(teamMembers).where(eq(teamMembers.userId, user.id))
      await this.server.db.delete(teams).where(eq(teams.ownerId, user.id))
    }

    await this.server.db.delete(users).where(eq(users.privyUserId, 'alex-ai-power-user'))
  }

  getScenarios(): TestScenario[] {
    return [
      // ===== AI GATEWAY - MODEL DISCOVERY =====
      {
        name: 'AI-001: Check AI Gateway status',
        description: 'Verify AI Gateway availability and configuration',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-gateway/status',
          })

          const success = response.statusCode === 200 && typeof response.body.enabled === 'boolean'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-002: List all available AI models',
        description: 'Get comprehensive list of models with pricing',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-gateway/models',
          })

          const success = response.statusCode === 200 &&
                         Array.isArray(response.body.models) &&
                         response.body.models.length > 0

          if (success) {
            agent.storeTestData('availableModels', response.body.models)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
            metadata: { modelCount: response.body.models?.length || 0 },
          }
        },
      },

      {
        name: 'AI-003: Get pricing for GPT-4o model',
        description: 'Retrieve detailed pricing information for specific model',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-gateway/models/openai-gpt-4o/pricing',
          })

          const success = response.statusCode === 200 && response.body.pricing

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-004: List AI providers',
        description: 'Get all available AI service providers',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-gateway/providers',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.providers)

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-005: Check credit balance',
        description: 'Get AI Gateway credit balance and usage',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-gateway/credits',
          })

          const success = response.statusCode === 200 && typeof response.body.balance === 'number'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== COST ESTIMATION =====
      {
        name: 'AI-006: Estimate cost for GPT-4o generation',
        description: 'Calculate estimated cost before making expensive API calls',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-gateway/estimate',
            payload: {
              model: 'openai/gpt-4o',
              inputTokens: 1000,
              outputTokens: 500,
            },
          })

          const success = response.statusCode === 200 && response.body.estimate?.costs?.total

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
            metadata: { estimatedCost: response.body.estimate?.costs?.total },
          }
        },
      },

      {
        name: 'AI-007: Compare costs across models',
        description: 'Estimate costs for same task across different models',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          let apiCalls = 0

          // Estimate GPT-4o
          const gpt4Response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-gateway/estimate',
            payload: {
              model: 'openai/gpt-4o',
              inputTokens: 2000,
              outputTokens: 1000,
            },
          })
          apiCalls++

          // Estimate Claude Sonnet
          const claudeResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-gateway/estimate',
            payload: {
              model: 'anthropic/claude-sonnet-4',
              inputTokens: 2000,
              outputTokens: 1000,
            },
          })
          apiCalls++

          const success = gpt4Response.statusCode === 200 && claudeResponse.statusCode === 200

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
            metadata: {
              gpt4Cost: gpt4Response.body.estimate?.costs?.total,
              claudeCost: claudeResponse.body.estimate?.costs?.total,
            },
          }
        },
      },

      // ===== AI CHAT COMPLETIONS =====
      {
        name: 'AI-008: Chat completion with GPT-4',
        description: 'Generate chat response using GPT-4 Turbo',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful game design assistant.',
                },
                {
                  role: 'user',
                  content: 'Generate a brief description for a fantasy RPG boss character.',
                },
              ],
              model: 'gpt-4-turbo',
              temperature: 0.7,
              maxTokens: 200,
            },
          })

          const success = response.statusCode === 200 && response.body.response?.content

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
            metadata: {
              responseLength: response.body.response?.content?.length || 0,
              tokensUsed: response.body.response?.usage?.totalTokens || 0,
            },
          }
        },
      },

      {
        name: 'AI-009: Multi-turn conversation',
        description: 'Conduct multi-turn chat with context',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'system', content: 'You are a game lore expert.' },
                { role: 'user', content: 'Tell me about ancient dragons.' },
                { role: 'assistant', content: 'Ancient dragons are powerful, wise creatures that have lived for millennia.' },
                { role: 'user', content: 'What are their weaknesses?' },
              ],
              model: 'gpt-3.5-turbo',
              temperature: 0.8,
              maxTokens: 150,
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 40 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-010: Temperature variation experiment',
        description: 'Test different temperature settings for creativity',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          let apiCalls = 0

          // Low temperature (deterministic)
          const lowTempResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'user', content: 'Generate a fantasy character name.' },
              ],
              model: 'gpt-3.5-turbo',
              temperature: 0.1,
              maxTokens: 50,
            },
          })
          apiCalls++

          // High temperature (creative)
          const highTempResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'user', content: 'Generate a fantasy character name.' },
              ],
              model: 'gpt-3.5-turbo',
              temperature: 1.8,
              maxTokens: 50,
            },
          })
          apiCalls++

          const success = lowTempResponse.statusCode === 200 && highTempResponse.statusCode === 200

          return {
            success,
            points: success ? 60 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
          }
        },
      },

      // ===== EMBEDDINGS & SEMANTIC SEARCH =====
      {
        name: 'AI-011: Generate text embeddings',
        description: 'Create vector embeddings for semantic search',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/embed',
            payload: {
              text: 'A powerful wizard who commands the elements and protects the realm from dark forces.',
              model: 'text-embedding-3-small',
            },
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.embedding)

          if (success) {
            agent.storeTestData('sampleEmbedding', response.body.embedding)
          }

          return {
            success,
            points: success ? 40 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
            metadata: { embeddingDimensions: response.body.embedding?.length || 0 },
          }
        },
      },

      {
        name: 'AI-012: Semantic similarity search',
        description: 'Find similar texts using embeddings',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/semantic/search',
            payload: {
              query: 'brave warrior knight',
              texts: [
                'A courageous knight who defends the kingdom',
                'An evil sorcerer plotting revenge',
                'A heroic fighter with a sword and shield',
                'A merchant selling magical potions',
                'A stealthy rogue who steals from the rich',
              ],
              model: 'text-embedding-3-small',
              topK: 3,
            },
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.results)

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
            metadata: { topResults: response.body.results?.length || 0 },
          }
        },
      },

      {
        name: 'AI-013: Project-wide semantic search',
        description: 'Search across all project content using embeddings',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/search',
            payload: {
              query: 'epic battle scene with dragons',
              projectId: (agent as any).projectId,
              threshold: 0.7,
              limit: 10,
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 40 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== IMAGE GENERATION =====
      {
        name: 'AI-014: Generate character portrait with AI',
        description: 'Create AI-generated character image',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/generate-image',
            payload: {
              prompt: 'A fierce elven archer with silver hair and emerald eyes, fantasy art style',
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid',
              model: 'google/gemini-2.5-flash-image-preview',
            },
          })

          const success = response.statusCode === 200 && response.body.imageUrl

          if (success) {
            agent.storeTestData('generatedImageUrl', response.body.imageUrl)
          }

          return {
            success,
            points: success ? 100 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-015: Generate NPC portrait with entity linkage',
        description: 'Create image linked to specific game entity',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/generate-image',
            payload: {
              prompt: 'Wise old wizard with long white beard and mystical staff',
              size: '512x512',
              quality: 'standard',
              style: 'natural',
              model: 'google/gemini-2.5-flash-image-preview',
              entityType: 'npc',
              entityName: 'Elder Sage Merlin',
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 80 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== VISION API =====
      {
        name: 'AI-016: Analyze single image with Vision API',
        description: 'Use GPT-4 Vision to analyze game asset image',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/vision/analyze',
            payload: {
              imageUrl: 'https://picsum.photos/800/600',
              prompt: 'Describe this image in detail, focusing on colors, composition, and mood.',
              model: 'gpt-4-vision-preview',
              maxTokens: 300,
              temperature: 0.5,
              detail: 'high',
            },
          })

          const success = response.statusCode === 200 && response.body.analysis

          return {
            success,
            points: success ? 60 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-017: Compare multiple images',
        description: 'Analyze and compare multiple images using Vision API',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/vision/analyze-multiple',
            payload: {
              images: [
                { url: 'https://picsum.photos/800/600', detail: 'high' },
                { url: 'https://picsum.photos/800/601', detail: 'high' },
                { url: 'https://picsum.photos/800/602', detail: 'low' },
              ],
              prompt: 'Compare these three images and identify common themes or differences.',
              model: 'gpt-4-vision-preview',
              maxTokens: 500,
              temperature: 0.7,
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 80 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== AUDIO PROCESSING =====
      {
        name: 'AI-018: Transcribe audio with Whisper',
        description: 'Convert audio to text using OpenAI Whisper',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/audio/transcribe',
            payload: {
              audioUrl: 'https://example.com/sample-audio.mp3',
              model: 'whisper-1',
              language: 'en',
              temperature: 0,
            },
          })

          // This might fail if audio URL is invalid, which is expected
          const success = response.statusCode === 200 || response.statusCode === 400

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-019: Translate audio to English',
        description: 'Translate foreign language audio using Whisper',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/audio/translate',
            payload: {
              audioUrl: 'https://example.com/foreign-audio.mp3',
              model: 'whisper-1',
              temperature: 0,
            },
          })

          // Expected to fail with invalid URL
          const success = response.statusCode === 200 || response.statusCode === 400

          return {
            success,
            points: success ? 40 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== USAGE TRACKING & ANALYTICS =====
      {
        name: 'AI-020: Get AI usage statistics',
        description: 'Retrieve detailed usage stats for AI services',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-services/usage',
          })

          const success = response.statusCode === 200 && response.body.usage

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-021: Get cost breakdown by service',
        description: 'Analyze spending across different AI services',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-services/usage/cost',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.costs)

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AI-022: List recent AI service calls',
        description: 'Get history of recent AI API calls',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-services/calls/recent?limit=10',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.calls)

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-023: Filter usage by service type',
        description: 'Get usage stats for specific AI service',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-services/usage?service=openai',
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-024: List available AI services',
        description: 'Get capabilities and models for each service',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/ai-services/services',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.services)

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== EDGE CASES & ERROR HANDLING =====
      {
        name: 'AI-025: Test empty message array',
        description: 'Try chat completion with no messages',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [],
              model: 'gpt-3.5-turbo',
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Empty messages array not properly validated',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: 'AI-026: Test invalid model name',
        description: 'Try to use non-existent AI model',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'user', content: 'Hello' },
              ],
              model: 'invalid-model-xyz-123',
            },
          })

          // Should fail gracefully
          const success = response.statusCode >= 400

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-027: Test negative temperature',
        description: 'Try invalid negative temperature value',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'user', content: 'Test' },
              ],
              model: 'gpt-3.5-turbo',
              temperature: -0.5,
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Negative temperature not validated',
            severity: 'low' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: 'AI-028: Test excessive token limit',
        description: 'Try to request more tokens than model supports',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/chat',
            payload: {
              messages: [
                { role: 'user', content: 'Generate text' },
              ],
              model: 'gpt-3.5-turbo',
              maxTokens: 999999,
            },
          })

          // Should fail or cap at reasonable limit
          const success = response.statusCode === 400

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-029: Test empty embedding text',
        description: 'Try to generate embeddings for empty string',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/embed',
            payload: {
              text: '',
              model: 'text-embedding-3-small',
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Empty text embedding not validated',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: 'AI-030: Test image generation with empty prompt',
        description: 'Try to generate image with no prompt',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/generate-image',
            payload: {
              prompt: '',
              size: '1024x1024',
              model: 'google/gemini-2.5-flash-image-preview',
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Empty image prompt not validated',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: 'AI-031: Test invalid image size',
        description: 'Try to generate image with unsupported dimensions',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/generate-image',
            payload: {
              prompt: 'A beautiful landscape',
              size: '9999x9999',
              model: 'google/gemini-2.5-flash-image-preview',
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-032: Test cost estimation with zero tokens',
        description: 'Try to estimate cost with invalid token counts',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-gateway/estimate',
            payload: {
              model: 'openai/gpt-4o',
              inputTokens: 0,
              outputTokens: 0,
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'AI-033: Test semantic search with invalid threshold',
        description: 'Try semantic search with threshold > 1.0',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/ai-services/search',
            payload: {
              query: 'test query',
              projectId: (agent as any).projectId,
              threshold: 1.5,
              limit: 10,
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },
    ]
  }
}
