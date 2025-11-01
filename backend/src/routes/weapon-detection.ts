/**
 * Weapon Detection API Routes
 * Provides GPT-4 Vision endpoints for weapon analysis:
 * - Handle/grip detection for weapon models
 * - Weapon orientation detection
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getWeaponDetectionPrompts } from '../utils/prompt-loader'
import OpenAI from 'openai'
import { env } from '../config/env'

// =====================================================
// SCHEMAS
// =====================================================

const GripBoundsSchema = z.object({
  minX: z.number().min(0).max(512),
  minY: z.number().min(0).max(512),
  maxX: z.number().min(0).max(512),
  maxY: z.number().min(0).max(512)
})

const DetectedPartsSchema = z.object({
  blade: z.string(),
  handle: z.string(),
  guard: z.string().optional()
})

const GripDataSchema = z.object({
  gripBounds: GripBoundsSchema,
  confidence: z.number().min(0).max(1),
  weaponType: z.string(),
  gripDescription: z.string(),
  detectedParts: DetectedPartsSchema.optional()
})

const HandleDetectRequestSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
  angle: z.string().optional(),
  promptHint: z.string().optional()
})

const HandleDetectResponseSchema = z.object({
  success: z.boolean(),
  gripData: GripDataSchema,
  originalImage: z.string()
})

const OrientationDataSchema = z.object({
  needsFlip: z.boolean(),
  currentOrientation: z.string(),
  reason: z.string()
})

const OrientationDetectRequestSchema = z.object({
  image: z.string().min(1, 'Image data is required')
})

const OrientationDetectResponseSchema = z.object({
  success: z.boolean(),
  needsFlip: z.boolean(),
  currentOrientation: z.string(),
  reason: z.string()
})

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string()
})

// =====================================================
// TYPES
// =====================================================

interface WeaponDetectionPrompts {
  basePrompt?: string
  additionalGuidance?: string
  restrictions?: string
  responseFormat?: string
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Build weapon detection prompt with optional customizations
 */
function buildWeaponPrompt(
  weaponPrompts: WeaponDetectionPrompts,
  angle?: string,
  promptHint?: string
): string {
  const basePromptTemplate =
    weaponPrompts?.basePrompt ||
    `You are analyzing a 3D weapon rendered from the \${angle || 'side'} in a 512x512 pixel image.
The weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.

YOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.

CRITICAL DISTINCTIONS:
- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)
- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)
- GUARD/CROSSGUARD: The horizontal piece between blade and handle
- POMMEL: The weighted end piece at the very bottom of the handle

For a SWORD specifically:
- The HANDLE is the wrapped/textured section BELOW the guard/crossguard
- It's typically 15-25% of the total weapon length
- It's narrower than the blade
- It often has visible wrapping, leather, or grip texture
- The grip is NEVER on the blade itself

VISUAL CUES for the handle:
1. Look for texture changes (wrapped vs smooth metal)
2. Look for width changes (handle is narrower than blade)
3. Look for the crossguard/guard that separates blade from handle
4. The handle is typically in the LOWER portion of the weapon
5. If you see a wide, flat, metallic surface - that's the BLADE, not the handle!`

  // Replace template variables
  let promptText = basePromptTemplate.replace(/\$\{angle \|\| 'side'\}/g, angle || 'side')

  if (promptHint) {
    const additionalGuidance =
      weaponPrompts?.additionalGuidance || '\n\nAdditional guidance: ${promptHint}'
    promptText += additionalGuidance.replace(/\$\{promptHint\}/g, promptHint)
  }

  // Add restrictions
  const restrictions =
    weaponPrompts?.restrictions ||
    `\n\nDO NOT select:
- The blade (wide, flat, sharp part)
- The guard/crossguard
- Decorative elements
- The pommel alone

ONLY select the cylindrical grip area where fingers would wrap around.`

  promptText += restrictions

  // Add response format
  const responseFormat =
    weaponPrompts?.responseFormat ||
    `\n\nRespond with ONLY a JSON object in this exact format:
{
  "gripBounds": {
    "minX": <pixel coordinate 0-512>,
    "minY": <pixel coordinate 0-512>,
    "maxX": <pixel coordinate 0-512>,
    "maxY": <pixel coordinate 0-512>
  },
  "confidence": <number 0-1>,
  "weaponType": "<sword|axe|mace|staff|bow|dagger|spear|etc>",
  "gripDescription": "<brief description of grip location>",
  "detectedParts": {
    "blade": "<describe what you identified as the blade>",
    "handle": "<describe what you identified as the handle>",
    "guard": "<describe if you see a guard/crossguard>"
  }
}`

  promptText += responseFormat

  return promptText
}

/**
 * Parse GPT-4 Vision response with fallback
 */
function parseGripData(content: string | null | undefined, logger: any): z.infer<typeof GripDataSchema> {
  if (!content) {
    throw new Error('No content returned from OpenAI')
  }

  try {
    return JSON.parse(content)
  } catch (parseError) {
    logger.error({ error: parseError }, 'Failed to parse GPT-4 Vision response')
    return {
      gripBounds: { minX: 200, minY: 350, maxX: 300, maxY: 450 },
      confidence: 0.5,
      weaponType: 'unknown',
      gripDescription: 'Unable to parse AI response'
    }
  }
}

/**
 * Parse orientation response with fallback
 */
function parseOrientationData(content: string | null | undefined, logger: any): z.infer<typeof OrientationDataSchema> {
  if (!content) {
    throw new Error('No content returned from OpenAI')
  }

  try {
    return JSON.parse(content)
  } catch (parseError) {
    logger.error({ error: parseError }, 'Failed to parse GPT-4 Vision response')
    return {
      needsFlip: false,
      currentOrientation: 'Unable to parse AI response',
      reason: 'Parse error - assuming correct orientation'
    }
  }
}

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export default async function (server: FastifyInstance) {
  // We need a raw OpenAI client for JSON mode
  const rawOpenAI = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  })

  /**
   * POST /api/weapon-handle-detect
   * Detect weapon grip/handle location using GPT-4 Vision
   */
  server.post<{
    Body: z.infer<typeof HandleDetectRequestSchema>
  }>(
    '/weapon-handle-detect',
    {
      schema: {
        tags: ['Weapon Detection'],
        description: 'Detect weapon grip/handle location using GPT-4 Vision',
        body: HandleDetectRequestSchema,
        response: {
          200: HandleDetectResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        if (!env.OPENAI_API_KEY) {
          return reply.status(500).send({
            success: false,
            error: 'OpenAI API key not configured'
          })
        }

        const { image, angle, promptHint } = request.body

        // Load weapon detection prompts
        const weaponPrompts = (await getWeaponDetectionPrompts()) as WeaponDetectionPrompts

        // Build the prompt with optional hint
        const promptText = buildWeaponPrompt(weaponPrompts, angle, promptHint)

        // Use GPT-4 Vision to analyze the weapon and identify grip location
        const response = await rawOpenAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: promptText
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: image,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.3, // Lower temperature for more consistent results
          response_format: { type: 'json_object' }
        })

        const gripData = parseGripData(response.choices[0]?.message?.content, server.log)

        return {
          success: true,
          gripData,
          originalImage: image
        }
      } catch (error) {
        server.log.error({ error }, 'Weapon handle detection error')
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }
  )

  /**
   * POST /api/weapon-orientation-detect
   * Detect if weapon is upside down using GPT-4 Vision
   */
  server.post<{
    Body: z.infer<typeof OrientationDetectRequestSchema>
  }>(
    '/weapon-orientation-detect',
    {
      schema: {
        tags: ['Weapon Detection'],
        description: 'Detect if weapon is upside down using GPT-4 Vision',
        body: OrientationDetectRequestSchema,
        response: {
          200: OrientationDetectResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        if (!env.OPENAI_API_KEY) {
          return reply.status(500).send({
            success: false,
            error: 'OpenAI API key not configured'
          })
        }

        const { image } = request.body

        const promptText = `You are analyzing a 3D weapon that should be oriented vertically.

CRITICAL TASK: Determine if this weapon is upside down and needs to be flipped 180 degrees.

CORRECT ORIENTATION:
- The HANDLE/GRIP should be at the BOTTOM
- The BLADE/HEAD/BUSINESS END should be at the TOP

For different weapons:
- SWORD: Blade should point UP, handle/grip DOWN
- AXE: Axe head UP, wooden handle DOWN
- MACE: Heavy spiked head UP, shaft/handle DOWN
- HAMMER: Hammer head UP, handle DOWN
- STAFF: Usually symmetrical but decorative end UP
- SPEAR: Pointed tip UP, shaft DOWN
- DAGGER: Blade UP, handle DOWN

Look for these visual cues:
1. Handles are usually narrower, wrapped, or textured
2. Blades/heads are usually wider, metallic, or decorative
3. The "heavy" or "dangerous" end should be UP
4. The "holding" end should be DOWN

Respond with ONLY a JSON object:
{
  "needsFlip": <true if weapon is upside down, false if correctly oriented>,
  "currentOrientation": "<describe what you see at top and bottom>",
  "reason": "<brief explanation of your decision>"
}`

        const response = await rawOpenAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: promptText
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: image,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })

        const orientationData = parseOrientationData(response.choices[0]?.message?.content, server.log)

        return {
          success: true,
          ...orientationData
        }
      } catch (error) {
        server.log.error({ error }, 'Weapon orientation detection error')
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }
  )
}
