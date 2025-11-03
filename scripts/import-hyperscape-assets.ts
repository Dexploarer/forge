#!/usr/bin/env bun
/**
 * Import all assets from HyperscapeAI/assets repository
 * Uploads to MinIO and creates database records
 *
 * Usage:
 *   railway run bun scripts/import-hyperscape-assets.ts [--dry-run]
 */

import { minioStorageService } from '../backend/src/services/minio.service'
import { db } from '../backend/src/database/db'
import { assets } from '../backend/src/database/schema'
import { readFile, readdir, stat } from 'fs/promises'
import { join, extname, basename, dirname, relative } from 'path'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

const ASSETS_REPO_PATH = process.env.ASSETS_REPO_PATH || '/tmp/hyperscape-assets'

interface ImportStats {
  total: number
  success: number
  failed: number
  skipped: number
  errors: Array<{ file: string; error: string }>
}

interface AssetInfo {
  path: string
  name: string
  type: 'model' | 'audio' | 'texture' | 'image'
  mimetype: string
  bucket: string
  category?: string
}

function getMimeType(filepath: string): string {
  const ext = extname(filepath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

function getAssetType(filepath: string): 'model' | 'audio' | 'texture' | 'image' {
  const ext = extname(filepath).toLowerCase()
  if (['.glb', '.gltf'].includes(ext)) return 'model'
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return 'audio'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image'
  return 'texture'
}

function getBucket(type: string): string {
  const bucketMap: Record<string, string> = {
    model: '3d-models',
    audio: 'audio',
    image: 'images',
    texture: 'images',
  }
  return bucketMap[type] || 'assets'
}

function getAssetName(filepath: string): string {
  const name = basename(filepath, extname(filepath))
  // Clean up the name
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getCategory(filepath: string): string | undefined {
  const parts = filepath.split('/')
  const modelsIndex = parts.indexOf('models')
  const musicIndex = parts.indexOf('music')

  if (modelsIndex >= 0 && parts.length > modelsIndex + 1) {
    return parts[modelsIndex + 1]
  }
  if (musicIndex >= 0 && parts.length > musicIndex + 1) {
    return parts[musicIndex + 1]
  }
  return undefined
}

async function scanAssets(dir: string): Promise<AssetInfo[]> {
  const assetInfos: AssetInfo[] = []
  const ext = extname(dir).toLowerCase()

  // Check if this is a file
  const stats = await stat(dir)
  if (stats.isFile()) {
    if (['.glb', '.gltf', '.mp3', '.wav', '.ogg', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const type = getAssetType(dir)
      assetInfos.push({
        path: dir,
        name: getAssetName(dir),
        type,
        mimetype: getMimeType(dir),
        bucket: getBucket(type),
        category: getCategory(dir),
      })
    }
    return assetInfos
  }

  // Scan directory recursively
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      // Skip git directories
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      const subAssets = await scanAssets(fullPath)
      assetInfos.push(...subAssets)
    } else {
      const ext = extname(entry.name).toLowerCase()
      if (['.glb', '.gltf', '.mp3', '.wav', '.ogg', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        const type = getAssetType(fullPath)
        assetInfos.push({
          path: fullPath,
          name: getAssetName(fullPath),
          type,
          mimetype: getMimeType(fullPath),
          bucket: getBucket(type),
          category: getCategory(fullPath),
        })
      }
    }
  }

  return assetInfos
}

async function importAsset(assetInfo: AssetInfo, stats: ImportStats): Promise<void> {
  const relativePath = relative(ASSETS_REPO_PATH, assetInfo.path)
  console.log(`\n📦 ${relativePath}`)
  console.log(`   Name: ${assetInfo.name}`)
  console.log(`   Type: ${assetInfo.type}`)
  console.log(`   Category: ${assetInfo.category || 'N/A'}`)
  console.log(`   Bucket: ${assetInfo.bucket}`)

  if (isDryRun) {
    console.log(`   [DRY RUN] Would import to MinIO and database`)
    stats.success++
    return
  }

  try {
    // Read file
    const buffer = await readFile(assetInfo.path)
    const fileSize = buffer.length
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)

    // Upload to MinIO
    console.log(`   📤 Uploading to MinIO...`)
    const minioData = await minioStorageService.uploadFile(
      buffer,
      assetInfo.mimetype,
      basename(assetInfo.path),
      assetInfo.bucket
    )

    console.log(`   ✅ MinIO: ${minioData.url}`)

    // Create database record
    const [asset] = await db.insert(assets).values({
      name: assetInfo.name,
      description: `Imported from HyperscapeAI/assets: ${relativePath}`,
      type: assetInfo.type,
      status: 'published',
      visibility: 'public',
      ownerId: process.env.IMPORT_USER_ID || '00000000-0000-0000-0000-000000000000', // System/import user
      fileUrl: minioData.url,
      fileSize,
      mimeType: assetInfo.mimetype,
      tags: assetInfo.category ? [assetInfo.category] : [],
      metadata: {
        storageMode: 'minio',
        minioBucket: minioData.bucket,
        minioPath: minioData.path,
        minioUrl: minioData.url,
        originalPath: relativePath,
        category: assetInfo.category,
        source: 'HyperscapeAI/assets',
        importedAt: new Date().toISOString(),
      },
      publishedAt: new Date(),
    }).returning()

    console.log(`   ✅ Database: ${asset?.id}`)
    stats.success++

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`   ❌ Failed: ${errorMsg}`)
    stats.failed++
    stats.errors.push({ file: assetInfo.path, error: errorMsg })
  }
}

async function cloneAssetsRepo(): Promise<void> {
  const { existsSync } = await import('fs')
  const { execSync } = await import('child_process')

  if (existsSync(ASSETS_REPO_PATH)) {
    console.log(`📁 Assets repo already exists at ${ASSETS_REPO_PATH}`)
    return
  }

  console.log('📥 Cloning HyperscapeAI/assets repository...')
  try {
    execSync(
      `git clone https://github.com/HyperscapeAI/assets.git ${ASSETS_REPO_PATH}`,
      { stdio: 'inherit' }
    )
    console.log('✅ Repository cloned successfully\n')
  } catch (error) {
    console.error('❌ Failed to clone repository:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 Hyperscape Assets Import\n')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Source: ${ASSETS_REPO_PATH}\n`)

  const stats: ImportStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // Clone assets repo if needed
  await cloneAssetsRepo()

  // Check MinIO availability
  if (!isDryRun && !minioStorageService.isAvailable()) {
    console.error('❌ MinIO is not available')
    process.exit(1)
  }

  // Ensure buckets exist
  if (!isDryRun) {
    console.log('📦 Ensuring MinIO buckets exist...')
    await minioStorageService.ensureBuckets()
    console.log('✅ Buckets ready\n')
  }

  // Scan for assets
  console.log('🔍 Scanning for assets...')
  const assetInfos = await scanAssets(ASSETS_REPO_PATH)
  stats.total = assetInfos.length

  console.log(`\n📊 Found ${assetInfos.length} assets:`)
  const byType = assetInfos.reduce((acc, info) => {
    acc[info.type] = (acc[info.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type}: ${count}`)
  }

  // Import each asset
  console.log('\n🚀 Starting import...\n')
  for (const assetInfo of assetInfos) {
    await importAsset(assetInfo, stats)
  }

  // Summary
  console.log('\n\n📊 Import Summary:')
  console.log(`   Total: ${stats.total}`)
  console.log(`   ✅ Success: ${stats.success}`)
  console.log(`   ❌ Failed: ${stats.failed}`)
  console.log(`   ⏭️  Skipped: ${stats.skipped}`)

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:')
    stats.errors.forEach(({ file, error }) => {
      console.log(`   - ${relative(ASSETS_REPO_PATH, file)}: ${error}`)
    })
  }

  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to perform actual import.')
  } else {
    console.log('\n✅ Import complete!')
  }

  process.exit(stats.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
