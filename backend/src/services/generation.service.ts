/**
 * Generation Service
 * Handles AI-powered asset generation pipelines
 *
 * Full pipeline implementation with:
 * - Prompt optimization (GPT-4)
 * - Image generation (DALL-E 3)
 * - 3D model generation (Meshy)
 * - Texture refinement (optional)
 * - File server integration
 */

import { EventEmitter } from 'events'
import { AISDKService } from './ai-sdk.service'
import { MeshyService } from './meshy.service'
import { fileStorageService } from './file.service'

export interface PipelineConfig {
  name: string
  type: string
  subtype: string
  description?: string
  assetId?: string
  generationType?: string
  enableRetexturing?: boolean
  enableRigging?: boolean
  enableSprites?: boolean
  materialPresets?: any[]
  referenceImage?: {
    url?: string
    dataUrl?: string
  }
  metadata?: {
    useGPT4Enhancement?: boolean
    characterHeight?: number
  }
  riggingOptions?: {
    heightMeters?: number
  }
  customPrompts?: {
    gameStyle?: string
  }
  quality?: string
  style?: string
}

export interface PipelineStage {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress: number
  result?: any
  error?: string | undefined
}

export interface PipelineStatus {
  id: string
  config: PipelineConfig
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  progress: number
  stages: Record<string, PipelineStage>
  results: Record<string, any>
  error?: string | undefined
  createdAt: string
  completedAt?: string | undefined
  finalAsset?: {
    id: string
    name: string
    modelUrl: string
    conceptArtUrl: string
    variants: any[]
  } | undefined
}

export class GenerationService extends EventEmitter {
  private activePipelines: Map<string, PipelineStatus>
  private aiService: AISDKService
  private meshyService: MeshyService

  constructor() {
    super()
    this.activePipelines = new Map()
    this.aiService = new AISDKService()
    this.meshyService = new MeshyService()

    // Check for required API keys
    if (!process.env.OPENAI_API_KEY || !process.env.MESHY_API_KEY) {
      console.warn('[GenerationService] Missing API keys - generation features will be limited')
    }
  }

  /**
   * Start a new generation pipeline
   */
  async startPipeline(config: PipelineConfig): Promise<{ pipelineId: string; status: string; message: string }> {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const pipeline: PipelineStatus = {
      id: pipelineId,
      config,
      status: 'initializing',
      progress: 0,
      stages: {
        textInput: { status: 'completed', progress: 100, result: { description: config.description } },
        promptOptimization: { status: 'pending', progress: 0 },
        imageGeneration: { status: 'pending', progress: 0 },
        image3D: { status: 'pending', progress: 0 },
        textureGeneration: { status: 'pending', progress: 0 },
        ...(config.generationType === 'avatar' && config.enableRigging ? { rigging: { status: 'pending', progress: 0 } } : {}),
        ...(config.enableSprites ? { spriteGeneration: { status: 'pending', progress: 0 } } : {})
      },
      results: {},
      createdAt: new Date().toISOString()
    }

    this.activePipelines.set(pipelineId, pipeline)

    // Start processing pipeline asynchronously (don't await)
    this.processPipeline(pipelineId).catch((error) => {
      console.error(`[GenerationService] Pipeline ${pipelineId} failed:`, error)
      this.updatePipelineError(pipelineId, error.message)
    })

    return {
      pipelineId,
      status: pipeline.status,
      message: 'Pipeline started successfully'
    }
  }

  /**
   * Process the complete generation pipeline
   */
  private async processPipeline(pipelineId: string): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`)
    }

    try {
      console.log(`[GenerationService] Starting pipeline ${pipelineId}`)
      this.updatePipelineStatus(pipelineId, 'processing')

      // Stage 2: Prompt Optimization (if enabled)
      let optimizedPrompt = pipeline.config.description || ''
      if (pipeline.config.metadata?.useGPT4Enhancement && pipeline.config.description) {
        await this.executeStage(pipelineId, 'promptOptimization', async () => {
          console.log(`[GenerationService] Optimizing prompt with GPT-4`)
          const result = await this.aiService.enhancePromptWithGPT4(
            pipeline.config.description!,
            {
              generationType: pipeline.config.generationType ?? undefined,
              type: pipeline.config.type ?? undefined,
              subtype: pipeline.config.subtype ?? undefined,
              style: pipeline.config.style ?? undefined,
              customPrompts: pipeline.config.customPrompts ?? undefined
            }
          )
          optimizedPrompt = result.optimizedPrompt
          return result
        })
      } else {
        this.updateStage(pipelineId, 'promptOptimization', 'skipped', 100)
      }

      // Stage 3: Image Generation
      let imageUrl: string | undefined
      let imageDataUrl: string | undefined // Keep base64 for Meshy
      await this.executeStage(pipelineId, 'imageGeneration', async () => {
        console.log(`[GenerationService] Generating concept art`)
        const result = await this.aiService.generateImage(
          optimizedPrompt,
          pipeline.config.type,
          pipeline.config.style || 'game-ready'
        )

        // Save image to MinIO
        if (result.imageUrl.startsWith('data:')) {
          const base64Data = result.imageUrl.split(',')[1]!
          const buffer = Buffer.from(base64Data, 'base64')

          // Keep the base64 data URL for Meshy (they can't access private storage)
          imageDataUrl = result.imageUrl

          // Upload to MinIO
          const minioData = await fileStorageService.uploadFile(
            buffer,
            'image/png',
            `concept-${pipelineId}.png`
          )
          console.log(`[GenerationService] Concept art saved to local storage: ${minioData.url}`)

          imageUrl = minioData.url

          return {
            imageUrl,
            imageDataUrl,
            minioBucket: minioData.bucket,
            minioPath: minioData.path,
            minioUrl: minioData.url,
            storageMode: 'minio',
            originalImageUrl: result.imageUrl,
            prompt: result.prompt,
            metadata: result.metadata
          }
        }

        imageUrl = result.imageUrl
        imageDataUrl = result.imageUrl
        return result
      })

      // Stage 4: Image-to-3D Generation
      let modelUrl: string | undefined
      let thumbnailUrl: string | undefined
      if (imageDataUrl) {
        await this.executeStage(pipelineId, 'image3D', async () => {
          console.log(`[GenerationService] Generating 3D model from image`)

          // Create image-to-3D task using base64 data URL (Meshy can process base64)
          // Required ModelParams: aiModel, topology, targetPolycount, artStyle, negativePrompt
          const model3D = await this.meshyService.imageToModel(imageDataUrl!, {
            aiModel: 'meshy-5',
            topology: 'triangle',
            targetPolycount: 30000,
            artStyle: 'realistic', // or use a desired style
            negativePrompt: '' // provide an empty or sensible negative prompt if not applicable
          });

          console.log(`[GenerationService] Meshy task created: ${model3D.id}`);

          // Poll for completion using image-to-3D status endpoint
          const completedTask = await this.pollImageTo3D(model3D.id, 5000, 120)

          if (completedTask.status !== 'completed' || !completedTask.result?.modelUrl) {
            throw new Error('Meshy 3D generation failed or no model URL returned')
          }

          const glbUrl = completedTask.result.modelUrl

          // Download GLB file
          const response = await fetch(glbUrl)
          if (!response.ok) {
            throw new Error(`Failed to download GLB: ${response.statusText}`)
          }
          const glbBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(glbBuffer)

          // Upload to MinIO
          const minioData = await fileStorageService.uploadFile(
            buffer,
            'model/gltf-binary',
            `model-${pipelineId}.glb`
          )
          console.log(`[GenerationService] 3D model saved to local storage: ${minioData.url}`)

          modelUrl = minioData.url
          thumbnailUrl = completedTask.result.thumbnailUrl

          return {
            modelUrl,
            minioBucket: minioData.bucket,
            minioPath: minioData.path,
            minioUrl: minioData.url,
            storageMode: 'minio',
            thumbnailUrl,
            meshyTaskId: model3D.id
          }
        })
      } else {
        this.updateStage(pipelineId, 'image3D', 'failed', 0, 'No image URL available')
      }

      // Stage 5: Texture Generation (optional, skipped for now)
      this.updateStage(pipelineId, 'textureGeneration', 'skipped', 100)

      // Stage 6: Rigging (optional, skipped for now)
      if (pipeline.stages.rigging) {
        this.updateStage(pipelineId, 'rigging', 'skipped', 100)
      }

      // Stage 7: Sprite Generation (optional, skipped for now)
      if (pipeline.stages.spriteGeneration) {
        this.updateStage(pipelineId, 'spriteGeneration', 'skipped', 100)
      }

      // Complete pipeline
      this.completePipeline(pipelineId, {
        id: pipeline.config.assetId || pipelineId,
        name: pipeline.config.name,
        modelUrl: modelUrl!,
        conceptArtUrl: imageUrl!,
        variants: []
      })

      console.log(`[GenerationService] Pipeline ${pipelineId} completed successfully`)
      this.emit('pipeline:completed', { pipelineId, status: 'completed' })

    } catch (error) {
      console.error(`[GenerationService] Pipeline ${pipelineId} failed:`, error)
      this.updatePipelineError(pipelineId, (error as Error).message)
      this.emit('pipeline:failed', { pipelineId, error: (error as Error).message })
      throw error
    }
  }

  /**
   * Execute a pipeline stage with error handling
   */
  private async executeStage<T>(
    pipelineId: string,
    stageName: string,
    executor: () => Promise<T>
  ): Promise<T> {
    try {
      this.updateStage(pipelineId, stageName, 'processing', 0)
      this.emit('stage:started', { pipelineId, stage: stageName })

      const result = await executor()

      this.updateStage(pipelineId, stageName, 'completed', 100, undefined, result)
      this.emit('stage:completed', { pipelineId, stage: stageName, result })

      return result
    } catch (error) {
      const errorMessage = (error as Error).message
      this.updateStage(pipelineId, stageName, 'failed', 0, errorMessage)
      this.emit('stage:failed', { pipelineId, stage: stageName, error: errorMessage })
      throw error
    }
  }

  /**
   * Update a specific stage in the pipeline
   */
  private updateStage(
    pipelineId: string,
    stageName: string,
    status: PipelineStage['status'],
    progress: number,
    error?: string,
    result?: any
  ): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return

    pipeline.stages[stageName] = {
      status,
      progress,
      error,
      result
    }

    if (result) {
      pipeline.results[stageName] = result
    }

    // Update overall progress (weighted average)
    const stageKeys = Object.keys(pipeline.stages)
    const completedStages = stageKeys.filter(k =>
      pipeline.stages[k]!.status === 'completed' || pipeline.stages[k]!.status === 'skipped'
    ).length
    pipeline.progress = Math.round((completedStages / stageKeys.length) * 100)

    this.emit('pipeline:progress', {
      pipelineId,
      progress: pipeline.progress,
      stage: stageName,
      stageStatus: status
    })
  }

  /**
   * Update pipeline status
   */
  private updatePipelineStatus(
    pipelineId: string,
    status: PipelineStatus['status']
  ): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return

    pipeline.status = status
  }

  /**
   * Update pipeline error
   */
  private updatePipelineError(pipelineId: string, error: string): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return

    pipeline.status = 'failed'
    pipeline.error = error
    pipeline.completedAt = new Date().toISOString()
  }

  /**
   * Complete pipeline with final asset
   */
  private completePipeline(
    pipelineId: string,
    finalAsset: PipelineStatus['finalAsset']
  ): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return

    pipeline.status = 'completed'
    pipeline.progress = 100
    pipeline.finalAsset = finalAsset
    pipeline.completedAt = new Date().toISOString()
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(pipelineId: string): Promise<PipelineStatus> {
    const pipeline = this.activePipelines.get(pipelineId)

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`)
    }

    return {
      id: pipeline.id,
      config: pipeline.config,
      status: pipeline.status,
      progress: pipeline.progress,
      stages: pipeline.stages,
      results: pipeline.results,
      error: pipeline.error,
      createdAt: pipeline.createdAt,
      completedAt: pipeline.completedAt,
      finalAsset: pipeline.finalAsset
    }
  }

  /**
   * Poll image-to-3D task until complete (uses v1 API)
   */
  private async pollImageTo3D(
    taskId: string,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.meshyService.getImageTo3DStatus(taskId)

      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Polling timeout: Model generation took too long')
  }

  /**
   * Clean up old pipelines
   */
  cleanupOldPipelines(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)

    for (const [id, pipeline] of Array.from(this.activePipelines.entries())) {
      const createdAt = new Date(pipeline.createdAt).getTime()
      if (createdAt < oneHourAgo && (pipeline.status === 'completed' || pipeline.status === 'failed')) {
        this.activePipelines.delete(id)
      }
    }
  }
}
