/**
 * Manifest Service - Query game data for AI context building
 *
 * Provides access to game manifests (items, NPCs, music, biomes, etc.)
 * for AI services to build context-aware content generation.
 */

import { db } from '@/database/db'
import { previewManifests } from '@/database/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { ContentEmbedderService } from './content-embedder.service'

export interface ManifestItem {
  id: string
  name: string
  [key: string]: unknown
}

export interface ItemManifestData extends ManifestItem {
  type: string
  stats?: {
    attack?: number
    defense?: number
    strength?: number
  }
  bonuses?: {
    attack?: number
    strength?: number
    defense?: number
    ranged?: number
  }
  requirements?: {
    level?: number
    skills?: Record<string, number>
  }
  value?: number
  rarity?: string
  equipSlot?: string
  weaponType?: string
  modelPath?: string
  iconPath?: string
}

export class ManifestService {
  /**
   * Get global manifest by type
   * Returns the latest version of the global manifest (userId=null, teamId=null)
   */
  async getGlobalManifest(manifestType: string): Promise<ManifestItem[] | null> {
    const manifest = await db.query.previewManifests.findFirst({
      where: and(
        eq(previewManifests.manifestType, manifestType),
        isNull(previewManifests.userId),
        isNull(previewManifests.teamId)
      ),
      orderBy: (manifests, { desc }) => [desc(manifests.version)],
    })

    if (!manifest) {
      return null
    }

    return (Array.isArray(manifest.content) ? manifest.content : [manifest.content]) as ManifestItem[]
  }

  /**
   * Get all items from items manifest
   * Useful for AI to understand available items, their stats, requirements
   */
  async getAllItems(): Promise<ItemManifestData[]> {
    const items = await this.getGlobalManifest('items')
    return (items || []) as ItemManifestData[]
  }

  /**
   * Get item by ID
   * AI can use this to validate item references and get exact stats
   */
  async getItemById(itemId: string): Promise<ItemManifestData | null> {
    const items = await this.getAllItems()
    return items.find((item) => item.id === itemId) || null
  }

  /**
   * Get items by type (weapon, tool, resource, etc.)
   */
  async getItemsByType(type: string): Promise<ItemManifestData[]> {
    const items = await this.getAllItems()
    return items.filter((item) => item.type === type)
  }

  /**
   * Get all NPCs/characters
   */
  async getAllNPCs(): Promise<ManifestItem[]> {
    const npcs = await this.getGlobalManifest('npcs')
    return npcs || []
  }

  /**
   * Get all music tracks
   */
  async getAllMusic(): Promise<ManifestItem[]> {
    const music = await this.getGlobalManifest('music')
    return music || []
  }

  /**
   * Get all biomes
   */
  async getAllBiomes(): Promise<ManifestItem[]> {
    const biomes = await this.getGlobalManifest('biomes')
    return biomes || []
  }

  /**
   * Get all zones
   */
  async getAllZones(): Promise<ManifestItem[]> {
    const zones = await this.getGlobalManifest('zones')
    return zones || []
  }

  /**
   * Get AI context string for item generation
   * Returns formatted context string with existing item data
   */
  async getItemGenerationContext(): Promise<string> {
    const items = await this.getAllItems()

    if (items.length === 0) {
      return 'No item data available in manifests.'
    }

    const context = [
      '=== GAME ITEM CONTEXT ===',
      '',
      `Available item types: ${[...new Set(items.map((i) => i.type))].join(', ')}`,
      `Total items in game: ${items.length}`,
      '',
      '=== SAMPLE ITEMS ===',
      '',
    ]

    // Show first 3 items as examples
    items.slice(0, 3).forEach((item) => {
      context.push(`Item: ${item.name} (${item.id})`)
      context.push(`  Type: ${item.type}`)
      context.push(`  Rarity: ${item.rarity || 'common'}`)
      context.push(`  Value: ${item.value || 0} coins`)

      if (item.requirements) {
        context.push(`  Requirements: Level ${item.requirements.level || 1}`)
        if (item.requirements.skills) {
          Object.entries(item.requirements.skills).forEach(([skill, level]) => {
            context.push(`    - ${skill}: ${level}`)
          })
        }
      }

      if (item.bonuses) {
        context.push('  Bonuses:')
        Object.entries(item.bonuses).forEach(([stat, value]) => {
          if (value && value > 0) {
            context.push(`    - ${stat}: +${value}`)
          }
        })
      }

      context.push('')
    })

    context.push('=== GUIDELINES ===')
    context.push('- Use existing item IDs as references')
    context.push('- Match stat bonuses to item tier/rarity')
    context.push('- Respect skill requirements progression')
    context.push('- Keep naming conventions consistent')

    return context.join('\n')
  }

  /**
   * Validate if an item ID exists in manifests
   */
  async validateItemId(itemId: string): Promise<boolean> {
    const item = await this.getItemById(itemId)
    return item !== null
  }

  /**
   * Get all available manifest types
   */
  async getAvailableManifestTypes(): Promise<string[]> {
    const manifests = await db.query.previewManifests.findMany({
      where: and(
        isNull(previewManifests.userId),
        isNull(previewManifests.teamId)
      ),
      columns: {
        manifestType: true,
      },
    })

    return [...new Set(manifests.map((m) => m.manifestType))]
  }

  // =============================================================================
  // Semantic Search Methods (using Qdrant)
  // =============================================================================

  private contentEmbedder: ContentEmbedderService | null = null

  /**
   * Get or create content embedder instance
   */
  private getEmbedder(): ContentEmbedderService {
    if (!this.contentEmbedder) {
      this.contentEmbedder = new ContentEmbedderService()
    }
    return this.contentEmbedder
  }

  /**
   * Find similar items using semantic search
   * Example: "powerful weapon" → finds mithril sword even without exact keyword match
   */
  async findSimilarItems(query: string, limit: number = 5): Promise<ItemManifestData[]> {
    const embedder = this.getEmbedder()

    const results = await embedder.findSimilar(query, {
      contentType: 'item',
      limit,
      threshold: 0.6,
    })

    // Map back to items from manifest
    const itemIds = results.map((r) => r.contentId)
    const items = await this.getAllItems()

    return items.filter((item) => itemIds.includes(item.id))
  }

  /**
   * Find similar content across all manifest types
   * Example: "forest" → finds forest biomes, forest music, forest zones
   */
  async findSimilarContent(query: string, limit: number = 10): Promise<ManifestItem[]> {
    const embedder = this.getEmbedder()

    const results = await embedder.findSimilar(query, {
      contentType: null, // Search across all types
      limit,
      threshold: 0.6,
    })

    return results.map((r) => ({
      id: r.contentId,
      name: r.contentId,
      content: r.content,
      type: r.contentType,
      similarity: r.similarity,
    }))
  }

  /**
   * Build AI context for item generation
   * Uses semantic search to find relevant existing items
   */
  async getItemGenerationContextSemantic(query: string): Promise<string> {
    const embedder = this.getEmbedder()

    const context = await embedder.buildContext(query, {
      contentType: 'item',
      limit: 5,
      threshold: 0.7,
    })

    if (!context.hasContext) {
      // Fallback to traditional context
      return this.getItemGenerationContext()
    }

    const header = [
      '=== AI ITEM GENERATION CONTEXT ===',
      '',
      `Query: "${query}"`,
      `Found ${context.sources.length} similar items:`,
      '',
    ]

    const footer = [
      '',
      '=== GUIDELINES ===',
      '- Match the stat progression of similar items',
      '- Use appropriate requirements for the tier',
      '- Maintain naming conventions',
      '- Ensure balance with existing items',
    ]

    return [...header, context.context, ...footer].join('\n')
  }

  /**
   * Validate item generation using semantic similarity
   * Checks if generated item is too similar to existing items (potential duplicate)
   */
  async validateGeneratedItem(
    itemData: ItemManifestData
  ): Promise<{ valid: boolean; reason?: string; similarItems?: string[] }> {
    const embedder = this.getEmbedder()

    // Create searchable text from item data
    const itemText = `${itemData.name}\n${itemData.type}\nAttack: ${itemData.bonuses?.attack || 0}\nLevel: ${itemData.requirements?.level || 1}`

    const results = await embedder.findSimilar(itemText, {
      contentType: 'item',
      limit: 3,
      threshold: 0.9, // Very high threshold for duplicate detection
    })

    if (results.length > 0 && results[0]!.similarity > 0.95) {
      return {
        valid: false,
        reason: 'Item is too similar to existing items (possible duplicate)',
        similarItems: results.map((r) => r.contentId),
      }
    }

    return { valid: true }
  }

  /**
   * Get contextually appropriate items for a given scenario
   * Example: "level 10 warrior" → returns steel tier weapons/armor
   */
  async getContextualItems(scenario: string, limit: number = 5): Promise<ItemManifestData[]> {
    return this.findSimilarItems(scenario, limit)
  }

  /**
   * Find items by semantic description instead of exact attributes
   * Example: "healing consumable" instead of filtering by type='potion' AND healAmount > 0
   */
  async findItemsByDescription(description: string): Promise<ItemManifestData[]> {
    return this.findSimilarItems(description, 10)
  }
}

export const manifestService = new ManifestService()
