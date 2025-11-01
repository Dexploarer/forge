#!/usr/bin/env bun
/**
 * Qdrant Verification & Testing Script
 *
 * This script:
 * - Tests Qdrant connection
 * - Tests embedding generation via AI Gateway
 * - Tests semantic search
 * - Tests context building for AI
 */

import { ContentEmbedderService } from '@/services/content-embedder.service'
import { qdrantService } from '@/services/qdrant.service'

async function testQdrant() {
  console.log('🧪 Qdrant Verification & Testing\n')
  console.log('=' .repeat(60))

  const contentEmbedder = new ContentEmbedderService()

  // Test 1: Qdrant Connection
  console.log('\n[1/5] Testing Qdrant Connection...')
  const isHealthy = await qdrantService.healthCheck()

  if (!isHealthy) {
    console.error('❌ Qdrant connection failed')
    console.error('   Make sure Qdrant is running and accessible')
    process.exit(1)
  }

  console.log('✅ Qdrant connection successful')

  // Test 2: Collection Stats
  console.log('\n[2/5] Fetching Collection Statistics...')
  try {
    const stats = await qdrantService.getAllStats()

    console.log('\n📊 Collections:')
    Object.entries(stats).forEach(([contentType, stat]: [string, any]) => {
      if (!stat.error) {
        console.log(`  ✅ content_${contentType}: ${stat.points_count || 0} points`)
      }
    })
  } catch (error: any) {
    console.error('❌ Failed to fetch stats:', error.message)
  }

  // Test 3: Embedding Generation
  console.log('\n[3/5] Testing Embedding Generation (via AI Gateway)...')
  try {
    const testText = 'A powerful sword for experienced warriors'
    console.log(`   Input: "${testText}"`)

    const embedding = await contentEmbedder.generateEmbedding(testText)

    console.log(`   ✅ Generated ${embedding.length}-dimensional embedding`)
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  } catch (error: any) {
    console.error('❌ Embedding generation failed:', error.message)
    console.error('   Check OPENAI_API_KEY or AI_GATEWAY_API_KEY in .env')
  }

  // Test 4: Semantic Search
  console.log('\n[4/5] Testing Semantic Search...')
  const searchQueries = [
    'powerful weapon for high level players',
    'starting equipment for new players',
    'forest area with trees',
    'background music for exploration',
  ]

  for (const query of searchQueries) {
    try {
      console.log(`\n   Query: "${query}"`)

      const results = await contentEmbedder.findSimilar(query, {
        limit: 3,
        threshold: 0.5,
      })

      if (results.length === 0) {
        console.log('   ⚠️  No results found (might need to run embed-manifests.ts first)')
      } else {
        console.log(`   ✅ Found ${results.length} results:`)
        results.forEach((result, i) => {
          const similarity = (result.similarity * 100).toFixed(1)
          const contentPreview = result.content.substring(0, 60).replace(/\n/g, ' ')
          console.log(`      ${i + 1}. [${result.contentType}] ${similarity}% - ${contentPreview}...`)
        })
      }
    } catch (error: any) {
      console.error(`   ❌ Search failed: ${error.message}`)
    }
  }

  // Test 5: AI Context Building
  console.log('\n[5/5] Testing AI Context Building...')
  try {
    const query = 'Generate a new weapon for level 15 warrior'
    console.log(`   Query: "${query}"`)

    const context = await contentEmbedder.buildContext(query, {
      limit: 3,
      threshold: 0.6,
    })

    if (context.hasContext) {
      console.log(`   ✅ Built context with ${context.sources.length} sources:`)
      context.sources.forEach((source, i) => {
        console.log(`      ${i + 1}. ${source.type}:${source.id} (${(source.similarity * 100).toFixed(1)}%)`)
      })

      console.log('\n   📝 Context Preview:')
      const preview = context.context.substring(0, 200).replace(/\n/g, '\n      ')
      console.log(`      ${preview}...`)
    } else {
      console.log('   ⚠️  No context available (embeddings might not be loaded yet)')
    }
  } catch (error: any) {
    console.error(`   ❌ Context building failed: ${error.message}`)
  }

  // Summary
  console.log('\n' + '=' .repeat(60))
  console.log('✅ Qdrant Verification Complete')
  console.log('=' .repeat(60))
  console.log('\nNext steps:')
  console.log('  1. Run: bun scripts/embed-manifests.ts')
  console.log('  2. Then test semantic search with real data')
  console.log('  3. Integrate into AI generation services')

  process.exit(0)
}

testQdrant().catch((error) => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
