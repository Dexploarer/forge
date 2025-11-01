import OpenAI from 'openai'
import { env } from '../config/env'

// =====================================================
// OPENAI SERVICE - OpenAI API Integration
// =====================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionParams {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export interface ChatCompletionResponse {
  id: string
  content: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
}

export interface EmbeddingResponse {
  embedding: number[]
  usage: {
    totalTokens: number
  }
}

export interface ImageGenerationParams {
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number
}

export interface ImageGenerationResponse {
  url: string
  revisedPrompt: string | undefined
}

export interface ModerationResult {
  flagged: boolean
  categories: Record<string, boolean>
  categoryScores: Record<string, number>
}

export interface VisionMessage {
  role: 'user' | 'assistant' | 'system'
  content:
    | string
    | Array<{
        type: 'text' | 'image_url'
        text?: string
        image_url?: {
          url: string
          detail?: 'auto' | 'low' | 'high'
        }
      }>
}

export interface VisionAnalysisOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  detail?: 'auto' | 'low' | 'high'
}

export interface EmbeddingOptions {
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
  dimensions?: number
  user?: string
}

export interface TranscriptionOptions {
  model?: 'whisper-1'
  language?: string
  prompt?: string
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  temperature?: number
}

// OpenAI API response types
interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

interface OpenAIChatResponse {
  id: string
  choices: Array<{
    message?: {
      content?: string
    }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  model: string
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding?: number[]
  }>
  usage?: {
    total_tokens?: number
  }
}

interface OpenAIImageResponse {
  data: Array<{
    url?: string
    revised_prompt?: string
  }>
}

interface OpenAIModerationResponse {
  results: Array<{
    flagged?: boolean
    categories?: Record<string, boolean>
    category_scores?: Record<string, number>
  }>
}

export class OpenAIService {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'
  private client: OpenAI

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.OPENAI_API_KEY || ''
    if (!this.apiKey && env.NODE_ENV !== 'test') {
      throw new Error('OpenAI API key is required')
    }

    this.client = new OpenAI({
      apiKey: this.apiKey
    })
  }

  /**
   * Chat completion
   */
  async chatCompletion(
    messages: ChatMessage[],
    params: ChatCompletionParams = {}
  ): Promise<ChatCompletionResponse> {
    const {
      model = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 1000,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0,
    } = params

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as OpenAIErrorResponse
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json() as OpenAIChatResponse

    return {
      id: data.id,
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason || 'unknown',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model: data.model,
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<EmbeddingResponse> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as OpenAIErrorResponse
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json() as OpenAIEmbeddingResponse

    return {
      embedding: data.data[0]?.embedding || [],
      usage: {
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  }

  /**
   * Generate image using DALL-E
   */
  async generateImage(
    prompt: string,
    params: ImageGenerationParams = {}
  ): Promise<ImageGenerationResponse> {
    const {
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1,
    } = params

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size,
        quality,
        style,
        n,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as OpenAIErrorResponse
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json() as OpenAIImageResponse

    return {
      url: data.data[0]?.url || '',
      revisedPrompt: data.data[0]?.revised_prompt,
    }
  }

  /**
   * Moderate content
   */
  async moderateContent(text: string): Promise<ModerationResult> {
    const response = await fetch(`${this.baseUrl}/moderations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as OpenAIErrorResponse
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json() as OpenAIModerationResponse
    const result = data.results[0]

    return {
      flagged: result?.flagged || false,
      categories: result?.categories || {},
      categoryScores: result?.category_scores || {},
    }
  }

  /**
   * Analyze an image using GPT-4 Vision
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options: VisionAnalysisOptions = {}
  ): Promise<string> {
    const messages: VisionMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: options.detail || 'auto'
            }
          }
        ]
      }
    ]

    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-4-vision-preview',
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7
    })

    return response.choices[0]!.message.content!
  }

  /**
   * Analyze multiple images in a single request
   */
  async analyzeMultipleImages(
    images: Array<{ url: string; detail?: 'auto' | 'low' | 'high' }>,
    prompt: string,
    options: Omit<VisionAnalysisOptions, 'detail'> = {}
  ): Promise<string> {
    const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'auto' | 'low' | 'high' } }> = [
      {
        type: 'text',
        text: prompt
      }
    ]

    for (const image of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: image.url,
          detail: image.detail || 'auto'
        }
      })
    }

    const messages: VisionMessage[] = [
      {
        role: 'user',
        content: content
      }
    ]

    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-4-vision-preview',
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    })

    return response.choices[0]!.message.content!
  }

  /**
   * Generate embeddings for text (supports arrays)
   */
  async createEmbedding(
    input: string | string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    const params: any = {
      model: options.model || 'text-embedding-3-small',
      input: input,
    }

    if (options.dimensions !== undefined) {
      params.dimensions = options.dimensions
    }
    if (options.user !== undefined) {
      params.user = options.user
    }

    const response = await this.client.embeddings.create(params)

    return response.data.map((item) => item.embedding)
  }

  /**
   * Generate a single embedding vector
   */
  async createSingleEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const embeddings = await this.createEmbedding(text, options)
    return embeddings[0]!
  }

  /**
   * Moderate a single piece of content (helper method)
   */
  async moderateSingleContent(text: string): Promise<ModerationResult> {
    return this.moderateContent(text)
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(
    audioFile: File | Buffer,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    const params: any = {
      file: audioFile as unknown as File,
      model: options.model || 'whisper-1',
    }

    if (options.language !== undefined) {
      params.language = options.language
    }
    if (options.prompt !== undefined) {
      params.prompt = options.prompt
    }
    if (options.response_format !== undefined) {
      params.response_format = options.response_format
    } else {
      params.response_format = 'text'
    }
    if (options.temperature !== undefined) {
      params.temperature = options.temperature
    }

    const response = await this.client.audio.transcriptions.create(params)

    return typeof response === 'string' ? response : response.text
  }

  /**
   * Translate audio to English using Whisper
   */
  async translateAudio(audioFile: File | Buffer, options: Omit<TranscriptionOptions, 'language'> = {}): Promise<string> {
    const params: any = {
      file: audioFile as unknown as File,
      model: options.model || 'whisper-1',
    }

    if (options.prompt !== undefined) {
      params.prompt = options.prompt
    }
    if (options.response_format !== undefined) {
      params.response_format = options.response_format
    } else {
      params.response_format = 'text'
    }
    if (options.temperature !== undefined) {
      params.temperature = options.temperature
    }

    const response = await this.client.audio.translations.create(params)

    return typeof response === 'string' ? response : response.text
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length')
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i]!, 0)
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Find most similar texts to a query using embeddings
   */
  async findSimilarTexts(
    query: string,
    texts: string[],
    options: EmbeddingOptions & { topK?: number } = {}
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    const topK = options.topK || 5

    // Generate embeddings
    const allTexts = [query, ...texts]
    const embeddings = await this.createEmbedding(allTexts, options)

    const queryEmbedding = embeddings[0]!
    const textEmbeddings = embeddings.slice(1)

    // Calculate similarities
    const similarities = textEmbeddings.map((embedding, index) => ({
      text: texts[index]!,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index: index
    }))

    // Sort by similarity and return top K
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
  }

  /**
   * Check if content is safe (not flagged by moderation)
   */
  async isContentSafe(text: string): Promise<boolean> {
    const result = await this.moderateSingleContent(text)
    return !result.flagged
  }
}

// Export singleton instance
export const openaiService = new OpenAIService()
