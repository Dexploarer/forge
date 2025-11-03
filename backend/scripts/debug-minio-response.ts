/**
 * Debug MinIO raw responses
 */

import { env } from '../src/config/env'

async function debugMinioResponse() {
  const accessKey = env.MINIO_ROOT_USER
  const secretKey = env.MINIO_ROOT_PASSWORD
  const endpoint = env.MINIO_ENDPOINT

  console.log('Testing MinIO endpoint:', endpoint)
  console.log('Access key:', accessKey?.substring(0, 4) + '...')

  // Try to list objects with a simple GET request
  const buckets = ['3d-models', 'audio', 'images']

  for (const bucket of buckets) {
    console.log(`\n📦 Testing bucket: ${bucket}`)
    const url = `${endpoint}/${bucket}/`

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessKey}`, // Try simple bearer auth first
        },
      })

      console.log('  Status:', response.status)
      console.log('  Content-Type:', response.headers.get('content-type'))

      const text = await response.text()
      console.log('  Response length:', text.length)
      console.log('  First 500 chars:', text.substring(0, 500))

      // Check if it's XML
      if (text.startsWith('<?xml') || text.startsWith('<')) {
        console.log('  ✓ Response is XML')
      } else {
        console.log('  ✗ Response is NOT XML')
        // Show first bytes as hex
        const bytes = new TextEncoder().encode(text.substring(0, 20))
        console.log('  First bytes (hex):', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '))
      }
    } catch (err: any) {
      console.error('  ❌ Error:', err.message)
    }
  }

  process.exit(0)
}

debugMinioResponse()
