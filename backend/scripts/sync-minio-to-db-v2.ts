/**
 * Scan MinIO buckets and create/update database records with file URLs
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import * as Minio from 'minio'
import { env } from '../src/config/env'

async function listBucketFiles(client: Minio.Client, bucket: string): Promise<string[]> {
  return new Promise((resolve) => {
    const files: string[] = []
    const stream = client.listObjectsV2(bucket, '', true)

    stream.on('data', (obj) => {
      if (obj.name) {
        files.push(obj.name)
      }
    })

    stream.on('error', (err) => {
      console.error(`  ❌ Error listing ${bucket}:`, err.message)
      resolve(files) // Return what we have so far
    })

    stream.on('end', () => {
      resolve(files)
    })
  })
}

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database...\n')

  if (!env.MINIO_ENDPOINT || !env.MINIO_ROOT_USER || !env.MINIO_ROOT_PASSWORD) {
    console.error('❌ MinIO not configured')
    process.exit(1)
  }

  const endpoint = env.MINIO_ENDPOINT.replace(/^https?:\/\//, '')
  const useSSL = env.MINIO_ENDPOINT.startsWith('https://')

  const client = new Minio.Client({
    endPoint: endpoint,
    port: env.MINIO_PORT || 9000,
    useSSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
  })

  const publicHost = env.MINIO_PUBLIC_HOST || endpoint
  let totalScanned = 0
  let totalCreated = 0

  // Scan 3D models bucket
  try {
    console.log('📦 Scanning 3d-models bucket...')
    const models = await listBucketFiles(client, '3d-models')
    console.log(`  Found ${models.length} files`)

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

      if (totalScanned % 10 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
  } catch (err: any) {
    console.error('Error scanning 3d-models:', err.message)
  }

  // Scan audio bucket
  try {
    console.log('\n📦 Scanning audio bucket...')
    const audioFiles = await listBucketFiles(client, 'audio')
    console.log(`  Found ${audioFiles.length} files`)

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

      if (totalScanned % 10 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
  } catch (err: any) {
    console.error('Error scanning audio:', err.message)
  }

  // Scan images bucket
  try {
    console.log('\n📦 Scanning images bucket...')
    const images = await listBucketFiles(client, 'images')
    console.log(`  Found ${images.length} files`)

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

      if (totalScanned % 10 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
  } catch (err: any) {
    console.error('Error scanning images:', err.message)
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
