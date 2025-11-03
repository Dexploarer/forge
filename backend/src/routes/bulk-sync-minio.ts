/**
 * Bulk MinIO sync endpoint - syncs ALL files from MinIO buckets to database
 */

import { FastifyPluginAsync } from 'fastify'
import { db } from '@/database/db'
import { assets, musicTracks } from '@/database/schema'
import { minioStorageService } from '@/services/minio.service'

const publicHost = 'bucket-staging-4c7a.up.railway.app'
const BATCH_SIZE = 50

// Valid file extensions based on Three.js loaders and common formats
const VALID_3D_EXTENSIONS = [
  '.glb', '.gltf', // GL Transmission Format (recommended for Three.js)
  '.obj', '.fbx', '.dae', '.stl', '.ply', // Common 3D formats
  '.3dm', '.3ds', '.3mf', '.amf', // Additional 3D formats
  '.drc', '.kmz', '.ldr', '.mpd', '.md2', // More formats
  '.usdz', '.usda', '.usdc', // Universal Scene Description
  '.vox', '.vtk', '.vtp', '.wrl', '.xyz', // Specialized formats
]

const VALID_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'
]

const VALID_IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif'
]

const isValidFile = (filename: string, validExtensions: string[]): boolean => {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  return ext ? validExtensions.includes(ext) : false
}

export const bulkSyncMinioRoute: FastifyPluginAsync = async (server) => {
  server.post('/bulk-sync-minio', async (_request, reply) => {
    try {
      console.log('🔄 Starting bulk MinIO sync...\n')

      // Check if MinIO is available
      if (!minioStorageService.isAvailable()) {
        return reply.status(500).send({
          success: false,
          error: 'MinIO service not available',
        })
      }

      // Get the first user to use as owner
      const { users } = await import('@/database/schema')
      const firstUser = await db.select().from(users).limit(1)
      if (firstUser.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No users found in database. Please create a user first.',
        })
      }
      const ownerId = firstUser[0]!.id
      console.log(`✓ Using owner: ${ownerId}\n`)

      let totalInserted = 0
      const summary = {
        '3d-models': { found: 0, inserted: 0 },
        audio: { found: 0, inserted: 0 },
        images: { found: 0, inserted: 0 },
      }

      // Sync 3D models
      try {
        console.log('📦 Processing 3d-models bucket...')
        const allFiles = await minioStorageService.listFiles('3d-models')
        const files = allFiles.filter(f => isValidFile(f, [...VALID_3D_EXTENSIONS, ...VALID_IMAGE_EXTENSIONS]))
        const skipped = allFiles.length - files.length

        summary['3d-models'].found = files.length
        console.log(`  Found ${files.length} valid files (${skipped} skipped)`)

        if (files.length > 0) {
          const records = files.map((filename) => {
            const url = `https://${publicHost}/3d-models/${filename}`
            const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
            const type = filename.match(/\.(png|jpg|jpeg)$/i) ? ('texture' as const) : ('model' as const)

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
            summary['3d-models'].inserted += inserted.length
            totalInserted += inserted.length
            console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (inserted ${inserted.length})`)
          }
        }

        console.log(`  ✓ Completed 3d-models`)
      } catch (err: any) {
        console.error('Error with 3d-models:', err.message)
      }

      // Sync audio
      try {
        console.log('\n📦 Processing audio bucket...')
        const allFiles = await minioStorageService.listFiles('audio')
        const files = allFiles.filter(f => isValidFile(f, VALID_AUDIO_EXTENSIONS))
        const skipped = allFiles.length - files.length

        summary.audio.found = files.length
        console.log(`  Found ${files.length} valid files (${skipped} skipped)`)

        if (files.length > 0) {
          const records = files.map((filename) => ({
            ownerId,
            name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            audioUrl: `https://${publicHost}/audio/${filename}`,
            status: 'published' as const,
          }))

          for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE)
            const inserted = await db.insert(musicTracks).values(batch).onConflictDoNothing().returning()
            summary.audio.inserted += inserted.length
            totalInserted += inserted.length
            console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (inserted ${inserted.length})`)
          }
        }

        console.log(`  ✓ Completed audio`)
      } catch (err: any) {
        console.error('Error with audio:', err.message)
      }

      // Sync images
      try {
        console.log('\n📦 Processing images bucket...')
        const allFiles = await minioStorageService.listFiles('images')
        const files = allFiles.filter(f => isValidFile(f, VALID_IMAGE_EXTENSIONS))
        const skipped = allFiles.length - files.length

        summary.images.found = files.length
        console.log(`  Found ${files.length} valid files (${skipped} skipped)`)

        if (files.length > 0) {
          const records = files.map((filename) => ({
            ownerId,
            name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            type: 'texture' as const,
            fileUrl: `https://${publicHost}/images/${filename}`,
            status: 'published' as const,
            visibility: 'public' as const,
          }))

          for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE)
            const inserted = await db.insert(assets).values(batch).onConflictDoNothing().returning()
            summary.images.inserted += inserted.length
            totalInserted += inserted.length
            console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (inserted ${inserted.length})`)
          }
        }

        console.log(`  ✓ Completed images`)
      } catch (err: any) {
        console.error('Error with images:', err.message)
      }

      // Get totals
      const assetCount = await db.select().from(assets).then((r) => r.filter((a) => a.fileUrl !== null).length)
      const musicCount = await db.select().from(musicTracks).then((r) => r.filter((m) => m.audioUrl !== null).length)

      console.log('\n✅ Bulk sync complete!')
      console.log(`   Total new records inserted: ${totalInserted}`)
      console.log(`   Total assets with URLs: ${assetCount}`)
      console.log(`   Total music tracks with URLs: ${musicCount}`)

      return reply.send({
        success: true,
        message: 'Bulk sync completed successfully',
        summary,
        totalInserted,
        totals: {
          assetsWithUrls: assetCount,
          musicWithUrls: musicCount,
        },
      })
    } catch (error) {
      console.error('❌ Bulk sync failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  })
}
