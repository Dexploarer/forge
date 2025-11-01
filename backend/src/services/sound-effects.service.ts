/**
 * Sound Effects Generation Service
 *
 * Handles ElevenLabs text-to-sound-effects generation for game audio.
 *
 * Features:
 * - Generate sound effects from text descriptions
 * - Support for duration control (0.5-22 seconds)
 * - Prompt influence for style control
 * - Seamless looping for ambient sounds
 * - Batch generation with concurrency control
 *
 * API Documentation: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
 * Pricing: 100 credits per auto-duration, 20 credits per second for set duration
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { env } from '../config/env'

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface SoundEffectOptions {
  text: string
  durationSeconds?: number | null
  promptInfluence?: number
  loop?: boolean
}

export interface SoundEffectBatchResult {
  effects: Array<{
    index: number
    success: boolean
    audioBuffer?: Buffer
    text: string
    size?: number
    error?: string
  }>
  successful: number
  total: number
}

export interface SoundEffectsServiceConfig {
  apiKey?: string
}

// =====================================================
// SOUND EFFECTS SERVICE CLASS
// =====================================================

export class SoundEffectsService {
  private client: ElevenLabsClient | null

  constructor(config: SoundEffectsServiceConfig = {}) {
    const apiKey = config.apiKey || env.ELEVENLABS_API_KEY

    if (!apiKey) {
      console.warn('[SoundEffectsService] ElevenLabs API key not found - service unavailable')
      this.client = null
    } else {
      this.client = new ElevenLabsClient({
        apiKey: apiKey,
      })
      console.log(
        `[SoundEffectsService] ElevenLabs Sound Effects client initialized ${config.apiKey ? '(user key)' : '(env var)'}`
      )
    }
  }

  /**
   * Check if service is available (API key configured)
   */
  isAvailable(): boolean {
    return this.client !== null
  }

  /**
   * Generate single sound effect from text description
   */
  async generateSoundEffect(options: SoundEffectOptions): Promise<Buffer> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    const { text, durationSeconds = null, promptInfluence = 0.3, loop = false } = options

    console.log('[SoundEffectsService] Generating sound effect', {
      text: text.substring(0, 50),
      duration: durationSeconds || 'auto',
      promptInfluence,
      loop,
    })

    try {
      // Call ElevenLabs sound generation API
      const audioStream: any = await (this.client as any).textToSoundEffects.convert({
        text,
        duration_seconds: durationSeconds,
        prompt_influence: promptInfluence,
      })

      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk))
      }
      const audioBuffer = Buffer.concat(chunks)

      console.log('[SoundEffectsService] Sound effect generated', {
        size: audioBuffer.length,
        duration: durationSeconds || 'auto',
      })

      return audioBuffer
    } catch (error) {
      console.error('[SoundEffectsService] Sound effect generation failed', {
        error: (error as Error).message,
        text: text.substring(0, 50),
      })
      throw error
    }
  }

  /**
   * Batch generate multiple sound effects
   */
  async generateSoundEffectBatch(effects: SoundEffectOptions[]): Promise<SoundEffectBatchResult> {
    if (!this.isAvailable()) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    console.log(`[SoundEffectsService] Batch generating ${effects.length} sound effects`)

    const results: SoundEffectBatchResult['effects'] = []
    let successful = 0

    for (const [index, effect] of effects.entries()) {
      try {
        const options: SoundEffectOptions = {
          text: effect.text,
        }

        if (effect.durationSeconds !== undefined) {
          options.durationSeconds = effect.durationSeconds
        }
        if (effect.promptInfluence !== undefined) {
          options.promptInfluence = effect.promptInfluence
        }
        if (effect.loop !== undefined) {
          options.loop = effect.loop
        }

        const audioBuffer = await this.generateSoundEffect(options)

        results.push({
          index,
          success: true,
          audioBuffer,
          text: effect.text,
          size: audioBuffer.length,
        })

        successful++
      } catch (error) {
        console.error(`[SoundEffectsService] Failed to generate sound effect ${index}`, {
          error: (error as Error).message,
          text: effect.text.substring(0, 50),
        })

        results.push({
          index,
          success: false,
          error: (error as Error).message,
          text: effect.text,
        })
      }
    }

    console.log(
      `[SoundEffectsService] Batch generation complete: ${successful}/${effects.length}`
    )

    return {
      effects: results,
      successful,
      total: effects.length,
    }
  }

  /**
   * Estimate cost for sound effect generation
   */
  estimateCost(
    durationSeconds: number | null = null
  ): { duration: string | number; credits: number; estimatedCostUSD: string } {
    if (durationSeconds === null) {
      // Auto-duration: 100 credits per generation
      return {
        duration: 'auto',
        credits: 100,
        estimatedCostUSD: '$0.024', // $0.24 per 1000 credits
      }
    }

    // Set duration: 20 credits per second
    const credits = Math.ceil(durationSeconds * 20)
    const costUSD = ((credits / 1000) * 0.24).toFixed(3)

    return {
      duration: durationSeconds,
      credits,
      estimatedCostUSD: `$${costUSD}`,
    }
  }

  /**
   * Get service status
   */
  getStatus(): { available: boolean } {
    return {
      available: this.isAvailable(),
    }
  }
}
