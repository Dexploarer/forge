import postgres from 'postgres'

const DATABASE_URL = 'postgresql://postgres:bratxk11nt2ue61m4p605nr23tywq7yp@shortline.proxy.rlwy.net:41224/railway'

async function addImageType() {
  const sql = postgres(DATABASE_URL, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  })

  try {
    console.log('🔄 Adding "image" type to asset_type enum...')

    // First check if it already exists
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'image'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'asset_type')
      ) as exists
    `

    if (result[0].exists) {
      console.log('✅ "image" type already exists in asset_type enum')
      await sql.end()
      return
    }

    // Add the new value
    await sql.unsafe(`ALTER TYPE "public"."asset_type" ADD VALUE 'image'`)

    console.log('✅ Successfully added "image" type to asset_type enum')
  } catch (error) {
    console.error('❌ Error adding image type:', error)
    throw error
  } finally {
    await sql.end()
  }
}

addImageType()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
