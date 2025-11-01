#!/usr/bin/env bun
/**
 * Promote User to Admin by Wallet Address
 */

import { db } from '../src/database/db'
import { users } from '../src/database/schema'
import { eq } from 'drizzle-orm'

const walletAddress = process.argv[2]

if (!walletAddress) {
  console.error('❌ Usage: bun scripts/promote-admin.ts <wallet-address>')
  console.error('   Example: bun scripts/promote-admin.ts 0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef')
  process.exit(1)
}

console.log(`🔍 Looking for user with wallet address: ${walletAddress}`)

// Find user by wallet address (case-insensitive)
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.walletAddress, walletAddress))
  .limit(1)

if (!user) {
  console.error(`❌ No user found with wallet address: ${walletAddress}`)
  console.error('   Make sure the user has logged in at least once.')
  process.exit(1)
}

console.log(`\n✅ Found user:`)
console.log(`   ID: ${user.id}`)
console.log(`   Display Name: ${user.displayName || 'N/A'}`)
console.log(`   Email: ${user.email || 'N/A'}`)
console.log(`   Current Role: ${user.role}`)
console.log(`   Wallet: ${user.walletAddress}`)

if (user.role === 'admin') {
  console.log(`\n✨ User is already an admin!`)
  process.exit(0)
}

// Update user role to admin
console.log(`\n🔄 Promoting user to admin...`)

const [updatedUser] = await db
  .update(users)
  .set({
    role: 'admin',
    updatedAt: new Date()
  })
  .where(eq(users.id, user.id))
  .returning()

console.log(`\n✅ SUCCESS! User promoted to admin:`)
console.log(`   Display Name: ${updatedUser.displayName || 'N/A'}`)
console.log(`   Email: ${updatedUser.email || 'N/A'}`)
console.log(`   New Role: ${updatedUser.role}`)
console.log(`   Wallet: ${updatedUser.walletAddress}`)
console.log(`\n🎉 User can now access the admin panel at /admin`)

process.exit(0)
