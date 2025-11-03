/**
 * Scan MinIO buckets using AWS SDK and create/update database records
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import { env } from '../src/config/env'

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database using AWS SDK...\n')

  if (!env.MINIO_ENDPOINT || !env.MINIO_ROOT_USER || !env.MINIO_ROOT_PASSWORD) {
    console.error('❌ MinIO not configured')
    process.exit(1)
  }

  const s3Client = new S3Client({
    endpoint: env.MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: env.MINIO_ROOT_USER,
      secretAccessKey: env.MINIO_ROOT_PASSWORD,
    },
    forcePathStyle: true, // Required for MinIO
  })

  const publicHost = env.MINIO_PUBLIC_HOST || env.MINIO_ENDPOINT.replace(/^https?:\/\//, '')
  let totalScanned = 0
  let totalCreated = 0

  // Scan 3D models bucket
  try {
    console.log('📦 Scanning 3d-models bucket...')
    const command = new ListObjectsV2Command({ Bucket: '3d-models' })
    const response = await s3Client.send(command)
    const files = response.Contents || []
    console.log(`  Found ${files.length} files`)

    for (const file of files) {
      if (!file.Key) continue

      const url = `https://${publicHost}/3d-models/${file.Key}`
      const name = file.Key.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

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
  } catch (err: any) {
    console.error('Error scanning 3d-models:', err.message)
  }

  // Scan audio bucket
  try {
    console.log('\n📦 Scanning audio bucket...')
    const command = new ListObjectsV2Command({ Bucket: 'audio' })
    const response = await s3Client.send(command)
    const files = response.Contents || []
    console.log(`  Found ${files.length} files`)

    for (const file of files) {
      if (!file.Key) continue

      const url = `https://${publicHost}/audio/${file.Key}`
      const name = file.Key.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      await db.insert(musicTracks).values({
        name,
        audioUrl: url,
        status: 'published',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++
    }
  } catch (err: any) {
    console.error('Error scanning audio:', err.message)
  }

  // Scan images bucket
  try {
    console.log('\n📦 Scanning images bucket...')
    const command = new ListObjectsV2Command({ Bucket: 'images' })
    const response = await s3Client.send(command)
    const files = response.Contents || []
    console.log(`  Found ${files.length} files`)

    for (const file of files) {
      if (!file.Key) continue

      const url = `https://${publicHost}/images/${file.Key}`
      const name = file.Key.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

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
