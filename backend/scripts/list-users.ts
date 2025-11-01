#!/usr/bin/env bun
/**
 * List all users in the database
 */

import { db } from '../src/database/db'
import { users } from '../src/database/schema'

console.log('🔍 Fetching all users from database...\n')

try {
  const allUsers = await db.select({
    id: users.id,
    privyUserId: users.privyUserId,
    displayName: users.displayName,
    email: users.email,
    walletAddress: users.walletAddress,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users)

  if (allUsers.length === 0) {
    console.log('❌ No users found in database.')
    console.log('   Users need to log in at least once to be created.')
    process.exit(0)
  }

  console.log(`✅ Found ${allUsers.length} user(s):\n`)

  allUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.displayName || 'N/A'}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Privy ID: ${user.privyUserId}`)
    console.log(`   Email: ${user.email || 'N/A'}`)
    console.log(`   Wallet: ${user.walletAddress || 'N/A'}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Created: ${user.createdAt}`)
    console.log('')
  })

  console.log('💡 To promote a user to admin, run:')
  console.log('   bun scripts/promote-admin.ts <wallet-address>')
} catch (error: any) {
  console.error('❌ Error fetching users:', error.message)
  process.exit(1)
}

process.exit(0)
