/**
 * Scan MinIO buckets and create/update database records with file URLs
 */

import { db } from '../src/database/db'
import { assets, musicTracks, soundEffects } from '../src/database/schema'
import { minioStorageService } from '../src/services/minio.service'
import { env } from '../src/config/env'

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database...\n')

  if (!minioStorageService.isAvailable()) {
    console.error('❌ MinIO is not available')
    process.exit(1)
  }

  const publicHost = env.MINIO_PUBLIC_HOST || 'bucket-staging-4c7a.up.railway.app'
  let totalScanned = 0
  let totalCreated = 0

  // Scan 3D models bucket
  try {
    console.log('📦 Scanning 3d-models bucket...')
    const models = await minioStorageService.listFiles('3d-models')
    console.log(`Found ${models.length} models`)

    for (const filename of models) {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      await db.insert(assets).values({
        name,
        type: 'model',
        fileUrl: url,
        storageMode: 'minio',
        status: 'published',
        visibility: 'public',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++
    }
  } catch (err) {
    console.error('Error scanning 3d-models:', err)
  }

  // Scan audio bucket
  try {
    console.log('\n📦 Scanning audio bucket...')
    const audioFiles = await minioStorageService.listFiles('audio')
    console.log(`Found ${audioFiles.length} audio files`)

    for (const filename of audioFiles) {
      const url = `https://${publicHost}/audio/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      // Create as music track
      await db.insert(musicTracks).values({
        name,
        audioUrl: url,
        status: 'published',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++
    }
  } catch (err) {
    console.error('Error scanning audio:', err)
  }

  // Scan images bucket
  try {
    console.log('\n📦 Scanning images bucket...')
    const images = await minioStorageService.listFiles('images')
    console.log(`Found ${images.length} images`)

    for (const filename of images) {
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
  } catch (err) {
    console.error('Error scanning images:', err)
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
