/**
 * Music Generation Service
 *
 * Handles ElevenLabs music generation for game soundtracks and ambient music.
 *
 * Features:
 * - Generate music from text prompts
 * - Detailed music generation with metadata
 * - Create composition plans for structured music
 * - Support for instrumental and vocal tracks
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { env } from '../config/env'

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface MusicGenerationOptions {
  prompt: string | undefined
  musicLengthMs: number | undefined
  modelId: string | undefined
  forceInstrumental: boolean | undefined
  respectSectionsDurations: boolean | undefined
  storeForInpainting: boolean | undefined
  compositionPlan: any | undefined
  outputFormat: string | undefined
}

export interface CompositionPlanOptions {
  prompt: string
  musicLengthMs?: number
  sourceCompositionPlan?: any
  modelId?: string
}

export interface MusicServiceConfig {
  apiKey?: string
}

// =====================================================
// MUSIC SERVICE CLASS
// =====================================================

export class MusicService {
  private client: ElevenLabsClient | null

  constructor(config: MusicServiceConfig = {}) {
    const apiKey = config.apiKey || env.ELEVENLABS_API_KEY

    if (!apiKey) {
      console.warn('[MusicService] ElevenLabs API key not found - service unavailable')
      this.client = null
    } else {
      this.client = new ElevenLabsClient({
        apiKey: apiKey,
      })
      console.log(
        `[MusicService] ElevenLabs Music client initialized ${config.apiKey ? '(user key)' : '(env var)'}`
      )
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.client !== null
  }


  /**
   * Generate music from a text prompt
   */
  async generateMusic(options: MusicGenerationOptions): Promise<Buffer> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const {
      prompt,
      musicLengthMs,
      modelId = 'music_v1',
      forceInstrumental = false,
      respectSectionsDurations = false,
      storeForInpainting = false,
      compositionPlan,
      outputFormat = 'mp3_44100_128',
    } = options

    try {
      console.log('[MusicService] Generating music', {
        promptLength: prompt?.length || 0,
        musicLengthMs,
        forceInstrumental,
        hasCompositionPlan: !!compositionPlan,
      })

      // Use the music generation API
      const response: any = await (this.client as any).music.compose({
        prompt: prompt || undefined,
        compositionPlan: compositionPlan || undefined,
        musicLengthMs: musicLengthMs || undefined,
        modelId,
        forceInstrumental,
        respectSectionsDurations,
        storeForInpainting,
        outputFormat,
      })

      // Convert audio stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of response) {
        chunks.push(Buffer.from(chunk))
      }
      const audioBuffer = Buffer.concat(chunks)

      console.log('[MusicService] Music generated successfully', {
        audioSizeKb: Math.round(audioBuffer.length / 1024),
      })

      return audioBuffer
    } catch (error) {
      console.error('[MusicService] Music generation failed', {
        error: (error as Error).message,
        prompt: prompt?.substring(0, 100),
      })
      throw error
    }
  }

  /**
   * Generate music with detailed response (includes metadata)
   */
  async generateMusicDetailed(options: MusicGenerationOptions): Promise<{
    audio: Buffer
    metadata: any
  }> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const {
      prompt,
      musicLengthMs,
      modelId = 'music_v1',
      forceInstrumental = false,
      storeForInpainting = false,
      compositionPlan,
      outputFormat = 'mp3_44100_128',
    } = options

    try {
      console.log('[MusicService] Generating detailed music', {
        promptLength: prompt?.length || 0,
        musicLengthMs,
      })

      const response: any = await (this.client as any).music.composeDetailed({
        prompt: prompt || undefined,
        compositionPlan: compositionPlan || undefined,
        musicLengthMs: musicLengthMs || undefined,
        modelId,
        forceInstrumental,
        storeForInpainting,
        outputFormat,
      })

      // Convert audio stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of response.audio) {
        chunks.push(Buffer.from(chunk))
      }
      const audioBuffer = Buffer.concat(chunks)

      console.log('[MusicService] Detailed music generated successfully', {
        audioSizeKb: Math.round(audioBuffer.length / 1024),
      })

      return {
        audio: audioBuffer,
        metadata: response.metadata || {},
      }
    } catch (error) {
      console.error('[MusicService] Detailed music generation failed', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Create a composition plan from a prompt
   * This doesn't cost any credits, just generates the plan structure
   */
  async createCompositionPlan(options: CompositionPlanOptions): Promise<any> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const { prompt, musicLengthMs, sourceCompositionPlan, modelId = 'music_v1' } = options

    try {
      console.log('[MusicService] Creating composition plan', {
        promptLength: prompt.length,
        musicLengthMs,
        hasSourcePlan: !!sourceCompositionPlan,
      })

      const plan: any = await (this.client as any).music.compositionPlan.create({
        prompt,
        musicLengthMs: musicLengthMs || undefined,
        sourceCompositionPlan: sourceCompositionPlan || undefined,
        modelId,
      })

      console.log('[MusicService] Composition plan created successfully', {
        sectionsCount: plan.sections?.length || 0,
      })

      return plan
    } catch (error) {
      console.error('[MusicService] Composition plan creation failed', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Generate multiple music tracks with controlled concurrency
   */
  async generateBatch(
    requests: MusicGenerationOptions[]
  ): Promise<Array<{ audio: Buffer | null; request: MusicGenerationOptions; success: boolean; error?: string }>> {
    if (!this.isAvailable()) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    console.log(`[MusicService] Starting batch music generation for ${requests.length} tracks`)

    const results = []

    for (const [index, request] of requests.entries()) {
      try {
        const audio = await this.generateMusic(request)
        results.push({
          audio,
          request,
          success: true,
        })
      } catch (error) {
        console.error(`[MusicService] Batch music generation failed for request ${index}`, {
          error: (error as Error).message,
          prompt: request.prompt?.substring(0, 100),
        })
        results.push({
          audio: null,
          request,
          success: false,
          error: (error as Error).message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(
      `[MusicService] Batch music generation complete: ${successCount}/${requests.length} successful`
    )

    return results
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
