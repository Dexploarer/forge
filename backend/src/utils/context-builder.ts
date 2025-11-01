/**
 * Context Builder
 * Provides manifest-aware context for AI content generation
 *
 * Production implementation with database integration, caching, and proper error handling.
 * Loads game data from PostgreSQL database to build rich context for AI generation.
 */

import { db } from '../database/db'
import { npcs, quests, loreEntries, previewManifests } from '../database/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'

// =====================================================
// TYPES
// =====================================================

export interface QuestContextParams {
  difficulty?: string
  questType?: string
  existingQuests?: any[]
  selectedContext?: any
  relationships?: any[]
  projectId?: string
  userId?: string
  minLevel?: number
  maxLevel?: number
}

export interface NPCContextParams {
  archetype?: string
  generatedNPCs?: any[]
  availableQuests?: any[]
  relationships?: any[]
  lore?: any[]
  projectId?: string
  userId?: string
  location?: string
}

export interface ContextResult {
  context: any
  formatted: string
}

interface TierDefinition {
  name: string
  material: string
  levelRange: { min: number; max: number }
  description?: string
}

// =====================================================
// TIER DEFINITIONS
// =====================================================

const MATERIAL_TIERS: TierDefinition[] = [
  { name: 'Bronze', material: 'bronze', levelRange: { min: 1, max: 10 }, description: 'Starter tier' },
  { name: 'Iron', material: 'iron', levelRange: { min: 11, max: 20 }, description: 'Early game tier' },
  { name: 'Steel', material: 'steel', levelRange: { min: 21, max: 30 }, description: 'Mid game tier' },
  { name: 'Mithril', material: 'mithril', levelRange: { min: 31, max: 40 }, description: 'Advanced tier' },
  { name: 'Adamantite', material: 'adamantite', levelRange: { min: 41, max: 50 }, description: 'High tier' },
  { name: 'Rune', material: 'rune', levelRange: { min: 51, max: 60 }, description: 'Expert tier' },
  { name: 'Dragon', material: 'dragon', levelRange: { min: 61, max: 70 }, description: 'Elite tier' },
  { name: 'Mythic', material: 'mythic', levelRange: { min: 71, max: 100 }, description: 'Legendary tier' },
]

// =====================================================
// CACHE MANAGEMENT
// =====================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const manifestCache = new Map<string, CacheEntry<any>>()

function getCachedData<T>(key: string): T | null {
  const cached = manifestCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    manifestCache.delete(key)
    return null
  }

  return cached.data as T
}

function setCachedData<T>(key: string, data: T): void {
  manifestCache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

export function clearContextCache(): void {
  manifestCache.clear()
  console.log('[ContextBuilder] Cache cleared')
}

// =====================================================
// DATA LOADERS
// =====================================================

/**
 * Load preview manifest data for items, resources, mobs, etc.
 */
async function loadPreviewManifests(userId?: string, manifestType?: string): Promise<any[]> {
  try {
    const cacheKey = `preview:${userId}:${manifestType}`
    const cached = getCachedData<any[]>(cacheKey)
    if (cached) return cached

    const conditions = []
    if (userId) conditions.push(eq(previewManifests.userId, userId))
    if (manifestType) conditions.push(eq(previewManifests.manifestType, manifestType))

    const results = await db
      .select()
      .from(previewManifests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(previewManifests.updatedAt))
      .limit(100)

    const manifestData = results.flatMap(r => (Array.isArray(r.content) ? r.content : []))
    setCachedData(cacheKey, manifestData)
    return manifestData
  } catch (error) {
    console.warn('[ContextBuilder] Failed to load preview manifests:', error)
    return []
  }
}

/**
 * Load NPCs from database
 */
async function loadNPCs(projectId?: string, location?: string): Promise<any[]> {
  try {
    const cacheKey = `npcs:${projectId}:${location}`
    const cached = getCachedData<any[]>(cacheKey)
    if (cached) return cached

    const conditions = [eq(npcs.status, 'active')]
    if (projectId) conditions.push(eq(npcs.projectId, projectId))
    if (location) conditions.push(eq(npcs.location, location))

    const results = await db
      .select({
        id: npcs.id,
        name: npcs.name,
        title: npcs.title,
        description: npcs.description,
        race: npcs.race,
        class: npcs.class,
        level: npcs.level,
        faction: npcs.faction,
        behavior: npcs.behavior,
        location: npcs.location,
        personality: npcs.personality,
        backstory: npcs.backstory,
        questIds: npcs.questIds,
      })
      .from(npcs)
      .where(and(...conditions))
      .orderBy(desc(npcs.createdAt))
      .limit(100)

    setCachedData(cacheKey, results)
    return results
  } catch (error) {
    console.warn('[ContextBuilder] Failed to load NPCs:', error)
    return []
  }
}

/**
 * Load quests from database
 */
async function loadQuests(projectId?: string, minLevel?: number, maxLevel?: number): Promise<any[]> {
  try {
    const cacheKey = `quests:${projectId}:${minLevel}:${maxLevel}`
    const cached = getCachedData<any[]>(cacheKey)
    if (cached) return cached

    const conditions = [eq(quests.status, 'active')]
    if (projectId) conditions.push(eq(quests.projectId, projectId))
    if (minLevel !== undefined) conditions.push(gte(quests.minLevel, minLevel))
    if (maxLevel !== undefined) conditions.push(lte(quests.minLevel, maxLevel))

    const results = await db
      .select({
        id: quests.id,
        name: quests.name,
        description: quests.description,
        questType: quests.questType,
        difficulty: quests.difficulty,
        minLevel: quests.minLevel,
        maxLevel: quests.maxLevel,
        objectives: quests.objectives,
        rewards: quests.rewards,
        location: quests.location,
      })
      .from(quests)
      .where(and(...conditions))
      .orderBy(desc(quests.createdAt))
      .limit(100)

    setCachedData(cacheKey, results)
    return results
  } catch (error) {
    console.warn('[ContextBuilder] Failed to load quests:', error)
    return []
  }
}

/**
 * Load lore entries from database
 */
async function loadLoreEntries(projectId?: string, category?: string): Promise<any[]> {
  try {
    const cacheKey = `lore:${projectId}:${category}`
    const cached = getCachedData<any[]>(cacheKey)
    if (cached) return cached

    const conditions = [eq(loreEntries.status, 'published')]
    if (projectId) conditions.push(eq(loreEntries.projectId, projectId))
    if (category) conditions.push(eq(loreEntries.category, category))

    const results = await db
      .select({
        id: loreEntries.id,
        title: loreEntries.title,
        content: loreEntries.content,
        summary: loreEntries.summary,
        category: loreEntries.category,
        era: loreEntries.era,
        region: loreEntries.region,
        importanceLevel: loreEntries.importanceLevel,
      })
      .from(loreEntries)
      .where(and(...conditions))
      .orderBy(desc(loreEntries.importanceLevel), desc(loreEntries.createdAt))
      .limit(50)

    setCachedData(cacheKey, results)
    return results
  } catch (error) {
    console.warn('[ContextBuilder] Failed to load lore entries:', error)
    return []
  }
}

/**
 * Get tier definition by difficulty or level
 */
function getTierByDifficulty(difficulty?: string, level?: number): TierDefinition {
  if (level !== undefined) {
    return MATERIAL_TIERS.find(t => level >= t.levelRange.min && level <= t.levelRange.max) || MATERIAL_TIERS[0]!
  }

  const difficultyMap: Record<string, number> = {
    easy: 0,
    medium: 2,
    hard: 4,
    expert: 6,
    legendary: 7,
  }

  const tierIndex = difficultyMap[difficulty?.toLowerCase() || 'medium'] || 0
  return MATERIAL_TIERS[Math.min(tierIndex, MATERIAL_TIERS.length - 1)]!
}

// =====================================================
// CONTEXT BUILDERS
// =====================================================

/**
 * Build quest generation context with tier-appropriate content
 */
export async function buildQuestContext(params: QuestContextParams): Promise<ContextResult> {
  try {
    // Determine tier based on difficulty or level
    const tier = getTierByDifficulty(params.difficulty, params.minLevel)

    // Load data from database and manifests
    const [existingNPCs, existingQuests, items, lore] = await Promise.all([
      loadNPCs(params.projectId),
      loadQuests(params.projectId, tier.levelRange.min, tier.levelRange.max),
      loadPreviewManifests(params.userId, 'items'),
      loadLoreEntries(params.projectId),
    ])

    // Load mobs/enemies and resources from preview manifests
    const [mobs, resources] = await Promise.all([
      loadPreviewManifests(params.userId, 'npcs').then(data =>
        data.filter((npc: any) => npc.behavior === 'hostile' || npc.type === 'mob')
      ),
      loadPreviewManifests(params.userId, 'resources'),
    ])

    // Filter items by tier if available
    const tierItems = items.filter((item: any) => {
      if (!item.level && !item.tier) return true
      const itemLevel = item.level || 1
      return itemLevel >= tier.levelRange.min && itemLevel <= tier.levelRange.max
    })

    // Build formatted context string
    const formatted = `
WORLD CONTEXT FOR QUEST GENERATION:

TIER INFORMATION:
- Material Tier: ${tier.name} (${tier.material})
- Level Range: ${tier.levelRange.min}-${tier.levelRange.max}
- Description: ${tier.description}

AVAILABLE ITEMS (${tierItems.length} items):
${tierItems.slice(0, 20).map((item: any) => `- ${item.name || item.id}${item.description ? `: ${item.description.slice(0, 60)}` : ''}`).join('\n')}
${tierItems.length > 20 ? `... and ${tierItems.length - 20} more items` : ''}

AVAILABLE MOBS/ENEMIES (${mobs.length} mobs):
${mobs.slice(0, 15).map((mob: any) => `- ${mob.name || mob.id} (Level ${mob.level || '?'})`).join('\n')}
${mobs.length > 15 ? `... and ${mobs.length - 15} more mobs` : ''}

AVAILABLE RESOURCES (${resources.length} resources):
${resources.slice(0, 15).map((res: any) => `- ${res.name || res.id}`).join('\n')}
${resources.length > 15 ? `... and ${resources.length - 15} more resources` : ''}

EXISTING NPCS (${existingNPCs.length} NPCs):
${existingNPCs.slice(0, 10).map(npc => `- ${npc.name}${npc.title ? ` (${npc.title})` : ''} - ${npc.behavior} ${npc.class || ''}`).join('\n')}
${existingNPCs.length > 10 ? `... and ${existingNPCs.length - 10} more NPCs` : ''}

EXISTING QUESTS (${existingQuests.length} quests):
${existingQuests.slice(0, 10).map(q => `- ${q.name} (${q.questType}, ${q.difficulty})`).join('\n')}
${existingQuests.length > 10 ? `... and ${existingQuests.length - 10} more quests` : ''}

LORE CONTEXT (${lore.length} entries):
${lore.slice(0, 5).map(l => `- ${l.title}: ${l.summary || l.content.slice(0, 100)}`).join('\n')}
${lore.length > 5 ? `... and ${lore.length - 5} more lore entries` : ''}

GENERATION GUIDELINES:
- Create quests appropriate for ${tier.name} tier (level ${tier.levelRange.min}-${tier.levelRange.max})
- Use items, mobs, and resources from the available lists above
- Reference existing NPCs when creating quest givers
- Ensure quest objectives align with the tier difficulty
- Avoid duplicating existing quest concepts
`.trim()

    return {
      context: {
        availableItems: tierItems,
        availableMobs: mobs,
        availableResources: resources,
        existingNPCs,
        existingQuests: [...existingQuests, ...(params.existingQuests || [])],
        lore,
        tier,
      },
      formatted,
    }
  } catch (error) {
    console.error('[ContextBuilder] Failed to build quest context:', error)

    // Return minimal fallback context on error
    const tier = getTierByDifficulty(params.difficulty)
    return {
      context: {
        availableItems: [],
        availableMobs: [],
        availableResources: [],
        existingNPCs: [],
        existingQuests: params.existingQuests || [],
        lore: [],
        tier,
      },
      formatted: `WORLD CONTEXT: Error loading manifest data. Using ${tier.name} tier defaults.\n`,
    }
  }
}

/**
 * Build NPC generation context with existing world data
 */
export async function buildNPCContext(params: NPCContextParams): Promise<ContextResult> {
  try {
    // Load data from database
    const [existingNPCs, availableQuests, lore] = await Promise.all([
      loadNPCs(params.projectId, params.location),
      loadQuests(params.projectId),
      loadLoreEntries(params.projectId),
    ])

    // Combine with runtime-generated NPCs
    const allNPCs = [...existingNPCs, ...(params.generatedNPCs || [])]
    const allQuests = [...availableQuests, ...(params.availableQuests || [])]
    const allLore = [...lore, ...(params.lore || [])]

    // Build formatted context string
    const formatted = `
WORLD CONTEXT FOR NPC GENERATION:

EXISTING NPCS (${allNPCs.length} NPCs):
${allNPCs.slice(0, 15).map(npc => {
  const details = []
  if (npc.title) details.push(npc.title)
  if (npc.race) details.push(npc.race)
  if (npc.class) details.push(npc.class)
  if (npc.level) details.push(`Level ${npc.level}`)
  if (npc.faction) details.push(`Faction: ${npc.faction}`)
  return `- ${npc.name}${details.length > 0 ? ` (${details.join(', ')})` : ''}`
}).join('\n')}
${allNPCs.length > 15 ? `... and ${allNPCs.length - 15} more NPCs` : ''}

AVAILABLE QUESTS (${allQuests.length} quests):
${allQuests.slice(0, 10).map(q => `- ${q.name} (${q.questType}, ${q.difficulty}, Level ${q.minLevel}-${q.maxLevel || q.minLevel})`).join('\n')}
${allQuests.length > 10 ? `... and ${allQuests.length - 10} more quests` : ''}

NPC RELATIONSHIPS:
${params.relationships && params.relationships.length > 0
  ? params.relationships.map((rel: any) => `- ${rel.from} → ${rel.to}: ${rel.type}`).join('\n')
  : 'No predefined relationships'}

LORE CONTEXT (${allLore.length} entries):
${allLore.slice(0, 8).map(l => `- [${l.category || 'General'}] ${l.title}${l.era ? ` (${l.era})` : ''}`).join('\n')}
${allLore.length > 8 ? `... and ${allLore.length - 8} more lore entries` : ''}

GENERATION GUIDELINES:
- Create NPCs that fit within the existing world lore and context
- Reference existing NPCs to establish relationships and connections
- Consider quest availability when creating quest givers
- Ensure NPC behavior and personality align with their role
- Use faction information to create coherent social structures
${params.location ? `- NPCs should be appropriate for location: ${params.location}` : ''}
${params.archetype ? `- Focus on archetype: ${params.archetype}` : ''}
`.trim()

    return {
      context: {
        existingNPCs,
        generatedNPCs: params.generatedNPCs || [],
        availableQuests: allQuests,
        relationships: params.relationships || [],
        lore: allLore,
      },
      formatted,
    }
  } catch (error) {
    console.error('[ContextBuilder] Failed to build NPC context:', error)

    return {
      context: {
        existingNPCs: [],
        generatedNPCs: params.generatedNPCs || [],
        availableQuests: params.availableQuests || [],
        relationships: params.relationships || [],
        lore: params.lore || [],
      },
      formatted: `WORLD CONTEXT: Error loading NPC context data.\n`,
    }
  }
}

/**
 * Build full world context for general use
 */
export async function buildFullContext(params: {
  projectId?: string
  userId?: string
  includeStats?: boolean
} = {}): Promise<string> {
  try {
    // Load all available data
    const [allNPCs, allQuests, allLore] = await Promise.all([
      loadNPCs(params.projectId),
      loadQuests(params.projectId),
      loadLoreEntries(params.projectId),
    ])

    // Load manifest data
    const [items, resources, mobs] = await Promise.all([
      loadPreviewManifests(params.userId, 'items'),
      loadPreviewManifests(params.userId, 'resources'),
      loadPreviewManifests(params.userId, 'npcs').then(data =>
        data.filter((npc: any) => npc.behavior === 'hostile' || npc.type === 'mob')
      ),
    ])

    const formatted = `
COMPLETE WORLD CONTEXT:

GAME DATA SUMMARY:
- NPCs: ${allNPCs.length} characters
- Quests: ${allQuests.length} quests
- Lore Entries: ${allLore.length} entries
- Items: ${items.length} items
- Resources: ${resources.length} resources
- Mobs/Enemies: ${mobs.length} mobs

MATERIAL TIERS:
${MATERIAL_TIERS.map(t => `- ${t.name}: Level ${t.levelRange.min}-${t.levelRange.max} (${t.material})`).join('\n')}

${params.includeStats ? `
NPC DISTRIBUTION:
${allNPCs.reduce((acc: Record<string, number>, npc) => {
  const key = npc.behavior || 'unknown'
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {} as Record<string, number>)}

QUEST TYPES:
${allQuests.reduce((acc: Record<string, number>, quest) => {
  const key = quest.questType || 'unknown'
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {} as Record<string, number>)}
` : ''}

This context provides a comprehensive overview of the game world data available for AI generation tasks.
`.trim()

    return formatted
  } catch (error) {
    console.error('[ContextBuilder] Failed to build full context:', error)
    return 'WORLD CONTEXT: Error loading game data.\n'
  }
}
