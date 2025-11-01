import { AISDKService } from './ai-sdk.service'
import { db } from '../database/db'
import { assets } from '../database/schema'
import { eq } from 'drizzle-orm'
import { fileStorageService } from './file.service'
import { fileServerClient } from './file-server-client.service'

interface ImageGenerationParams {
  prompt: string
  size?: string
  quality?: string
  style?: string
}

export async function processImageGeneration(
  assetId: string,
  params: ImageGenerationParams,
  dbInstance: typeof db
): Promise<void> {
  try {
    console.log(`[Image-Gen] Starting generation for asset ${assetId}`)

    // Use AI SDK service which supports AI Gateway
    const aiService = new AISDKService({
      openaiApiKey: undefined,
      anthropicApiKey: undefined,
      db: dbInstance
    })

    // Generate image with AI SDK (supports both direct OpenAI and AI Gateway)
    const response = await aiService.generateImage(
      params.prompt,
      'texture',
      params.style || 'vivid'
    )

    console.log(`[Image-Gen] Image generated via AI SDK`)

    // AI SDK returns base64 data URL, convert to buffer
    if (!response.imageUrl.startsWith('data:')) {
      throw new Error('Expected base64 data URL from AI SDK')
    }

    const base64Data = response.imageUrl.split(',')[1]!
    const buffer = Buffer.from(base64Data, 'base64')

    console.log(`[Image-Gen] Image ready (${buffer.length} bytes), saving locally...`)

    // Save to local storage
    const localFile = await fileStorageService.saveFile(
      buffer,
      'image/png',
      `image-${assetId}.png`
    )

    console.log(`[Image-Gen] Saved locally: ${localFile.path}`)

    // Try to upload to file server (optional)
    let uploadResult: { url: string } | null = null
    try {
      uploadResult = await fileServerClient.uploadFile({
        buffer,
        filename: `image-${assetId}.png`,
        mimeType: 'image/png'
      })
      console.log(`[Image-Gen] Uploaded to file server: ${uploadResult.url}`)
    } catch (uploadError) {
      console.warn(`[Image-Gen] File server upload failed, using local storage only:`, uploadError)
    }

    // Update asset with results (use remote URL if available, otherwise local)
    await dbInstance.update(assets)
      .set({
        status: 'published',
        fileUrl: uploadResult?.url || localFile.url,
        fileSize: buffer.length,
        mimeType: 'image/png',
        metadata: {
          localPath: localFile.path,
          localUrl: localFile.url,
          remoteUrl: uploadResult?.url || null,
          storageMode: uploadResult ? 'dual' : 'local-only',
          prompt: response.prompt,
          originalPrompt: params.prompt,
          model: response.metadata.model,
          resolution: response.metadata.resolution,
          quality: response.metadata.quality,
          timestamp: response.metadata.timestamp,
        },
        updatedAt: new Date(),
        publishedAt: new Date(),
      })
      .where(eq(assets.id, assetId))

    console.log(`[Image-Gen] Asset ${assetId} completed with ${uploadResult ? 'dual' : 'local-only'} storage`)
  } catch (error) {
    console.error(`[Image-Gen] Error ${assetId}:`, error)

    await dbInstance.update(assets)
      .set({
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))
  }
}
