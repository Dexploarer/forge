/**
 * MinIO sync endpoint - inserts sample records for MinIO files
 */

import { FastifyPluginAsync } from 'fastify'
import { db } from '@/database/db'
import { assets, musicTracks } from '@/database/schema'

const publicHost = 'bucket-staging-4c7a.up.railway.app'

// Sample files we know exist
const sample3DModels = [
  '0078445c-e722-44d8-b23d-798a4f5d4a96.glb',
  '0cce9e16-5cf8-4888-99a5-ad97c3c18a09.glb',
  '13389e2b-0ef1-45ac-a5d5-ae5a10818133.png',
  '13722641-845d-4237-aef4-ce3822b6514c.glb',
  '15ca047a-6484-4c3c-ae02-ee6b8b11029c.glb',
]

const sampleAudioFiles = [
  '003d4895-b92f-4e39-90a9-dda547edf555.mp3',
  '01147a82-584b-4d47-8022-c023cb29fb34.mp3',
  '012fb20f-9efb-4ce9-8ddd-bfb370d87c78.mp3',
  '019c1491-4b20-484a-a38a-1327e1984660.mp3',
  '01d9103f-37b6-4c57-a0db-c8d0ee75658d.mp3',
]

const sampleImages = [
  '625910a4-ed16-46ea-9fff-c1a88cb7c9d1.png',
  '6d6307b0-fd34-4f06-8b01-8f3f7826dee0.png',
  'a7363569-8e21-49b6-a519-f108ac54d176.png',
  'be35c40d-c25e-4d87-8e53-811e9fcabf76.png',
  'f8de4dc4-b8f2-492c-ab3a-db48fb7dbc77.png',
]

export const syncMinioRoute: FastifyPluginAsync = async (server) => {
  server.post('/sync-minio', async (request, reply) => {
    try {
      console.log('📝 Starting MinIO sync...')

      // Get the first user to use as owner
      const { users } = await import('@/database/schema')
      const firstUser = await db.select().from(users).limit(1)
      if (firstUser.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No users found in database. Please create a user first.',
        })
      }
      const ownerId = firstUser[0].id

      // Insert 3D models/textures
      const modelRecords = sample3DModels.map(filename => {
        const url = `https://${publicHost}/3d-models/${filename}`
        const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        const type = filename.endsWith('.png') ? 'texture' as const : 'model' as const

        return {
          ownerId,
          name,
          type,
          fileUrl: url,
          status: 'published' as const,
          visibility: 'public' as const,
        }
      })

      const insertedAssets = await db.insert(assets).values(modelRecords).onConflictDoNothing().returning()
      console.log(`✓ Inserted ${insertedAssets.length} 3D assets`)

      // Insert images
      const imageRecords = sampleImages.map(filename => ({
        ownerId,
        name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        type: 'texture' as const,
        fileUrl: `https://${publicHost}/images/${filename}`,
        status: 'published' as const,
        visibility: 'public' as const,
      }))

      const insertedImages = await db.insert(assets).values(imageRecords).onConflictDoNothing().returning()
      console.log(`✓ Inserted ${insertedImages.length} image assets`)

      // Insert audio
      const audioRecords = sampleAudioFiles.map(filename => ({
        ownerId,
        name: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        audioUrl: `https://${publicHost}/audio/${filename}`,
        status: 'published' as const,
      }))

      const insertedMusic = await db.insert(musicTracks).values(audioRecords).onConflictDoNothing().returning()
      console.log(`✓ Inserted ${insertedMusic.length} music tracks`)

      // Get totals
      const assetCount = await db.select().from(assets).then(r => r.filter(a => a.fileUrl !== null).length)
      const musicCount = await db.select().from(musicTracks).then(r => r.filter(m => m.audioUrl !== null).length)

      return reply.send({
        success: true,
        message: 'Sample records created successfully',
        inserted: {
          assets: insertedAssets.length + insertedImages.length,
          music: insertedMusic.length,
        },
        totals: {
          assetsWithUrls: assetCount,
          musicWithUrls: musicCount,
        },
      })
    } catch (error) {
      console.error('❌ Sync failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
