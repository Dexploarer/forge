/**
 * Create sample database records for known MinIO files
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'

const publicHost = 'bucket-staging-4c7a.up.railway.app'

// Sample files from mc CLI output
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

async function createSampleRecords() {
  console.log('📝 Creating sample database records...\n')

  // Create 3D model records
  console.log('📦 Creating sample 3D models/textures...')
  const modelRecords = sample3DModels.map(filename => {
    const url = `https://${publicHost}/3d-models/${filename}`
    const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const type = filename.endsWith('.png') ? 'texture' as const : 'model' as const

    return {
      name,
      type,
      fileUrl: url,
      storageMode: 'minio' as const,
      status: 'published' as const,
      visibility: 'public' as const,
    }
  })

  await db.insert(assets).values(modelRecords).onConflictDoNothing()
  console.log(`  ✓ Created ${modelRecords.length} records`)

  // Create audio records
  console.log('\n📦 Creating sample audio tracks...')
  const audioRecords = sampleAudioFiles.map(filename => {
    const url = `https://${publicHost}/audio/${filename}`
    const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

    return {
      name,
      audioUrl: url,
      status: 'published' as const,
    }
  })

  await db.insert(musicTracks).values(audioRecords).onConflictDoNothing()
  console.log(`  ✓ Created ${audioRecords.length} records`)

  // Create image records
  console.log('\n📦 Creating sample images...')
  const imageRecords = sampleImages.map(filename => {
    const url = `https://${publicHost}/images/${filename}`
    const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

    return {
      name,
      type: 'texture' as const,
      fileUrl: url,
      storageMode: 'minio' as const,
      status: 'published' as const,
      visibility: 'public' as const,
    }
  })

  await db.insert(assets).values(imageRecords).onConflictDoNothing()
  console.log(`  ✓ Created ${imageRecords.length} records`)

  console.log('\n✅ Sample records created!')
  console.log('   Check the dashboard to verify they appear')

  // Verify
  console.log('\n📊 Verification:')
  const assetCount = await db.select().from(assets).then(r => r.filter(a => a.fileUrl !== null).length)
  const musicCount = await db.select().from(musicTracks).then(r => r.filter(m => m.audioUrl !== null).length)

  console.log(`   Assets with URLs: ${assetCount}`)
  console.log(`   Music tracks with URLs: ${musicCount}`)

  process.exit(0)
}

createSampleRecords().catch(err => {
  console.error('❌ Failed:', err)
  process.exit(1)
})
