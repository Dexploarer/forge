/**
 * File Server Client Service
 *
 * Client for uploading/downloading files from the dedicated file server
 * File Server: ghcr.io/lassejlv/file-server:latest
 */

export interface FileUploadResult {
  /**
   * Public URL to access the file
   */
  url: string

  /**
   * File ID from file server
   */
  id: string

  /**
   * File path on server
   */
  filePath: string

  /**
   * Storage type (local or s3)
   */
  storageType: string

  /**
   * File size in bytes
   */
  size: number

  /**
   * Original filename
   */
  name: string

  /**
   * Created timestamp
   */
  createdAt: string
}

export interface FileServerConfig {
  /**
   * File server URL (internal or public)
   */
  url: string
}

// File server API response types
interface FileServerUploadResponse {
  data: {
    id: string
    path: string
    size: number
    name: string
    created_at: string
  }
  file_path: string
  storage_type: string
}

export class FileServerClientService {
  private fileServerUrl: string

  constructor(config?: FileServerConfig) {
    // Use internal Railway URL if available, otherwise public URL
    this.fileServerUrl = config?.url || this.getFileServerUrl()

    console.log('[FileServerClient] Initialized', {
      url: this.fileServerUrl,
    })
  }

  /**
   * Get file server URL from environment
   */
  private getFileServerUrl(): string {
    // Priority:
    // 1. FILE_SERVER_URL environment variable
    // 2. Railway internal URL (file-server.railway.internal)
    // 3. Public Railway URL

    if (process.env.FILE_SERVER_URL) {
      return process.env.FILE_SERVER_URL
    }

    if (process.env.RAILWAY_ENVIRONMENT) {
      // Use internal Railway URL for service-to-service communication
      return 'http://file-server.railway.internal:8888'
    }

    // Fallback to public URL (for local development)
    return 'https://file-server-production-2299.up.railway.app'
  }

  /**
   * Upload a file to the file server
   */
  async uploadFile(options: {
    /**
     * File data as Buffer
     */
    buffer: Buffer

    /**
     * Original filename
     */
    filename: string

    /**
     * MIME type (e.g., 'image/png', 'model/gltf-binary', 'audio/mpeg')
     */
    mimeType: string
  }): Promise<FileUploadResult> {
    const { buffer, filename, mimeType } = options

    const startTime = Date.now()

    try {
      // Create FormData with file
      const formData = new FormData()

      // Create a Blob from the buffer with proper MIME type
      const blob = new Blob([buffer], { type: mimeType })
      formData.append('file', blob, filename)

      // Upload to file server
      const response = await fetch(`${this.fileServerUrl}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`File server upload failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as FileServerUploadResponse

      // Parse response
      const fileId = result.data.id
      const filePath = result.file_path

      // Construct public URL
      // File server serves files at: /files/uploads/{id}
      const publicUrl = `${this.getPublicFileServerUrl()}${filePath}`

      const duration = Date.now() - startTime
      console.log('[FileServerClient] File uploaded successfully', {
        filename,
        fileId,
        size: buffer.length,
        duration: `${duration}ms`,
      })

      return {
        url: publicUrl,
        id: fileId,
        filePath: result.data.path,
        storageType: result.storage_type,
        size: result.data.size,
        name: result.data.name,
        createdAt: result.data.created_at,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[FileServerClient] Upload failed', {
        filename,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Upload multiple files in batch
   */
  async uploadFiles(
    files: Array<{
      buffer: Buffer
      filename: string
      mimeType: string
    }>
  ): Promise<FileUploadResult[]> {
    const startTime = Date.now()

    console.log(`[FileServerClient] Batch uploading ${files.length} files...`)

    // Upload files sequentially to avoid overwhelming the file server
    const results: FileUploadResult[] = []

    for (const file of files) {
      try {
        const result = await this.uploadFile(file)
        results.push(result)
      } catch (error) {
        console.error(`[FileServerClient] Failed to upload ${file.filename}:`, error)
        throw error
      }
    }

    const duration = Date.now() - startTime
    console.log(`[FileServerClient] Batch upload completed: ${results.length}/${files.length} successful (${duration}ms)`)

    return results
  }

  /**
   * Get public file server URL for external access
   */
  private getPublicFileServerUrl(): string {
    // For external links, always use the public Railway URL
    if (process.env.FILE_SERVER_PUBLIC_URL) {
      return process.env.FILE_SERVER_PUBLIC_URL
    }

    return 'https://file-server-production-2299.up.railway.app'
  }

  /**
   * Download a file from the file server
   */
  async downloadFile(fileUrl: string): Promise<Buffer> {
    const startTime = Date.now()

    try {
      const response = await fetch(fileUrl)

      if (!response.ok) {
        throw new Error(`File download failed: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const duration = Date.now() - startTime
      console.log('[FileServerClient] File downloaded', {
        url: fileUrl,
        size: buffer.length,
        duration: `${duration}ms`,
      })

      return buffer
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[FileServerClient] Download failed', {
        url: fileUrl,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Check file server health
   */
  async healthCheck(): Promise<boolean> {
    try {
      // File server doesn't have /health, so we just check the root
      const response = await fetch(`${this.fileServerUrl}/`)
      return response.ok
    } catch (error) {
      console.error('[FileServerClient] Health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const fileServerClient = new FileServerClientService()
