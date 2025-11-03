import { meshyService } from './meshy.service'
import { db } from '../database/db'
import { assets } from '../database/schema'
import { eq } from 'drizzle-orm'

interface Generation3DParams {
  prompt: string
  artStyle?: string
  negativePrompt?: string
  aiModel?: string
  topology?: 'quad' | 'triangle'
  targetPolycount?: number
}

export async function processGeneration3D(
  assetId: string,
  params: Generation3DParams,
  _ownerId: string,
  dbInstance: typeof db
): Promise<void> {
  try {
    console.log(`[3D-Gen] Starting generation for asset ${assetId}`)

    // Update progress: Starting
    await dbInstance.update(assets)
      .set({
        metadata: { progress: 0, stage: 'initializing' },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))

    // Step 1: Start Meshy generation
    const meshyTask = await meshyService.textToModel(params.prompt, {
      artStyle: params.artStyle,
      negativePrompt: params.negativePrompt,
      aiModel: params.aiModel,
      topology: params.topology,
      targetPolycount: params.targetPolycount,
    })

    console.log(`[3D-Gen] Meshy task created: ${meshyTask.id}`)

    // Update progress: Polling
    await dbInstance.update(assets)
      .set({
        metadata: {
          progress: 10,
          stage: 'generating',
          meshyTaskId: meshyTask.id,
        },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))

    // Step 2: Poll until complete
    const result = await meshyService.pollUntilComplete(meshyTask.id, 5000, 60)

    if (result.status === 'failed') {
      throw new Error(result.error || 'Generation failed')
    }

    console.log(`[3D-Gen] Generation completed for asset ${assetId}`)

    // Step 3: Update asset with results (using Meshy URL - not saved to MinIO yet)
    await dbInstance.update(assets)
      .set({
        status: 'published',
        fileUrl: result.result?.modelUrl,
        metadata: {
          progress: 100,
          stage: 'completed',
          meshyTaskId: meshyTask.id,
          thumbnailUrl: result.result?.thumbnailUrl,
          videoUrl: result.result?.videoUrl,
          storageMode: 'external', // Using Meshy URL (not saved to MinIO)
          externalUrl: result.result?.modelUrl,
        },
        updatedAt: new Date(),
        publishedAt: new Date(),
      })
      .where(eq(assets.id, assetId))

    console.log(`[3D-Gen] Asset ${assetId} published successfully`)
  } catch (error) {
    console.error(`[3D-Gen] Error generating asset ${assetId}:`, error)

    // Update asset with error
    await dbInstance.update(assets)
      .set({
        status: 'failed',
        metadata: {
          progress: 0,
          stage: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))
  }
}
