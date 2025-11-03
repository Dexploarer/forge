import * as Minio from 'minio'
import { env } from '../src/config/env'

const endpoint = env.MINIO_ENDPOINT.replace(/^https?:\/\//, '')
const useSSL = env.MINIO_ENDPOINT.startsWith('https://')

const client = new Minio.Client({
  endPoint: endpoint,
  port: env.MINIO_PORT || 9000,
  useSSL,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
})

const buckets = ['3d-models', 'audio', 'images', 'assets', 'uploads']

async function checkBuckets() {
  for (const bucket of buckets) {
    console.log(`\nChecking bucket: ${bucket}`)
    try {
      const stream = client.listObjectsV2(bucket, '', true)
      let count = 0

      stream.on('data', (obj) => {
        count++
        if (count <= 5) {
          console.log(`  - ${obj.name} (${obj.size} bytes)`)
        }
      })

      stream.on('error', (err) => {
        console.error(`  ❌ Error: ${err.message}`)
      })

      await new Promise((resolve) => {
        stream.on('end', () => {
          console.log(`  Total files: ${count}`)
          resolve(null)
        })
      })
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`)
    }
  }

  process.exit(0)
}

checkBuckets()
