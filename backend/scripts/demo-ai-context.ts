#!/usr/bin/env bun
/**
 * Demonstrate AI Context Building with Manifest Data
 *
 * This script shows how AI services can query game manifests
 * to build context-aware content generation.
 */

import { manifestService } from '@/services/manifest.service'

async function demonstrateAIContext() {
  console.log('🤖 AI Context Building Demo\n')
  console.log('=' .repeat(60))
  console.log()

  // 1. Get available manifest types
  console.log('📋 Available Manifest Types:')
  const types = await manifestService.getAvailableManifestTypes()
  types.forEach((type) => console.log(`  - ${type}`))
  console.log()

  // 2. Get item generation context (what AI would use)
  console.log('🎮 Item Generation Context for AI:')
  console.log('=' .repeat(60))
  const context = await manifestService.getItemGenerationContext()
  console.log(context)
  console.log()

  // 3. Validate specific item IDs (AI checking references)
  console.log('✓ Validating Item References:')
  const itemsToCheck = ['bronze_sword', 'steel_sword', 'fake_item_123']
  for (const itemId of itemsToCheck) {
    const isValid = await manifestService.validateItemId(itemId)
    console.log(`  ${itemId}: ${isValid ? '✓ Valid' : '✗ Not found'}`)
  }
  console.log()

  // 4. Get specific item details (AI retrieving stats)
  console.log('📦 Item Details Lookup:')
  const bronzeSword = await manifestService.getItemById('bronze_sword')
  if (bronzeSword) {
    console.log('  Bronze Sword:')
    console.log(`    Attack Bonus: +${bronzeSword.bonuses?.attack || 0}`)
    console.log(`    Strength Bonus: +${bronzeSword.bonuses?.strength || 0}`)
    console.log(`    Required Attack Level: ${bronzeSword.requirements?.skills?.attack || 1}`)
    console.log(`    Model Path: ${bronzeSword.modelPath}`)
  }
  console.log()

  // 5. Get items by type (AI filtering)
  console.log('🗡️  All Weapons:')
  const weapons = await manifestService.getItemsByType('weapon')
  weapons.forEach((weapon) => {
    console.log(`  - ${weapon.name} (${weapon.id})`)
  })
  console.log()

  // 6. Get world data for context
  console.log('🌍 World Context:')
  const biomes = await manifestService.getAllBiomes()
  console.log(`  Available Biomes: ${biomes.map((b) => b.name).join(', ')}`)

  const zones = await manifestService.getAllZones()
  console.log(`  Available Zones: ${zones.map((z) => z.name).join(', ')}`)
  console.log()

  // 7. Example: AI generating a new item with context
  console.log('💡 Example: AI Generating New Item')
  console.log('=' .repeat(60))
  console.log('Prompt: "Generate a new tier-2 sword similar to steel_sword"')
  console.log()

  const steelSword = await manifestService.getItemById('steel_sword')
  if (steelSword) {
    console.log('AI Context Retrieved:')
    console.log(`  Reference Item: ${steelSword.name}`)
    console.log(`  Attack Bonus: +${steelSword.bonuses?.attack || 0}`)
    console.log(`  Strength Bonus: +${steelSword.bonuses?.strength || 0}`)
    console.log(`  Required Level: ${steelSword.requirements?.level || 1}`)
    console.log(`  Required Attack: ${steelSword.requirements?.skills?.attack || 1}`)
    console.log(`  Value: ${steelSword.value} coins`)
    console.log()

    console.log('AI Generated Item (example):')
    console.log('  {')
    console.log('    "id": "iron_sword",')
    console.log('    "name": "Iron Sword",')
    console.log('    "type": "weapon",')
    console.log('    "bonuses": {')
    console.log(`      "attack": ${(steelSword.bonuses?.attack || 0) - 2},  // Slightly weaker than steel`)
    console.log(`      "strength": ${(steelSword.bonuses?.strength || 0) - 2}`)
    console.log('    },')
    console.log('    "requirements": {')
    console.log(`      "level": ${(steelSword.requirements?.level || 1) - 2},`)
    console.log('      "skills": {')
    console.log(`        "attack": ${(steelSword.requirements?.skills?.attack || 1) - 2}`)
    console.log('      }')
    console.log('    },')
    console.log(`    "value": ${Math.floor((steelSword.value || 0) * 0.6)},  // Lower value`)
    console.log('    "rarity": "common"')
    console.log('  }')
  }
  console.log()

  console.log('=' .repeat(60))
  console.log('✓ AI can now generate context-aware, game-consistent content!')
  console.log('=' .repeat(60))

  process.exit(0)
}

demonstrateAIContext().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
