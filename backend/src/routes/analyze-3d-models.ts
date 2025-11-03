import { FastifyPluginAsync } from 'fastify'
import { db } from '../database/db'
import { assets } from '../database/schema'
import { eq } from 'drizzle-orm'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

interface AnalysisResult {
  assetId: string
  name: string
  success: boolean
  metadata?: {
    polyCount: number
    vertexCount: number
    dimensions: { width: number; height: number; depth: number }
    fileSize: number
    materialCount: number
    textureCount: number
    hasAnimations: boolean
    meshCount: number
  }
  error?: string
}

export const analyze3DModelsRoute: FastifyPluginAsync = async (server) => {
  server.post('/analyze-3d-models', async (_request, reply) => {
    try {
      console.log('🔍 Starting 3D model analysis...\n')

      const results: AnalysisResult[] = []

      // Get all 3D model assets
      const modelAssets = await db
        .select()
        .from(assets)
        .where(eq(assets.type, 'model'))

      console.log(`Found ${modelAssets.length} 3D models to analyze\n`)

      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

      for (const asset of modelAssets) {
        if (!asset.fileUrl) {
          results.push({
            assetId: asset.id,
            name: asset.name,
            success: false,
            error: 'No file URL'
          })
          continue
        }

        try {
          console.log(`  📦 Analyzing: ${asset.name}`)

          // Fetch the GLB file from MinIO
          const response = await fetch(asset.fileUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Parse the GLB file
          const document: Document = await io.readBinary(new Uint8Array(buffer))

          // Extract metadata
          const root = document.getRoot()
          const meshes = root.listMeshes()
          const materials = root.listMaterials()
          const textures = root.listTextures()
          const animations = root.listAnimations()

          let totalPolyCount = 0
          let totalVertexCount = 0
          const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }

          // Calculate poly and vertex counts, and bounding box
          for (const mesh of meshes) {
            for (const primitive of mesh.listPrimitives()) {
              const indices = primitive.getIndices()
              const position = primitive.getAttribute('POSITION')

              if (indices) {
                totalPolyCount += indices.getCount() / 3
              } else if (position) {
                totalPolyCount += position.getCount() / 3
              }

              if (position) {
                totalVertexCount += position.getCount()

                // Calculate bounding box
                const posArray = position.getArray()
                if (posArray) {
                  for (let i = 0; i < posArray.length - 2; i += 3) {
                    const x = posArray[i]
                    const y = posArray[i + 1]
                    const z = posArray[i + 2]
                    if (x !== undefined && y !== undefined && z !== undefined) {
                      bounds.min[0] = Math.min(bounds.min[0]!, x)
                      bounds.min[1] = Math.min(bounds.min[1]!, y)
                      bounds.min[2] = Math.min(bounds.min[2]!, z)
                      bounds.max[0] = Math.max(bounds.max[0]!, x)
                      bounds.max[1] = Math.max(bounds.max[1]!, y)
                      bounds.max[2] = Math.max(bounds.max[2]!, z)
                    }
                  }
                }
              }
            }
          }

          const dimensions = {
            width: Math.abs((bounds.max[0] ?? 0) - (bounds.min[0] ?? 0)),
            height: Math.abs((bounds.max[1] ?? 0) - (bounds.min[1] ?? 0)),
            depth: Math.abs((bounds.max[2] ?? 0) - (bounds.min[2] ?? 0))
          }

          const metadata = {
            polyCount: Math.round(totalPolyCount),
            vertexCount: totalVertexCount,
            dimensions: {
              width: Math.round(dimensions.width * 100) / 100,
              height: Math.round(dimensions.height * 100) / 100,
              depth: Math.round(dimensions.depth * 100) / 100
            },
            fileSize: buffer.length,
            materialCount: materials.length,
            textureCount: textures.length,
            hasAnimations: animations.length > 0,
            meshCount: meshes.length
          }

          // Update the asset in database
          await db
            .update(assets)
            .set({
              metadata: metadata as any,
              updatedAt: new Date()
            })
            .where(eq(assets.id, asset.id))

          console.log(`    ✅ ${metadata.polyCount.toLocaleString()} polys, ${metadata.vertexCount.toLocaleString()} verts, ${(metadata.fileSize / 1024).toFixed(1)} KB`)

          results.push({
            assetId: asset.id,
            name: asset.name,
            success: true,
            metadata
          })

        } catch (error) {
          console.error(`    ❌ Failed to analyze ${asset.name}:`, error)
          results.push({
            assetId: asset.id,
            name: asset.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      console.log(`\n✨ Analysis complete: ${successCount} successful, ${failCount} failed`)

      return reply.send({
        success: true,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failCount
        },
        results
      })

    } catch (error) {
      console.error('❌ Analysis failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}
