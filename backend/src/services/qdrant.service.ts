import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env';

/**
 * Content Types for Qdrant Collections
 */
export const CONTENT_TYPES = {
  ASSET: 'asset',
  LORE: 'lore',
  QUEST: 'quest',
  NPC: 'npc',
  MANIFEST: 'manifest',
  ITEM: 'item',
  CHARACTER: 'character',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

/**
 * Embedding Models
 */
export const EMBEDDING_MODELS = {
  TEXT_EMBEDDING_3_SMALL: 'text-embedding-3-small',
  TEXT_EMBEDDING_3_LARGE: 'text-embedding-3-large',
  TEXT_EMBEDDING_ADA_002: 'text-embedding-ada-002',
} as const;

export type EmbeddingModel = typeof EMBEDDING_MODELS[keyof typeof EMBEDDING_MODELS];

/**
 * Payload structure stored with each vector
 */
export interface VectorPayload extends Record<string, unknown> {
  contentId: string;
  contentType: ContentType;
  embeddingModel: EmbeddingModel;
  embeddingDimensions: number;
  sourceText: string;
  metadata: Record<string, any> | undefined;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search result from Qdrant
 */
export interface SearchResult {
  id: string;
  score: number;
  payload: VectorPayload;
}

/**
 * Qdrant Service
 *
 * Manages vector embeddings using Qdrant vector database.
 * Replaces PostgreSQL pgvector implementation with dedicated vector store.
 */
export class QdrantService {
  private client: QdrantClient;
  private readonly collectionPrefix = 'content_';
  private readonly vectorSize: number;
  private readonly distance = 'Cosine';

  constructor(vectorSize: number = 1536) {
    this.vectorSize = vectorSize;

    // Auto-construct Qdrant URL if not explicitly set
    // Railway provides QDRANT_PRIVATE_DOMAIN and QDRANT_PORT separately
    let qdrantUrl = env.QDRANT_URL

    if (!qdrantUrl && env.QDRANT_PRIVATE_DOMAIN) {
      // Railway environment: construct URL from parts
      const host = env.QDRANT_PRIVATE_DOMAIN
      const port = env.QDRANT_PORT || 6333
      qdrantUrl = `http://${host}:${port}`
      console.log('[QdrantService] Auto-constructed Qdrant URL from Railway variables:', qdrantUrl)
    }

    if (!qdrantUrl) {
      // Fallback to localhost for local development
      qdrantUrl = 'http://localhost:6333'
    }

    // Initialize Qdrant client
    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey: env.QDRANT_API_KEY || '',
    });

    console.log('[QdrantService] Initialized', {
      url: qdrantUrl,
      vectorSize: this.vectorSize,
      distance: this.distance,
    });
  }

  /**
   * Get collection name for content type
   */
  private getCollectionName(contentType: ContentType): string {
    return `${this.collectionPrefix}${contentType}`;
  }

  /**
   * Initialize all collections for content types
   */
  async initializeCollections(): Promise<void> {
    const contentTypes = Object.values(CONTENT_TYPES);

    for (const contentType of contentTypes) {
      const collectionName = this.getCollectionName(contentType);

      try {
        // Check if collection exists
        const exists = await this.collectionExists(collectionName);

        if (!exists) {
          // Create collection with cosine distance
          await this.client.createCollection(collectionName, {
            vectors: {
              size: this.vectorSize,
              distance: this.distance,
            },
            // Enable HNSW index for fast similarity search
            hnsw_config: {
              m: 16,
              ef_construct: 100,
            },
            // Enable payload indexing for filtering
            optimizers_config: {
              default_segment_number: 2,
            },
          });

          console.log(`[QdrantService] Created Qdrant collection: ${collectionName}`);
        } else {
          console.log(`[QdrantService] Qdrant collection already exists: ${collectionName}`);
        }

        // Create payload indexes for efficient filtering
        await this.createPayloadIndexes(collectionName);
      } catch (error) {
        console.error(`[QdrantService] Failed to initialize collection: ${collectionName}`, error);
        throw error;
      }
    }
  }

  /**
   * Check if collection exists
   */
  private async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.client.getCollection(collectionName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create payload indexes for filtering
   */
  private async createPayloadIndexes(collectionName: string): Promise<void> {
    const indexes = [
      { field: 'contentId', type: 'keyword' as const },
      { field: 'contentType', type: 'keyword' as const },
      { field: 'embeddingModel', type: 'keyword' as const },
      { field: 'createdAt', type: 'datetime' as const },
      { field: 'updatedAt', type: 'datetime' as const },
    ];

    for (const index of indexes) {
      try {
        await this.client.createPayloadIndex(collectionName, {
          field_name: index.field,
          field_schema: index.type,
        });
      } catch (error) {
        // Index might already exist, log but don't fail
        // Index might already exist, ignore error
      }
    }
  }

  /**
   * Upsert a single vector embedding
   */
  async upsert(params: {
    contentType: ContentType;
    contentId: string;
    embedding: number[];
    sourceText: string;
    embeddingModel: EmbeddingModel;
    embeddingDimensions: number;
    metadata: Record<string, any> | undefined;
  }): Promise<void> {
    const collectionName = this.getCollectionName(params.contentType);
    const now = new Date().toISOString();

    // Generate point ID from contentId for idempotency
    const pointId = this.generatePointId(params.contentId);

    const payload: VectorPayload = {
      contentId: params.contentId,
      contentType: params.contentType,
      embeddingModel: params.embeddingModel,
      embeddingDimensions: params.embeddingDimensions,
      sourceText: params.sourceText,
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: params.embedding,
            payload,
          },
        ],
      });

      // Successfully upserted vector
    } catch (error) {
      console.error('[QdrantService] Failed to upsert vector to Qdrant', {
        collection: collectionName,
        contentId: params.contentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Batch upsert multiple vectors
   */
  async batchUpsert(params: {
    contentType: ContentType;
    points: Array<{
      contentId: string;
      embedding: number[];
      sourceText: string;
      embeddingModel: EmbeddingModel;
      embeddingDimensions: number;
      metadata: Record<string, any> | undefined;
    }>;
  }): Promise<void> {
    const collectionName = this.getCollectionName(params.contentType);
    const now = new Date().toISOString();

    const points = params.points.map((point) => ({
      id: this.generatePointId(point.contentId),
      vector: point.embedding,
      payload: {
        contentId: point.contentId,
        contentType: params.contentType,
        embeddingModel: point.embeddingModel,
        embeddingDimensions: point.embeddingDimensions,
        sourceText: point.sourceText,
        metadata: point.metadata,
        createdAt: now,
        updatedAt: now,
      } satisfies VectorPayload,
    }));

    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points,
      });

      console.log(`[QdrantService] Batch upserted ${points.length} vectors to ${collectionName}`);
    } catch (error) {
      console.error('[QdrantService] Failed to batch upsert vectors to Qdrant', {
        collection: collectionName,
        count: points.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(params: {
    contentType: ContentType | undefined;
    queryVector: number[];
    limit: number | undefined;
    threshold: number | undefined;
    filter: Record<string, any> | undefined;
  }): Promise<SearchResult[]> {
    const { contentType, queryVector, limit = 10, threshold = 0.0, filter } = params;

    // If contentType is specified, search in that collection only
    if (contentType) {
      const collectionName = this.getCollectionName(contentType);
      return this.searchCollection(collectionName, queryVector, limit, threshold, filter);
    }

    // Search across all collections
    const contentTypes = Object.values(CONTENT_TYPES);
    const searchPromises = contentTypes.map((type) => {
      const collectionName = this.getCollectionName(type);
      return this.searchCollection(collectionName, queryVector, limit, threshold, filter);
    });

    const allResults = await Promise.all(searchPromises);

    // Flatten and sort by score
    const flatResults = allResults.flat();
    flatResults.sort((a, b) => b.score - a.score);

    // Return top N results
    return flatResults.slice(0, limit);
  }

  /**
   * Search in a specific collection
   */
  private async searchCollection(
    collectionName: string,
    queryVector: number[],
    limit: number,
    threshold: number,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const searchResult = await this.client.search(collectionName, {
        vector: queryVector,
        limit,
        score_threshold: threshold,
        filter: filter ? this.buildFilter(filter) : undefined,
        with_payload: true,
      });

      return searchResult.map((result) => ({
        id: String(result.id),
        score: result.score,
        payload: result.payload as VectorPayload,
      }));
    } catch (error) {
      console.error('[QdrantService] Failed to search in Qdrant collection', {
        collection: collectionName,
        error,
      });
      // Return empty results on error (collection might not exist yet)
      return [];
    }
  }

  /**
   * Build Qdrant filter from simple key-value pairs
   */
  private buildFilter(filter: Record<string, any>): any {
    const must = Object.entries(filter).map(([key, value]) => ({
      key,
      match: { value },
    }));

    return { must };
  }

  /**
   * Delete a vector by content ID
   */
  async delete(params: { contentType: ContentType; contentId: string }): Promise<void> {
    const collectionName = this.getCollectionName(params.contentType);
    const pointId = this.generatePointId(params.contentId);

    try {
      await this.client.delete(collectionName, {
        wait: true,
        points: [pointId],
      });

      // Successfully deleted vector
    } catch (error) {
      console.error('[QdrantService] Failed to delete vector from Qdrant', {
        collection: collectionName,
        contentId: params.contentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(contentType: ContentType): Promise<any> {
    const collectionName = this.getCollectionName(contentType);

    try {
      return await this.client.getCollection(collectionName);
    } catch (error) {
      console.error('[QdrantService] Failed to get collection stats', {
        collection: collectionName,
        error,
      });
      throw error;
    }
  }

  /**
   * Get stats for all collections
   */
  async getAllStats(): Promise<Record<ContentType, any>> {
    const contentTypes = Object.values(CONTENT_TYPES);
    const stats: Record<string, any> = {};

    await Promise.all(
      contentTypes.map(async (type) => {
        try {
          stats[type] = await this.getCollectionStats(type);
        } catch (error) {
          stats[type] = { error: 'Collection not found or inaccessible' };
        }
      })
    );

    return stats as Record<ContentType, any>;
  }

  /**
   * Generate a deterministic point ID from content ID
   * Uses simple hash to create numeric ID
   */
  private generatePointId(contentId: string): number {
    let hash = 0;
    for (let i = 0; i < contentId.length; i++) {
      const char = contentId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Health check - verify Qdrant connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('[QdrantService] Health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();
