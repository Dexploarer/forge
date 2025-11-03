/**
 * Sync MinIO files to database from exported file lists
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import { readFileSync } from 'fs'

const publicHost = 'bucket-staging-4c7a.up.railway.app'

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database from file lists...\n')

  let totalScanned = 0
  let totalCreated = 0

  // Sync 3D models
  try {
    console.log('📦 Processing 3d-models...')
    const files = readFileSync('/tmp/3d-models-files.txt', 'utf-8')
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0)

    console.log(`  Found ${files.length} files`)

    for (const filename of files) {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      // Determine type based on extension
      let type: 'model' | 'texture' = 'model'
      if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        type = 'texture'
      }

      await db.insert(assets).values({
        name,
        type,
        fileUrl: url,
        storageMode: 'minio',
        status: 'published',
        visibility: 'public',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++

      if (totalScanned % 50 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
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

    for (const filename of files) {
      const url = `https://${publicHost}/audio/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      await db.insert(musicTracks).values({
        name,
        audioUrl: url,
        status: 'published',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++

      if (totalScanned % 50 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
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

    for (const filename of files) {
      const url = `https://${publicHost}/images/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      await db.insert(assets).values({
        name,
        type: 'texture',
        fileUrl: url,
        storageMode: 'minio',
        status: 'published',
        visibility: 'public',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++
    }
    console.log(`  ✓ Completed images`)
  } catch (err: any) {
    console.error('Error processing images:', err.message)
  }

  console.log(`\n✅ Sync complete!`)
  console.log(`   Scanned: ${totalScanned} files`)
  console.log(`   Created: ${totalCreated} database records`)

  process.exit(0)
}

syncMinioToDatabase().catch(err => {
  console.error('❌ Sync failed:', err)
  process.exit(1)
})
