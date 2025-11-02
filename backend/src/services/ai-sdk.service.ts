/**
 * AI SDK Service
 * Unified AI service using Vercel AI SDK v5
 * Replaces direct OpenAI API calls with the AI SDK
 *
 * Supports:
 * - Direct provider access (OpenAI, Anthropic)
 * - Vercel AI Gateway for unified access to all providers
 * - Usage tracking and analytics
 * - Cost optimization
 * - Per-user API keys
 */

import { generateText, gateway, embed } from 'ai'
import { eq, and } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { modelConfigurations } from '../database/schema'
import { getGenerationPrompts, getGPT4EnhancementPrompts } from '../utils/prompt-loader'
import { env } from '../config/env'

// =====================================================
// TYPES
// =====================================================

interface AISDKServiceConfig {
  openaiApiKey?: string | undefined
  anthropicApiKey?: string | undefined
  db?: PostgresJsDatabase<any> | undefined
}

interface ModelConfigCache {
  modelId: string
  provider: string
  temperature: number
  maxTokens: number | null
  timestamp: number
}

interface ModelSettings {
  temperature: number
  maxTokens: number | null
}

interface PromptEnhancementResult {
  originalPrompt: string
  optimizedPrompt: string
  model?: string
  keywords?: string[]
  error?: string
}

interface ImageGenerationResult {
  imageUrl: string
  prompt: string
  metadata: {
    model: string
    resolution: string
    quality: string
    timestamp: string
  }
}

interface AssetConfig {
  generationType: string | undefined
  type: string | undefined
  subtype: string | undefined
  style: string | undefined
  customPrompts: {
    gameStyle?: string
  } | undefined
}

// =====================================================
// SERVICE
// =====================================================

export class AISDKService {
  private useGateway: boolean
  private modelConfigCache: Map<string, ModelConfigCache>
  private cacheExpiry: number
  private openaiApiKey: string | undefined
  private anthropicApiKey: string | undefined
  private db: PostgresJsDatabase<any> | undefined

  constructor(_config: AISDKServiceConfig = {}) {
    this.useGateway = this.shouldUseGateway()
    this.modelConfigCache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes
    this.db = _config.db

    // Store API key overrides (for per-user keys)
    this.openaiApiKey = _config.openaiApiKey || env.OPENAI_API_KEY
    this.anthropicApiKey = _config.anthropicApiKey || env.ANTHROPIC_API_KEY

    // Check for required API keys
    if (!this.useGateway && !this.openaiApiKey && env.NODE_ENV !== 'test') {
      console.warn('[AISDKService] Missing OpenAI API key - some features will be limited')
    }

    if (this.useGateway) {
      console.log('[AISDKService] Using Vercel AI Gateway for model access')
    } else {
      console.log(
        `[AISDKService] Using direct provider access ${_config.openaiApiKey ? '(user key)' : '(env var)'}`
      )
    }
  }

  /**
   * Get configured model for a specific task type
   * Falls back to default if not configured
   */
  async getConfiguredModel(
    taskType: string,
    defaultModelId: string,
    defaultProvider: 'openai' | 'anthropic' = 'openai'
  ): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `model_${taskType}`
      const cached = this.modelConfigCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return this.getModel(cached.modelId, cached.provider as 'openai' | 'anthropic')
      }

      // Fetch from database using Drizzle ORM (if db available)
      if (this.db) {
        const results = await this.db
          .select()
          .from(modelConfigurations)
          .where(
            and(
              eq(modelConfigurations.taskType, taskType),
              eq(modelConfigurations.isActive, true)
            )
          )
          .limit(1)

        const result = results[0]

        if (result) {
          // Cache the result
          this.modelConfigCache.set(cacheKey, {
            modelId: result.modelId,
            provider: result.provider,
            temperature: parseFloat(result.temperature || '0.7'),
            maxTokens: result.maxTokens,
            timestamp: Date.now(),
          })

          return this.getModel(result.modelId, result.provider as 'openai' | 'anthropic')
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch configured model for ${taskType}:`, (error as Error).message)
    }

    // Fall back to default
    return this.getModel(defaultModelId, defaultProvider)
  }

  /**
   * Get model configuration settings (temperature, maxTokens)
   */
  async getModelSettings(taskType: string): Promise<ModelSettings> {
    try {
      const cacheKey = `model_${taskType}`
      const cached = this.modelConfigCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return {
          temperature: cached.temperature,
          maxTokens: cached.maxTokens,
        }
      }

      if (this.db) {
        const results = await this.db
          .select({
            temperature: modelConfigurations.temperature,
            maxTokens: modelConfigurations.maxTokens,
          })
          .from(modelConfigurations)
          .where(
            and(
              eq(modelConfigurations.taskType, taskType),
              eq(modelConfigurations.isActive, true)
            )
          )
          .limit(1)

        const result = results[0]

        if (result) {
          return {
            temperature: parseFloat(result.temperature || '0.7'),
            maxTokens: result.maxTokens,
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch model settings for ${taskType}:`, (error as Error).message)
    }

    // Return defaults
    return {
      temperature: 0.7,
      maxTokens: null,
    }
  }

  /**
   * Clear model configuration cache
   */
  clearModelCache(): void {
    this.modelConfigCache.clear()
  }

  /**
   * Determine if we should use the AI Gateway
   * Gateway is used if AI_GATEWAY_API_KEY is set or running on Vercel (OIDC)
   */
  private shouldUseGateway(): boolean {
    return !!(env.AI_GATEWAY_API_KEY || env.VERCEL_ENV)
  }

  /**
   * Get the appropriate model based on gateway availability
   *
   * When using AI Gateway, returns a model string (e.g., 'openai/gpt-4o')
   * that the AI SDK will automatically route through the gateway.
   *
   * When not using the gateway, returns a provider instance.
   */
  getModel(modelId: string, provider: 'openai' | 'anthropic' = 'openai'): any {
    // If using AI Gateway, return model string format that AI SDK will route through gateway
    // The AI SDK automatically uses the gateway when AI_GATEWAY_API_KEY is set
    if (this.useGateway && env.AI_GATEWAY_API_KEY) {
      // Clean up model ID to ensure correct format
      const cleanModelId = modelId.replace(/^(openai|anthropic)\//, '')

      // Return model string in provider/model format
      // AI SDK will automatically route this through the gateway
      return `${provider}/${cleanModelId}`
    }

    // Direct provider access not supported without gateway
    // If we reach here, AI_GATEWAY_API_KEY is not set
    throw new Error(`AI Gateway is required. Please set AI_GATEWAY_API_KEY environment variable.`)
  }

  /**
   * Enhance prompt using GPT-4 with AI SDK
   */
  async enhancePromptWithGPT4(
    description: string,
    assetConfig: AssetConfig,
    _userId: string | null = null
  ): Promise<PromptEnhancementResult> {
    if (!this.useGateway && !env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY required for GPT-4 enhancement')
    }

    // Load GPT-4 enhancement prompts
    const gpt4Prompts = await getGPT4EnhancementPrompts()

    const isAvatar = assetConfig.generationType === 'avatar' || assetConfig.type === 'character'
    const isArmor = assetConfig.type === 'armor'
    const isChestArmor =
      isArmor &&
      (assetConfig.subtype?.toLowerCase().includes('chest') ||
        assetConfig.subtype?.toLowerCase().includes('body'))

    // Build system prompt from loaded prompts
    let systemPrompt = gpt4Prompts.systemPrompt.base

    if (isAvatar) {
      systemPrompt += '\n' + gpt4Prompts.typeSpecific.avatar.critical
    }

    if (isArmor) {
      systemPrompt += '\n' + gpt4Prompts.typeSpecific.armor.base
      if (isChestArmor) {
        systemPrompt += ' ' + gpt4Prompts.typeSpecific.armor.chest
      }
      systemPrompt += ' ' + gpt4Prompts.typeSpecific.armor.positioning
    }

    // Add focus points
    const focusPoints = gpt4Prompts.systemPrompt.focusPoints.map((point) =>
      point.replace('${config.style || \'low-poly RuneScape\'}', assetConfig.style || 'low-poly RuneScape')
    )

    systemPrompt += '\nFocus on:\n' + focusPoints.map((point) => `- ${point}`).join('\n')

    if (isAvatar) {
      systemPrompt += '\n' + gpt4Prompts.typeSpecific.avatar.focus
    }

    if (isArmor) {
      systemPrompt += '\n' + gpt4Prompts.typeSpecific.armor.focus.join('\n')
    }

    systemPrompt += '\n' + gpt4Prompts.systemPrompt.closingInstruction

    // Include custom game style text
    const stylePrefix = assetConfig.customPrompts?.gameStyle
      ? `${assetConfig.customPrompts.gameStyle} — `
      : ''
    const baseDescription = `${stylePrefix}${description}`
    const userPrompt = isArmor
      ? gpt4Prompts.typeSpecific.armor.enhancementPrefix + `"${baseDescription}"`
      : `Enhance this ${assetConfig.type} asset description for 3D generation: "${baseDescription}"`

    try {
      // Get configured model and settings for this task
      const model = await this.getConfiguredModel('prompt-enhancement', 'gpt-4o', 'openai')
      const settings = await this.getModelSettings('prompt-enhancement')

      // Use AI SDK v5 generateText
      const { text } = await generateText({
        model: model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: settings.temperature,
        maxSteps: settings.maxTokens || 200,
      } as any)

      return {
        originalPrompt: description,
        optimizedPrompt: text.trim(),
        model: 'gpt-4o',
        keywords: this.extractKeywords(text),
      }
    } catch (error) {
      console.error('GPT-4 enhancement failed:', error)

      // Load generation prompts for fallback
      const generationPrompts = await getGenerationPrompts()
      const fallbackTemplate = generationPrompts.imageGeneration.fallbackEnhancement

      // Replace template variables
      const fallbackPrompt = fallbackTemplate
        .replace('${config.description}', description)
        .replace('${config.style || "game-ready"}', assetConfig.style || 'game-ready')

      return {
        originalPrompt: description,
        optimizedPrompt: fallbackPrompt,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Generate image using AI SDK v5
   * Uses AI Gateway with Google Gemini 2.5 Flash (nano banana model)
   */
  async generateImage(
    description: string,
    assetType: string,
    style: string,
    _userId: string | null = null
  ): Promise<ImageGenerationResult> {
    if (!this.useGateway || !env.AI_GATEWAY_API_KEY) {
      throw new Error('AI_GATEWAY_API_KEY required for image generation')
    }

    // Load generation prompts
    const generationPrompts = await getGenerationPrompts()
    const promptTemplate = generationPrompts.imageGeneration.base

    // Replace template variables
    const prompt = promptTemplate
      .replace('${description}', description)
      .replace('${style || "game-ready"}', style || 'game-ready')
      .replace('${assetType}', assetType)

    try {
      console.log('[AISDKService] Using AI Gateway with Google Gemini 2.5 Flash for image generation')

      // Use generateText with Gemini multimodal model (nano banana)
      // Images will be in the files property
      const result = await generateText({
        model: gateway('google/gemini-2.5-flash-image-preview'),
        prompt: `Create an image: ${prompt}`,
      })

      // Extract image from files
      const imageFile = result.files.find(file => file.mediaType.startsWith('image/'))

      if (!imageFile) {
        throw new Error('No image generated by Gemini model')
      }

      // Convert uint8Array to base64
      const base64Data = Buffer.from(imageFile.uint8Array).toString('base64')
      const imageUrl = `data:${imageFile.mediaType};base64,${base64Data}`

      return {
        imageUrl,
        prompt,
        metadata: {
          model: 'google/gemini-2.5-flash-image-preview',
          resolution: '1024x1024',
          quality: 'standard',
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error('Image generation failed:', error)
      throw new Error(`Image generation failed: ${(error as Error).message}`)
    }
  }

  /**
   * Extract keywords from prompt
   */
  private extractKeywords(prompt: string): string[] {
    const keywords: string[] = []
    const patterns = [
      /\b(bronze|steel|iron|mithril|adamant|rune)\b/gi,
      /\b(sword|shield|bow|staff|armor|helmet)\b/gi,
      /\b(leather|metal|wood|crystal|bone)\b/gi,
      /\b(low-poly|high-poly|realistic|stylized)\b/gi,
    ]

    patterns.forEach((pattern) => {
      const matches = prompt.match(pattern)
      if (matches) {
        keywords.push(...matches.map((m) => m.toLowerCase()))
      }
    })

    return [...new Set(keywords)]
  }

  /**
   * Generate text with Claude (for lore, dialogue, etc.)
   */
  async generateWithClaude(
    prompt: string,
    systemPrompt: string,
    options: {
      temperature?: number
      maxTokens?: number
      taskType?: string
      tags?: string
    } = {},
    _userId: string | null = null
  ): Promise<string> {
    if (!this.useGateway && !env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required for Claude generation')
    }

    // Get configured model and settings for text generation
    const taskType = options.taskType || 'text-generation'
    const model = await this.getConfiguredModel(taskType, 'claude-sonnet-4', 'anthropic')
    const settings = await this.getModelSettings(taskType)

    const { text } = await generateText({
      model: model,
      system: systemPrompt,
      prompt: prompt,
      temperature: options.temperature || settings.temperature,
      maxSteps: options.maxTokens || settings.maxTokens || 1000,
    } as any)

    return text
  }

  /**
   * Generate embedding using AI Gateway
   * Uses text-embedding-3-small by default
   */
  async generateEmbedding(
    text: string,
    options: {
      model?: string
    } = {}
  ): Promise<number[]> {
    if (!this.useGateway && !env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY required for embeddings')
    }

    const modelId = options.model || 'text-embedding-3-small'

    try {
      // When using AI Gateway, the embed function will automatically route through gateway
      const embeddingModel = this.useGateway && env.AI_GATEWAY_API_KEY
        ? `openai/${modelId}`
        : this.getModel(modelId, 'openai')

      const { embedding } = await embed({
        model: embeddingModel,
        value: text,
      } as any)

      return embedding
    } catch (error) {
      console.error('[AISDKService] Embedding generation failed:', error)
      throw new Error(`Embedding generation failed: ${(error as Error).message}`)
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(
    texts: string[],
    options: {
      model?: string
    } = {}
  ): Promise<number[][]> {
    const embeddings: number[][] = []

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text, options)
      embeddings.push(embedding)
    }

    return embeddings
  }
}

// Export singleton instance (without db by default, can be overridden)
export const aiSDKService = new AISDKService()
