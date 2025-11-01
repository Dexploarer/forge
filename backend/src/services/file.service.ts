import { mkdir, writeFile, unlink } from 'fs/promises'
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
  }

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
}

export const fileStorageService = new FileStorageService()
