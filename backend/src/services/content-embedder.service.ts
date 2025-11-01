/**
 * Content Embedder Service
 * Generates and stores vector embeddings for game content using Vercel AI SDK and Qdrant
 *
 * Features:
 * - Text embedding generation (OpenAI text-embedding-3-small)
 * - Vector similarity search using Qdrant
 * - Content extraction from game data (lore, quests, NPCs, items, manifests)
 * - Batch embedding operations
 * - AI context building for memory-augmented generation
 */

import { embed, embedMany, gateway } from 'ai'
import { openai } from '@ai-sdk/openai'
import { qdrantService, type ContentType, CONTENT_TYPES } from './qdrant.service'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100

export interface EmbeddingOptions {
  contentType?: ContentType | null
  limit?: number
  threshold?: number
  metadata?: Record<string, any> | null
}

export interface SimilarContent {
  id: string
  contentType: string
  contentId: string
  content: string
  similarity: number
  createdAt: Date | null
}

export interface ContextResult {
  hasContext: boolean
  context: string
  sources: Array<{
    type: string
    id: string
    similarity: number
  }>
}

export class ContentEmbedderService {
  private useGateway: boolean
  private enabled: boolean

  constructor() {
    this.useGateway = this.shouldUseGateway()

    // Check for required API keys
    if (!this.useGateway && !process.env.OPENAI_API_KEY) {
      console.warn('[ContentEmbedder] Missing OPENAI_API_KEY - embedding features disabled')
      this.enabled = false
    } else {
      this.enabled = true

      if (this.useGateway) {
        console.log(`[ContentEmbedder] Initialized with Vercel AI Gateway (${EMBEDDING_DIMENSIONS}d) + Qdrant`)
      } else {
        console.log(`[ContentEmbedder] Initialized with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d) + Qdrant`)
      }
    }
  }

  /**
   * Initialize Qdrant collections
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      console.warn('[ContentEmbedder] Skipping Qdrant initialization - service disabled')
      return
    }

    try {
      await qdrantService.initializeCollections()
      console.log('[ContentEmbedder] Qdrant collections initialized successfully')
    } catch (error: any) {
      console.error('[ContentEmbedder] Failed to initialize Qdrant collections:', error.message)
      throw error
    }
  }

  /**
   * Determine if we should use the AI Gateway
   */
  private shouldUseGateway(): boolean {
    return !!(
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_ENV // Deployed on Vercel with OIDC
    )
  }

  /**
   * Get the embedding model (gateway or direct)
   */
  private getModel(modelId: string = EMBEDDING_MODEL): ReturnType<typeof openai.embedding> {
    if (this.useGateway) {
      const gatewayModelId = modelId.includes('/') ? modelId : `openai/${modelId}`
      // Use gateway.textEmbeddingModel for embedding models
      return gateway.textEmbeddingModel(gatewayModelId)
    }

    // Direct OpenAI access
    return openai.embedding(modelId.replace('openai/', ''))
  }

  // =============================================================================
  // Content Extraction Methods
  // =============================================================================

  /**
   * Extract embeddable text from lore content
   */
  extractLoreContent(lore: Record<string, any>): string {
    const parts = [
      lore.title || '',
      lore.category || '',
      lore.content || '',
      lore.summary || ''
    ].filter(Boolean)

    return parts.join('\n\n')
  }

  /**
   * Extract embeddable text from quest
   */
  extractQuestContent(quest: Record<string, any>): string {
    const parts = [
      quest.title || quest.name || '',
      quest.description || '',
      quest.objective || '',
      quest.questGiver || '',
      quest.rewards ? `Rewards: ${JSON.stringify(quest.rewards)}` : '',
      quest.requirements ? `Requirements: ${JSON.stringify(quest.requirements)}` : ''
    ].filter(Boolean)

    return parts.join('\n\n')
  }

  /**
   * Extract embeddable text from item
   */
  extractItemContent(item: Record<string, any>): string {
    const parts = [
      item.name || '',
      item.id || '',
      item.type || item.category || '',
      item.description || '',
      item.lore || '',
      item.stats ? `Stats: ${JSON.stringify(item.stats)}` : '',
      item.effects ? `Effects: ${JSON.stringify(item.effects)}` : ''
    ].filter(Boolean)

    return parts.join('\n\n')
  }

  /**
   * Extract embeddable text from character/NPC
   */
  extractCharacterContent(character: Record<string, any>): string {
    const parts = [
      character.name || '',
      character.title || '',
      character.race || character.species || '',
      character.class || character.role || '',
      character.description || '',
      character.backstory || '',
      character.personality || '',
      character.dialogue ? `Common phrases: ${Array.isArray(character.dialogue) ? character.dialogue.slice(0, 3).join('; ') : character.dialogue}` : '',
      character.location ? `Location: ${character.location}` : ''
    ].filter(Boolean)

    return parts.join('\n\n')
  }

  /**
   * Extract embeddable text from manifest
   */
  extractManifestContent(manifest: Record<string, any>): string {
    const parts = [
      manifest.name || '',
      manifest.category || manifest.type || '',
      manifest.description || '',
      manifest.tags ? `Tags: ${manifest.tags.join(', ')}` : '',
      manifest.metadata ? `Metadata: ${JSON.stringify(manifest.metadata)}` : ''
    ].filter(Boolean)

    // If manifest has items, include a summary
    if (manifest.items && Array.isArray(manifest.items)) {
      const itemSummary = manifest.items.slice(0, 5)
        .map((item: any) => item.name || item.id)
        .join(', ')
      parts.push(`Items: ${itemSummary}${manifest.items.length > 5 ? '...' : ''}`)
    }

    return parts.join('\n\n')
  }

  // =============================================================================
  // Embedding Generation
  // =============================================================================

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.enabled) {
      throw new Error('Embedding service is disabled - API key not configured')
    }

    const startTime = Date.now()

    try {
      const model = this.getModel()

      const { embedding } = await embed({
        model,
        value: text
      })

      const duration = Date.now() - startTime
      console.log(`[ContentEmbedder] Generated embedding for ${text.length} chars (${duration}ms)`)

      return embedding
    } catch (error: any) {
      console.error('[ContentEmbedder] Failed to generate embedding:', error.message)
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.enabled) {
      throw new Error('Embedding service is disabled - API key not configured')
    }

    if (texts.length === 0) {
      return []
    }

    const startTime = Date.now()

    try {
      const model = this.getModel()

      // Process in batches
      const results: number[][] = []

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)

        // Validate batch before sending
        const validBatch = batch.filter(text => {
          if (typeof text !== 'string') {
            console.warn(`[ContentEmbedder] Skipping non-string value in batch: ${typeof text}`)
            return false
          }
          if (text.trim().length === 0) {
            console.warn(`[ContentEmbedder] Skipping empty string in batch`)
            return false
          }
          return true
        })

        if (validBatch.length === 0) {
          console.warn(`[ContentEmbedder] Batch ${i}-${i + batch.length} had no valid texts, skipping`)
          continue
        }

        console.log(`[ContentEmbedder] Generating embeddings for batch of ${validBatch.length} texts (chars: ${validBatch.map(t => t.length).join(', ')})`)

        const { embeddings } = await embedMany({
          model,
          values: validBatch
        })

        results.push(...embeddings)
      }

      const duration = Date.now() - startTime
      console.log(`[ContentEmbedder] Generated ${results.length} embeddings (${duration}ms)`)

      return results
    } catch (error: any) {
      console.error('[ContentEmbedder] Failed to generate embeddings:', error)
      console.error('[ContentEmbedder] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      })
      throw error
    }
  }

  // =============================================================================
  // Qdrant Operations
  // =============================================================================

  /**
   * Store embedding in Qdrant
   */
  async storeEmbedding(params: {
    contentType: ContentType
    contentId: string
    content: string
    embedding: number[]
    metadata: Record<string, any> | undefined
  }) {
    const startTime = Date.now()

    try {
      await qdrantService.upsert({
        contentType: params.contentType,
        contentId: params.contentId,
        embedding: params.embedding,
        sourceText: params.content,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        metadata: params.metadata
      })

      const duration = Date.now() - startTime
      console.log(`[ContentEmbedder] Stored embedding for ${params.contentType}:${params.contentId} (${duration}ms)`)

      // Return success with the content ID (which is also used as the point ID in Qdrant)
      return {
        success: true,
        id: params.contentId
      }
    } catch (error: any) {
      console.error(`[ContentEmbedder] Failed to store embedding:`, error.message)
      throw error
    }
  }

  /**
   * Embed and store content in one operation
   */
  async embedContent(params: {
    contentType: ContentType
    contentId: string
    content: string
    metadata: Record<string, any> | undefined
  }) {
    if (!this.enabled) {
      console.warn(`[ContentEmbedder] Skipping embedding for ${params.contentType}:${params.contentId} - service disabled`)
      return null
    }

    const startTime = Date.now()

    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(params.content)

      // Store in Qdrant
      const result = await this.storeEmbedding({
        contentType: params.contentType,
        contentId: params.contentId,
        content: params.content,
        embedding,
        metadata: params.metadata
      })

      const duration = Date.now() - startTime
      console.log(`[ContentEmbedder] Embedded ${params.contentType}:${params.contentId} (${duration}ms total)`)

      return result
    } catch (error: any) {
      console.error(`[ContentEmbedder] Failed to embed content:`, error.message)
      throw error
    }
  }

  // =============================================================================
  // Content-Specific Embedding Methods
  // =============================================================================

  async embedLore(loreId: string, lore: Record<string, any>) {
    const content = this.extractLoreContent(lore)
    return this.embedContent({
      contentType: CONTENT_TYPES.LORE,
      contentId: loreId,
      content,
      metadata: {
        title: lore.title,
        category: lore.category,
        tags: lore.tags || []
      }
    })
  }

  async embedQuest(questId: string, quest: Record<string, any>) {
    const content = this.extractQuestContent(quest)
    return this.embedContent({
      contentType: CONTENT_TYPES.QUEST,
      contentId: questId,
      content,
      metadata: {
        title: quest.title || quest.name,
        difficulty: quest.difficulty,
        questGiver: quest.questGiver,
        level: quest.level || quest.requiredLevel
      }
    })
  }

  async embedItem(itemId: string, item: Record<string, any>) {
    const content = this.extractItemContent(item)
    return this.embedContent({
      contentType: CONTENT_TYPES.ITEM,
      contentId: itemId,
      content,
      metadata: {
        name: item.name,
        type: item.type || item.category,
        rarity: item.rarity,
        level: item.level
      }
    })
  }

  async embedCharacter(characterId: string, character: Record<string, any>) {
    const content = this.extractCharacterContent(character)
    return this.embedContent({
      contentType: CONTENT_TYPES.CHARACTER,
      contentId: characterId,
      content,
      metadata: {
        name: character.name,
        race: character.race || character.species,
        class: character.class || character.role,
        location: character.location
      }
    })
  }

  async embedNPC(npcId: string, npc: Record<string, any>) {
    const content = this.extractCharacterContent(npc)
    return this.embedContent({
      contentType: CONTENT_TYPES.NPC,
      contentId: npcId,
      content,
      metadata: {
        name: npc.name,
        type: npc.type || 'npc',
        location: npc.location,
        faction: npc.faction
      }
    })
  }

  async embedManifest(manifestId: string, manifest: Record<string, any>) {
    const content = this.extractManifestContent(manifest)
    return this.embedContent({
      contentType: CONTENT_TYPES.MANIFEST,
      contentId: manifestId,
      content,
      metadata: {
        name: manifest.name,
        category: manifest.category,
        itemCount: manifest.items?.length || 0
      }
    })
  }

  /**
   * Batch embed multiple items of the same type
   */
  async embedBatch(contentType: ContentType, items: Array<{ id: string; data: Record<string, any>; metadata?: Record<string, any> }>) {
    const extractorMap: Record<string, (data: Record<string, any>) => string> = {
      lore: this.extractLoreContent.bind(this),
      quest: this.extractQuestContent.bind(this),
      item: this.extractItemContent.bind(this),
      character: this.extractCharacterContent.bind(this),
      npc: this.extractCharacterContent.bind(this),
      manifest: this.extractManifestContent.bind(this)
    }

    const extractor = extractorMap[contentType]
    if (!extractor) {
      throw new Error(`Unknown content type: ${contentType}`)
    }

    // Extract texts and filter out invalid/empty ones
    const itemsWithTexts = items.map((item, index) => {
      const text = extractor(item.data)
      return { item, text, index }
    })

    // Filter out items with empty or very short texts
    const validItems = itemsWithTexts.filter(({ text }) => {
      const trimmed = text.trim()
      if (trimmed.length === 0) {
        console.warn(`[ContentEmbedder] Skipping item with empty text`)
        return false
      }
      if (trimmed.length < 3) {
        console.warn(`[ContentEmbedder] Skipping item with very short text: "${trimmed}"`)
        return false
      }
      return true
    })

    if (validItems.length === 0) {
      console.log(`[ContentEmbedder] No valid items to embed for ${contentType}`)
      return { success: true, count: 0 }
    }

    console.log(`[ContentEmbedder] Embedding ${validItems.length}/${items.length} valid ${contentType} items`)

    // Extract valid texts for embedding
    const texts = validItems.map(({ text }) => text)
    const embeddings = await this.generateEmbeddings(texts)

    // Prepare points for batch upsert (only valid items)
    const points = validItems.map(({ item, text }, i) => ({
      contentId: item.id,
      embedding: embeddings[i]!,
      sourceText: text,
      embeddingModel: EMBEDDING_MODEL as any, // Type cast needed - EMBEDDING_MODEL is a const string
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      metadata: item.metadata || {}
    }))

    // Batch upsert to Qdrant
    await qdrantService.batchUpsert({
      contentType,
      points
    })

    console.log(`[ContentEmbedder] Batch embedded ${validItems.length} ${contentType} items`)
    return { success: true, count: validItems.length }
  }

  // =============================================================================
  // Search Operations
  // =============================================================================

  /**
   * Find similar content using vector similarity search
   */
  async findSimilar(
    queryText: string,
    options: EmbeddingOptions = {}
  ): Promise<SimilarContent[]> {
    if (!this.enabled) {
      throw new Error('Embedding service is disabled - OPENAI_API_KEY not configured')
    }

    const {
      contentType = null,
      limit = 10,
      threshold = 0.7
    } = options

    const startTime = Date.now()

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText)

      // Search in Qdrant
      const results = await qdrantService.search({
        contentType: contentType || undefined,
        queryVector: queryEmbedding,
        limit,
        threshold,
        filter: undefined
      })

      const duration = Date.now() - startTime
      console.log(`[ContentEmbedder] Found ${results.length} similar items (${duration}ms)`)

      // Transform Qdrant results to SimilarContent format
      return results.map(result => ({
        id: result.id,
        contentType: result.payload.contentType,
        contentId: result.payload.contentId,
        content: result.payload.sourceText,
        similarity: result.score,
        createdAt: new Date(result.payload.createdAt)
      }))
    } catch (error: any) {
      console.error('[ContentEmbedder] Failed to find similar content:', error.message)
      throw error
    }
  }

  /**
   * Build AI context from similar content
   */
  async buildContext(queryText: string, options: EmbeddingOptions = {}): Promise<ContextResult> {
    const similar = await this.findSimilar(queryText, {
      limit: options.limit || 5,
      threshold: options.threshold || 0.7,
      ...options
    })

    if (similar.length === 0) {
      return {
        hasContext: false,
        context: '',
        sources: []
      }
    }

    const context = similar
      .map((item, i) => {
        const type = item.contentType.toUpperCase()
        return `[${type} ${i + 1}] (${Math.round(item.similarity * 100)}% relevant)\n${item.content}`
      })
      .join('\n\n')

    return {
      hasContext: true,
      context,
      sources: similar.map(item => ({
        type: item.contentType,
        id: item.contentId,
        similarity: item.similarity
      }))
    }
  }

  /**
   * Delete embedding for content
   */
  async deleteEmbedding(contentType: ContentType, contentId: string): Promise<boolean> {
    try {
      await qdrantService.delete({
        contentType,
        contentId
      })

      console.log(`[ContentEmbedder] Deleted embedding for ${contentType}:${contentId}`)
      return true
    } catch (error: any) {
      console.error(`[ContentEmbedder] Failed to delete embedding:`, error.message)
      throw error
    }
  }

  /**
   * Get embedding statistics
   */
  async getStats() {
    try {
      const allStats = await qdrantService.getAllStats()

      return Object.entries(allStats).map(([contentType, stats]) => ({
        content_type: contentType,
        total_embeddings: stats.points_count || 0,
        vector_size: stats.config?.params?.vectors?.size || EMBEDDING_DIMENSIONS,
        status: stats.status || 'unknown'
      }))
    } catch (error: any) {
      console.error('[ContentEmbedder] Failed to get stats:', error.message)
      throw error
    }
  }
}
