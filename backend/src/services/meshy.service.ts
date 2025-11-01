import { env } from '../config/env'

// =====================================================
// MESHY SERVICE - Meshy AI 3D Model Generation
// =====================================================

export interface ModelParams {
  artStyle?: string | undefined
  negativePrompt?: string | undefined
  aiModel?: string | undefined
  topology?: 'quad' | 'triangle' | undefined
  targetPolycount?: number | undefined
}

export interface RefineParams {
  enablePbr?: boolean
  surfaceMode?: 'hard' | 'soft' | 'organic'
  textureRichness?: number
}

export interface Model3D {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  modelUrl: string | undefined
  thumbnailUrl: string | undefined
  videoUrl: string | undefined
  progress: number | undefined
  error: string | undefined
}

export interface TaskStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result: {
    modelUrl: string
    thumbnailUrl: string | undefined
    videoUrl: string | undefined
  } | undefined
  error: string | undefined
}

// Meshy API response types
interface MeshyErrorResponse {
  error?: string
  message?: string
}

interface MeshyCreateResponse {
  result?: string
  id?: string
  task_id?: string
  status?: string
  model_url?: string
  thumbnail_url?: string
  video_url?: string
  progress?: number
}

interface MeshyStatusResponse {
  id?: string
  status?: string
  progress?: number
  model_urls?: {
    glb?: string
    fbx?: string
    usdz?: string
  }
  model_url?: string
  thumbnail_url?: string
  video_url?: string
  error?: string
}

export class MeshyService {
  private apiKey: string
  private baseUrl = 'https://api.meshy.ai/openapi/v2'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.MESHY_API_KEY || ''
    if (!this.apiKey && env.NODE_ENV !== 'test') {
      throw new Error('Meshy API key is required')
    }
  }

  /**
   * Text to 3D model generation (creates preview task)
   */
  async textToModel(
    prompt: string,
    params: ModelParams = {}
  ): Promise<Model3D> {
    const {
      artStyle = 'realistic',
      negativePrompt = '',
      aiModel = 'meshy-5',
      topology = 'triangle',
      targetPolycount = 30000,
    } = params

    const response = await fetch(`${this.baseUrl}/text-to-3d`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        mode: 'preview', // REQUIRED: create preview task first
        prompt,
        art_style: artStyle,
        negative_prompt: negativePrompt,
        ai_model: aiModel,
        topology,
        target_polycount: targetPolycount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as MeshyErrorResponse
      throw new Error(`Meshy API error: ${error.error || response.statusText}`)
    }

    const data = await response.json() as MeshyCreateResponse

    return {
      id: data.result || data.id || data.task_id || '', // v2 API returns task ID in 'result' field
      status: this.mapStatus(data.status || ''),
      modelUrl: data.model_url,
      thumbnailUrl: data.thumbnail_url,
      videoUrl: data.video_url,
      progress: data.progress,
      error: undefined,
    }
  }

  /**
   * Image to 3D model generation (uses v1 API)
   */
  async imageToModel(
    imageUrl: string,
    params: ModelParams = {}
  ): Promise<Model3D> {
    const {
      aiModel = 'meshy-5',
      topology = 'triangle',
      targetPolycount = 30000,
    } = params

    // Use v1 API endpoint for image-to-3D (same as api-fastify)
    const response = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        ai_model: aiModel,
        topology,
        target_polycount: targetPolycount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as MeshyErrorResponse
      throw new Error(`Meshy API error: ${error.error || response.statusText}`)
    }

    const data = await response.json() as MeshyCreateResponse

    return {
      id: data.id || data.task_id || data.result || '',
      status: this.mapStatus(data.status || ''),
      modelUrl: data.model_url,
      thumbnailUrl: data.thumbnail_url,
      videoUrl: data.video_url,
      progress: data.progress,
      error: undefined,
    }
  }

  /**
   * Refine existing model
   */
  async refineModel(
    modelId: string,
    params: RefineParams = {}
  ): Promise<Model3D> {
    const {
      enablePbr = true,
      surfaceMode = 'hard',
      textureRichness = 5,
    } = params

    const response = await fetch(`${this.baseUrl}/refine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model_id: modelId,
        enable_pbr: enablePbr,
        surface_mode: surfaceMode,
        texture_richness: textureRichness,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as MeshyErrorResponse
      throw new Error(`Meshy API error: ${error.error || response.statusText}`)
    }

    const data = await response.json() as MeshyCreateResponse

    return {
      id: data.result || data.id || data.task_id || '', // v2 API returns task ID in 'result' field
      status: this.mapStatus(data.status || ''),
      modelUrl: data.model_url,
      thumbnailUrl: data.thumbnail_url,
      videoUrl: data.video_url,
      progress: data.progress,
      error: undefined,
    }
  }

  /**
   * Get text-to-3D task status
   */
  async getTextTo3DStatus(taskId: string): Promise<TaskStatus> {
    const response = await fetch(`${this.baseUrl}/text-to-3d/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as MeshyErrorResponse
      throw new Error(`Meshy API error: ${error.error || response.statusText}`)
    }

    const data = await response.json() as MeshyStatusResponse

    return {
      id: data.id || taskId,
      status: this.mapStatus(data.status || ''),
      progress: data.progress || 0,
      result: data.status === 'SUCCEEDED' ? {
        modelUrl: data.model_urls?.glb || data.model_url || '',
        thumbnailUrl: data.thumbnail_url,
        videoUrl: data.video_url,
      } : undefined,
      error: data.error,
    }
  }

  /**
   * Get image-to-3D task status (v1 API)
   */
  async getImageTo3DStatus(taskId: string): Promise<TaskStatus> {
    const response = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as MeshyErrorResponse
      throw new Error(`Meshy API error: ${error.error || response.statusText}`)
    }

    const data = await response.json() as MeshyStatusResponse

    return {
      id: data.id || taskId,
      status: this.mapStatus(data.status || ''),
      progress: data.progress || 0,
      result: data.status === 'SUCCEEDED' ? {
        modelUrl: data.model_urls?.glb || data.model_url || '',
        thumbnailUrl: data.thumbnail_url,
        videoUrl: data.video_url,
      } : undefined,
      error: data.error,
    }
  }

  /**
   * Get generation status (legacy method - defaults to text-to-3D)
   */
  async getGenerationStatus(taskId: string): Promise<TaskStatus> {
    return this.getTextTo3DStatus(taskId)
  }

  /**
   * Map Meshy status to our standard status
   */
  private mapStatus(meshyStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (meshyStatus?.toLowerCase()) {
      case 'pending':
      case 'queued':
        return 'pending'
      case 'in_progress':
      case 'processing':
        return 'processing'
      case 'succeeded':
      case 'completed':
        return 'completed'
      case 'failed':
      case 'error':
        return 'failed'
      default:
        return 'pending'
    }
  }

  /**
   * Poll for completion (helper method)
   */
  async pollUntilComplete(
    taskId: string,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ): Promise<TaskStatus> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getGenerationStatus(taskId)

      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Polling timeout: Model generation took too long')
  }
}

// Export singleton instance
export const meshyService = new MeshyService()
