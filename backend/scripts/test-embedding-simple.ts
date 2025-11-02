#!/usr/bin/env bun
/**
 * Simple Embedding Test
 * Tests the core embedding functionality without health checks
 */

import { embeddingsService } from '../src/services/embeddings.service'
import { qdrantService, CONTENT_TYPES } from '../src/services/qdrant.service'

async function testEmbedding() {
  console.log('🧪 Simple Embedding Test\n')

  // Test 1: Generate embedding
  console.log('1️⃣  Generating embedding via AI Gateway...')
  try {
    const testText = 'A powerful elven mage who controls storm magic'
    const embedding = await embeddingsService.embedText(testText)
    console.log(`✅ Embedding generated: ${embedding.length} dimensions`)
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  } catch (error) {
    console.error('❌ Failed to generate embedding:', error)
    throw error
  }

  // Test 2: Store embedding in Qdrant
  console.log('\n2️⃣  Storing embedding in Qdrant...')
  const testNpcId = 'test-npc-' + Date.now()

  try {
    await embeddingsService.storeEmbedding({
      contentType: CONTENT_TYPES.NPC,
      contentId: testNpcId,
      text: 'Elara Stormweaver | A wise elven mage | Storm magic specialist',
      metadata: {
        name: 'Elara Stormweaver',
        race: 'Elf',
        class: 'Mage',
      },
    })
    console.log(`✅ Embedding stored in Qdrant`)
    console.log(`   Content ID: ${testNpcId}`)
  } catch (error) {
    console.error('❌ Failed to store embedding:', error)
    throw error
  }

  // Test 3: Search for similar content
  console.log('\n3️⃣  Searching for similar NPCs...')
  try {
    const queryEmbedding = await embeddingsService.embedText('mage with elemental powers')
    const results = await qdrantService.search({
      contentType: CONTENT_TYPES.NPC,
      queryVector: queryEmbedding,
      limit: 3,
      threshold: 0.3,
      filter: undefined,
    })

    console.log(`✅ Found ${results.length} similar NPCs`)
    results.forEach((result, i) => {
      console.log(`\n   ${i + 1}. Similarity: ${(result.score * 100).toFixed(1)}%`)
      console.log(`      Name: ${result.payload.metadata?.name || 'N/A'}`)
      console.log(`      Text: ${result.payload.sourceText.substring(0, 60)}...`)
    })
  } catch (error) {
    console.error('❌ Search failed:', error)
    throw error
  }

  // Cleanup
  console.log('\n4️⃣  Cleaning up...')
  try {
    await qdrantService.delete({
      contentType: CONTENT_TYPES.NPC,
      contentId: testNpcId,
    })
    console.log('✅ Test data cleaned up')
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error)
  }

  console.log('\n🎉 All tests passed!')
  console.log('\n📊 Summary:')
  console.log('  ✓ AI Gateway embeddings work')
  console.log('  ✓ Qdrant storage works')
  console.log('  ✓ Similarity search works')
  console.log('  ✓ Full flow is operational')
}

testEmbedding().catch((error) => {
  console.error('\n💥 Test failed:', error)
  process.exit(1)
})
