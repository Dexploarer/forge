/**
 * Sync MinIO assets to database
 * Creates database records for assets that exist in MinIO but not in DB
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { Client } from 'minio'
import { assets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:bratxk11nt2ue61m4p605nr23tywq7yp@shortline.proxy.rlwy.net:41224/railway"
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "bucket.railway.internal"
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000")
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const MINIO_BUCKET = process.env.MINIO_BUCKET || "forge-assets"
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true"
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "https://bucket.railway.internal"

// Default user ID for orphaned assets (you'll need to replace this)
const DEFAULT_OWNER_ID = process.env.DEFAULT_OWNER_ID || "00000000-0000-0000-0000-000000000000"

const client = postgres(DATABASE_URL)
const db = drizzle(client)

const minioClient = new Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

console.log(`\n🔍 Scanning MinIO bucket: ${MINIO_BUCKET}`)
console.log(`📦 MinIO endpoint: ${MINIO_ENDPOINT}:${MINIO_PORT}`)

const stream = minioClient.listObjectsV2(MINIO_BUCKET, '', true)
const minioFiles: any[] = []

stream.on('data', (obj) => {
  minioFiles.push(obj)
})

stream.on('end', async () => {
  console.log(`\n✅ Found ${minioFiles.length} files in MinIO\n`)

  let created = 0
  let skipped = 0

  for (const file of minioFiles) {
    const key = file.name

    // Check if asset already exists in database
    const existing = await db.select().from(assets).where(eq(assets.metadata, { minioKey: key })).limit(1)

    if (existing.length > 0) {
      console.log(`⏭️  Skip: ${key} (already in DB)`)
      skipped++
      continue
    }

    // Determine asset type from file extension
    const ext = key.split('.').pop()?.toLowerCase()
    let type: 'model' | 'texture' | 'audio' | 'other' = 'other'
    if (['glb', 'gltf', 'obj', 'fbx'].includes(ext || '')) type = 'model'
    else if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) type = 'texture'
    else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) type = 'audio'

    // Get file name without path
    const name = key.split('/').pop() || key

    // Build file URL
    const fileUrl = `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`

    try {
      await db.insert(assets).values({
        name: name.replace(/\.[^/.]+$/, ''), // Remove extension
        description: `Imported from MinIO: ${key}`,
        type,
        status: 'published',
        visibility: 'public',
        fileUrl,
        thumbnailUrl: type === 'texture' ? fileUrl : null,
        fileSize: file.size,
        mimeType: getMimeType(ext || ''),
        metadata: {
          minioKey: key,
          minioBucket: MINIO_BUCKET,
          storageMode: 'minio',
          importedAt: new Date().toISOString(),
        },
        ownerId: DEFAULT_OWNER_ID,
      })

      console.log(`✅ Created: ${name} (${type}, ${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      created++
    } catch (error) {
      console.error(`❌ Failed to create ${name}:`, error)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total:   ${minioFiles.length}\n`)

  await client.end()
  process.exit(0)
})

stream.on('error', (err) => {
  console.error('❌ MinIO error:', err)
  process.exit(1)
})

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    obj: 'model/obj',
    fbx: 'model/fbx',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}
