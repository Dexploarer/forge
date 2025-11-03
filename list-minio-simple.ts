import * as Minio from 'minio'

// Use Railway production credentials - FIX the endpoint parsing
const endpoint = 'bucket-staging-4c7a.up.railway.app'  // Public endpoint

const client = new Minio.Client({
  endPoint: endpoint,
  port: 443,
  useSSL: true,
  accessKey: 'y1m84YjYcO9QVUlWS1gU1GQgT7B7bDGp',
  secretKey: '5Z3fbifEkI3gPAKSjnUYAobnoV51F95G2oFTYu8hg3MYCVJr',
})

console.log('🔍 Listing files in MinIO buckets...\n')

const buckets = ['3d-models', 'assets', 'audio', 'images']

for (const bucketName of buckets) {
  console.log(`\n📦 Bucket: ${bucketName}`)

  try {
    // Use listObjectsV2 with simpler parameters
    const objectsList: any[] = []
    const stream = client.listObjectsV2(bucketName, '', false)

    await new Promise((resolve, reject) => {
      stream.on('data', (obj) => objectsList.push(obj))
      stream.on('error', reject)
      stream.on('end', resolve)
    })

    console.log(`  Total files: ${objectsList.length}`)

    for (const obj of objectsList) {
      const sizeMB = ((obj.size || 0) / 1024 / 1024).toFixed(2)
      console.log(`  📄 ${obj.name}`)
      console.log(`     Size: ${sizeMB} MB`)
      console.log(`     Modified: ${obj.lastModified}`)
    }

    if (objectsList.length === 0) {
      console.log('  (empty)')
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}
