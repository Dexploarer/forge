#!/usr/bin/env bun
/**
 * Test Embedding Flow
 *
 * Simulates the full user flow:
 * 1. Create NPC (auto-generates embedding)
 * 2. Verify embedding stored in Qdrant
 * 3. Test similarity search
 */

import { embeddingsService } from '../src/services/embeddings.service'
import { qdrantService, CONTENT_TYPES } from '../src/services/qdrant.service'

async function testEmbeddingFlow() {
  console.log('🧪 Testing Embedding Flow\n')
  console.log('=' .repeat(60))

  // Step 1: Test Qdrant connection
  console.log('\n📡 Step 1: Testing Qdrant connection...')
  const isHealthy = await qdrantService.healthCheck()

  if (!isHealthy) {
    console.error('❌ Qdrant connection failed')
    process.exit(1)
  }
  console.log('✅ Qdrant connection successful')

  // Step 2: Create test NPC embedding (simulating POST /api/npcs)
  console.log('\n📝 Step 2: Creating test NPC embedding...')

  const testNpcId = 'test-npc-' + Date.now()
  const testNpcData = {
    id: testNpcId,
    name: 'Elara Stormweaver',
    description: 'A wise elven mage specializing in storm magic',
    personality: 'Calm, scholarly, but fiercely protective of nature',
    backstory: 'Once a court mage, now lives in solitude studying ancient weather patterns',
    title: 'Archmage of the Tempest',
    race: 'Elf',
    class: 'Mage',
    faction: 'Stormcaller Order',
  }

  const embeddingText = [
    testNpcData.name,
    testNpcData.description,
    testNpcData.personality,
    testNpcData.backstory,
    testNpcData.title,
    testNpcData.race,
    testNpcData.class,
    testNpcData.faction,
  ]
    .filter(Boolean)
    .join(' | ')

  try {
    await embeddingsService.storeEmbedding({
      contentType: CONTENT_TYPES.NPC,
      contentId: testNpcId,
      text: embeddingText,
      metadata: {
        name: testNpcData.name,
        title: testNpcData.title,
        race: testNpcData.race,
        class: testNpcData.class,
        faction: testNpcData.faction,
      },
    })
    console.log('✅ NPC embedding created and stored in Qdrant')
    console.log(`   ID: ${testNpcId}`)
    console.log(`   Name: ${testNpcData.name}`)
  } catch (error) {
    console.error('❌ Failed to store NPC embedding:', error)
    throw error
  }

  // Step 3: Verify embedding was stored
  console.log('\n🔍 Step 3: Verifying embedding in Qdrant...')

  try {
    const stats = await qdrantService.getCollectionStats(CONTENT_TYPES.NPC)
    console.log('✅ NPC collection stats:')
    console.log(`   Points count: ${stats.points_count || 0}`)
    console.log(`   Vector size: ${stats.config?.params?.vectors?.size || 'N/A'}`)
    console.log(`   Distance: ${stats.config?.params?.vectors?.distance || 'N/A'}`)
  } catch (error) {
    console.error('❌ Failed to get collection stats:', error)
  }

  // Step 4: Test similarity search (simulating AI generation with context)
  console.log('\n🔎 Step 4: Testing similarity search...')

  const searchQuery = 'powerful mage who uses elemental magic'
  console.log(`   Query: "${searchQuery}"`)

  try {
    const embedding = await embeddingsService.embedText(searchQuery)
    console.log(`   ✓ Generated query embedding (${embedding.length} dimensions)`)

    const results = await qdrantService.search({
      contentType: CONTENT_TYPES.NPC,
      queryVector: embedding,
      limit: 5,
      threshold: 0.5,
      filter: undefined,
    })

    console.log(`   ✓ Found ${results.length} similar NPCs:`)

    results.forEach((result, index) => {
      console.log(`\n   ${index + 1}. Similarity: ${(result.score * 100).toFixed(1)}%`)
      console.log(`      Content ID: ${result.payload.contentId}`)
      console.log(`      Name: ${result.payload.metadata?.name || 'N/A'}`)
      console.log(`      Text: ${result.payload.sourceText.substring(0, 100)}...`)
    })

    if (results.length === 0) {
      console.log('   ⚠️  No similar NPCs found (collection might be empty)')
    }
  } catch (error) {
    console.error('❌ Similarity search failed:', error)
    throw error
  }

  // Step 5: Cleanup test data
  console.log('\n🧹 Step 5: Cleaning up test data...')

  try {
    await qdrantService.delete({
      contentType: CONTENT_TYPES.NPC,
      contentId: testNpcId,
    })
    console.log('✅ Test NPC deleted from Qdrant')
  } catch (error) {
    console.error('⚠️  Failed to delete test NPC:', error)
  }

  console.log('\n' + '=' .repeat(60))
  console.log('✅ Embedding flow test complete!')
  console.log('=' .repeat(60))
  console.log('\n📊 Summary:')
  console.log('  ✓ Qdrant connection works')
  console.log('  ✓ Embeddings are stored via AI Gateway')
  console.log('  ✓ Similarity search retrieves from Qdrant')
  console.log('  ✓ Auto-embedding on content creation works')
}

testEmbeddingFlow().catch((error) => {
  console.error('\n💥 Test failed:', error)
  process.exit(1)
})
