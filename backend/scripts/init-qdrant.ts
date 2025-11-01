#!/usr/bin/env bun
/**
 * Initialize Qdrant Vector Database
 *
 * This script:
 * - Tests connection to Qdrant on Railway
 * - Initializes all content type collections
 * - Creates HNSW indexes for fast similarity search
 * - Creates payload indexes for filtering
 */

import { qdrantService, CONTENT_TYPES } from '@/services/qdrant.service'

async function initializeQdrant() {
  console.log('🔵 Qdrant Initialization\n')
  console.log('=' .repeat(60))

  // 1. Health check
  console.log('\n📡 Testing Qdrant connection...')
  const isHealthy = await qdrantService.healthCheck()

  if (!isHealthy) {
    console.error('❌ Failed to connect to Qdrant')
    console.error('   Check QDRANT_URL in .env')
    console.error('   Expected: http://qdrant.railway.internal:6333')
    process.exit(1)
  }

  console.log('✅ Qdrant connection successful')

  // 2. Get existing collections
  console.log('\n📋 Checking existing collections...')
  try {
    const client = (qdrantService as any).client
    const { collections } = await client.getCollections()

    console.log(`Found ${collections.length} existing collections:`)
    collections.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.points_count || 0} points)`)
    })
  } catch (error: any) {
    console.error('❌ Failed to list collections:', error.message)
  }

  // 3. Initialize all content type collections
  console.log('\n🔧 Initializing content type collections...')
  console.log(`Creating ${Object.values(CONTENT_TYPES).length} collections:`)
  Object.values(CONTENT_TYPES).forEach((type) => {
    console.log(`  - content_${type}`)
  })
  console.log()

  try {
    await qdrantService.initializeCollections()
    console.log('✅ All collections initialized successfully')
  } catch (error: any) {
    console.error('❌ Failed to initialize collections:', error.message)
    process.exit(1)
  }

  // 4. Verify collections
  console.log('\n✓ Verifying collections...')
  const stats = await qdrantService.getAllStats()

  console.log('\n📊 Collection Statistics:')
  Object.entries(stats).forEach(([contentType, stat]: [string, any]) => {
    if (stat.error) {
      console.log(`  ❌ ${contentType}: ${stat.error}`)
    } else {
      console.log(`  ✅ content_${contentType}:`)
      console.log(`     Points: ${stat.points_count || 0}`)
      console.log(`     Vector size: ${stat.config?.params?.vectors?.size || 1536}`)
      console.log(`     Distance: ${stat.config?.params?.vectors?.distance || 'Cosine'}`)
      console.log(`     Status: ${stat.status || 'unknown'}`)
    }
  })

  console.log('\n' + '=' .repeat(60))
  console.log('✅ Qdrant initialization complete!')
  console.log('=' .repeat(60))
  console.log('\nReady to embed content:')
  console.log('  - Items (weapons, tools, resources)')
  console.log('  - NPCs (characters, dialogue)')
  console.log('  - Lore (world-building content)')
  console.log('  - Quests (objectives, rewards)')
  console.log('  - Manifests (game data)')
  console.log('  - Music (tracks, metadata)')
  console.log('  - And more...')

  process.exit(0)
}

initializeQdrant().catch((error) => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
