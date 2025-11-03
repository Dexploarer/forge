/**
 * Cleanup endpoint - removes invalid assets from database
 */

import { FastifyPluginAsync } from 'fastify'
import { db } from '@/database/db'
import { assets, musicTracks } from '@/database/schema'
import { sql } from 'drizzle-orm'

// Valid file extensions
const VALID_3D_EXTENSIONS = [
  '.glb', '.gltf', '.obj', '.fbx', '.dae', '.stl', '.ply',
  '.3dm', '.3ds', '.3mf', '.amf', '.drc', '.kmz', '.ldr',
  '.mpd', '.md2', '.usdz', '.usda', '.usdc', '.vox', '.vtk',
  '.vtp', '.wrl', '.xyz'
]

const VALID_IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif'
]

const VALID_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'
]

export const cleanupInvalidAssetsRoute: FastifyPluginAsync = async (server) => {
  server.post('/cleanup-invalid-assets', async (_request, reply) => {
    try {
      console.log('🧹 Starting cleanup of invalid assets...\n')

      const deletedAssets: string[] = []
      const deletedMusic: string[] = []

      // Get all assets
      const allAssets = await db.select().from(assets)
      console.log(`  Found ${allAssets.length} total assets`)

      for (const asset of allAssets) {
        if (!asset.fileUrl) continue

        const filename = asset.fileUrl.split('/').pop() || ''
        const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]

        const validExtensions = asset.type === 'texture'
          ? VALID_IMAGE_EXTENSIONS
          : [...VALID_3D_EXTENSIONS, ...VALID_IMAGE_EXTENSIONS]

        if (!ext || !validExtensions.includes(ext)) {
          console.log(`  ❌ Deleting invalid asset: ${asset.name} (${filename})`)
          await db.delete(assets).where(sql`id = ${asset.id}`)
          deletedAssets.push(asset.name)
        }
      }

      // Get all music tracks
      const allMusic = await db.select().from(musicTracks)
      console.log(`\n  Found ${allMusic.length} total music tracks`)

      for (const track of allMusic) {
        if (!track.audioUrl) continue

        const filename = track.audioUrl.split('/').pop() || ''
        const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]

        if (!ext || !VALID_AUDIO_EXTENSIONS.includes(ext)) {
          console.log(`  ❌ Deleting invalid track: ${track.name} (${filename})`)
          await db.delete(musicTracks).where(sql`id = ${track.id}`)
          deletedMusic.push(track.name)
        }
      }

      console.log('\n✅ Cleanup complete!')
      console.log(`   Deleted ${deletedAssets.length} invalid assets`)
      console.log(`   Deleted ${deletedMusic.length} invalid music tracks`)

      return reply.send({
        success: true,
        message: 'Cleanup completed successfully',
        deleted: {
          assets: deletedAssets,
          music: deletedMusic,
        },
        counts: {
          assets: deletedAssets.length,
          music: deletedMusic.length,
        },
      })
    } catch (error) {
      console.error('❌ Cleanup failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
