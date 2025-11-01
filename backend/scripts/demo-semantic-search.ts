#!/usr/bin/env bun
/**
 * Semantic Search Demo
 *
 * Demonstrates the power of vector-based semantic search vs traditional keyword matching.
 * Shows how AI can find relevant game content even when exact keywords don't match.
 */

import { ContentEmbedderService } from '@/services/content-embedder.service'

const contentEmbedder = new ContentEmbedderService()

interface Demo {
  title: string
  description: string
  queries: string[]
}

const demos: Demo[] = [
  {
    title: 'Item Discovery by Description',
    description: 'Find items by what they do, not just their name',
    queries: [
      'weapon for beginners',
      'powerful melee weapon',
      'defensive equipment',
      'ranged attack tool',
    ],
  },
  {
    title: 'Cross-Type Content Search',
    description: 'Find related content across different types',
    queries: [
      'forest environment',
      'combat music',
      'peaceful areas',
    ],
  },
  {
    title: 'Level-Based Equipment',
    description: 'Find appropriate items for character levels',
    queries: [
      'level 1 starter gear',
      'mid-tier equipment for level 10',
      'endgame legendary items',
    ],
  },
  {
    title: 'Conceptual Search',
    description: 'Search by game concepts and mechanics',
    queries: [
      'items that boost attack power',
      'resources for crafting',
      'currency and economy',
    ],
  },
]

async function runDemo(demo: Demo) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${demo.title}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Description: ${demo.description}\n`)

  for (const query of demo.queries) {
    console.log(`\n🔍 Query: "${query}"`)
    console.log('-'.repeat(60))

    try {
      const results = await contentEmbedder.findSimilar(query, {
        limit: 5,
        threshold: 0.6,
      })

      if (results.length === 0) {
        console.log('   ⚠️  No results found')
        console.log('   💡 Tip: Run `bun scripts/embed-manifests.ts` first')
      } else {
        results.forEach((result, i) => {
          const similarity = (result.similarity * 100).toFixed(1)
          const type = result.contentType.toUpperCase().padEnd(8)

          // Extract key info from content
          const contentPreview = result.content
            .split('\n')[0] // First line usually has the name
            .substring(0, 50)
            .trim()

          console.log(`   ${i + 1}. [${type}] ${similarity}% match`)
          console.log(`      ${contentPreview}`)
          console.log(`      ID: ${result.contentId}`)
        })
      }
    } catch (error: any) {
      console.error(`   ❌ Search failed: ${error.message}`)
    }
  }
}

async function demonstrateContextBuilding() {
  console.log(`\n\n${'='.repeat(60)}`)
  console.log('🤖 AI Context Building Demo')
  console.log('='.repeat(60))
  console.log('Showing how AI uses semantic search for context-aware generation\n')

  const scenarios = [
    {
      task: 'Generate a new sword for level 12 player',
      expectedContext: 'Should find steel tier weapons (level 10)',
    },
    {
      task: 'Create background music for a mystical forest zone',
      expectedContext: 'Should find forest biomes and peaceful music',
    },
    {
      task: 'Design a new mid-tier shield',
      expectedContext: 'Should find steel shield as reference',
    },
  ]

  for (const scenario of scenarios) {
    console.log(`\n📝 Scenario: ${scenario.task}`)
    console.log(`   Expected: ${scenario.expectedContext}`)
    console.log('-'.repeat(60))

    try {
      const context = await contentEmbedder.buildContext(scenario.task, {
        limit: 3,
        threshold: 0.6,
      })

      if (context.hasContext) {
        console.log(`   ✅ Found ${context.sources.length} relevant context sources:`)

        context.sources.forEach((source, i) => {
          const similarity = (source.similarity * 100).toFixed(1)
          console.log(`      ${i + 1}. ${source.type}:${source.id} (${similarity}% relevant)`)
        })

        console.log('\n   📄 AI Context (preview):')
        const preview = context.context.substring(0, 300).replace(/\n/g, '\n      ')
        console.log(`      ${preview}...\n`)

        console.log('   💡 This context would be injected into the AI prompt for generation')
      } else {
        console.log('   ⚠️  No context available')
      }
    } catch (error: any) {
      console.error(`   ❌ Context building failed: ${error.message}`)
    }
  }
}

async function showComparison() {
  console.log(`\n\n${'='.repeat(60)}`)
  console.log('⚖️  Traditional vs Semantic Search Comparison')
  console.log('='.repeat(60))
  console.log()

  console.log('Traditional Keyword Search:')
  console.log('  ❌ Query "powerful weapon" → No exact match for "powerful"')
  console.log('  ❌ Query "starter gear" → Must know exact item names')
  console.log('  ❌ Query "level 10 equipment" → No level field to filter')
  console.log()

  console.log('Semantic Vector Search (Qdrant):')
  console.log('  ✅ Query "powerful weapon" → Finds mithril sword (high stats)')
  console.log('  ✅ Query "starter gear" → Finds bronze tier items (low requirements)')
  console.log('  ✅ Query "level 10 equipment" → Finds steel tier (level 10 requirement)')
  console.log('  ✅ Works across languages and synonyms')
  console.log('  ✅ Understands context and intent')
}

async function main() {
  console.log('🎯 Semantic Search Demonstration')
  console.log('Using Qdrant + Vercel AI SDK + OpenAI Embeddings')
  console.log()

  // Show comparison first
  showComparison()

  // Run all demos
  for (const demo of demos) {
    await runDemo(demo)
  }

  // Demonstrate context building
  await demonstrateContextBuilding()

  // Final summary
  console.log(`\n\n${'='.repeat(60)}`)
  console.log('✨ Summary: Why Semantic Search Matters')
  console.log('='.repeat(60))
  console.log()
  console.log('Benefits for AI Generation:')
  console.log('  1. AI finds relevant examples without exact keywords')
  console.log('  2. Context-aware generation (knows existing items/stats)')
  console.log('  3. Discovers relationships across content types')
  console.log('  4. Maintains game balance (matches existing tiers)')
  console.log('  5. Better player experience (recommendations, search)')
  console.log()
  console.log('Use Cases:')
  console.log('  - Item generation: "Create warrior weapon" → refs similar items')
  console.log('  - Music selection: "Forest ambience" → finds matching tracks')
  console.log('  - Quest design: "Desert adventure" → finds desert zones/NPCs')
  console.log('  - Player search: "Find healing items" → semantic matching')
  console.log()

  process.exit(0)
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
