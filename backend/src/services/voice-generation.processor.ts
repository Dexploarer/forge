import { elevenLabsService } from './elevenlabs.service'
import { db } from '../database/db'
import { voiceGenerations } from '../database/schema'
import { eq } from 'drizzle-orm'
import { fileStorageService } from './file.service'

interface VoiceGenerationParams {
  text: string
  speed?: number
  pitch?: number
  stability?: number
  clarity?: number
}

interface VoiceProfile {
  serviceVoiceId: string | null
}

export async function processVoiceGeneration(
  generationId: string,
  params: VoiceGenerationParams,
  profile: VoiceProfile,
  dbInstance: typeof db
): Promise<void> {
  try {
    console.log(`[Voice-Gen] Starting generation ${generationId}`)

    if (!profile.serviceVoiceId) {
      throw new Error('Voice profile does not have a service voice ID')
    }

    // Generate audio using ElevenLabs
    const audioBuffer = await elevenLabsService.synthesizeSpeech(
      params.text,
      profile.serviceVoiceId,
      {
        stability: params.stability,
        similarityBoost: params.clarity,
        style: undefined,
        useSpeakerBoost: undefined,
        speed: params.speed
      }
    )

    // Save to local storage
    const minioData = await fileStorageService.saveFile(
      audioBuffer,
      'audio/mpeg',
      `voice-${generationId}.mp3`
    )

    // Update generation with results
    await dbInstance.update(voiceGenerations)
      .set({
        status: 'completed',
        audioUrl: minioData.url,
        duration: audioBuffer.length,
        fileSize: audioBuffer.length,
        format: 'mp3',
        updatedAt: new Date(),
      })
      .where(eq(voiceGenerations.id, generationId))

    console.log(`[Voice-Gen] Generation ${generationId} completed`)
  } catch (error) {
    console.error(`[Voice-Gen] Error ${generationId}:`, error)

    await dbInstance.update(voiceGenerations)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(voiceGenerations.id, generationId))
  }
}
