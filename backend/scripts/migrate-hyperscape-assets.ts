#!/usr/bin/env bun
/**
 * Migrate HyperscapeAI/assets repo to MinIO
 * Uploads all files from the cloned assets repo
 */

import { minioStorageService } from '@/services/minio.service'
import { readFile, readdir, stat } from 'fs/promises'
import { join, extname, relative } from 'path'

const ASSETS_REPO_PATH = '/tmp/assets'

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

      // Skip .git directory
      if (entry.name === '.git') continue

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
    '.hdr': 'image/vnd.radiance',
    '.wasm': 'application/wasm',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

function getBucketFromPath(filePath: string): string {
  const relativePath = filePath.replace(ASSETS_REPO_PATH + '/', '')

  // Determine bucket based on path
  if (relativePath.startsWith('music/')) return 'audio'
  if (relativePath.startsWith('models/') && relativePath.includes('/voice/')) return 'audio'
  if (relativePath.startsWith('models/')) return '3d-models'
  if (relativePath.startsWith('world/')) return '3d-models'
  if (relativePath.includes('.png') || relativePath.includes('.jpg') || relativePath.includes('.hdr')) return 'images'
  if (relativePath.startsWith('web/')) return 'assets'

  return 'assets'
}

async function migrateHyperscapeAssets(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`🔍 Scanning ${ASSETS_REPO_PATH} for files...`)

  const allFiles = await getAllFiles(ASSETS_REPO_PATH)
  console.log(`📦 Found ${allFiles.length} files to migrate\n`)

  if (!minioStorageService.isAvailable()) {
    console.error('❌ MinIO is not configured.')
    process.exit(1)
  }

  await minioStorageService.ensureBuckets()

  for (const filePath of allFiles) {
    try {
      const relativePath = relative(ASSETS_REPO_PATH, filePath)
      const bucket = getBucketFromPath(filePath)
      const mimeType = getMimeTypeFromPath(filePath)

      // Preserve directory structure in filename
      const minioFilename = relativePath.replace(/\//g, '_')

      console.log(`📤 ${relativePath}`)
      console.log(`   → ${bucket}/${minioFilename}`)

      // Read file
      const buffer = await readFile(filePath)

      // Upload to MinIO
      const minioData = await minioStorageService.uploadFile(
        buffer,
        mimeType,
        minioFilename,
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
  console.log('🚀 HyperscapeAI Assets → MinIO Migration\n')

  const result = await migrateHyperscapeAssets()

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

  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
