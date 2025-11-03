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
    console.log('[MinioService] 🚀 Initializing MinIO storage service', {
      hasEndpoint: !!env.MINIO_ENDPOINT,
      hasRootUser: !!env.MINIO_ROOT_USER,
      hasRootPassword: !!env.MINIO_ROOT_PASSWORD,
      publicHost: this.publicHost,
    })

    if (!env.MINIO_ENDPOINT || !env.MINIO_ROOT_USER || !env.MINIO_ROOT_PASSWORD) {
      console.warn('[MinioService] ⚠️  MinIO not configured - file uploads will fail', {
        missingEndpoint: !env.MINIO_ENDPOINT,
        missingUser: !env.MINIO_ROOT_USER,
        missingPassword: !env.MINIO_ROOT_PASSWORD,
      })
      return
    }

    try {
      // Detect SSL from endpoint protocol (http:// vs https://)
      const originalEndpoint = env.MINIO_ENDPOINT
      const useSSL = originalEndpoint.startsWith('https://')

      // Remove protocol from endpoint
      let endpoint = originalEndpoint.replace(/^https?:\/\//, '')

      // Extract port from endpoint if present (e.g., "host:9000" -> "host")
      let port = env.MINIO_PORT || 9000
      if (endpoint.includes(':')) {
        const parts = endpoint.split(':')
        endpoint = parts[0]!
        port = parseInt(parts[1]!, 10) || port
      }

      console.log('[MinioService] 🔧 Creating MinIO client', {
        endpoint,
        port,
        useSSL,
        detectedFromProtocol: true,
      })

      this.client = new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL,
        accessKey: env.MINIO_ROOT_USER,
        secretKey: env.MINIO_ROOT_PASSWORD,
      })

      console.log(`[MinioService] ✅ MinIO client initialized successfully`, {
        endpoint,
        port,
        useSSL,
        publicHost: this.publicHost,
      })
    } catch (error) {
      console.error('[MinioService] ❌ Failed to initialize MinIO client', {
        error: (error as Error).message,
        errorName: (error as Error).name,
        stack: (error as Error).stack,
        endpoint: env.MINIO_ENDPOINT,
      })
      this.client = null
    }
  }

  async ensureBuckets() {
    if (!this.client) {
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
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
    const startTime = Date.now()

    console.log('[MinioService] 📤 Starting file upload', {
      originalFilename,
      mimetype,
      sizeBytes: buffer.length,
      sizeKB: (buffer.length / 1024).toFixed(2),
      bucketOverride,
    })

    if (!this.client) {
      console.error('[MinioService] ❌ Upload failed - client not initialized')
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
    }

    const ext = originalFilename.split('.').pop() || 'bin'
    const filename = `${randomUUID()}.${ext}`
    const bucket = bucketOverride || this.getBucketForMimeType(mimetype)

    console.log('[MinioService] 📁 Determined upload target', {
      bucket,
      filename,
      ext,
      autoBucket: !bucketOverride,
    })

    try {
      // Ensure bucket exists
      console.log('[MinioService] 🔍 Checking if bucket exists', { bucket })
      const exists = await this.client.bucketExists(bucket)

      if (!exists) {
        console.log('[MinioService] 🆕 Creating new bucket', { bucket, region: 'us-east-1' })
        await this.client.makeBucket(bucket, 'us-east-1')
        console.log('[MinioService] ✅ Bucket created', { bucket })
      } else {
        console.log('[MinioService] ✓ Bucket already exists', { bucket })
      }

      // Upload file
      console.log('[MinioService] 📡 Uploading file to MinIO', {
        bucket,
        filename,
        size: buffer.length,
        contentType: mimetype,
      })

      await this.client.putObject(bucket, filename, buffer, Number(buffer.length), {
        'Content-Type': mimetype,
      })

      // Generate public URL
      const useSSL = env.MINIO_USE_SSL || false
      const protocol = useSSL ? 'https' : 'https' // Always use HTTPS for public URLs
      const url = `${protocol}://${this.publicHost}/${bucket}/${filename}`

      const elapsedTime = Date.now() - startTime

      console.log('[MinioService] ✅ File uploaded successfully', {
        bucket,
        filename,
        path: `${bucket}/${filename}`,
        url,
        sizeBytes: buffer.length,
        sizeKB: (buffer.length / 1024).toFixed(2),
        elapsedTimeMs: elapsedTime,
        uploadSpeedKBps: ((buffer.length / 1024) / (elapsedTime / 1000)).toFixed(2),
      })

      return {
        path: `${bucket}/${filename}`,
        url,
        filename,
        bucket,
      }
    } catch (error) {
      const elapsedTime = Date.now() - startTime

      console.error('[MinioService] ❌ Upload failed', {
        bucket,
        filename,
        originalFilename,
        error: (error as Error).message,
        errorName: (error as Error).name,
        stack: (error as Error).stack,
        elapsedTimeMs: elapsedTime,
      })

      throw new AppError(
        500,
        `Failed to upload file to MinIO: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MINIO_UPLOAD_FAILED'
      )
    }
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(bucket: string, filename: string): Promise<void> {
    const startTime = Date.now()

    console.log('[MinioService] 🗑️  Deleting file', {
      bucket,
      filename,
      path: `${bucket}/${filename}`,
    })

    if (!this.client) {
      console.error('[MinioService] ❌ Delete failed - client not initialized')
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
    }

    try {
      await this.client.removeObject(bucket, filename)

      const elapsedTime = Date.now() - startTime

      console.log('[MinioService] ✅ File deleted successfully', {
        bucket,
        filename,
        path: `${bucket}/${filename}`,
        elapsedTimeMs: elapsedTime,
      })
    } catch (error) {
      const elapsedTime = Date.now() - startTime

      console.error('[MinioService] ❌ Delete failed', {
        bucket,
        filename,
        error: (error as Error).message,
        errorName: (error as Error).name,
        stack: (error as Error).stack,
        elapsedTimeMs: elapsedTime,
      })

      throw new AppError(
        500,
        `Failed to delete file from MinIO: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      throw new AppError(400, 'Invalid file path', 'INVALID_PATH')
    }

    await this.deleteFile(bucket, filename)
  }

  /**
   * Get a presigned URL for private file access (expires in 7 days by default)
   */
  async getPresignedUrl(bucket: string, filename: string, expirySeconds = 604800): Promise<string> {
    if (!this.client) {
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
    }

    try {
      return await this.client.presignedGetObject(bucket, filename, expirySeconds)
    } catch (error) {
      console.error('MinIO presigned URL error:', error)
      throw new AppError(
        500,
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MINIO_PRESIGN_FAILED'
      )
    }
  }

  /**
   * List all files in a bucket
   */
  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    if (!this.client) {
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
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
        500,
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
    }

    try {
      return await this.client.statObject(bucket, filename)
    } catch (error) {
      console.error('MinIO stat error:', error)
      throw new AppError(
        500,
        `Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MINIO_STAT_FAILED'
      )
    }
  }

  /**
   * Download file as buffer
   */
  async downloadFile(bucket: string, filename: string): Promise<Buffer> {
    const startTime = Date.now()

    console.log('[MinioService] 📥 Downloading file', {
      bucket,
      filename,
      path: `${bucket}/${filename}`,
    })

    if (!this.client) {
      console.error('[MinioService] ❌ Download failed - client not initialized')
      throw new AppError(500, 'MinIO client not initialized', 'MINIO_NOT_CONFIGURED')
    }

    try {
      const stream = await this.client.getObject(bucket, filename)
      const chunks: Buffer[] = []

      console.log('[MinioService] 📡 Receiving file stream')

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk)
          if (chunks.length % 100 === 0) {
            console.log('[MinioService] 📦 Downloaded chunks', {
              chunkCount: chunks.length,
              totalBytes: chunks.reduce((sum, c) => sum + c.length, 0),
            })
          }
        })
        stream.on('error', (error) => {
          console.error('[MinioService] ❌ Stream error during download', {
            bucket,
            filename,
            error: error.message,
          })
          reject(error)
        })
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const elapsedTime = Date.now() - startTime

          console.log('[MinioService] ✅ File downloaded successfully', {
            bucket,
            filename,
            sizeBytes: buffer.length,
            sizeKB: (buffer.length / 1024).toFixed(2),
            sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
            chunkCount: chunks.length,
            elapsedTimeMs: elapsedTime,
            downloadSpeedKBps: ((buffer.length / 1024) / (elapsedTime / 1000)).toFixed(2),
          })

          resolve(buffer)
        })
      })
    } catch (error) {
      const elapsedTime = Date.now() - startTime

      console.error('[MinioService] ❌ Download failed', {
        bucket,
        filename,
        error: (error as Error).message,
        errorName: (error as Error).name,
        stack: (error as Error).stack,
        elapsedTimeMs: elapsedTime,
      })

      throw new AppError(
        500,
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
