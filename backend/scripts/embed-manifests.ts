#!/usr/bin/env bun
/**
 * Embed Manifest Data into Qdrant
 *
 * This script:
 * - Loads all manifest data from preview_manifests table
 * - Extracts embeddable text from each item
 * - Generates embeddings via Vercel AI Gateway
 * - Stores in Qdrant for semantic search
 */

import { db } from '@/database/db'
import { previewManifests } from '@/database/schema'
import { isNull } from 'drizzle-orm'
import { ContentEmbedderService } from '@/services/content-embedder.service'
import { CONTENT_TYPES } from '@/services/qdrant.service'

// Manifest type to Qdrant content type mapping
const MANIFEST_TO_CONTENT_TYPE: Record<string, keyof typeof CONTENT_TYPES> = {
  items: 'ITEM',
  npcs: 'NPC',
  music: 'ASSET', // Could create MUSIC type if needed
  biomes: 'ASSET',
  zones: 'ASSET',
  world: 'ASSET',
  banks: 'ASSET',
  stores: 'ASSET',
  avatars: 'CHARACTER',
  asset_requirements: 'MANIFEST',
  generation_configs: 'MANIFEST',
  resources: 'ITEM',
  buildings: 'ASSET',
}

interface EmbedResult {
  manifestType: string
  totalItems: number
  embedded: number
  failed: number
  duration: number
}

async function embedManifests(): Promise<EmbedResult[]> {
  const contentEmbedder = new ContentEmbedderService()

  console.log('🎮 Embedding Game Manifests into Qdrant\n')
  console.log('=' .repeat(60))

  // 1. Initialize embedder
  console.log('\n🔧 Initializing Content Embedder + Qdrant...')
  await contentEmbedder.initialize()
  console.log('✅ Ready to embed content')

  // 2. Load all global manifests
  console.log('\n📖 Loading manifests from database...')
  const manifests = await db.query.previewManifests.findMany({
    where: isNull(previewManifests.userId),
  })

  console.log(`Found ${manifests.length} global manifests\n`)

  const results: EmbedResult[] = []

  // 3. Embed each manifest type
  for (const manifest of manifests) {
    const startTime = Date.now()
    const manifestType = manifest.manifestType
    const contentType = MANIFEST_TO_CONTENT_TYPE[manifestType]

    if (!contentType) {
      console.log(`⚠️  ${manifestType}: No content type mapping, skipping`)
      continue
    }

    console.log(`\n📦 Processing ${manifestType} manifest...`)
    const items = Array.isArray(manifest.content) ? manifest.content : [manifest.content]

    if (items.length === 0) {
      console.log(`   ⚠️  Empty manifest, skipping`)
      results.push({
        manifestType,
        totalItems: 0,
        embedded: 0,
        failed: 0,
        duration: Date.now() - startTime,
      })
      continue
    }

    console.log(`   Items to embed: ${items.length}`)

    let embedded = 0
    let failed = 0

    // Embed items in batches
    const batchItems = items.map((item: any, index: number) => {
      // Generate unique ID for each item
      const itemId = item.id || item.name || `${manifestType}_${index}`

      return {
        id: itemId,
        data: item,
        metadata: {
          manifestType,
          name: item.name,
          type: item.type || item.category,
          id: item.id,
        },
      }
    })

    try {
      // Use batch embedding for efficiency
      await contentEmbedder.embedBatch(
        CONTENT_TYPES[contentType],
        batchItems
      )

      embedded = items.length
      console.log(`   ✅ Embedded ${embedded} items`)
    } catch (error: any) {
      console.error(`   ❌ Batch embedding failed: ${error.message}`)
      failed = items.length
    }

    const duration = Date.now() - startTime

    results.push({
      manifestType,
      totalItems: items.length,
      embedded,
      failed,
      duration,
    })

    console.log(`   ⏱️  Duration: ${duration}ms`)
  }

  return results
}

async function main() {
  console.log('🚀 Manifest Embedding Pipeline\n')

  try {
    const results = await embedManifests()

    // Summary
    console.log('\n\n' + '=' .repeat(60))
    console.log('📊 Embedding Summary')
    console.log('=' .repeat(60))

    let totalEmbedded = 0
    let totalFailed = 0
    let totalDuration = 0

    results.forEach((result) => {
      console.log(`\n${result.manifestType}:`)
      console.log(`  Total Items: ${result.totalItems}`)
      console.log(`  ✅ Embedded: ${result.embedded}`)
      console.log(`  ❌ Failed: ${result.failed}`)
      console.log(`  ⏱️  Duration: ${result.duration}ms`)

      totalEmbedded += result.embedded
      totalFailed += result.failed
      totalDuration += result.duration
    })

    console.log('\n' + '=' .repeat(60))
    console.log('TOTAL:')
    console.log(`  ✅ Successfully embedded: ${totalEmbedded} items`)
    console.log(`  ❌ Failed: ${totalFailed} items`)
    console.log(`  ⏱️  Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`)
    console.log('=' .repeat(60))

    console.log('\n💡 Semantic Search Now Available!')
    console.log('   Query examples:')
    console.log('   - "powerful melee weapon" → finds mithril sword')
    console.log('   - "starting equipment" → finds bronze tier items')
    console.log('   - "forest area" → finds biomes and zones')
    console.log('   - "background music" → finds music tracks')

    process.exit(totalFailed > 0 ? 1 : 0)
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
