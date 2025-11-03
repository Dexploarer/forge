import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres('postgresql://postgres:EqSZhuIHEBzZZpQXGyYpvydLRhurAVHi@interchange.proxy.rlwy.net:46923/railway');
const db = drizzle(client);

console.log('🔍 Checking database for MinIO-stored assets...\n')

// Check for assets with MinIO URLs
const minioAssets = await db.execute(
  `SELECT
    id,
    name,
    type,
    file_url,
    file_size,
    mime_type,
    (metadata->>'storageMode') as storage_mode,
    (metadata->>'minioBucket') as minio_bucket,
    (metadata->>'minioPath') as minio_path,
    created_at,
    updated_at
  FROM assets
  WHERE file_url LIKE '%bucket-staging%' OR (metadata->>'storageMode') = 'minio'
  ORDER BY created_at DESC`
);

console.log(`Found ${minioAssets.length} assets with MinIO storage:\n`)

for (const asset of minioAssets as any[]) {
  console.log(`📄 ${asset.name} (${asset.type})`)
  console.log(`   ID: ${asset.id}`)
  console.log(`   Storage: ${asset.storage_mode || 'unknown'}`)
  console.log(`   Bucket: ${asset.minio_bucket || 'N/A'}`)
  console.log(`   Path: ${asset.minio_path || 'N/A'}`)
  console.log(`   URL: ${asset.file_url}`)
  console.log(`   Size: ${asset.file_size ? (asset.file_size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`)
  console.log(`   Created: ${asset.created_at}`)
  console.log()
}

// Check all unique storage modes
const storageModes = await db.execute(
  `SELECT
    (metadata->>'storageMode') as storage_mode,
    COUNT(*) as count
  FROM assets
  WHERE file_url IS NOT NULL
  GROUP BY (metadata->>'storageMode')
  ORDER BY count DESC`
);

console.log('\n📊 Storage mode summary:')
for (const mode of storageModes as any[]) {
  console.log(`  ${mode.storage_mode || '(no mode)'}: ${mode.count} assets`)
}

await client.end();
