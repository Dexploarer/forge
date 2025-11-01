// =====================================================
// PROMPT LOADER
// =====================================================
// Provides prompt templates for AI generation and enhancement

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// Cache for loaded prompts
const promptCache = new Map<string, unknown>()

export interface GPT4EnhancementPrompts {
  systemPrompt: {
    base: string
    focusPoints: string[]
    closingInstruction: string
  }
  typeSpecific: {
    avatar: {
      critical: string
      focus: string
    }
    armor: {
      base: string
      chest: string
      positioning: string
      focus: string[]
      enhancementPrefix: string
    }
  }
}

export interface GenerationPrompts {
  imageGeneration: {
    base: string
    fallbackEnhancement: string
  }
}

/**
 * Load a prompt file from the prompts directory
 * @param promptType - Type of prompt to load (e.g., 'generation-prompts')
 * @returns Parsed JSON prompt data or null if not found
 */
export async function loadPromptFile(promptType: string): Promise<unknown | null> {
  // Check cache first
  if (promptCache.has(promptType)) {
    return promptCache.get(promptType)
  }

  // Resolve path to prompts directory
  const filePath = join(process.cwd(), 'prompts', `${promptType}.json`)

  try {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    promptCache.set(promptType, data)
    return data
  } catch (error) {
    console.error(`Failed to load prompt file ${promptType}:`, error)
    return null
  }
}

/**
 * Save a prompt file to the prompts directory
 * @param promptType - Type of prompt to save
 * @param data - Prompt data to save
 * @returns true if successful, false otherwise
 */
export async function savePromptFile(promptType: string, data: unknown): Promise<boolean> {
  const filePath = join(process.cwd(), 'prompts', `${promptType}.json`)

  try {
    await writeFile(filePath, JSON.stringify(data, null, 2))
    // Update cache
    promptCache.set(promptType, data)
    return true
  } catch (error) {
    console.error(`Failed to save prompt file ${promptType}:`, error)
    return false
  }
}

/**
 * Clear prompt cache (useful for development)
 */
export function clearPromptCache(): void {
  promptCache.clear()
}

/**
 * Get GPT-4 enhancement prompts for asset generation
 */
export async function getGPT4EnhancementPrompts(): Promise<GPT4EnhancementPrompts> {
  return {
    systemPrompt: {
      base: `You are an expert at optimizing prompts for 3D asset generation.
Your task is to enhance the user's description to create better results with image generation and 3D conversion.`,
      focusPoints: [
        'Clear, specific visual details',
        'Material and texture descriptions',
        'Geometric shape and form',
        'Style consistency (especially for \${config.style || \'low-poly RuneScape\'} style)',
      ],
      closingInstruction: 'Keep the enhanced prompt concise but detailed.',
    },
    typeSpecific: {
      avatar: {
        critical: `CRITICAL for characters: The character MUST be in a T-pose (arms stretched out horizontally, legs slightly apart) for proper rigging. The character must have EMPTY HANDS - no weapons, tools, or held items. Always add "standing in T-pose with empty hands" to the description.`,
        focus: '- T-pose stance with empty hands for rigging compatibility',
      },
      armor: {
        base: `CRITICAL for armor pieces: The armor must be shown ALONE without any armor stand, mannequin, or body inside.`,
        chest: 'EXTRA IMPORTANT for chest/body armor: This MUST be shaped for a SCARECROW POSE (T-POSE). The shoulder openings must point straight sideways (90° from the body), NOT down. Imagine it forms a "T" or cross shape when viewed from above.',
        positioning: 'The armor MUST be positioned and SHAPED for a SCARECROW/T-POSE body (arms straight out to the sides). Shoulder holes must be horizontal, not angled downward.',
        focus: [
          '- Armor SHAPED for T-pose body (shoulder openings pointing straight sideways, not down)',
          '- Chest armor should form a "T" or cross shape when viewed from above',
          '- Shoulder openings at 180° angle to each other (straight line across)',
        ],
        enhancementPrefix: `Enhance this armor piece description for 3D generation. CRITICAL: The armor MUST be shaped for a T-POSE/SCARECROW body (arms straight out sideways). Shoulder openings must point horizontally outward (90° from body), not downward. The armor should form a "T" shape when viewed from above. Description: `,
      },
    },
  }
}

/**
 * Get generation prompts for image/3D asset creation
 */
export async function getGenerationPrompts(): Promise<GenerationPrompts> {
  return {
    imageGeneration: {
      base: '\${description}. \${style || "game-ready"} style, \${assetType}, clean geometry suitable for 3D conversion.',
      fallbackEnhancement: '\${config.description}. \${config.style || "game-ready"} style, clean geometry, game-ready 3D asset.',
    },
  }
}

/**
 * Get weapon detection prompts for GPT-4 Vision analysis
 */
export async function getWeaponDetectionPrompts(): Promise<unknown> {
  const prompts = await loadPromptFile('weapon-detection-prompts')
  return prompts || {}
}
