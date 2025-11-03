// This script will run ON Railway to check MinIO contents
import { minioStorageService } from './backend/src/services/minio.service'

console.log('🔍 Checking MinIO from Railway backend service...\n')

const buckets = ['3d-models', 'assets', 'audio', 'images', 'uploads']

for (const bucket of buckets) {
  console.log(`\n📁 Bucket: ${bucket}`)
  try {
    const files = await minioStorageService.listFiles(bucket)
    console.log(`  Files found: ${files.length}`)

    for (const file of files) {
      console.log(`  - ${file}`)
    }

    if (files.length === 0) {
      console.log('  (empty)')
    }
  } catch (error) {
    console.log(`  ⚠️  Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.log('\n✅ Done')
