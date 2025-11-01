#!/usr/bin/env bun
/**
 * Verify imported manifests in database
 */

import { db } from '@/database/db'
import { previewManifests } from '@/database/schema'
import { isNull } from 'drizzle-orm'

async function verifyManifests() {
  console.log('🔍 Verifying imported manifests...\n')

  // Query all global manifests (userId=null, teamId=null)
  const manifests = await db.query.previewManifests.findMany({
    where: isNull(previewManifests.userId),
  })

  console.log(`Found ${manifests.length} global manifests:\n`)

  for (const manifest of manifests) {
    const itemCount = Array.isArray(manifest.content) ? manifest.content.length : 1
    console.log(`✓ ${manifest.manifestType} (v${manifest.version}) - ${itemCount} items`)
  }

  // Show sample item data
  const itemsManifest = manifests.find((m) => m.manifestType === 'items')
  if (itemsManifest && Array.isArray(itemsManifest.content)) {
    console.log('\n📦 Sample Item Data:')
    const sampleItem = itemsManifest.content[0]
    console.log(JSON.stringify(sampleItem, null, 2))
  }

  process.exit(0)
}

verifyManifests().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
