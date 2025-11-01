#!/usr/bin/env bun
/**
 * Migration script to transfer all local files to MinIO
 *
 * This script:
 * 1. Finds all assets with local file storage
 * 2. Uploads them to MinIO
 * 3. Updates database records with new MinIO URLs
 * 4. Optionally deletes local files after successful migration
 *
 * Usage:
 *   bun scripts/migrate-to-minio.ts [--dry-run] [--keep-local]
 *
 * Options:
 *   --dry-run: Show what would be migrated without actually doing it
 *   --keep-local: Keep local files after migration (default: delete)
 */

import { db } from '@/database/db'
import { assets } from '@/database/schema'
import { minioStorageService } from '@/services/minio.service'
import { eq, isNotNull } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { env } from '@/config/env'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const keepLocal = args.includes('--keep-local')

interface MigrationResult {
  success: number
  failed: number
  skipped: number
  errors: Array<{ assetId: string; error: string }>
}

async function migrateAssets(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  console.log('🔍 Finding assets with local files...')

  // Find all assets with fileUrl
  const assetsToMigrate = await db.query.assets.findMany({
    where: isNotNull(assets.fileUrl),
  })

  console.log(`📦 Found ${assetsToMigrate.length} assets to process\n`)

  if (!minioStorageService.isAvailable()) {
    console.error('❌ MinIO is not configured. Please check your environment variables.')
    process.exit(1)
  }

  // Ensure buckets exist
  await minioStorageService.ensureBuckets()

  for (const asset of assetsToMigrate) {
    try {
      const metadata = asset.metadata as Record<string, any>

      // Skip if already migrated to MinIO
      if (metadata?.storageMode === 'minio' && metadata?.minioBucket) {
        console.log(`⏭️  Skipping ${asset.name} (already in MinIO)`)
        result.skipped++
        continue
      }

      // Get local file path
      let localPath: string | null = null

      // Try to get path from metadata
      if (metadata?.localPath) {
        localPath = metadata.localPath
      } else if (asset.fileUrl && !asset.fileUrl.startsWith('http')) {
        // Try to construct path from fileUrl
        localPath = join(env.FILE_STORAGE_PATH, asset.fileUrl.replace('/files/', ''))
      } else {
        console.log(`⚠️  Skipping ${asset.name} (no local path found)`)
        result.skipped++
        continue
      }

      console.log(`📤 Migrating: ${asset.name}`)
      console.log(`   Type: ${asset.type}`)
      console.log(`   Local path: ${localPath}`)

      if (isDryRun) {
        console.log(`   [DRY RUN] Would upload to MinIO\n`)
        result.success++
        continue
      }

      // Read local file
      let buffer: Buffer
      try {
        buffer = await readFile(localPath)
      } catch (error) {
        const errorMsg = `File not found at ${localPath}`
        console.error(`   ❌ ${errorMsg}`)
        result.failed++
        result.errors.push({ assetId: asset.id, error: errorMsg })
        continue
      }

      // Determine mimetype
      const mimeType = asset.mimeType || getMimeTypeFromPath(localPath)

      // Get filename from path
      const filename = localPath.split('/').pop() || 'unknown'

      // Upload to MinIO
      const minioData = await minioStorageService.uploadFile(
        buffer,
        mimeType,
        filename
      )

      console.log(`   ✅ Uploaded to MinIO: ${minioData.url}`)

      // Update database
      await db
        .update(assets)
        .set({
          fileUrl: minioData.url,
          metadata: {
            ...metadata,
            minioBucket: minioData.bucket,
            minioPath: minioData.path,
            minioUrl: minioData.url,
            localPath: keepLocal ? localPath : undefined,
            localUrl: keepLocal ? metadata?.localUrl : undefined,
            storageMode: 'minio',
            migratedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(assets.id, asset.id))

      console.log(`   ✅ Database updated`)

      // Optionally delete local file
      if (!keepLocal) {
        try {
          await Bun.write(localPath, '') // Clear file content
          console.log(`   🗑️  Local file cleared`)
        } catch (error) {
          console.warn(`   ⚠️  Could not delete local file: ${error}`)
        }
      }

      result.success++
      console.log('')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`   ❌ Migration failed: ${errorMsg}\n`)
      result.failed++
      result.errors.push({ assetId: asset.id, error: errorMsg })
    }
  }

  return result
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

// Main execution
async function main() {
  console.log('🚀 MinIO Migration Script\n')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Keep local files: ${keepLocal ? 'YES' : 'NO'}`)
  console.log('')

  const result = await migrateAssets()

  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${result.success}`)
  console.log(`   ❌ Failed: ${result.failed}`)
  console.log(`   ⏭️  Skipped: ${result.skipped}`)

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach(({ assetId, error }) => {
      console.log(`   - Asset ${assetId}: ${error}`)
    })
  }

  if (isDryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to perform actual migration.')
  }

  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
