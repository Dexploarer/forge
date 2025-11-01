/**
 * AI Context Preferences API Routes
 * Manages user preferences for AI context building
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../database/db'
import { aiContextPreferences, previewManifests, manifestSubmissions, teamMembers } from '../database/schema'
import { eq, and } from 'drizzle-orm'
import { serializeTimestamps } from '../helpers/serialization'

// ============================================================================
// Schemas
// ============================================================================

const UpdatePreferencesSchema = z.object({
  useOwnPreview: z.boolean().optional(),
  useCdnContent: z.boolean().optional(),
  useTeamPreview: z.boolean().optional(),
  useAllSubmissions: z.boolean().optional(),
  maxContextItems: z.number().int().min(1).max(500).optional(),
  preferRecent: z.boolean().optional()
})

const BuildContextSchema = z.object({
  types: z.array(z.string()).optional()
})

// Default AI context preferences
const DEFAULT_PREFERENCES = {
  useOwnPreview: true,
  useCdnContent: true,
  useTeamPreview: true,
  useAllSubmissions: false,
  maxContextItems: 100,
  preferRecent: true
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or create user preferences
 */
async function getOrCreatePreferences(userId: string) {
  let prefs = await db.query.aiContextPreferences.findFirst({
    where: eq(aiContextPreferences.userId, userId)
  })

  if (!prefs) {
    const result = await db
      .insert(aiContextPreferences)
      .values({
        userId,
        ...DEFAULT_PREFERENCES
      })
      .returning()

    prefs = result[0]!
  }

  return prefs
}


// ============================================================================
// Routes
// ============================================================================

const aiContextRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/ai-context/preferences
   * Get user's AI context preferences
   */
  fastify.get('/preferences', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ai-context'],
      description: 'Get user AI context preferences',
      response: {
        200: z.object({
          preferences: z.object({
            id: z.string(),
            userId: z.string(),
            useOwnPreview: z.boolean(),
            useCdnContent: z.boolean(),
            useTeamPreview: z.boolean(),
            useAllSubmissions: z.boolean(),
            maxContextItems: z.number(),
            preferRecent: z.boolean(),
            createdAt: z.string().nullable(),
            updatedAt: z.string().nullable()
          })
        }),
        500: z.object({
          error: z.string()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const prefs = await getOrCreatePreferences(userId)

      return {
        preferences: {
          ...serializeTimestamps(prefs, ['createdAt', 'updatedAt']),
          useOwnPreview: prefs.useOwnPreview!,
          useCdnContent: prefs.useCdnContent!,
          useTeamPreview: prefs.useTeamPreview!,
          useAllSubmissions: prefs.useAllSubmissions!,
          maxContextItems: prefs.maxContextItems!,
          preferRecent: prefs.preferRecent!,
        }
      }
    } catch (error: any) {
      fastify.log.error('[AI Context] Error fetching preferences:', error)
      return reply.status(500).send({ error: error.message })
    }
  })

  /**
   * PUT /api/ai-context/preferences
   * Update user's AI context preferences
   */
  fastify.put('/preferences', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ai-context'],
      description: 'Update user AI context preferences',
      body: UpdatePreferencesSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          preferences: z.object({
            id: z.string(),
            useOwnPreview: z.boolean(),
            useCdnContent: z.boolean(),
            useTeamPreview: z.boolean(),
            useAllSubmissions: z.boolean(),
            maxContextItems: z.number(),
            preferRecent: z.boolean(),
            updatedAt: z.string().nullable()
          })
        }),
        500: z.object({
          error: z.string()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const updates = UpdatePreferencesSchema.parse(request.body)

      // Check if preferences exist
      const existing = await db.query.aiContextPreferences.findFirst({
        where: eq(aiContextPreferences.userId, userId)
      })

      let result

      if (!existing) {
        // Insert new preferences
        result = await db
          .insert(aiContextPreferences)
          .values({
            userId,
            useOwnPreview: updates.useOwnPreview ?? DEFAULT_PREFERENCES.useOwnPreview,
            useCdnContent: updates.useCdnContent ?? DEFAULT_PREFERENCES.useCdnContent,
            useTeamPreview: updates.useTeamPreview ?? DEFAULT_PREFERENCES.useTeamPreview,
            useAllSubmissions: updates.useAllSubmissions ?? DEFAULT_PREFERENCES.useAllSubmissions,
            maxContextItems: updates.maxContextItems ?? DEFAULT_PREFERENCES.maxContextItems,
            preferRecent: updates.preferRecent ?? DEFAULT_PREFERENCES.preferRecent
          })
          .returning()
      } else {
        // Update existing preferences
        const updateData: any = { updatedAt: new Date() }
        if (updates.useOwnPreview !== undefined) updateData.useOwnPreview = updates.useOwnPreview
        if (updates.useCdnContent !== undefined) updateData.useCdnContent = updates.useCdnContent
        if (updates.useTeamPreview !== undefined) updateData.useTeamPreview = updates.useTeamPreview
        if (updates.useAllSubmissions !== undefined) updateData.useAllSubmissions = updates.useAllSubmissions
        if (updates.maxContextItems !== undefined) updateData.maxContextItems = updates.maxContextItems
        if (updates.preferRecent !== undefined) updateData.preferRecent = updates.preferRecent

        result = await db
          .update(aiContextPreferences)
          .set(updateData)
          .where(eq(aiContextPreferences.userId, userId))
          .returning()
      }

      const prefs = result[0]!

      return {
        success: true,
        message: 'Preferences updated successfully',
        preferences: {
          id: prefs.id,
          useOwnPreview: prefs.useOwnPreview!,
          useCdnContent: prefs.useCdnContent!,
          useTeamPreview: prefs.useTeamPreview!,
          useAllSubmissions: prefs.useAllSubmissions!,
          maxContextItems: prefs.maxContextItems!,
          preferRecent: prefs.preferRecent!,
          updatedAt: prefs.updatedAt ? prefs.updatedAt.toISOString() : null
        }
      }
    } catch (error: any) {
      fastify.log.error('[AI Context] Error updating preferences:', error)
      return reply.status(500).send({ error: error.message })
    }
  })

  /**
   * POST /api/ai-context/build
   * Build combined manifest context based on user preferences
   */
  fastify.post('/build', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ai-context'],
      description: 'Build combined manifest context based on user preferences',
      body: BuildContextSchema,
      response: {
        200: z.object({
          context: z.array(z.any()),
          totalItems: z.number(),
          sources: z.object({
            ownPreview: z.number(),
            cdnContent: z.number(),
            teamPreview: z.number(),
            allSubmissions: z.number()
          }),
          metadata: z.object({
            preferRecent: z.boolean(),
            maxContextItems: z.number()
          })
        }),
        500: z.object({
          error: z.string()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { types } = BuildContextSchema.parse(request.body)

      // Get user's preferences
      const prefs = await db.query.aiContextPreferences.findFirst({
        where: eq(aiContextPreferences.userId, userId)
      })

      const settings = prefs || DEFAULT_PREFERENCES

      // Determine which manifest types to fetch
      const manifestTypes = types || ['npc', 'quest', 'lore', 'item']

      const context: any[] = []
      const sources = {
        ownPreview: 0,
        cdnContent: 0,
        teamPreview: 0,
        allSubmissions: 0
      }

      // Process each manifest type
      for (const manifestType of manifestTypes) {
        const typeData: any[] = []

        // 1. Get items from user's own preview manifest
        if (settings.useOwnPreview) {
          const previewResult = await db.query.previewManifests.findFirst({
            where: and(
              eq(previewManifests.userId, userId),
              eq(previewManifests.manifestType, manifestType),
              eq(previewManifests.isActive, true)
            )
          })

          if (previewResult && previewResult.content) {
            const previewItems = Array.isArray(previewResult.content) ? previewResult.content : []
            typeData.push(...previewItems)
            sources.ownPreview += previewItems.length
          }
        }

        // 2. CDN content is skipped for Forge backend (no CDN manifest files)
        // This would be loaded from a CDN or external source in production

        // 3. Get items from team preview manifests
        if (settings.useTeamPreview) {
          // Get user's teams
          const userTeams = await db.query.teamMembers.findMany({
            where: eq(teamMembers.userId, userId)
          })

          for (const membership of userTeams) {
            const teamPreviewResult = await db.query.previewManifests.findFirst({
              where: and(
                eq(previewManifests.teamId, membership.teamId!),
                eq(previewManifests.manifestType, manifestType),
                eq(previewManifests.isActive, true)
              )
            })

            if (teamPreviewResult && teamPreviewResult.content) {
              const teamItems = Array.isArray(teamPreviewResult.content) ? teamPreviewResult.content : []
              typeData.push(...teamItems)
              sources.teamPreview += teamItems.length
            }
          }
        }

        // 4. Get items from all submissions (if enabled)
        if (settings.useAllSubmissions) {
          const submissionsResult = await db.query.manifestSubmissions.findMany({
            where: and(
              eq(manifestSubmissions.status, 'pending'),
              eq(manifestSubmissions.manifestType, manifestType)
            )
          })

          for (const submission of submissionsResult) {
            const itemData = submission.wasEdited && submission.editedItemData
              ? submission.editedItemData
              : submission.itemData
            typeData.push(itemData)
            sources.allSubmissions++
          }
        }

        // Add type context if we have data
        if (typeData.length > 0) {
          context.push({
            type: manifestType,
            data: typeData
          })
        }
      }

      // Calculate total items
      const totalItems = context.reduce((sum, item) => sum + item.data.length, 0)

      // Apply maxContextItems limit across all types if needed
      const maxItems = settings.maxContextItems || DEFAULT_PREFERENCES.maxContextItems
      if (totalItems > maxItems) {
        // Limit context array
        let itemCount = 0
        const limitedContext = []

        for (const typeContext of context) {
          if (itemCount >= maxItems) break

          const availableSlots = maxItems - itemCount
          const limitedData = typeContext.data.slice(0, availableSlots)
          limitedContext.push({
            type: typeContext.type,
            data: limitedData
          })
          itemCount += limitedData.length
        }

        return {
          context: limitedContext,
          totalItems: itemCount,
          sources,
          metadata: {
            preferRecent: settings.preferRecent || DEFAULT_PREFERENCES.preferRecent,
            maxContextItems: maxItems
          }
        }
      }

      return {
        context,
        totalItems,
        sources,
        metadata: {
          preferRecent: settings.preferRecent || DEFAULT_PREFERENCES.preferRecent,
          maxContextItems: maxItems
        }
      }
    } catch (error: any) {
      fastify.log.error('[AI Context] Error building context:', error)
      return reply.status(500).send({ error: error.message })
    }
  })
}

export default aiContextRoutes
