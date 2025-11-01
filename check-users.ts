import { db } from './backend/src/database/db'
import { users } from './backend/src/database/schema'

async function checkUsers() {
  try {
    const allUsers = await db.select().from(users)
    console.log(`\n📊 Total users in database: ${allUsers.length}\n`)

    if (allUsers.length > 0) {
      console.log('Users:')
      allUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email || user.walletAddress || user.privyUserId}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Privy ID: ${user.privyUserId}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Created: ${user.createdAt}`)
        console.log(`   Last Login: ${user.lastLoginAt}`)
      })
    } else {
      console.log('❌ No users found in database!')
    }
  } catch (error) {
    console.error('Error checking users:', error)
  }
  process.exit(0)
}

checkUsers()
