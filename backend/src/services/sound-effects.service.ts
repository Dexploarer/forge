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

export class SoundEffectOptions {
  text: string
  durationSeconds?: number | null | undefined
  promptInfluence?: number | undefined
  loop?: boolean | undefined

  constructor(data: {
    text: string
    durationSeconds?: number | null | undefined
    promptInfluence?: number | undefined
    loop?: boolean | undefined
  }) {
    this.text = data.text
    this.durationSeconds = data.durationSeconds
    this.promptInfluence = data.promptInfluence
    this.loop = data.loop
  }
}

export class SoundEffectBatchItem {
  index: number
  success: boolean
  audioBuffer?: Buffer | undefined
  text: string
  size?: number | undefined
  error?: string | undefined

  constructor(data: {
    index: number
    success: boolean
    audioBuffer?: Buffer | undefined
    text: string
    size?: number | undefined
    error?: string | undefined
  }) {
    this.index = data.index
    this.success = data.success
    this.audioBuffer = data.audioBuffer
    this.text = data.text
    this.size = data.size
    this.error = data.error
  }
}

export class SoundEffectBatchResult {
  effects: SoundEffectBatchItem[]
  successful: number
  total: number

  constructor(data: {
    effects: SoundEffectBatchItem[]
    successful: number
    total: number
  }) {
    this.effects = data.effects
    this.successful = data.successful
    this.total = data.total
  }

  getSuccessRate(): number {
    return (this.successful / this.total) * 100
  }

  getFailedEffects(): SoundEffectBatchItem[] {
    return this.effects.filter(e => !e.success)
  }
}

export class SoundEffectsServiceConfig {
  apiKey?: string | undefined

  constructor(data: { apiKey?: string | undefined } = {}) {
    this.apiKey = data.apiKey
  }
}

// =====================================================
// SOUND EFFECTS SERVICE CLASS
// =====================================================

export class SoundEffectsService {
  private client: ElevenLabsClient | null

  constructor(config: SoundEffectsServiceConfig = {}) {
    const apiKey = config.apiKey || env.ELEVENLABS_API_KEY

    console.log('[SoundEffectsService] Initializing service', {
      hasConfigKey: !!config.apiKey,
      hasEnvKey: !!env.ELEVENLABS_API_KEY,
      keySource: config.apiKey ? 'user' : 'env',
    })

    if (!apiKey) {
      console.warn('[SoundEffectsService] ElevenLabs API key not found - service unavailable')
      this.client = null
    } else {
      try {
        this.client = new ElevenLabsClient({
          apiKey: apiKey,
        })
        console.log(
          `[SoundEffectsService] ✅ ElevenLabs Sound Effects client initialized ${config.apiKey ? '(user key)' : '(env var)'}`
        )
      } catch (error) {
        console.error('[SoundEffectsService] ❌ Failed to initialize client', {
          error: (error as Error).message,
          stack: (error as Error).stack,
        })
        this.client = null
      }
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
    const startTime = Date.now()

    console.log('[SoundEffectsService] 🎵 Starting sound effect generation', {
      textPreview: options.text.substring(0, 100),
      textLength: options.text.length,
      duration: options.durationSeconds || 'auto',
      promptInfluence: options.promptInfluence || 0.3,
      loop: options.loop || false,
      timestamp: new Date().toISOString(),
    })

    if (!this.isAvailable() || !this.client) {
      console.error('[SoundEffectsService] ❌ Service unavailable', {
        isAvailable: this.isAvailable(),
        hasClient: !!this.client,
      })
      throw new Error('Sound effects service not available - API key not configured')
    }

    const { text, durationSeconds = null, promptInfluence = 0.3 } = options

    try {
      console.log('[SoundEffectsService] 📡 Calling ElevenLabs API', {
        endpoint: 'textToSoundEffects.convert',
        params: {
          text: text.substring(0, 50) + '...',
          duration_seconds: durationSeconds,
          prompt_influence: promptInfluence,
        }
      })

      // Call ElevenLabs sound generation API
      const audioStream: any = await (this.client as any).textToSoundEffects.convert({
        text,
        duration_seconds: durationSeconds,
        prompt_influence: promptInfluence,
      })

      console.log('[SoundEffectsService] 📥 Receiving audio stream from ElevenLabs')

      // Convert stream to buffer
      const chunks: Buffer[] = []
      let chunkCount = 0
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk))
        chunkCount++
        if (chunkCount % 10 === 0) {
          console.log('[SoundEffectsService] 📦 Received chunk', {
            chunkNumber: chunkCount,
            totalBytes: chunks.reduce((sum, c) => sum + c.length, 0),
          })
        }
      }
      const audioBuffer = Buffer.concat(chunks)

      const elapsedTime = Date.now() - startTime
      console.log('[SoundEffectsService] ✅ Sound effect generated successfully', {
        size: audioBuffer.length,
        sizeKB: (audioBuffer.length / 1024).toFixed(2),
        chunks: chunkCount,
        duration: durationSeconds || 'auto',
        elapsedTimeMs: elapsedTime,
        elapsedTimeSec: (elapsedTime / 1000).toFixed(2),
      })

      return audioBuffer
    } catch (error) {
      const elapsedTime = Date.now() - startTime
      console.error('[SoundEffectsService] ❌ Sound effect generation failed', {
        error: (error as Error).message,
        errorName: (error as Error).name,
        stack: (error as Error).stack,
        textPreview: text.substring(0, 50),
        duration: durationSeconds,
        promptInfluence,
        elapsedTimeMs: elapsedTime,
      })
      throw error
    }
  }

  /**
   * Batch generate multiple sound effects
   */
  async generateSoundEffectBatch(effects: SoundEffectOptions[]): Promise<SoundEffectBatchResult> {
    const startTime = Date.now()

    console.log('[SoundEffectsService] 🎵🎵🎵 Starting batch sound effect generation', {
      totalEffects: effects.length,
      timestamp: new Date().toISOString(),
    })

    if (!this.isAvailable()) {
      console.error('[SoundEffectsService] ❌ Batch generation failed - service unavailable')
      throw new Error('Sound effects service not available - API key not configured')
    }

    const results: SoundEffectBatchResult['effects'] = []
    let successful = 0

    for (const [index, effect] of effects.entries()) {
      const effectStartTime = Date.now()

      console.log(`[SoundEffectsService] 🎯 Processing effect ${index + 1}/${effects.length}`, {
        index,
        textPreview: effect.text.substring(0, 50),
        duration: effect.durationSeconds || 'auto',
      })

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

        const effectElapsed = Date.now() - effectStartTime
        results.push(new SoundEffectBatchItem({
          index,
          success: true,
          audioBuffer,
          text: effect.text,
          size: audioBuffer.length,
        }))

        successful++

        console.log(`[SoundEffectsService] ✅ Effect ${index + 1} generated successfully`, {
          index,
          size: audioBuffer.length,
          elapsedMs: effectElapsed,
          successRate: `${successful}/${index + 1}`,
        })
      } catch (error) {
        const effectElapsed = Date.now() - effectStartTime

        console.error(`[SoundEffectsService] ❌ Failed to generate effect ${index + 1}`, {
          index,
          error: (error as Error).message,
          errorName: (error as Error).name,
          stack: (error as Error).stack,
          textPreview: effect.text.substring(0, 50),
          elapsedMs: effectElapsed,
        })

        results.push(new SoundEffectBatchItem({
          index,
          success: false,
          error: (error as Error).message,
          text: effect.text,
        }))
      }
    }

    const totalElapsed = Date.now() - startTime
    const successRate = ((successful / effects.length) * 100).toFixed(1)

    console.log('[SoundEffectsService] 📊 Batch generation complete', {
      successful,
      failed: effects.length - successful,
      total: effects.length,
      successRate: `${successRate}%`,
      totalElapsedMs: totalElapsed,
      totalElapsedSec: (totalElapsed / 1000).toFixed(2),
      avgTimePerEffectMs: Math.round(totalElapsed / effects.length),
    })

    return new SoundEffectBatchResult({
      effects: results,
      successful,
      total: effects.length,
    })
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
