#!/usr/bin/env bun
/**
 * Comprehensive file migration to MinIO
 * Migrates ALL local files in uploads/ directory to MinIO
 *
 * Usage:
 *   bun scripts/migrate-all-files-to-minio.ts [--dry-run]
 */

import { minioStorageService } from '@/services/minio.service'
import { readFile, readdir } from 'fs/promises'
import { join, extname, basename } from 'path'
import { env } from '@/config/env'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

interface MigrationResult {
  success: number
  failed: number
  skipped: number
  errors: Array<{ file: string; error: string }>
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function scan(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(directory, entry.name)

      if (entry.isDirectory()) {
        await scan(fullPath)
      } else {
        files.push(fullPath)
      }
    }
  }

  await scan(dir)
  return files
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'model/fbx',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

function getBucketFromPath(filePath: string): string {
  if (filePath.includes('/audio/')) return 'audio'
  if (filePath.includes('/models/')) return '3d-models'
  if (filePath.includes('/textures/')) return 'images'
  return 'uploads'
}

async function migrateAllFiles(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  const uploadsPath = env.FILE_STORAGE_PATH
  console.log(`🔍 Scanning ${uploadsPath} for files...`)

  const allFiles = await getAllFiles(uploadsPath)
  console.log(`📦 Found ${allFiles.length} files to migrate\n`)

  if (!minioStorageService.isAvailable()) {
    console.error('❌ MinIO is not configured.')
    process.exit(1)
  }

  await minioStorageService.ensureBuckets()

  for (const filePath of allFiles) {
    try {
      const relativePath = filePath.replace(uploadsPath + '/', '')
      const filename = basename(filePath)
      const bucket = getBucketFromPath(filePath)
      const mimeType = getMimeTypeFromPath(filePath)

      console.log(`📤 ${relativePath}`)
      console.log(`   Bucket: ${bucket}`)
      console.log(`   Type: ${mimeType}`)

      if (isDryRun) {
        console.log(`   [DRY RUN] Would upload to MinIO\n`)
        result.success++
        continue
      }

      // Read file
      const buffer = await readFile(filePath)

      // Upload to MinIO
      const minioData = await minioStorageService.uploadFile(
        buffer,
        mimeType,
        filename,
        bucket
      )

      console.log(`   ✅ ${minioData.url}\n`)
      result.success++

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`   ❌ Failed: ${errorMsg}\n`)
      result.failed++
      result.errors.push({ file: filePath, error: errorMsg })
    }
  }

  return result
}

async function main() {
  console.log('🚀 Comprehensive MinIO Migration\n')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  const result = await migrateAllFiles()

  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${result.success}`)
  console.log(`   ❌ Failed: ${result.failed}`)
  console.log(`   ⏭️  Skipped: ${result.skipped}`)

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`)
    })
  }

  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to perform actual migration.')
  }

  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
