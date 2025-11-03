/**
 * Bulk sync ALL MinIO files to database
 */

import { db } from '../src/database/db'
import { assets, musicTracks, users } from '../src/database/schema'
import * as fs from 'fs'

const publicHost = 'bucket-staging-4c7a.up.railway.app'
const BATCH_SIZE = 50

async function bulkSync() {
  console.log('🔄 Bulk syncing ALL MinIO files to database...\n')

  // Get first user as owner
  const firstUser = await db.select().from(users).limit(1)
  if (firstUser.length === 0) {
    console.error('❌ No users found')
    process.exit(1)
  }
  const ownerId = firstUser[0].id
  console.log(`Using owner: ${ownerId}\n`)

  let totalInserted = 0

  // Sync 3D models
  try {
    console.log('📦 Processing 3d-models...')
    const files = fs.readFileSync('/tmp/all-3d-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    const records = files.map(filename => {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      const type = filename.match(/\.(png|jpg|jpeg)$/i) ? 'texture' as const : 'model' as const

      return {
        ownerId,
        name,
        type,
        fileUrl: url,
        status: 'published' as const,
        visibility: 'public' as const,
      }
    })

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const inserted = await db.insert(assets).values(batch).onConflictDoNothing().returning()
      totalInserted += inserted.length
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (inserted ${inserted.length})`)
    }

    console.log(`  ✓ Completed 3d-models`)
  } catch (err: any) {
    console.error('Error with 3d-models:', err.message)
  }

  // Sync audio
  try {
    console.log('\n📦 Processing audio...')
    const files = fs.readFileSync('/tmp/all-audio-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    const records = files.map(filename => ({
      ownerId,
      name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      audioUrl: `https://${publicHost}/audio/${filename}`,
      status: 'published' as const,
    }))

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const inserted = await db.insert(musicTracks).values(batch).onConflictDoNothing().returning()
      totalInserted += inserted.length
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (inserted ${inserted.length})`)
    }

    console.log(`  ✓ Completed audio`)
  } catch (err: any) {
    console.error('Error with audio:', err.message)
  }

  // Sync images
  try {
    console.log('\n📦 Processing images...')
    const files = fs.readFileSync('/tmp/all-image-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    if (files.length > 0) {
      const records = files.map(filename => ({
        ownerId,
        name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        type: 'texture' as const,
        fileUrl: `https://${publicHost}/images/${filename}`,
        status: 'published' as const,
        visibility: 'public' as const,
      }))

      const inserted = await db.insert(assets).values(records).onConflictDoNothing().returning()
      totalInserted += inserted.length
      console.log(`  ✓ Completed images (inserted ${inserted.length})`)
    }
  } catch (err: any) {
    console.error('Error with images:', err.message)
  }

  // Verify
  const assetCount = await db.select().from(assets).then(r => r.filter(a => a.fileUrl !== null).length)
  const musicCount = await db.select().from(musicTracks).then(r => r.filter(m => m.audioUrl !== null).length)

  console.log(`\n✅ Bulk sync complete!`)
  console.log(`   Total new records inserted: ${totalInserted}`)
  console.log(`   Total assets with URLs: ${assetCount}`)
  console.log(`   Total music tracks with URLs: ${musicCount}`)

  process.exit(0)
}

bulkSync().catch(err => {
  console.error('❌ Sync failed:', err)
  console.error(err.stack)
  process.exit(1)
})
