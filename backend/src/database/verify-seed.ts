import { db } from './db'

async function verifySeed() {
  console.log('🔍 Verifying Database Seed Results...\n')

  // Check assets
  const assets = await db.query.assets.findMany({
    columns: {
      type: true,
      name: true,
      status: true,
      visibility: true,
    },
    orderBy: (assets, { asc }) => [asc(assets.createdAt)],
  })

  console.log('📦 ASSETS:')
  assets.forEach((asset, i) => {
    console.log(`  ${i + 1}. [${asset.type}] ${asset.name} (${asset.status}, ${asset.visibility})`)
  })
  console.log(`  Total: ${assets.length}\n`)

  // Check NPCs
  const npcs = await db.query.npcs.findMany({
    columns: {
      name: true,
      behavior: true,
      location: true,
    },
  })

  console.log('🧙 NPCs:')
  npcs.forEach((npc, i) => {
    console.log(`  ${i + 1}. ${npc.name} (${npc.behavior}) @ ${npc.location}`)
  })
  console.log(`  Total: ${npcs.length}\n`)

  // Check quests
  const quests = await db.query.quests.findMany({
    columns: {
      name: true,
      difficulty: true,
      minLevel: true,
    },
  })

  console.log('⚔️  QUESTS:')
  quests.forEach((quest, i) => {
    console.log(`  ${i + 1}. ${quest.name} (${quest.difficulty}, level ${quest.minLevel}+)`)
  })
  console.log(`  Total: ${quests.length}\n`)

  // Check lore
  const lore = await db.query.loreEntries.findMany({
    columns: {
      title: true,
      category: true,
    },
  })

  console.log('📖 LORE ENTRIES:')
  lore.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.title} (${entry.category})`)
  })
  console.log(`  Total: ${lore.length}\n`)

  // Check AI service calls
  const apiCalls = await db.query.aiServiceCalls.findMany({
    columns: {
      service: true,
      model: true,
      tokensUsed: true,
      cost: true,
    },
    orderBy: (calls, { desc }) => [desc(calls.createdAt)],
    limit: 5,
  })

  console.log('💰 RECENT AI SERVICE CALLS (Last 5):')
  apiCalls.forEach((call, i) => {
    console.log(`  ${i + 1}. ${call.service}/${call.model} - ${call.tokensUsed} tokens, $${((call.cost || 0) / 100).toFixed(2)}`)
  })
  console.log()

  // Total costs
  const allCalls = await db.query.aiServiceCalls.findMany({
    columns: {
      service: true,
      cost: true,
    },
  })

  const totalByService = allCalls.reduce((acc, call) => {
    acc[call.service] = (acc[call.service] || 0) + (call.cost || 0)
    return acc
  }, {} as Record<string, number>)

  console.log('📊 TOTAL COSTS BY SERVICE:')
  Object.entries(totalByService).forEach(([service, cost]) => {
    console.log(`  ${service}: $${(cost / 100).toFixed(2)}`)
  })
  console.log(`  TOTAL: $${(allCalls.reduce((sum, c) => sum + (c.cost || 0), 0) / 100).toFixed(2)}\n`)

  console.log('✅ Verification complete!')

  process.exit(0)
}

verifySeed().catch((error) => {
  console.error('❌ Verification failed:', error)
  process.exit(1)
})
