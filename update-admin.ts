import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from './backend/src/database/schema/index.ts'
import { eq } from 'drizzle-orm'

const client = postgres('postgresql://postgres:bratxk11nt2ue61m4p605nr23tywq7yp@shortline.proxy.rlwy.net:41224/railway')
const db = drizzle(client)

// Update the user to admin role
const result = await db
  .update(users)
  .set({ role: 'admin' })
  .where(eq(users.id, '57f5ff08-aa90-4fec-9395-18432dd9e46b'))
  .returning()

console.log('✅ Updated user to admin:')
console.log('ID:', result[0].id)
console.log('Wallet:', result[0].walletAddress)
console.log('Role:', result[0].role)

await client.end()
process.exit(0)
