import * as Minio from 'minio'

// Use Railway production credentials
const client = new Minio.Client({
  endPoint: 'bucket-staging-4c7a.up.railway.app',
  port: 443,
  useSSL: true,
  accessKey: 'y1m84YjYcO9QVUlWS1gU1GQgT7B7bDGp',
  secretKey: '5Z3fbifEkI3gPAKSjnUYAobnoV51F95G2oFTYu8hg3MYCVJr',
})

console.log('🔍 Checking MinIO buckets and files...\n')

// List all buckets
try {
  const buckets = await client.listBuckets()
  console.log(`📦 Found ${buckets.length} buckets:`)
  console.log(buckets.map(b => `  - ${b.name} (created: ${b.creationDate})`).join('\n'))
  console.log()

  // List files in each bucket
  for (const bucket of buckets) {
    console.log(`\n📁 Files in bucket "${bucket.name}":`)

    try {
      const stream = client.listObjects(bucket.name, '', true)
      let count = 0

      for await (const obj of stream) {
        count++
        const sizeKB = ((obj.size || 0) / 1024).toFixed(2)
        const sizeMB = ((obj.size || 0) / 1024 / 1024).toFixed(2)
        console.log(`  ${count}. ${obj.name}`)
        console.log(`     Size: ${sizeKB} KB (${sizeMB} MB)`)
        console.log(`     Modified: ${obj.lastModified}`)
        console.log(`     URL: https://bucket-staging-4c7a.up.railway.app/${bucket.name}/${obj.name}`)
        console.log()
      }

      if (count === 0) {
        console.log('  (empty)')
      }
      console.log(`  Total: ${count} files`)
    } catch (bucketError) {
      console.log(`  ⚠️  Error listing files: ${bucketError instanceof Error ? bucketError.message : String(bucketError)}`)
    }
  }
} catch (error) {
  console.error('❌ Error:', error)
  if (error instanceof Error) {
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
  }
}
