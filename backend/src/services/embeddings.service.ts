import { aiSDKService } from './ai-sdk.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'
import { qdrantService, CONTENT_TYPES, EMBEDDING_MODELS, type ContentType } from './qdrant.service'

// =====================================================
// EMBEDDINGS SERVICE - Text Embedding and Similarity
// =====================================================

export interface SimilarContent {
  id: string
  type: string
  content: string
  similarity: number
  metadata?: Record<string, unknown> | undefined
}

export class EmbeddingsService {
  private model = 'text-embedding-3-small'
  private embeddingDimensions = 1536

  /**
   * Generate embedding for text using AI Gateway
   */
  async embedText(text: string): Promise<number[]> {
    const embedding = await aiSDKService.generateEmbedding(text, { model: this.model })
    return embedding
  }

  /**
   * Generate embeddings for multiple texts using AI Gateway
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings = await aiSDKService.generateEmbeddings(texts, { model: this.model })
    return embeddings
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Store an embedding in Qdrant
   */
  async storeEmbedding(params: {
    contentType: ContentType
    contentId: string
    text: string
    metadata?: Record<string, any>
  }): Promise<void> {
    const embedding = await this.embedText(params.text)

    await qdrantService.upsert({
      contentType: params.contentType,
      contentId: params.contentId,
      embedding,
      sourceText: params.text,
      embeddingModel: EMBEDDING_MODELS.TEXT_EMBEDDING_3_SMALL,
      embeddingDimensions: this.embeddingDimensions,
      metadata: params.metadata,
    })
  }

  /**
   * Store multiple embeddings in Qdrant (batch operation)
   */
  async storeBatchEmbeddings(params: {
    contentType: ContentType
    items: Array<{
      contentId: string
      text: string
      metadata?: Record<string, any>
    }>
  }): Promise<void> {
    const texts = params.items.map(item => item.text)
    const embeddings = await this.embedBatch(texts)

    const points = params.items.map((item, index) => ({
      contentId: item.contentId,
      embedding: embeddings[index]!,
      sourceText: item.text,
      embeddingModel: EMBEDDING_MODELS.TEXT_EMBEDDING_3_SMALL,
      embeddingDimensions: this.embeddingDimensions,
      metadata: item.metadata,
    }))

    await qdrantService.batchUpsert({
      contentType: params.contentType,
      points,
    })
  }

  /**
   * Delete an embedding from Qdrant
   */
  async deleteEmbedding(params: {
    contentType: ContentType
    contentId: string
  }): Promise<void> {
    await qdrantService.delete(params)
  }

  /**
   * Find similar NPCs based on description embedding (using Qdrant)
   */
  async findSimilarNPCs(
    _db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    _projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const results = await qdrantService.search({
      contentType: CONTENT_TYPES.NPC,
      queryVector: embedding,
      limit,
      threshold,
      filter: undefined, // Could filter by projectId if we add it to metadata
    })

    return results.map(result => ({
      id: result.payload.contentId,
      type: 'npc',
      content: result.payload.sourceText,
      similarity: result.score,
      metadata: result.payload.metadata as Record<string, unknown> | undefined,
    }))
  }

  /**
   * Find similar lore entries (using Qdrant)
   */
  async findSimilarLore(
    _db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    _projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const results = await qdrantService.search({
      contentType: CONTENT_TYPES.LORE,
      queryVector: embedding,
      limit,
      threshold,
      filter: undefined,
    })

    return results.map(result => ({
      id: result.payload.contentId,
      type: 'lore',
      content: result.payload.sourceText,
      similarity: result.score,
      metadata: result.payload.metadata as Record<string, unknown> | undefined,
    }))
  }

  /**
   * Find similar quests (using Qdrant)
   */
  async findSimilarQuests(
    _db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    _projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const results = await qdrantService.search({
      contentType: CONTENT_TYPES.QUEST,
      queryVector: embedding,
      limit,
      threshold,
      filter: undefined,
    })

    return results.map(result => ({
      id: result.payload.contentId,
      type: 'quest',
      content: result.payload.sourceText,
      similarity: result.score,
      metadata: result.payload.metadata as Record<string, unknown> | undefined,
    }))
  }

  /**
   * Find similar content across all types (using Qdrant)
   */
  async findSimilar(
    _db: PostgresJsDatabase<typeof schema>,
    text: string,
    _projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const embedding = await this.embedText(text)

    // Search across all content types
    const results = await qdrantService.search({
      contentType: undefined, // Search all collections
      queryVector: embedding,
      limit,
      threshold,
      filter: undefined,
    })

    return results.map(result => ({
      id: result.payload.contentId,
      type: result.payload.contentType,
      content: result.payload.sourceText,
      similarity: result.score,
      metadata: result.payload.metadata as Record<string, unknown> | undefined,
    }))
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService()
