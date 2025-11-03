import { FastifyPluginAsync } from 'fastify'
import { assets } from '../database/schema'
import { eq } from 'drizzle-orm'

const GITHUB_API_BASE = 'https://api.github.com/repos/HyperscapeAI/assets/contents'
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/HyperscapeAI/assets/main'

interface GitHubContent {
  name: string
  path: string
  type: 'file' | 'dir'
  download_url?: string
  size?: number
}

interface AssetMetadata {
  name: string
  gameId: string
  type: string
  subtype?: string
  description: string
  detailedPrompt?: string
  generatedAt?: string
  completedAt?: string
  isBaseModel?: boolean
  materialVariants?: string[]
  isPlaceholder?: boolean
  hasModel?: boolean
  hasConceptArt?: boolean
  modelPath?: string
  conceptArtUrl?: string
  gddCompliant?: boolean
  workflow?: string
  meshyTaskId?: string
  meshyStatus?: string
}

interface ImportResult {
  name: string
  success: boolean
  action: 'created' | 'updated' | 'skipped'
  error?: string
}

export const importGitHubAssetsRoute: FastifyPluginAsync = async (server) => {
  server.post('/import-github-assets', async (_request, reply) => {
    try {
      console.log('🔄 Starting GitHub asset import from HyperscapeAI/assets...\n')

      // Get or create a system user to use as owner
      const { users } = await import('../database/schema')
      let firstUser = await server.db.select().from(users).limit(1)

      let ownerId: string
      if (firstUser.length === 0) {
        console.log('⚠️  No users found, creating system user...')
        const [systemUser] = await server.db.insert(users).values({
          privyUserId: 'system-public-assets',
          displayName: 'System (Public Assets)',
          email: 'system@forge.local',
          role: 'admin'
        }).returning()
        ownerId = systemUser!.id
        console.log(`✓ Created system user: ${ownerId}\n`)
      } else {
        ownerId = firstUser[0]!.id
        console.log(`✓ Using owner: ${ownerId}\n`)
      }

      const results: ImportResult[] = []

      // Fetch models directory contents
      const modelsResponse = await fetch(`${GITHUB_API_BASE}/models`)
      if (!modelsResponse.ok) {
        throw new Error(`GitHub API error: ${modelsResponse.statusText}`)
      }

      const modelsContents = await modelsResponse.json() as GitHubContent[]
      const modelDirs = modelsContents.filter(item => item.type === 'dir')

      console.log(`Found ${modelDirs.length} model directories\n`)

      for (const dir of modelDirs) {
        try {
          console.log(`  📦 Processing: ${dir.name}`)

          // Fetch directory contents
          const dirResponse = await fetch(`${GITHUB_API_BASE}/models/${dir.name}`)
          if (!dirResponse.ok) {
            throw new Error(`Failed to fetch directory: ${dirResponse.statusText}`)
          }

          const dirContents = await dirResponse.json() as GitHubContent[]

          // Find metadata.json, .glb file, and concept art
          const metadataFile = dirContents.find(f => f.name === 'metadata.json')
          const glbFile = dirContents.find(f => f.name.endsWith('.glb'))
          const conceptArtFile = dirContents.find(f => f.name === 'concept-art.png')

          if (!metadataFile || !glbFile) {
            console.log(`    ⚠️  Skipping: Missing metadata.json or .glb file`)
            results.push({
              name: dir.name,
              success: false,
              action: 'skipped',
              error: 'Missing required files'
            })
            continue
          }

          // Fetch and parse metadata.json
          const metadataResponse = await fetch(metadataFile.download_url!)
          if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`)
          }

          const metadata = await metadataResponse.json() as AssetMetadata

          // Construct file URLs
          const glbUrl = `${GITHUB_RAW_BASE}/models/${dir.name}/${glbFile.name}`
          const conceptArtUrl = conceptArtFile
            ? `${GITHUB_RAW_BASE}/models/${dir.name}/${conceptArtFile.name}`
            : null

          // Check if asset already exists by name
          const existingAsset = await server.db.query.assets.findFirst({
            where: eq(assets.name, metadata.name)
          })

          const assetData = {
            name: metadata.name,
            type: metadata.type === 'weapon' || metadata.type === 'equipment' ? 'model' as const : 'model' as const,
            fileUrl: glbUrl,
            thumbnailUrl: conceptArtUrl,
            description: metadata.description,
            visibility: 'public' as const,
            metadata: {
              gameId: metadata.gameId,
              assetType: metadata.type,
              subtype: metadata.subtype,
              detailedPrompt: metadata.detailedPrompt,
              generatedAt: metadata.generatedAt,
              completedAt: metadata.completedAt,
              isBaseModel: metadata.isBaseModel,
              materialVariants: metadata.materialVariants,
              gddCompliant: metadata.gddCompliant,
              workflow: metadata.workflow,
              meshyTaskId: metadata.meshyTaskId,
              meshyStatus: metadata.meshyStatus,
              fileSize: glbFile.size,
              source: 'github-hyperscape-assets'
            },
            tags: [
              metadata.type,
              ...(metadata.subtype ? [metadata.subtype] : []),
              ...(metadata.isBaseModel ? ['base-model'] : []),
              ...(metadata.materialVariants || [])
            ].filter(Boolean) as string[]
          }

          if (existingAsset) {
            // Update existing asset
            await server.db
              .update(assets)
              .set({
                ...assetData,
                updatedAt: new Date()
              })
              .where(eq(assets.id, existingAsset.id))

            console.log(`    ✅ Updated: ${metadata.name}`)
            results.push({
              name: metadata.name,
              success: true,
              action: 'updated'
            })
          } else {
            // Create new asset
            await server.db.insert(assets).values({
              ...assetData,
              ownerId // Use the system/first user
            })

            console.log(`    ✅ Created: ${metadata.name}`)
            results.push({
              name: metadata.name,
              success: true,
              action: 'created'
            })
          }

        } catch (error) {
          console.error(`    ❌ Failed to process ${dir.name}:`, error)
          results.push({
            name: dir.name,
            success: false,
            action: 'skipped',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const summary = {
        total: results.length,
        created: results.filter(r => r.action === 'created').length,
        updated: results.filter(r => r.action === 'updated').length,
        skipped: results.filter(r => r.action === 'skipped').length,
        failed: results.filter(r => !r.success).length
      }

      console.log(`\n✨ GitHub import complete:`)
      console.log(`   Created: ${summary.created}`)
      console.log(`   Updated: ${summary.updated}`)
      console.log(`   Skipped: ${summary.skipped}`)
      console.log(`   Failed: ${summary.failed}`)

      return reply.send({
        success: true,
        summary,
        results
      })

    } catch (error) {
      console.error('❌ GitHub import failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}
