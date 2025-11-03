import { mkdir, writeFile, unlink, stat, readdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { env } from '../config/env'

export class FileStorageService {
  private uploadPath: string

  constructor() {
    this.uploadPath = env.FILE_STORAGE_PATH
  }

  async initialize() {
    await mkdir(this.uploadPath, { recursive: true })
    await mkdir(join(this.uploadPath, 'models'), { recursive: true })
    await mkdir(join(this.uploadPath, 'audio'), { recursive: true })
    await mkdir(join(this.uploadPath, 'textures'), { recursive: true })
    await mkdir(join(this.uploadPath, '3d-models'), { recursive: true })
    await mkdir(join(this.uploadPath, 'images'), { recursive: true })
  }

  // =====================================================
  // Core Methods (original API)
  // =====================================================

  async saveFile(
    buffer: Buffer,
    mimetype: string,
    originalFilename: string
  ): Promise<{ path: string; url: string; filename: string }> {
    const ext = originalFilename.split('.').pop()
    const filename = `${randomUUID()}.${ext}`

    let subdir = 'textures'
    if (mimetype.includes('model') || mimetype.includes('gltf')) {
      subdir = 'models'
    } else if (mimetype.includes('audio')) {
      subdir = 'audio'
    }

    const filePath = join(this.uploadPath, subdir, filename)
    const fileUrl = env.FILE_SERVER_URL
      ? `${env.FILE_SERVER_URL}/${subdir}/${filename}`
      : `/files/${subdir}/${filename}`

    await writeFile(filePath, buffer)

    return {
      path: filePath,
      url: fileUrl,
      filename,
    }
  }

  async deleteFile(filePath: string) {
    try {
      await unlink(filePath)
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  validateFileType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => mimetype.includes(type))
  }

  validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize
  }

  // =====================================================
  // MinIO-Compatible Methods (adapter layer)
  // =====================================================

  /**
   * Check if storage is available (always true for local file storage)
   */
  isAvailable(): boolean {
    return true
  }

  /**
   * Upload file with MinIO-compatible return structure
   */
  async uploadFile(
    buffer: Buffer,
    mimetype: string,
    originalFilename: string
  ): Promise<{ path: string; url: string; filename: string; bucket: string }> {
    const result = await this.saveFile(buffer, mimetype, originalFilename)

    // Determine bucket name from path
    let bucket = 'assets'
    if (result.path.includes('/models/')) bucket = 'models'
    else if (result.path.includes('/audio/')) bucket = 'audio'
    else if (result.path.includes('/textures/')) bucket = 'textures'
    else if (result.path.includes('/3d-models/')) bucket = '3d-models'
    else if (result.path.includes('/images/')) bucket = 'images'

    return {
      ...result,
      bucket,
    }
  }

  /**
   * List files in a "bucket" (directory)
   */
  async listFiles(bucketName: string): Promise<string[]> {
    try {
      const dirPath = join(this.uploadPath, bucketName)
      await mkdir(dirPath, { recursive: true })
      const files = await readdir(dirPath)
      return files.filter(f => !f.startsWith('.')) // Filter out hidden files
    } catch (error) {
      console.error(`Failed to list files in ${bucketName}:`, error)
      return []
    }
  }

  /**
   * Delete file by path (supports both full paths and bucket/filename)
   */
  async deleteFileByPath(path: string) {
    try {
      // If path looks like "bucket/filename", convert to full path
      if (!path.startsWith('/') && !path.includes(this.uploadPath)) {
        const fullPath = join(this.uploadPath, path)
        await unlink(fullPath)
      } else {
        await unlink(path)
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  /**
   * Get file stats (for size, etc.)
   */
  async getFileStats(bucketName: string, filename: string): Promise<{ size: number }> {
    try {
      const filePath = join(this.uploadPath, bucketName, filename)
      const stats = await stat(filePath)
      return { size: stats.size }
    } catch (error) {
      console.error(`Failed to get file stats for ${bucketName}/${filename}:`, error)
      return { size: 0 }
    }
  }
}

export const fileStorageService = new FileStorageService()
