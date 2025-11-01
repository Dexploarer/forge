#!/usr/bin/env bun
/**
 * Import HyperscapeAI manifests into preview_manifests table
 * This makes game data available to AI for context-aware generation
 */

import { db } from '@/database/db'
import { previewManifests } from '@/database/schema'
import { eq, and } from 'drizzle-orm'
import { readFile } from 'fs/promises'

const MANIFESTS_DIR = '/tmp/hyperscape-check/manifests'

interface ImportResult {
  success: number
  failed: number
  errors: Array<{ file: string; error: string }>
}

// Map manifest filenames to manifestType values
const MANIFEST_TYPE_MAP: Record<string, string> = {
  'items.json': 'items',
  'characters.json': 'npcs',
  'music.json': 'music',
  'biomes.json': 'biomes',
  'zones.json': 'zones',
  'world-areas.json': 'world',
  'banks.json': 'banks',
  'stores.json': 'stores',
  'avatars.json': 'avatars',
  'asset-requirements.json': 'asset_requirements',
  'batch-generation.json': 'generation_configs',
  'resources.json': 'resources',
  'buildings.json': 'buildings',
}

async function importManifests(): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  }

  console.log('📖 Importing Hyperscape manifests into database...\n')

  for (const [filename, manifestType] of Object.entries(MANIFEST_TYPE_MAP)) {
    try {
      const filePath = `${MANIFESTS_DIR}/${filename}`
      console.log(`📄 Processing ${filename} (type: ${manifestType})`)

      // Read manifest file
      const fileContent = await readFile(filePath, 'utf-8')
      const manifestData = JSON.parse(fileContent)

      // Ensure it's an array
      const content = Array.isArray(manifestData) ? manifestData : [manifestData]

      console.log(`   Items: ${content.length}`)

      // Check if manifest already exists (global manifest with userId=null, teamId=null)
      const existing = await db.query.previewManifests.findFirst({
        where: and(
          eq(previewManifests.manifestType, manifestType),
          eq(previewManifests.userId, null as any),
          eq(previewManifests.teamId, null as any)
        )
      })

      if (existing) {
        // Update existing manifest
        await db
          .update(previewManifests)
          .set({
            content,
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(previewManifests.id, existing.id))

        console.log(`   ✅ Updated existing manifest (v${existing.version} → v${existing.version + 1})\n`)
      } else {
        // Insert new manifest (global manifests have null userId and teamId)
        await db.insert(previewManifests).values({
          userId: null as any,
          teamId: null as any,
          manifestType,
          content,
          version: 1,
          isActive: true,
        })

        console.log(`   ✅ Created new manifest (v1)\n`)
      }

      result.success++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`   ❌ Failed: ${errorMsg}\n`)
      result.failed++
      result.errors.push({ file: filename, error: errorMsg })
    }
  }

  return result
}

async function main() {
  console.log('🎮 Hyperscape Metadata → Database Import\n')

  const result = await importManifests()

  console.log('📊 Import Summary:')
  console.log(`   ✅ Success: ${result.success}`)
  console.log(`   ❌ Failed: ${result.failed}`)

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`)
    })
  }

  console.log('\n💡 Game data is now available for AI context!')
  console.log('   AI can now reference:')
  console.log('   - Item IDs, stats, requirements')
  console.log('   - Character definitions')
  console.log('   - Music tracks')
  console.log('   - Biomes, zones, world areas')
  console.log('   - And more...')

  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
