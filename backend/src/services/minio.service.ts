import * as Minio from 'minio'
import { randomUUID } from 'crypto'
import { env } from '@/config/env'
import { AppError } from '@/utils/errors'

export class MinioStorageService {
  private client: Minio.Client | null = null
  private buckets = {
    assets: 'assets',
    uploads: 'uploads',
    audio: 'audio',
    '3d-models': '3d-models',
    images: 'images',
  }
  private publicHost: string

  constructor() {
    this.publicHost = env.MINIO_PUBLIC_HOST || 'localhost:9000'
    this.initialize()
  }

  private initialize() {
    if (!env.MINIO_ENDPOINT || !env.MINIO_ROOT_USER || !env.MINIO_ROOT_PASSWORD) {
      console.warn('⚠️  MinIO not configured - file uploads will fail')
      return
    }

    try {
      // Remove protocol from endpoint if present
      let endpoint = env.MINIO_ENDPOINT
      endpoint = endpoint.replace(/^https?:\/\//, '')

      this.client = new Minio.Client({
        endPoint: endpoint,
        port: env.MINIO_PORT || 9000,
        useSSL: env.MINIO_USE_SSL || false,
        accessKey: env.MINIO_ROOT_USER,
        secretKey: env.MINIO_ROOT_PASSWORD,
      })
      console.log(`✅ MinIO client initialized (${endpoint}:${env.MINIO_PORT || 9000}, SSL: ${env.MINIO_USE_SSL || false})`)
    } catch (error) {
      console.error('❌ Failed to initialize MinIO client:', error)
      this.client = null
    }
  }

  async ensureBuckets() {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    for (const bucket of Object.values(this.buckets)) {
      try {
        const exists = await this.client.bucketExists(bucket)
        if (!exists) {
          await this.client.makeBucket(bucket, 'us-east-1')
          console.log(`✅ Created bucket: ${bucket}`)
        }
      } catch (error) {
        console.error(`Failed to ensure bucket ${bucket}:`, error)
      }
    }
  }

  /**
   * Get the appropriate bucket for a file based on mimetype
   */
  private getBucketForMimeType(mimetype: string): string {
    if (mimetype.includes('model') || mimetype.includes('gltf') || mimetype.includes('glb')) {
      return this.buckets['3d-models']
    }
    if (mimetype.includes('audio')) {
      return this.buckets.audio
    }
    if (mimetype.includes('image')) {
      return this.buckets.images
    }
    return this.buckets.uploads
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(
    buffer: Buffer,
    mimetype: string,
    originalFilename: string,
    bucketOverride?: string
  ): Promise<{ path: string; url: string; filename: string; bucket: string }> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    const ext = originalFilename.split('.').pop() || 'bin'
    const filename = `${randomUUID()}.${ext}`
    const bucket = bucketOverride || this.getBucketForMimeType(mimetype)

    try {
      // Ensure bucket exists
      const exists = await this.client.bucketExists(bucket)
      if (!exists) {
        await this.client.makeBucket(bucket, 'us-east-1')
      }

      // Upload file
      await this.client.putObject(bucket, filename, buffer, buffer.length, {
        'Content-Type': mimetype,
      })

      // Generate public URL
      const useSSL = env.MINIO_USE_SSL || false
      const protocol = useSSL ? 'https' : 'https' // Always use HTTPS for public URLs
      const url = `${protocol}://${this.publicHost}/${bucket}/${filename}`

      return {
        path: `${bucket}/${filename}`,
        url,
        filename,
        bucket,
      }
    } catch (error) {
      console.error('MinIO upload error:', error)
      throw new AppError(
        `Failed to upload file to MinIO: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_UPLOAD_FAILED'
      )
    }
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(bucket: string, filename: string): Promise<void> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    try {
      await this.client.removeObject(bucket, filename)
      console.log(`Deleted file: ${bucket}/${filename}`)
    } catch (error) {
      console.error('MinIO delete error:', error)
      throw new AppError(
        `Failed to delete file from MinIO: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_DELETE_FAILED'
      )
    }
  }

  /**
   * Delete file by path (bucket/filename)
   */
  async deleteFileByPath(path: string): Promise<void> {
    const [bucket, ...filenameParts] = path.split('/')
    const filename = filenameParts.join('/')

    if (!bucket || !filename) {
      throw new AppError('Invalid file path', 400, 'INVALID_PATH')
    }

    await this.deleteFile(bucket, filename)
  }

  /**
   * Get a presigned URL for private file access (expires in 7 days by default)
   */
  async getPresignedUrl(bucket: string, filename: string, expirySeconds = 604800): Promise<string> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    try {
      return await this.client.presignedGetObject(bucket, filename, expirySeconds)
    } catch (error) {
      console.error('MinIO presigned URL error:', error)
      throw new AppError(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_PRESIGN_FAILED'
      )
    }
  }

  /**
   * List all files in a bucket
   */
  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    try {
      const stream = this.client.listObjects(bucket, prefix, true)
      const files: string[] = []

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            files.push(obj.name)
          }
        })
        stream.on('error', reject)
        stream.on('end', () => resolve(files))
      })
    } catch (error) {
      console.error('MinIO list error:', error)
      throw new AppError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_LIST_FAILED'
      )
    }
  }

  /**
   * Check if MinIO is configured and available
   */
  isAvailable(): boolean {
    return this.client !== null
  }

  /**
   * Get file stats
   */
  async getFileStats(bucket: string, filename: string): Promise<Minio.BucketItemStat> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    try {
      return await this.client.statObject(bucket, filename)
    } catch (error) {
      console.error('MinIO stat error:', error)
      throw new AppError(
        `Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_STAT_FAILED'
      )
    }
  }

  /**
   * Download file as buffer
   */
  async downloadFile(bucket: string, filename: string): Promise<Buffer> {
    if (!this.client) {
      throw new AppError('MinIO client not initialized', 500, 'MINIO_NOT_CONFIGURED')
    }

    try {
      const stream = await this.client.getObject(bucket, filename)
      const chunks: Buffer[] = []

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks)))
      })
    } catch (error) {
      console.error('MinIO download error:', error)
      throw new AppError(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MINIO_DOWNLOAD_FAILED'
      )
    }
  }

  validateFileType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.some((type) => mimetype.includes(type))
  }

  validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize
  }
}

export const minioStorageService = new MinioStorageService()
