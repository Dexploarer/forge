// =====================================================
// ELEVENLABS SERVICE
// =====================================================
// Integration with ElevenLabs API for text-to-speech, music, and sound effects

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { env } from '../config/env'

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Voice {
  voiceId: string
  name: string
  category: string | undefined
  description: string | undefined
  previewUrl: string | undefined
  labels: Record<string, string> | undefined
}

export interface VoiceSettings {
  stability?: number | undefined // 0.0 - 1.0
  similarityBoost?: number | undefined // 0.0 - 1.0 (mapped to similarity_boost)
  style?: number | undefined // 0.0 - 1.0
  useSpeakerBoost?: boolean | undefined // mapped to use_speaker_boost
  speed?: number | undefined // 0.25 - 4.0
}

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

export interface SoundEffectOptions {
  text: string
  durationSeconds?: number | null
  promptInfluence?: number
}

export class ElevenLabsService {
  private client: ElevenLabsClient | null
  private defaultVoiceId: string = '21m00Tcm4TlvDq8ikWAM' // Default voice
  private defaultModelId: string = 'eleven_multilingual_v2'

  constructor(config: { apiKey?: string } = {}) {
    const apiKey = config.apiKey || env.ELEVENLABS_API_KEY

    if (!apiKey) {
      console.warn('[ElevenLabsService] ElevenLabs API key not found - service unavailable')
      this.client = null
    } else {
      this.client = new ElevenLabsClient({
        apiKey: apiKey,
      })
      console.log('[ElevenLabsService] ElevenLabs client initialized')
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.client !== null
  }

  /**
   * Convert ReadableStream to Buffer
   */
  private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader()
    const chunks: Buffer[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(Buffer.from(value))
    }

    return Buffer.concat(chunks)
  }

  /**
   * Synthesize speech from text
   */
  async synthesizeSpeech(
    text: string,
    voiceId: string,
    settings: VoiceSettings = {}
  ): Promise<Buffer> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log('[ElevenLabsService] Converting text to speech', { voiceId, textLength: text.length })

    const voiceSettings = {
      stability: settings.stability ?? 0.5,
      similarity_boost: settings.similarityBoost ?? 0.75,
      style: settings.style ?? 0,
      use_speaker_boost: settings.useSpeakerBoost ?? true,
      speed: settings.speed ?? 1.0,
    }

    const stream: any = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId: this.defaultModelId,
      voiceSettings: voiceSettings,
    } as any)

    return this.streamToBuffer(stream)
  }

  /**
   * Convert text to speech and return as Buffer
   */
  async textToSpeechBuffer(
    text: string,
    options: {
      voiceId?: string
      modelId?: string
      voiceSettings?: VoiceSettings
    } = {}
  ): Promise<Buffer> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    const voiceId = options.voiceId || this.defaultVoiceId
    const modelId = options.modelId || this.defaultModelId

    const voiceSettings = options.voiceSettings
      ? {
          stability: options.voiceSettings.stability,
          similarity_boost: options.voiceSettings.similarityBoost,
          style: options.voiceSettings.style,
          use_speaker_boost: options.voiceSettings.useSpeakerBoost,
          speed: options.voiceSettings.speed,
        }
      : undefined

    const stream: any = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId: modelId,
      voiceSettings: voiceSettings,
    } as any)

    return this.streamToBuffer(stream)
  }

  /**
   * Generate music from a text prompt using ElevenLabs Music API
   */
  async generateMusic(options: MusicGenerationOptions): Promise<Buffer> {
    if (!this.isConfigured() || !this.client) {
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

    console.log('[ElevenLabsService] Generating music', {
      promptLength: prompt?.length || 0,
      musicLengthMs,
      forceInstrumental,
    })

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

    console.log('[ElevenLabsService] Music generated successfully', {
      audioSizeKb: Math.round(audioBuffer.length / 1024),
    })

    return audioBuffer
  }

  /**
   * Generate sound effect from text description
   */
  async generateSoundEffect(options: SoundEffectOptions): Promise<Buffer> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    const { text, durationSeconds = null, promptInfluence = 0.3 } = options

    console.log('[ElevenLabsService] Generating sound effect', {
      text: text.substring(0, 50),
      duration: durationSeconds || 'auto',
      promptInfluence,
    })

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

    console.log('[ElevenLabsService] Sound effect generated', {
      size: audioBuffer.length,
      duration: durationSeconds || 'auto',
    })

    return audioBuffer
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<Voice[]> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log('[ElevenLabsService] Fetching available voices')

    const response = await this.client.voices.getAll()
    const apiResponse = response as unknown as { voices: Array<Record<string, unknown>> }

    return apiResponse.voices.map((voice) => ({
      voiceId: (voice.voiceId || voice.voice_id) as string,
      name: voice.name as string,
      category: voice.category as string | undefined,
      description: voice.description as string | undefined,
      labels: voice.labels as Record<string, string> | undefined,
      previewUrl: (voice.previewUrl || voice.preview_url) as string | undefined,
    }))
  }

  /**
   * Get voice details
   */
  async getVoice(voiceId: string): Promise<Voice> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log(`[ElevenLabsService] Fetching voice: ${voiceId}`)

    const response = await this.client.voices.get(voiceId)
    const apiResponse = response as unknown as Record<string, unknown>

    return {
      voiceId: (apiResponse.voiceId || apiResponse.voice_id || voiceId) as string,
      name: (response.name || 'Unknown Voice') as string,
      category: apiResponse.category as string | undefined,
      description: apiResponse.description as string | undefined,
      labels: apiResponse.labels as Record<string, string> | undefined,
      previewUrl: (apiResponse.previewUrl || apiResponse.preview_url) as string | undefined,
    }
  }

  /**
   * Clone a voice from audio samples
   */
  async cloneVoice(audioFiles: Buffer[], name: string, description?: string): Promise<Voice> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log('[ElevenLabsService] Cloning voice', { name, description, fileCount: audioFiles.length })

    // Note: Voice cloning implementation depends on ElevenLabs SDK version
    // This is a placeholder that needs to be implemented based on the SDK
    throw new Error('Voice cloning not yet implemented - requires FormData support')
  }

  /**
   * Delete a cloned voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log('[ElevenLabsService] Deleting voice', voiceId)

    await this.client.voices.delete(voiceId)
  }

  /**
   * Get service status
   */
  getStatus(): { available: boolean } {
    return {
      available: this.isConfigured(),
    }
  }
}

export const elevenLabsService = new ElevenLabsService()
