/**
 * Voice Profile Generator Service
 *
 * Automatically generates voice profiles for NPCs based on their characteristics.
 * Uses AI to analyze personality, backstory, and traits to recommend voice settings.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { db } from '../database/db'
import { voiceProfiles } from '../database/schema'
import { AISDKService } from './ai-sdk.service'

// =====================================================
// TYPES
// =====================================================

export interface NPCCharacteristics {
  name: string
  personality: string
  backstory?: string
  race?: string
  class?: string
  age?: number
  gender?: string
  behavior?: string
  appearance?: {
    height?: string
    build?: string
    features?: string[]
  }
}

export interface VoiceProfileRecommendation {
  name: string
  description: string
  gender: 'male' | 'female' | 'neutral'
  age: 'child' | 'young' | 'adult' | 'elderly'
  accent?: string
  tone: string
  reasoning: string
  serviceSettings: {
    stability?: number
    clarity?: number
    style?: number
  }
}

// =====================================================
// SCHEMA
// =====================================================

const VoiceProfileRecommendationSchema = z.object({
  name: z.string().describe('Descriptive name for the voice profile (e.g., "Gruff Warrior Voice", "Wise Elder Tone")'),
  description: z.string().describe('Brief description of the voice characteristics'),
  gender: z.enum(['male', 'female', 'neutral']).describe('Voice gender based on NPC characteristics'),
  age: z.enum(['child', 'young', 'adult', 'elderly']).describe('Voice age range based on NPC age and maturity'),
  accent: z.string().optional().describe('Accent or regional dialect (e.g., "British", "Southern", "Russian")'),
  tone: z.string().describe('Voice tone and quality (e.g., "warm and friendly", "cold and calculating", "rough and gravelly")'),
  reasoning: z.string().describe('Brief explanation of why these voice characteristics fit the NPC'),
  serviceSettings: z.object({
    stability: z.number().min(0).max(1).optional().describe('Voice stability (0.0-1.0). Higher = more consistent, lower = more expressive'),
    clarity: z.number().min(0).max(1).optional().describe('Voice clarity (0.0-1.0). Higher = clearer, lower = more character'),
    style: z.number().min(0).max(1).optional().describe('Voice style exaggeration (0.0-1.0)'),
  }).describe('Technical voice settings for generation'),
})

// =====================================================
// SERVICE
// =====================================================

export class VoiceProfileGeneratorService {
  private aiService: AISDKService

  constructor() {
    this.aiService = new AISDKService()
  }

  /**
   * Generate voice profile recommendation based on NPC characteristics
   */
  async generateVoiceProfileRecommendation(
    npc: NPCCharacteristics,
    model: string = 'gpt-4o-mini'
  ): Promise<VoiceProfileRecommendation> {
    const prompt = this.buildVoiceAnalysisPrompt(npc)

    try {
      const aiModel = await this.aiService.getConfiguredModel(
        'npc_voice_analysis',
        model,
        'openai'
      )

      const result = await generateObject({
        model: aiModel,
        schema: VoiceProfileRecommendationSchema,
        prompt,
        temperature: 0.7,
      })

      return result.object as VoiceProfileRecommendation
    } catch (error) {
      console.error('[VoiceProfileGenerator] Failed to generate recommendation:', error)

      // Fallback to simple heuristics
      return this.getFallbackRecommendation(npc)
    }
  }

  /**
   * Create voice profile in database based on NPC characteristics
   */
  async createVoiceProfileForNPC(
    npc: NPCCharacteristics,
    ownerId: string,
    projectId?: string,
    model: string = 'gpt-4o-mini'
  ): Promise<typeof voiceProfiles.$inferSelect> {
    const recommendation = await this.generateVoiceProfileRecommendation(npc, model)

    const [profile] = await db.insert(voiceProfiles).values({
      name: recommendation.name,
      description: recommendation.description,
      ownerId,
      projectId,
      gender: recommendation.gender,
      age: recommendation.age,
      accent: recommendation.accent,
      tone: recommendation.tone,
      serviceProvider: 'elevenlabs', // Default to ElevenLabs
      serviceSettings: {
        ...recommendation.serviceSettings,
        voiceGenerationReasoning: recommendation.reasoning,
      },
      characterIds: [],
      tags: [npc.race, npc.class, npc.behavior].filter(Boolean) as string[],
      metadata: {
        generatedFrom: 'npc_characteristics',
        npcName: npc.name,
        generatedAt: new Date().toISOString(),
      },
      isActive: true,
    }).returning()

    if (!profile) {
      throw new Error('Failed to create voice profile')
    }

    return profile
  }

  /**
   * Generate voice profile recommendations for multiple NPCs
   */
  async generateBatchRecommendations(
    npcs: NPCCharacteristics[],
    model: string = 'gpt-4o-mini'
  ): Promise<Map<string, VoiceProfileRecommendation>> {
    const recommendations = new Map<string, VoiceProfileRecommendation>()

    // Generate in parallel with Promise.allSettled to handle failures gracefully
    const results = await Promise.allSettled(
      npcs.map(async (npc) => {
        const recommendation = await this.generateVoiceProfileRecommendation(npc, model)
        return { npcName: npc.name, recommendation }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        recommendations.set(result.value.npcName, result.value.recommendation)
      }
    }

    return recommendations
  }

  /**
   * Build prompt for AI voice analysis
   */
  private buildVoiceAnalysisPrompt(npc: NPCCharacteristics): string {
    return `Analyze this NPC character and recommend appropriate voice characteristics for voice generation:

NPC DETAILS:
Name: ${npc.name}
${npc.race ? `Race: ${npc.race}` : ''}
${npc.class ? `Class: ${npc.class}` : ''}
${npc.age ? `Age: ${npc.age}` : ''}
${npc.gender ? `Gender: ${npc.gender}` : ''}
${npc.behavior ? `Behavior: ${npc.behavior}` : ''}
Personality: ${npc.personality}
${npc.backstory ? `Backstory: ${npc.backstory}` : ''}
${npc.appearance ? `Appearance: ${JSON.stringify(npc.appearance)}` : ''}

TASK:
Based on the character's personality, backstory, and traits, recommend:
1. Voice gender (male/female/neutral)
2. Voice age range (child/young/adult/elderly)
3. Accent or dialect (if any)
4. Voice tone and quality (warm, cold, rough, smooth, etc.)
5. Technical settings for voice generation (stability, clarity, style)

Consider factors like:
- Character's age, race, and background
- Personality traits and behavior
- Social status and profession (class)
- Physical appearance cues (height, build)
- Backstory elements that might affect speech

Provide a descriptive name for the voice profile and explain your reasoning.`
  }

  /**
   * Fallback recommendation using simple heuristics when AI fails
   */
  private getFallbackRecommendation(npc: NPCCharacteristics): VoiceProfileRecommendation {
    // Determine gender
    let gender: 'male' | 'female' | 'neutral' = 'neutral'
    if (npc.gender) {
      const genderLower = npc.gender.toLowerCase()
      if (genderLower === 'male' || genderLower === 'm') gender = 'male'
      else if (genderLower === 'female' || genderLower === 'f') gender = 'female'
    }

    // Determine age
    let age: 'child' | 'young' | 'adult' | 'elderly' = 'adult'
    if (npc.age) {
      if (npc.age < 13) age = 'child'
      else if (npc.age < 30) age = 'young'
      else if (npc.age < 60) age = 'adult'
      else age = 'elderly'
    }

    // Determine tone from personality/class
    let tone = 'neutral and clear'
    const personalityLower = npc.personality.toLowerCase()

    if (personalityLower.includes('gruff') || personalityLower.includes('rough')) {
      tone = 'rough and gravelly'
    } else if (personalityLower.includes('wise') || personalityLower.includes('sage')) {
      tone = 'warm and measured'
    } else if (personalityLower.includes('friendly') || personalityLower.includes('cheerful')) {
      tone = 'warm and friendly'
    } else if (personalityLower.includes('cold') || personalityLower.includes('calculating')) {
      tone = 'cold and precise'
    }

    return {
      name: `${npc.name}'s Voice`,
      description: `Voice profile for ${npc.name}, a ${npc.race || 'character'} ${npc.class || ''}`.trim(),
      gender,
      age,
      tone,
      reasoning: 'Generated using fallback heuristics based on basic character traits',
      serviceSettings: {
        stability: 0.5,
        clarity: 0.75,
        style: 0.5,
      },
    }
  }

  /**
   * Update existing voice profile based on NPC changes
   */
  async updateVoiceProfileForNPC(
    profileId: string,
    npc: NPCCharacteristics,
    model: string = 'gpt-4o-mini'
  ): Promise<typeof voiceProfiles.$inferSelect> {
    const { eq } = await import('drizzle-orm')
    const recommendation = await this.generateVoiceProfileRecommendation(npc, model)

    const [updatedProfile] = await db
      .update(voiceProfiles)
      .set({
        name: recommendation.name,
        description: recommendation.description,
        gender: recommendation.gender,
        age: recommendation.age,
        accent: recommendation.accent,
        tone: recommendation.tone,
        serviceSettings: {
          ...recommendation.serviceSettings,
          voiceGenerationReasoning: recommendation.reasoning,
        },
        tags: [npc.race, npc.class, npc.behavior].filter(Boolean) as string[],
        metadata: {
          generatedFrom: 'npc_characteristics',
          npcName: npc.name,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, profileId))
      .returning()

    if (!updatedProfile) {
      throw new Error('Failed to update voice profile')
    }

    return updatedProfile
  }
}

// Export singleton instance
export const voiceProfileGeneratorService = new VoiceProfileGeneratorService()
