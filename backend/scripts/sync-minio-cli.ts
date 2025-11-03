/**
 * Sync MinIO files to database using mc CLI
 */

import { db } from '../src/database/db'
import { assets, musicTracks } from '../src/database/schema'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const publicHost = 'bucket-staging-4c7a.up.railway.app'

async function getFilesFromBucket(bucket: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`/tmp/mc ls myminio/${bucket} --recursive`)
    const lines = stdout.trim().split('\n').filter(line => line.trim())

    const files = lines.map(line => {
      // Parse mc output: [date time] size STANDARD filename
      const parts = line.split(/\s+/)
      const filename = parts[parts.length - 1]
      return filename
    }).filter(f => f && f.length > 0)

    return files
  } catch (err: any) {
    console.error(`Error listing ${bucket}:`, err.message)
    return []
  }
}

async function syncMinioToDatabase() {
  console.log('🔄 Syncing MinIO files to database using CLI...\n')

  let totalScanned = 0
  let totalCreated = 0

  // Scan 3D models bucket
  try {
    console.log('📦 Scanning 3d-models bucket...')
    const files = await getFilesFromBucket('3d-models')
    console.log(`  Found ${files.length} files`)

    for (const filename of files) {
      const url = `https://${publicHost}/3d-models/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      // Determine type based on extension
      let type: 'model' | 'texture' = 'model'
      if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        type = 'texture'
      }

      await db.insert(assets).values({
        name,
        type,
        fileUrl: url,
        storageMode: 'minio',
        status: 'published',
        visibility: 'public',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++

      if (totalScanned % 50 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
  } catch (err: any) {
    console.error('Error scanning 3d-models:', err.message)
  }

  // Scan audio bucket
  try {
    console.log('\n📦 Scanning audio bucket...')
    const files = await getFilesFromBucket('audio')
    console.log(`  Found ${files.length} files`)

    for (const filename of files) {
      const url = `https://${publicHost}/audio/${filename}`
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      await db.insert(musicTracks).values({
        name,
        audioUrl: url,
        status: 'published',
      }).onConflictDoNothing()

      totalCreated++
      totalScanned++

      if (totalScanned % 50 === 0) {
        console.log(`  Progress: ${totalScanned} files processed`)
      }
    }
  } catch (err: any) {
    console.error('Error scanning audio:', err.message)
  }

  // Scan images bucket
  try {
    console.log('\n📦 Scanning images bucket...')
    const files = await getFilesFromBucket('images')
    console.log(`  Found ${files.length} files`)

    for (const filename of files) {
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

      if (totalScanned % 50 === 0) {
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
