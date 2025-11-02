import { aiSDKService } from './ai-sdk.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import * as schema from '../database/schema'

// =====================================================
// EMBEDDINGS SERVICE - Text Embedding and Similarity
// =====================================================

export interface SimilarContent {
  id: string
  type: string
  content: string
  similarity: number
  metadata?: Record<string, unknown>
}

export class EmbeddingsService {
  private model = 'text-embedding-3-small'

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
   * Find similar NPCs based on description embedding
   */
  async findSimilarNPCs(
    db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    // This would require pgvector extension in production
    // For now, we'll return a mock implementation
    const npcs = await db.query.npcs.findMany({
      where: sql`${schema.npcs.projectId} = ${projectId}`,
      limit: 50,
    })

    const similar: SimilarContent[] = []

    for (const npc of npcs) {
      // In production, you'd have stored embeddings and use pgvector
      // For now, we'll do a simple text match simulation
      if (npc.description) {
        const npcEmbedding = await this.embedText(npc.description)
        const similarity = this.cosineSimilarity(embedding, npcEmbedding)

        if (similarity >= threshold) {
          similar.push({
            id: npc.id,
            type: 'npc',
            content: npc.description,
            similarity,
            metadata: {
              name: npc.name,
              title: npc.title,
            },
          })
        }
      }
    }

    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  /**
   * Find similar lore entries
   */
  async findSimilarLore(
    db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const lore = await db.query.loreEntries.findMany({
      where: sql`${schema.loreEntries.projectId} = ${projectId}`,
      limit: 50,
    })

    const similar: SimilarContent[] = []

    for (const entry of lore) {
      if (entry.content) {
        const loreEmbedding = await this.embedText(entry.content)
        const similarity = this.cosineSimilarity(embedding, loreEmbedding)

        if (similarity >= threshold) {
          similar.push({
            id: entry.id,
            type: 'lore',
            content: entry.content,
            similarity,
            metadata: {
              title: entry.title,
              category: entry.category,
            },
          })
        }
      }
    }

    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  /**
   * Find similar quests
   */
  async findSimilarQuests(
    db: PostgresJsDatabase<typeof schema>,
    embedding: number[],
    projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const quests = await db.query.quests.findMany({
      where: sql`${schema.quests.projectId} = ${projectId}`,
      limit: 50,
    })

    const similar: SimilarContent[] = []

    for (const quest of quests) {
      if (quest.description) {
        const questEmbedding = await this.embedText(quest.description)
        const similarity = this.cosineSimilarity(embedding, questEmbedding)

        if (similarity >= threshold) {
          similar.push({
            id: quest.id,
            type: 'quest',
            content: quest.description,
            similarity,
            metadata: {
              name: quest.name,
              difficulty: quest.difficulty,
            },
          })
        }
      }
    }

    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  /**
   * Find similar content across all types
   */
  async findSimilar(
    db: PostgresJsDatabase<typeof schema>,
    text: string,
    projectId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SimilarContent[]> {
    const embedding = await this.embedText(text)

    const [npcs, lore, quests] = await Promise.all([
      this.findSimilarNPCs(db, embedding, projectId, threshold, limit),
      this.findSimilarLore(db, embedding, projectId, threshold, limit),
      this.findSimilarQuests(db, embedding, projectId, threshold, limit),
    ])

    const all = [...npcs, ...lore, ...quests]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return all
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService()
