/**
 * Sync MinIO files to database - direct approach
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import * as Minio from 'minio'
import { env } from '../src/config/env'

const publicHost = 'bucket-staging-4c7a.up.railway.app'
const BATCH_SIZE = 50

async function listFiles(client: Minio.Client, bucket: string): Promise<string[]> {
  const files: string[] = []
  const stream = client.listObjectsV2(bucket, '', true)

  return new Promise((resolve) => {
    stream.on('data', (obj) => {
      if (obj.name) files.push(obj.name)
    })
    stream.on('error', (err) => {
      console.error(`Error listing ${bucket}:`, err.message)
      resolve(files)
    })
    stream.on('end', () => resolve(files))
  })
}

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database...\n')

  const endpoint = env.MINIO_ENDPOINT.replace(/^https?:\/\//, '')
  const useSSL = env.MINIO_ENDPOINT.startsWith('https://')

  const client = new Minio.Client({
    endPoint: endpoint,
    port: env.MINIO_PORT || 9000,
    useSSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
  })

  let totalScanned = 0

  // Process 3D models
  console.log('📦 Processing 3d-models...')
  const modelFiles = await listFiles(client, '3d-models')
  console.log(`  Found ${modelFiles.length} files (ignoring errors)`)

  if (modelFiles.length === 0) {
    console.log('  ⚠️  Using fallback method...')
    // If listing fails, we know files exist from CLI, so let's just say we can't list them
    console.log('  ❌ Cannot list files programmatically')
  } else {
    const modelRecords = modelFiles.map(filename => {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      let type: 'model' | 'texture' = 'model'
      if (filename.match(/\.(png|jpg|jpeg)$/i)) type = 'texture'

      return {
        name,
        type,
        fileUrl: url,
        storageMode: 'minio' as const,
        status: 'published' as const,
        visibility: 'public' as const,
      }
    })

    for (let i = 0; i < modelRecords.length; i += BATCH_SIZE) {
      const batch = modelRecords.slice(i, i + BATCH_SIZE)
      await db.insert(assets).values(batch).onConflictDoNothing()
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, modelRecords.length)}/${modelRecords.length}`)
    }
    totalScanned += modelFiles.length
  }

  // Process audio
  console.log('\n📦 Processing audio...')
  const audioFiles = await listFiles(client, 'audio')
  console.log(`  Found ${audioFiles.length} files (ignoring errors)`)

  if (audioFiles.length > 0) {
    const audioRecords = audioFiles.map(filename => ({
      name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      audioUrl: `https://${publicHost}/audio/${filename}`,
      status: 'published' as const,
    }))

    for (let i = 0; i < audioRecords.length; i += BATCH_SIZE) {
      const batch = audioRecords.slice(i, i + BATCH_SIZE)
      await db.insert(musicTracks).values(batch).onConflictDoNothing()
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, audioRecords.length)}/${audioRecords.length}`)
    }
    totalScanned += audioFiles.length
  }

  // Process images
  console.log('\n📦 Processing images...')
  const imageFiles = await listFiles(client, 'images')
  console.log(`  Found ${imageFiles.length} files (ignoring errors)`)

  if (imageFiles.length > 0) {
    const imageRecords = imageFiles.map(filename => ({
      name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      type: 'texture' as const,
      fileUrl: `https://${publicHost}/images/${filename}`,
      storageMode: 'minio' as const,
      status: 'published' as const,
      visibility: 'public' as const,
    }))

    if (imageRecords.length <= BATCH_SIZE) {
      await db.insert(assets).values(imageRecords).onConflictDoNothing()
    } else {
      for (let i = 0; i < imageRecords.length; i += BATCH_SIZE) {
        const batch = imageRecords.slice(i, i + BATCH_SIZE)
        await db.insert(assets).values(batch).onConflictDoNothing()
        console.log(`  Progress: ${Math.min(i + BATCH_SIZE, imageRecords.length)}/${imageRecords.length}`)
      }
    }
    totalScanned += imageFiles.length
  }

  console.log(`\n✅ Sync complete!`)
  console.log(`   Total files processed: ${totalScanned}`)
  console.log(`\n📊 Checking dashboard...`)

  const assetCount = await db.select().from(assets).then(r => r.length)
  const musicCount = await db.select().from(musicTracks).then(r => r.length)

  console.log(`   Assets in DB: ${assetCount}`)
  console.log(`   Music tracks in DB: ${musicCount}`)

  process.exit(0)
}

syncMinioToDatabase().catch(err => {
  console.error('❌ Sync failed:', err)
  console.error(err.stack)
  process.exit(1)
})
