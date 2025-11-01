import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import * as schema from '../database/schema'

// =====================================================
// RATE LIMITER - AI Service Usage Limits
// =====================================================

/**
 * Rate limit configuration per service
 */
const RATE_LIMITS: Record<string, {
  maxCallsPerHour: number
  maxCallsPerDay: number
  maxTokensPerDay: number
  maxCostPerDay: number // in cents
}> = {
  openai: {
    maxCallsPerHour: 100,
    maxCallsPerDay: 1000,
    maxTokensPerDay: 1000000,
    maxCostPerDay: 10000, // $100
  },
  anthropic: {
    maxCallsPerHour: 100,
    maxCallsPerDay: 1000,
    maxTokensPerDay: 1000000,
    maxCostPerDay: 10000, // $100
  },
  meshy: {
    maxCallsPerHour: 20,
    maxCallsPerDay: 100,
    maxTokensPerDay: 0, // Not applicable
    maxCostPerDay: 5000, // $50
  },
  elevenlabs: {
    maxCallsPerHour: 50,
    maxCallsPerDay: 500,
    maxTokensPerDay: 0, // Not applicable
    maxCostPerDay: 5000, // $50
  },
}

export interface RateLimitStatus {
  allowed: boolean
  reason: string | undefined
  current: {
    callsThisHour: number
    callsToday: number
    tokensToday: number
    costToday: number
  }
  limits: {
    maxCallsPerHour: number
    maxCallsPerDay: number
    maxTokensPerDay: number
    maxCostPerDay: number
  }
  resetAt: {
    hourly: Date
    daily: Date
  }
}

/**
 * Check if a user has exceeded rate limits for a service
 */
export async function checkRateLimit(
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  service: string
): Promise<RateLimitStatus> {
  const limits = RATE_LIMITS[service.toLowerCase()] || RATE_LIMITS.openai!

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  // Get calls in the last hour
  const callsThisHour = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.aiServiceCalls)
    .where(
      and(
        eq(schema.aiServiceCalls.userId, userId),
        eq(schema.aiServiceCalls.service, service),
        gte(schema.aiServiceCalls.createdAt, oneHourAgo)
      )
    )

  // Get calls today
  const callsToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.aiServiceCalls)
    .where(
      and(
        eq(schema.aiServiceCalls.userId, userId),
        eq(schema.aiServiceCalls.service, service),
        gte(schema.aiServiceCalls.createdAt, startOfDay)
      )
    )

  // Get tokens used today
  const tokensToday = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.aiServiceCalls.tokensUsed}), 0)` })
    .from(schema.aiServiceCalls)
    .where(
      and(
        eq(schema.aiServiceCalls.userId, userId),
        eq(schema.aiServiceCalls.service, service),
        gte(schema.aiServiceCalls.createdAt, startOfDay)
      )
    )

  // Get cost today
  const costToday = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.aiServiceCalls.cost}), 0)` })
    .from(schema.aiServiceCalls)
    .where(
      and(
        eq(schema.aiServiceCalls.userId, userId),
        eq(schema.aiServiceCalls.service, service),
        gte(schema.aiServiceCalls.createdAt, startOfDay)
      )
    )

  const currentCallsThisHour = Number(callsThisHour[0]?.count ?? 0)
  const currentCallsToday = Number(callsToday[0]?.count ?? 0)
  const currentTokensToday = Number(tokensToday[0]?.total ?? 0)
  const currentCostToday = Number(costToday[0]?.total ?? 0)

  // Calculate reset times
  const nextHour = new Date(now)
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)

  const nextDay = new Date(startOfDay)
  nextDay.setDate(nextDay.getDate() + 1)

  // Check limits
  let allowed = true
  let reason: string | undefined

  if (currentCallsThisHour >= limits.maxCallsPerHour) {
    allowed = false
    reason = `Hourly call limit exceeded (${limits.maxCallsPerHour} calls per hour)`
  } else if (currentCallsToday >= limits.maxCallsPerDay) {
    allowed = false
    reason = `Daily call limit exceeded (${limits.maxCallsPerDay} calls per day)`
  } else if (limits.maxTokensPerDay > 0 && currentTokensToday >= limits.maxTokensPerDay) {
    allowed = false
    reason = `Daily token limit exceeded (${limits.maxTokensPerDay} tokens per day)`
  } else if (currentCostToday >= limits.maxCostPerDay) {
    allowed = false
    reason = `Daily cost limit exceeded ($${(limits.maxCostPerDay / 100).toFixed(2)} per day)`
  }

  return {
    allowed,
    reason,
    current: {
      callsThisHour: currentCallsThisHour,
      callsToday: currentCallsToday,
      tokensToday: currentTokensToday,
      costToday: currentCostToday,
    },
    limits,
    resetAt: {
      hourly: nextHour,
      daily: nextDay,
    },
  }
}

/**
 * Record AI service usage
 */
export async function recordUsage(
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  service: string,
  data: {
    endpoint: string
    model?: string
    requestData?: Record<string, unknown>
    responseData?: Record<string, unknown>
    tokensUsed?: number
    cost?: number
    durationMs?: number
    status: 'success' | 'error' | 'timeout'
    error?: string
  }
): Promise<void> {
  await db.insert(schema.aiServiceCalls).values({
    userId,
    service,
    endpoint: data.endpoint,
    model: data.model,
    requestData: data.requestData || {},
    responseData: data.responseData || {},
    tokensUsed: data.tokensUsed,
    cost: data.cost,
    durationMs: data.durationMs,
    status: data.status,
    error: data.error,
  })
}

/**
 * Get usage statistics for a user and service
 */
export async function getUsageStats(
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  service?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  totalTokens: number
  totalCost: number
  averageDuration: number
}> {
  const conditions = [eq(schema.aiServiceCalls.userId, userId)]

  if (service) {
    conditions.push(eq(schema.aiServiceCalls.service, service))
  }

  if (startDate) {
    conditions.push(gte(schema.aiServiceCalls.createdAt, startDate))
  }

  if (endDate) {
    conditions.push(lte(schema.aiServiceCalls.createdAt, endDate))
  }

  const stats = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      successfulCalls: sql<number>`count(*) FILTER (WHERE ${schema.aiServiceCalls.status} = 'success')`,
      failedCalls: sql<number>`count(*) FILTER (WHERE ${schema.aiServiceCalls.status} = 'error')`,
      totalTokens: sql<number>`COALESCE(SUM(${schema.aiServiceCalls.tokensUsed}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${schema.aiServiceCalls.cost}), 0)`,
      averageDuration: sql<number>`COALESCE(AVG(${schema.aiServiceCalls.durationMs}), 0)`,
    })
    .from(schema.aiServiceCalls)
    .where(and(...conditions))

  return {
    totalCalls: Number(stats[0]?.totalCalls ?? 0),
    successfulCalls: Number(stats[0]?.successfulCalls ?? 0),
    failedCalls: Number(stats[0]?.failedCalls ?? 0),
    totalTokens: Number(stats[0]?.totalTokens ?? 0),
    totalCost: Number(stats[0]?.totalCost ?? 0),
    averageDuration: Math.round(Number(stats[0]?.averageDuration ?? 0)),
  }
}

/**
 * Override rate limits for a specific user (admin function)
 */
export function setCustomRateLimit(
  service: string,
  limits: {
    maxCallsPerHour?: number
    maxCallsPerDay?: number
    maxTokensPerDay?: number
    maxCostPerDay?: number
  }
): void {
  const current = RATE_LIMITS[service.toLowerCase()] || RATE_LIMITS.openai!
  RATE_LIMITS[service.toLowerCase()] = {
    ...current,
    ...limits,
  }
}
