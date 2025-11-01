#!/usr/bin/env bun
/**
 * Insert Sample Manifest Data
 * Creates minimal sample game data for Qdrant embedding
 */

import { db } from '../src/database/db'
import { previewManifests } from '../src/database/schema'

async function insertSampleManifests() {
  console.log('📦 Inserting sample manifest data...\n')

  // Sample items (weapons, tools)
  const itemsManifest = {
    manifestType: 'items',
    content: [
      {
        id: 'bronze_sword',
        name: 'Bronze Sword',
        type: 'weapon',
        description: 'A basic sword made of bronze, suitable for beginners',
        bonuses: { attack: 10, strength: 5 },
        requirements: { level: 1, skills: { attack: 1 } },
        value: 100
      },
      {
        id: 'steel_sword',
        name: 'Steel Sword',
        type: 'weapon',
        description: 'A well-crafted steel sword with improved damage',
        bonuses: { attack: 25, strength: 10 },
        requirements: { level: 5, skills: { attack: 10 } },
        value: 500
      },
      {
        id: 'mithril_sword',
        name: 'Mithril Sword',
        type: 'weapon',
        description: 'A legendary sword forged from rare mithril ore',
        bonuses: { attack: 50, strength: 20 },
        requirements: { level: 20, skills: { attack: 40 } },
        value: 5000
      }
    ],
    version: 1,
    isActive: true
  }

  // Sample NPCs
  const npcsManifest = {
    manifestType: 'npcs',
    content: [
      {
        id: 'blacksmith_john',
        name: 'John the Blacksmith',
        role: 'merchant',
        description: 'A skilled blacksmith who sells weapons and armor',
        location: 'Town Square',
        dialogue: ['Welcome to my forge!', 'I have the finest weapons in town.']
      },
      {
        id: 'wizard_merlin',
        name: 'Merlin the Wizard',
        role: 'quest_giver',
        description: 'An ancient wizard with vast knowledge of magic',
        location: 'Magic Tower',
        dialogue: ['Seek me when you need wisdom.', 'Magic requires dedication.']
      }
    ],
    version: 1,
    isActive: true
  }

  // Sample biomes
  const biomesManifest = {
    manifestType: 'biomes',
    content: [
      {
        id: 'forest',
        name: 'Enchanted Forest',
        type: 'forest',
        description: 'A lush green forest filled with ancient trees and magical creatures',
        climate: 'temperate',
        difficulty: 'easy'
      },
      {
        id: 'desert',
        name: 'Scorching Desert',
        type: 'desert',
        description: 'A vast desert with extreme heat and dangerous sandstorms',
        climate: 'arid',
        difficulty: 'hard'
      }
    ],
    version: 1,
    isActive: true
  }

  // Insert manifests
  try {
    await db.insert(previewManifests).values([
      itemsManifest,
      npcsManifest,
      biomesManifest
    ])

    console.log('✅ Inserted sample manifests:')
    console.log('   - items: 3 items')
    console.log('   - npcs: 2 NPCs')
    console.log('   - biomes: 2 biomes')
    console.log('\nTotal: 3 manifests, 7 embeddable items')
  } catch (error: any) {
    console.error('❌ Error inserting manifests:', error.message)
    throw error
  }
}

insertSampleManifests()
  .then(() => {
    console.log('\n🎉 Sample data ready for Qdrant embedding!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
