import { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { loreEntries } from '../database/schema'

// =====================================================
// LORE TIMELINE TYPES
// =====================================================

export interface TimelineNode {
  id: string
  title: string
  era: string | null
  timelinePosition: number | null
  importanceLevel: number
  category: string | null
  summary: string | null
  relatedCharacters: string[]
  relatedLocations: string[]
  relatedEvents: string[]
}

export interface RelatedContent {
  characters: Array<{
    id: string
    title: string
  }>
  locations: Array<{
    id: string
    title: string
  }>
  events: Array<{
    id: string
    title: string
  }>
}

// =====================================================
// TIMELINE BUILDER
// =====================================================

/**
 * Build a timeline from lore entries
 * Sorts by timeline position and filters entries with valid positions
 */
export function buildTimeline(entries: Array<{
  id: string
  title: string
  era: string | null
  timelinePosition: number | null
  importanceLevel: number
  category: string | null
  summary: string | null
  relatedCharacters: string[]
  relatedLocations: string[]
  relatedEvents: string[]
}>): TimelineNode[] {
  // Filter entries that have timeline positions
  const timelineEntries = entries.filter(e => e.timelinePosition !== null)

  // Sort by timeline position (ascending)
  const sorted = timelineEntries.sort((a, b) => {
    const posA = a.timelinePosition ?? 0
    const posB = b.timelinePosition ?? 0
    return posA - posB
  })

  return sorted.map(entry => ({
    id: entry.id,
    title: entry.title,
    era: entry.era,
    timelinePosition: entry.timelinePosition,
    importanceLevel: entry.importanceLevel,
    category: entry.category,
    summary: entry.summary,
    relatedCharacters: entry.relatedCharacters,
    relatedLocations: entry.relatedLocations,
    relatedEvents: entry.relatedEvents,
  }))
}

// =====================================================
// RELATED CONTENT FINDER
// =====================================================

/**
 * Find all related content (characters, locations, events) for a lore entry
 * Returns actual lore entries that are referenced
 */
export async function findRelatedContent(
  fastify: FastifyInstance,
  entryId: string,
  projectId: string
): Promise<RelatedContent> {
  // Get the source entry
  const entry = await fastify.db.query.loreEntries.findFirst({
    where: and(
      eq(loreEntries.id, entryId),
      eq(loreEntries.projectId, projectId)
    )
  })

  if (!entry) {
    return {
      characters: [],
      locations: [],
      events: [],
    }
  }

  // Collect all related IDs
  const characterIds = entry.relatedCharacters || []
  const locationIds = entry.relatedLocations || []
  const eventIds = entry.relatedEvents || []
  const allRelatedIds = [...characterIds, ...locationIds, ...eventIds]

  if (allRelatedIds.length === 0) {
    return {
      characters: [],
      locations: [],
      events: [],
    }
  }

  // Fetch all related entries in one query
  const relatedEntries = await fastify.db.query.loreEntries.findMany({
    where: and(
      inArray(loreEntries.id, allRelatedIds),
      eq(loreEntries.projectId, projectId)
    ),
    columns: {
      id: true,
      title: true,
    }
  })

  // Create a map for quick lookup
  const entriesMap = new Map(relatedEntries.map(e => [e.id, e]))

  // Build response
  return {
    characters: characterIds
      .map(id => entriesMap.get(id))
      .filter((e): e is { id: string; title: string } => e !== undefined),
    locations: locationIds
      .map(id => entriesMap.get(id))
      .filter((e): e is { id: string; title: string } => e !== undefined),
    events: eventIds
      .map(id => entriesMap.get(id))
      .filter((e): e is { id: string; title: string } => e !== undefined),
  }
}
