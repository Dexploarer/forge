// =====================================================
// AUDIO GENERATION SERVICE
// =====================================================
// Centralized service for AI audio generation

import { env } from '../config/env'
import { MusicService } from './music.service'
import { SoundEffectsService } from './sound-effects.service'
import { ElevenLabsService } from './elevenlabs.service'
import { fileStorageService } from './file.service'

export interface MusicParams {
  prompt: string
  bpm?: number
  key?: string
  genre?: string
  mood?: string
  duration?: number
  instruments?: string[]
}

export interface SFXParams {
  prompt: string
  category?: string
  subcategory?: string
  duration?: number
}

export interface VoiceParams {
  speed?: number
  pitch?: number
  stability?: number
  clarity?: number
  emotion?: string
}

export interface GeneratedMusic {
  audioUrl: string
  duration: number
  fileSize: number
  format: string
  metadata?: Record<string, any>
}

export interface GeneratedSFX {
  audioUrl: string
  duration: number
  fileSize: number
  format: string
  metadata?: Record<string, any>
}

export interface GeneratedVoice {
  audioUrl: string
  duration: number
  fileSize: number
  format: string
  cost?: number
  metadata?: Record<string, any>
}

export class AudioGenerationService {
  private musicService: MusicService
  private sfxService: SoundEffectsService
  private voiceService: ElevenLabsService

  constructor(apiKey?: string) {
    const key = apiKey || env.ELEVENLABS_API_KEY || ''
    this.musicService = new MusicService({ apiKey: key })
    this.sfxService = new SoundEffectsService({ apiKey: key })
    this.voiceService = new ElevenLabsService({ apiKey: key })
  }

  /**
   * Generate music using AI service (ElevenLabs)
   */
  async generateMusic(prompt: string, params: MusicParams): Promise<GeneratedMusic> {
    if (!this.musicService.isAvailable()) {
      throw new Error('Music generation service not available - API key not configured')
    }

    console.log('[AudioGeneration] Generating music', { prompt: prompt.substring(0, 50), params })

    try {
      // Generate music using ElevenLabs
      const audioBuffer = await this.musicService.generateMusic({
        prompt,
        musicLengthMs: params.duration ? params.duration * 1000 : undefined,
        modelId: undefined,
        forceInstrumental: true, // Default to instrumental for game music
        respectSectionsDurations: undefined,
        storeForInpainting: undefined,
        compositionPlan: undefined,
        outputFormat: undefined,
      })

      // Save to file storage
      const { url } = await fileStorageService.saveFile(
        audioBuffer,
        'audio/mpeg',
        `music-${Date.now()}.mp3`
      )

      // Estimate duration based on file size (rough approximation for MP3 at 128kbps)
      const estimatedDuration = Math.round((audioBuffer.length * 8) / (128 * 1024))

      const result: GeneratedMusic = {
        audioUrl: url,
        duration: params.duration || estimatedDuration,
        fileSize: audioBuffer.length,
        format: 'mp3',
        metadata: {
          prompt,
          params,
          generatedAt: new Date().toISOString(),
        },
      }

      console.log('[AudioGeneration] Music generated successfully', {
        url,
        size: audioBuffer.length,
      })

      return result
    } catch (error) {
      console.error('[AudioGeneration] Music generation failed', {
        error: (error as Error).message,
        prompt: prompt.substring(0, 50),
      })
      throw error
    }
  }

  /**
   * Generate sound effect using AI service (ElevenLabs)
   */
  async generateSFX(prompt: string, params: SFXParams): Promise<GeneratedSFX> {
    if (!this.sfxService.isAvailable()) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    console.log('[AudioGeneration] Generating SFX', { prompt: prompt.substring(0, 50), params })

    try {
      // Generate SFX using ElevenLabs
      const audioBuffer = await this.sfxService.generateSoundEffect({
        text: prompt,
        durationSeconds: params.duration || null,
        promptInfluence: 0.3, // Default prompt influence
      })

      // Save to file storage
      const { url } = await fileStorageService.saveFile(
        audioBuffer,
        'audio/mpeg',
        `sfx-${Date.now()}.mp3`
      )

      // Estimate duration based on file size (rough approximation for MP3 at 128kbps)
      const estimatedDuration = Math.round((audioBuffer.length * 8) / (128 * 1024))

      const result: GeneratedSFX = {
        audioUrl: url,
        duration: params.duration || estimatedDuration,
        fileSize: audioBuffer.length,
        format: 'mp3',
        metadata: {
          prompt,
          params,
          generatedAt: new Date().toISOString(),
        },
      }

      console.log('[AudioGeneration] SFX generated successfully', {
        url,
        size: audioBuffer.length,
      })

      return result
    } catch (error) {
      console.error('[AudioGeneration] SFX generation failed', {
        error: (error as Error).message,
        prompt: prompt.substring(0, 50),
      })
      throw error
    }
  }

  /**
   * Generate voice audio using TTS service (ElevenLabs)
   */
  async generateVoice(
    text: string,
    voiceId: string,
    params: VoiceParams
  ): Promise<GeneratedVoice> {
    if (!this.voiceService.isConfigured()) {
      throw new Error('Voice generation service not available - API key not configured')
    }

    console.log('[AudioGeneration] Generating voice', {
      text: text.substring(0, 50),
      voiceId,
      params,
    })

    try {
      // Generate voice using ElevenLabs
      const audioBuffer = await this.voiceService.textToSpeechBuffer(text, {
        voiceId,
        voiceSettings: {
          stability: params.stability,
          similarityBoost: params.clarity, // Map clarity to similarity_boost
          style: 0,
          useSpeakerBoost: true,
          speed: params.speed,
        },
      })

      // Save to file storage
      const { url } = await fileStorageService.saveFile(
        audioBuffer,
        'audio/mpeg',
        `voice-${Date.now()}.mp3`
      )

      // Estimate duration based on file size (rough approximation for MP3 at 128kbps)
      const estimatedDuration = Math.round((audioBuffer.length * 8) / (128 * 1024))

      const result: GeneratedVoice = {
        audioUrl: url,
        duration: estimatedDuration,
        fileSize: audioBuffer.length,
        format: 'mp3',
        metadata: {
          text: text.substring(0, 100),
          voiceId,
          params,
          generatedAt: new Date().toISOString(),
        },
      }

      console.log('[AudioGeneration] Voice generated successfully', {
        url,
        size: audioBuffer.length,
      })

      return result
    } catch (error) {
      console.error('[AudioGeneration] Voice generation failed', {
        error: (error as Error).message,
        text: text.substring(0, 50),
      })
      throw error
    }
  }

  /**
   * Validate music generation parameters
   */
  validateMusicParams(params: MusicParams): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (params.bpm && (params.bpm < 20 || params.bpm > 300)) {
      errors.push('BPM must be between 20 and 300')
    }

    if (params.duration && params.duration < 1) {
      errors.push('Duration must be at least 1 second')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate SFX generation parameters
   */
  validateSFXParams(params: SFXParams): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (params.duration && params.duration < 1) {
      errors.push('Duration must be at least 1 millisecond')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate voice generation parameters
   */
  validateVoiceParams(params: VoiceParams): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (params.speed && (params.speed < 0.5 || params.speed > 2.0)) {
      errors.push('Speed must be between 0.5 and 2.0')
    }

    if (params.pitch && (params.pitch < -12 || params.pitch > 12)) {
      errors.push('Pitch must be between -12 and +12')
    }

    if (params.stability && (params.stability < 0.0 || params.stability > 1.0)) {
      errors.push('Stability must be between 0.0 and 1.0')
    }

    if (params.clarity && (params.clarity < 0.0 || params.clarity > 1.0)) {
      errors.push('Clarity must be between 0.0 and 1.0')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

export const audioGenerationService = new AudioGenerationService()
