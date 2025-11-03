import * as Minio from 'minio'
import { env } from '../src/config/env'

console.log('Testing MinIO connection...')
console.log('Endpoint:', env.MINIO_ENDPOINT)
console.log('Port:', env.MINIO_PORT)
console.log('Has User:', !!env.MINIO_ROOT_USER)
console.log('Has Password:', !!env.MINIO_ROOT_PASSWORD)

const endpoint = env.MINIO_ENDPOINT.replace(/^https?:\/\//, '')
const useSSL = env.MINIO_ENDPOINT.startsWith('https://')

const client = new Minio.Client({
  endPoint: endpoint,
  port: env.MINIO_PORT || 9000,
  useSSL,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
})

console.log('\nConnecting to MinIO...')
client.listBuckets()
  .then(buckets => {
    console.log('✅ MinIO connected successfully!')
    console.log('Buckets:', buckets.map(b => b.name))
    process.exit(0)
  })
  .catch(err => {
    console.error('❌ MinIO connection failed:', err.message)
    console.error('Error name:', err.name)
    process.exit(1)
  })
