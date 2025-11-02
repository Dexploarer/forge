import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { assets } from '../src/database/schema'

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:bratxk11nt2ue61m4p605nr23tywq7yp@shortline.proxy.rlwy.net:41224/railway"

const client = postgres(DATABASE_URL)
const db = drizzle(client)

const allAssets = await db.select().from(assets).limit(10)

console.log(`\nFound ${allAssets.length} assets in database:`)
allAssets.forEach((asset, i) => {
  console.log(`\n${i + 1}. ${asset.name}`)
  console.log(`   Type: ${asset.type}`)
  console.log(`   Status: ${asset.status}`)
  console.log(`   File URL: ${asset.fileUrl}`)
  console.log(`   Thumbnail: ${asset.thumbnailUrl}`)
  console.log(`   MinIO: ${asset.metadata?.minioBucket}/${asset.metadata?.minioKey}`)
})

await client.end()
