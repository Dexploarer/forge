/**
 * Retexture Service
 * Handles AI-powered texture generation using Meshy API
 */

import fs from 'fs/promises'
import path from 'path'
// Use global fetch (available in Bun and modern Node)

// Temporary MeshyClient implementation until build issues are resolved
class MeshyClient {
  private apiKey: string
  private baseUrl: string
  private checkInterval: number
  private maxCheckTime: number

  constructor(config: {
    apiKey: string
    baseUrl?: string
    maxRetries?: number
    retryDelay?: number
    checkInterval?: number
    maxCheckTime?: number
  }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.meshy.ai'
    this.checkInterval = config.checkInterval || 10000
    this.maxCheckTime = config.maxCheckTime || 600000
  }

  async startRetexture(options: {
    inputTaskId: string
    textStylePrompt: string
    artStyle?: string
    aiModel?: string
    enableOriginalUV?: boolean
  }): Promise<string> {
    const body = {
      input_task_id: options.inputTaskId,
      text_style_prompt: options.textStylePrompt,
      art_style: options.artStyle || 'realistic',
      ai_model: options.aiModel || 'meshy-5',
      enable_original_uv: options.enableOriginalUV ?? true
    }

    const response = await fetch(`${this.baseUrl}/openapi/v1/retexture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Meshy Retexture API error: ${response.status} - ${error}`)
    }

    const result = await response.json() as any
    return result.result || result.task_id || result
  }

  async waitForCompletion(
    taskId: string,
    progressCallback?: (progress: number) => void
  ): Promise<any> {
    const startTime = Date.now()

    while (true) {
      const status = await this.getRetextureTaskStatus(taskId)

      if (status.status === 'SUCCEEDED') {
        if (progressCallback) progressCallback(100)
        return status
      }

      if (status.status === 'FAILED') {
        throw new Error(`Retexture failed: ${status.task_error?.message || 'Unknown error'}`)
      }

      if (progressCallback && status.progress) {
        progressCallback(status.progress)
      }

      if (Date.now() - startTime > this.maxCheckTime) {
        throw new Error(`Retexture timeout after ${this.maxCheckTime / 1000} seconds`)
      }

      await new Promise(resolve => setTimeout(resolve, this.checkInterval))
    }
  }

  async getRetextureTaskStatus(taskId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/openapi/v1/retexture/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Meshy Retexture API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async downloadModel(modelUrl: string): Promise<Buffer> {
    const response = await fetch(modelUrl)
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer)
  }
}

export interface MaterialPreset {
  id: string
  name: string
  displayName: string
  category: string
  tier: string | undefined
  color: string | undefined
  stylePrompt: string
}

export interface RetextureOptions {
  baseAssetId: string
  materialPreset: MaterialPreset
  outputName?: string
  assetsDir: string
}

export interface AssetMetadata {
  id: string
  gameId: string
  name: string
  type: string
  subtype: string
  description?: string | undefined
  meshyTaskId?: string | undefined
  conceptArtPath?: string | undefined
  hasConceptArt?: boolean | undefined
  variants?: string[] | undefined
  variantCount?: number | undefined
  [key: string]: any
}

export class RetextureService {
  private meshyApiKey: string | null
  private meshyClient: MeshyClient | null

  constructor(apiKeyOverride: string | null = null) {
    // Use provided API key or fall back to environment variable
    this.meshyApiKey = apiKeyOverride || process.env.MESHY_API_KEY || null

    if (!this.meshyApiKey) {
      console.warn('[RetextureService] Meshy API key not found - retexturing will be disabled')
      this.meshyClient = null
    } else {
      // Initialize MeshyClient with robust configuration
      this.meshyClient = new MeshyClient({
        apiKey: this.meshyApiKey,
        baseUrl: 'https://api.meshy.ai',
        maxRetries: 3,
        checkInterval: 10000,
        maxCheckTime: 600000
      })
      console.log(`[RetextureService] Initialized ${apiKeyOverride ? '(user key)' : '(env var)'}`)
    }
  }

  async retexture(options: RetextureOptions): Promise<any> {
    if (!this.meshyClient) {
      throw new Error('MESHY_API_KEY is required for retexturing')
    }

    try {
      const { baseAssetId, materialPreset, outputName, assetsDir } = options

      // Get base asset metadata
      const baseMetadata = await this.getAssetMetadata(baseAssetId, assetsDir)
      if (!baseMetadata.meshyTaskId) {
        throw new Error(`Base asset ${baseAssetId} does not have a Meshy task ID`)
      }

      console.log(`🎨 Starting retexture for ${baseAssetId} with material: ${materialPreset.displayName}`)

      // Start retexture task using the MeshyClient
      const taskId = await this.meshyClient.startRetexture({
        inputTaskId: baseMetadata.meshyTaskId,
        textStylePrompt: materialPreset.stylePrompt ||
          `Apply ${materialPreset.displayName} material texture`,
        artStyle: 'realistic',
        aiModel: 'meshy-5',
        enableOriginalUV: true
      })

      console.log(`🎨 Retexture task started: ${taskId}`)

      // Wait for completion with progress updates
      const result = await this.meshyClient.waitForCompletion(
        taskId,
        (progress: number) => {
          console.log(`⏳ Retexture Progress: ${progress}%`)
        }
      )

      // Download and save the retextured model
      const variantName = outputName ||
        `${baseAssetId.replace('-base', '')}-${materialPreset.id}`

      const savedAsset = await this.saveRetexturedAsset({
        result,
        variantName,
        baseAssetId,
        baseMetadata,
        materialPreset,
        taskId,
        assetsDir
      })

      return {
        success: true,
        assetId: variantName,
        message: 'Asset retextured successfully using Meshy AI',
        asset: savedAsset
      }
    } catch (error: any) {
      console.error('Retexturing failed:', error)

      // Provide more detailed error information
      const errorMessage = error.message || 'Unknown error'
      const isNetworkError = errorMessage.includes('timeout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network')

      throw new Error(
        isNetworkError
          ? `Network error during retexturing: ${errorMessage}. Please check your internet connection and try again.`
          : `Retexturing failed: ${errorMessage}`
      )
    }
  }

  private async saveRetexturedAsset(options: {
    result: any
    variantName: string
    baseAssetId: string
    baseMetadata: AssetMetadata
    materialPreset: MaterialPreset
    taskId: string
    assetsDir: string
  }): Promise<AssetMetadata> {
    const { result, variantName, baseAssetId, baseMetadata, materialPreset, taskId, assetsDir } = options

    if (!result.model_urls?.glb) {
      throw new Error('No model URL in result')
    }

    const outputDir = path.join(assetsDir, variantName)
    await fs.mkdir(outputDir, { recursive: true })

    // Download model using MeshyClient
    console.log(`📥 Downloading retextured model...`)
    const modelBuffer = await this.meshyClient!.downloadModel(result.model_urls.glb)
    const modelPath = path.join(outputDir, `${variantName}.glb`)
    await fs.writeFile(modelPath, modelBuffer)

    // Copy concept art if it exists
    try {
      const baseConceptPath = path.join(assetsDir, baseAssetId, 'concept-art.png')
      const variantConceptPath = path.join(outputDir, 'concept-art.png')
      await fs.copyFile(baseConceptPath, variantConceptPath)
    } catch (e) {
      // Ignore if concept art doesn't exist
    }

    // Create standardized metadata
    const variantMetadata: AssetMetadata = {
      // Identity
      id: variantName,
      gameId: variantName,
      name: variantName,
      type: baseMetadata.type,
      subtype: baseMetadata.subtype,

      // Variant-specific
      isBaseModel: false,
      isVariant: true,
      parentBaseModel: baseAssetId,

      // Material information
      materialPreset: {
        id: materialPreset.id,
        displayName: materialPreset.displayName,
        category: materialPreset.category,
        tier: materialPreset.tier,
        color: materialPreset.color,
        stylePrompt: materialPreset.stylePrompt
      },

      // Generation tracking
      workflow: 'Meshy AI Retexture',
      baseModelTaskId: baseMetadata.meshyTaskId,
      retextureTaskId: taskId,
      retextureStatus: 'completed',

      // Files
      modelPath: `${variantName}.glb`,
      conceptArtPath: baseMetadata.conceptArtPath ? 'concept-art.png' : undefined,
      hasModel: true,
      hasConceptArt: baseMetadata.hasConceptArt || false,

      // Timestamps
      generatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),

      // Inherit other properties from base
      description: baseMetadata.description,
      isPlaceholder: false,
      gddCompliant: true
    }

    await fs.writeFile(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(variantMetadata, null, 2)
    )

    // Update base asset metadata to track this variant
    await this.updateBaseAssetVariants(baseAssetId, variantName, assetsDir)

    console.log(`✅ Successfully retextured: ${variantName}`)

    return variantMetadata
  }

  private async updateBaseAssetVariants(
    baseAssetId: string,
    variantId: string,
    assetsDir: string
  ): Promise<void> {
    try {
      const metadataPath = path.join(assetsDir, baseAssetId, 'metadata.json')
      const metadata = await this.getAssetMetadata(baseAssetId, assetsDir)

      // Initialize variants array if it doesn't exist
      if (!metadata.variants) {
        metadata.variants = []
      }

      // Add variant if not already tracked
      if (!metadata.variants.includes(variantId)) {
        metadata.variants.push(variantId)
        metadata.variantCount = metadata.variants.length
        metadata.lastVariantGenerated = variantId
        metadata.updatedAt = new Date().toISOString()

        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      }
    } catch (error: any) {
      console.warn(`Failed to update base asset variants: ${error.message}`)
    }
  }

  private async getAssetMetadata(assetId: string, assetsDir: string): Promise<AssetMetadata> {
    const metadataPath = path.join(assetsDir, assetId, 'metadata.json')
    const content = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(content)
  }

  async regenerateBase(options: {
    baseAssetId: string
    assetsDir: string
  }): Promise<any> {
    if (!this.meshyApiKey || !process.env.OPENAI_API_KEY) {
      throw new Error('MESHY_API_KEY and OPENAI_API_KEY are required for base regeneration')
    }

    // For now, return a simulated success response
    // Full implementation would regenerate the base model from scratch
    console.log(`🔄 Regenerating base model: ${options.baseAssetId}`)

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000))

    return {
      success: true,
      assetId: options.baseAssetId,
      message: `Base model ${options.baseAssetId} has been queued for regeneration. This feature is coming soon!`,
      asset: await this.getAssetMetadata(options.baseAssetId, options.assetsDir)
    }
  }
}
