/**
 * Sync MinIO files to database with batch inserts
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import { readFileSync } from 'fs'

const publicHost = 'bucket-staging-4c7a.up.railway.app'
const BATCH_SIZE = 100

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database (batched)...\n')

  let totalScanned = 0

  // Sync 3D models
  try {
    console.log('📦 Processing 3d-models...')
    const files = readFileSync('/tmp/3d-models-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    const records = files.map(filename => {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      let type: 'model' | 'texture' = 'model'
      if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        type = 'texture'
      }

      return {
        name,
        type,
        fileUrl: url,
        storageMode: 'minio' as const,
        status: 'published' as const,
        visibility: 'public' as const,
      }
    })

    // Insert in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      await db.insert(assets).values(batch).onConflictDoNothing()
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    totalScanned += files.length
    console.log(`  ✓ Completed 3d-models`)
  } catch (err: any) {
    console.error('Error processing 3d-models:', err.message)
  }

  // Sync audio
  try {
    console.log('\n📦 Processing audio...')
    const files = readFileSync('/tmp/audio-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    const records = files.map(filename => {
      const url = `https://${publicHost}/audio/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      return {
        name,
        audioUrl: url,
        status: 'published' as const,
      }
    })

    // Insert in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      await db.insert(musicTracks).values(batch).onConflictDoNothing()
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
    }

    totalScanned += files.length
    console.log(`  ✓ Completed audio`)
  } catch (err: any) {
    console.error('Error processing audio:', err.message)
  }

  // Sync images
  try {
    console.log('\n📦 Processing images...')
    const files = readFileSync('/tmp/images-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    const records = files.map(filename => {
      const url = `https://${publicHost}/images/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      return {
        name,
        type: 'texture' as const,
        fileUrl: url,
        storageMode: 'minio' as const,
        status: 'published' as const,
        visibility: 'public' as const,
      }
    })

    if (records.length > 0) {
      await db.insert(assets).values(records).onConflictDoNothing()
    }

    totalScanned += files.length
    console.log(`  ✓ Completed images`)
  } catch (err: any) {
    console.error('Error processing images:', err.message)
  }

  console.log(`\n✅ Sync complete!`)
  console.log(`   Total files processed: ${totalScanned}`)

  process.exit(0)
}

syncMinioToDatabase().catch(err => {
  console.error('❌ Sync failed:', err)
  console.error(err.stack)
  process.exit(1)
})
