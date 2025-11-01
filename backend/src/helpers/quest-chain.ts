import { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { quests } from '../database/schema'

// =====================================================
// QUEST CHAIN TYPES
// =====================================================

export interface Quest {
  id: string
  name: string
  description: string
  questType: string
  difficulty: string
  minLevel: number
  maxLevel: number | null
  requirements: {
    level?: number
    previousQuests?: string[]
    items?: string[]
    reputation?: Record<string, number>
  }
  rewards: {
    experience?: number
    gold?: number
    items?: Array<{ id: string; name: string; quantity: number }>
    reputation?: Record<string, number>
  }
  repeatable: boolean
}

// =====================================================
// QUEST CHAIN BUILDER
// =====================================================

/**
 * Get the full quest chain for a given quest
 * Includes all prerequisite quests and following quests
 */
export async function getQuestChain(
  fastify: FastifyInstance,
  questId: string,
  projectId: string
): Promise<Quest[]> {
  const chain: Quest[] = []
  const visited = new Set<string>()

  // Get the initial quest
  const initialQuest = await fastify.db.query.quests.findFirst({
    where: and(
      eq(quests.id, questId),
      eq(quests.projectId, projectId)
    )
  })

  if (!initialQuest) {
    return []
  }

  // Recursively get all prerequisite quests
  await getPrerequisites(fastify, initialQuest, projectId, chain, visited)

  // Add the current quest
  if (!visited.has(initialQuest.id)) {
    chain.push(mapToQuest(initialQuest))
    visited.add(initialQuest.id)
  }

  // Get all quests that depend on this one
  await getFollowingQuests(fastify, initialQuest.id, projectId, chain, visited)

  return chain
}

/**
 * Recursively get all prerequisite quests
 */
async function getPrerequisites(
  fastify: FastifyInstance,
  quest: any,
  projectId: string,
  chain: Quest[],
  visited: Set<string>
): Promise<void> {
  const previousQuestIds = quest.requirements?.previousQuests || []

  if (previousQuestIds.length === 0) {
    return
  }

  // Fetch all prerequisite quests
  const prerequisiteQuests = await fastify.db.query.quests.findMany({
    where: and(
      inArray(quests.id, previousQuestIds),
      eq(quests.projectId, projectId)
    )
  })

  // Recursively process each prerequisite
  for (const prereq of prerequisiteQuests) {
    if (!visited.has(prereq.id)) {
      await getPrerequisites(fastify, prereq, projectId, chain, visited)
      chain.push(mapToQuest(prereq))
      visited.add(prereq.id)
    }
  }
}

/**
 * Get all quests that have this quest as a prerequisite
 */
async function getFollowingQuests(
  fastify: FastifyInstance,
  questId: string,
  projectId: string,
  chain: Quest[],
  visited: Set<string>
): Promise<void> {
  // Find all quests in the project
  const allQuests = await fastify.db.query.quests.findMany({
    where: eq(quests.projectId, projectId)
  })

  // Filter quests that have this quest as a prerequisite
  const followingQuests = allQuests.filter(q => {
    const previousQuests = q.requirements?.previousQuests || []
    return previousQuests.includes(questId) && !visited.has(q.id)
  })

  // Add following quests to chain
  for (const followingQuest of followingQuests) {
    chain.push(mapToQuest(followingQuest))
    visited.add(followingQuest.id)
    // Recursively get quests that follow this one
    await getFollowingQuests(fastify, followingQuest.id, projectId, chain, visited)
  }
}

/**
 * Map database quest to Quest interface
 */
function mapToQuest(dbQuest: any): Quest {
  return {
    id: dbQuest.id,
    name: dbQuest.name,
    description: dbQuest.description,
    questType: dbQuest.questType,
    difficulty: dbQuest.difficulty,
    minLevel: dbQuest.minLevel,
    maxLevel: dbQuest.maxLevel,
    requirements: dbQuest.requirements || {},
    rewards: dbQuest.rewards || {},
    repeatable: dbQuest.repeatable,
  }
}

// =====================================================
// QUEST REQUIREMENTS VALIDATOR
// =====================================================

/**
 * Validate if a player meets the requirements for a quest
 */
export function validateQuestRequirements(
  quest: Quest,
  playerLevel: number,
  completedQuestIds: string[] = [],
  playerItems: string[] = [],
  playerReputation: Record<string, number> = {}
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Check level requirement
  if (quest.requirements.level && playerLevel < quest.requirements.level) {
    reasons.push(`Requires level ${quest.requirements.level} (you are level ${playerLevel})`)
  }

  // Check min level
  if (playerLevel < quest.minLevel) {
    reasons.push(`Requires minimum level ${quest.minLevel}`)
  }

  // Check max level
  if (quest.maxLevel && playerLevel > quest.maxLevel) {
    reasons.push(`Maximum level for this quest is ${quest.maxLevel}`)
  }

  // Check previous quests
  const requiredQuests = quest.requirements.previousQuests || []
  const missingQuests = requiredQuests.filter(qId => !completedQuestIds.includes(qId))
  if (missingQuests.length > 0) {
    reasons.push(`Must complete ${missingQuests.length} prerequisite quest(s)`)
  }

  // Check required items
  const requiredItems = quest.requirements.items || []
  const missingItems = requiredItems.filter(itemId => !playerItems.includes(itemId))
  if (missingItems.length > 0) {
    reasons.push(`Missing ${missingItems.length} required item(s)`)
  }

  // Check reputation requirements
  const reputationRequirements = quest.requirements.reputation || {}
  for (const [faction, requiredRep] of Object.entries(reputationRequirements)) {
    const currentRep = playerReputation[faction] || 0
    if (currentRep < requiredRep) {
      reasons.push(`Requires ${requiredRep} reputation with ${faction} (you have ${currentRep})`)
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  }
}
