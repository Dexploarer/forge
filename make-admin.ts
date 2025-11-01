import { db } from './backend/src/database/db'
import { users } from './backend/src/database/schema'
import { eq } from 'drizzle-orm'

async function makeAdmin() {
  const userId = 'f8bc20c1-cfab-42b0-9340-920ce205f49d'

  await db.update(users)
    .set({ role: 'admin' })
    .where(eq(users.id, userId))

  console.log(`✅ User ${userId} is now an admin`)

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  })

  console.log('Updated user:', user)
  process.exit(0)
}

makeAdmin()
