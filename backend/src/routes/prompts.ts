/**
 * Prompt Management Routes
 * Endpoints for loading, saving, and managing AI prompts
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { loadPromptFile, savePromptFile } from '../utils/prompt-loader'

// =====================================================
// CONSTANTS
// =====================================================

// Map of URL paths to file names
const PROMPT_FILE_MAP: Record<string, string> = {
  'game-styles': 'game-style-prompts',
  'asset-types': 'asset-type-prompts',
  'materials': 'material-prompts',
  'generation': 'generation-prompts',
  'gpt4-enhancement': 'gpt4-enhancement-prompts',
  'weapon-detection': 'weapon-detection-prompts',
}

// =====================================================
// SCHEMAS
// =====================================================

const PromptTypeParamSchema = z.object({
  type: z.string(),
})

const PromptDeleteParamsSchema = z.object({
  type: z.string(),
  id: z.string(),
})

const PromptDeleteQuerySchema = z.object({
  category: z.enum(['avatar', 'item']).optional(),
})

const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Validate prompt file structure
 */
function validatePromptStructure(type: string, prompts: any): string | null {
  if (type === 'asset-types') {
    if (!prompts.version || !prompts.avatar || !prompts.item) {
      return 'Invalid asset type prompt structure'
    }
  } else {
    if (!prompts.version || !prompts.default || !prompts.custom) {
      return 'Invalid prompt structure'
    }
  }
  return null
}

/**
 * Delete custom prompt from loaded data
 */
function deleteCustomPrompt(type: string, prompts: any, id: string, category?: string): boolean {
  if (type === 'asset-types') {
    // For asset types, we need the category (avatar or item)
    if (!category || !['avatar', 'item'].includes(category)) {
      return false
    }

    if (prompts[category]?.custom?.[id]) {
      delete prompts[category].custom[id]
      return true
    }
  } else {
    // For other types, delete from custom section
    if (prompts.custom?.[id]) {
      delete prompts.custom[id]
      return true
    }
  }

  return false
}

// =====================================================
// PROMPT ROUTES
// =====================================================

export default async function promptRoutes(server: FastifyInstance) {
  /**
   * GET /api/prompts/:type
   * Load prompts from file
   */
  server.get('/:type', {
    schema: {
      tags: ['prompts'],
      description: 'Load prompts from file',
      params: PromptTypeParamSchema,
      response: {
        200: z.any(), // Prompts have dynamic structure
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const fileName = PROMPT_FILE_MAP[type]
    const startTime = Date.now()

    if (!fileName) {
      return reply.code(404).send({ error: 'Invalid prompt type' })
    }

    try {
      server.log.info({ type, fileName }, '[Prompts] Loading prompt file')
      const prompts = await loadPromptFile(fileName)

      if (!prompts) {
        return reply.code(404).send({ error: 'Prompt file not found' })
      }

      const duration = Date.now() - startTime
      server.log.info({ type, duration }, '[Prompts] Prompt file loaded')
      return prompts
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({ error, type, duration }, '[Prompts] Failed to load prompt file')
      return reply.code(500).send({ error: 'Failed to load prompts' })
    }
  })

  /**
   * POST /api/prompts/:type
   * Save prompts to file (only updates custom section)
   */
  server.post('/:type', {
    schema: {
      tags: ['prompts'],
      description: 'Save prompts to file',
      params: PromptTypeParamSchema,
      body: z.any(), // Prompts have dynamic structure
      response: {
        200: SuccessResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const updatedPrompts = request.body as any
    const fileName = PROMPT_FILE_MAP[type]
    const startTime = Date.now()

    if (!fileName) {
      return reply.code(404).send({ error: 'Invalid prompt type' })
    }

    try {
      server.log.info({ type, fileName }, '[Prompts] Saving prompt file')

      // Validate the structure
      const validationError = validatePromptStructure(type, updatedPrompts)
      if (validationError) {
        return reply.code(400).send({ error: validationError })
      }

      const success = await savePromptFile(fileName, updatedPrompts)

      if (!success) {
        return reply.code(500).send({ error: 'Failed to save prompts' })
      }

      const duration = Date.now() - startTime
      server.log.info({ type, duration }, '[Prompts] Prompt file saved')

      return {
        success: true,
        message: 'Prompts updated successfully',
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({ error, type, duration }, '[Prompts] Failed to save prompt file')
      return reply.code(500).send({ error: 'Failed to save prompts' })
    }
  })

  /**
   * DELETE /api/prompts/:type/:id
   * Delete a custom prompt
   */
  server.delete('/:type/:id', {
    schema: {
      tags: ['prompts'],
      description: 'Delete a custom prompt',
      params: PromptDeleteParamsSchema,
      querystring: PromptDeleteQuerySchema,
      response: {
        200: SuccessResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string }
    const { category } = request.query as { category?: string }
    const fileName = PROMPT_FILE_MAP[type]
    const startTime = Date.now()

    if (!fileName) {
      return reply.code(404).send({ error: 'Invalid prompt type' })
    }

    try {
      server.log.info({ type, id, fileName }, '[Prompts] Deleting custom prompt')

      // Load current prompts
      const currentPrompts = await loadPromptFile(fileName) as any

      if (!currentPrompts) {
        return reply.code(404).send({ error: 'Prompt file not found' })
      }

      // Handle deletion based on type
      if (type === 'asset-types' && (!category || !['avatar', 'item'].includes(category))) {
        return reply.code(400).send({
          error: 'Category parameter required (avatar or item)',
        })
      }

      const deleted = deleteCustomPrompt(type, currentPrompts, id, category)

      if (!deleted) {
        return reply.code(404).send({ error: 'Custom prompt not found' })
      }

      const success = await savePromptFile(fileName, currentPrompts)

      if (!success) {
        return reply.code(500).send({ error: 'Failed to save prompts after deletion' })
      }

      const duration = Date.now() - startTime
      server.log.info({ type, id, duration }, '[Prompts] Custom prompt deleted')

      return {
        success: true,
        message: 'Prompt deleted successfully',
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      server.log.error({ error, type, id, duration }, '[Prompts] Failed to delete custom prompt')
      return reply.code(500).send({ error: 'Failed to delete prompt' })
    }
  })
}
