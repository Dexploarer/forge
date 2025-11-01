import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env'
import * as schema from './schema'

// =====================================================
// DATABASE CONNECTION
// =====================================================

// Create PostgreSQL connection with connection pooling
const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idle_timeout: 30,        // 30 seconds
  connect_timeout: 10,     // 10 seconds
  max_lifetime: 60 * 30,   // 30 minutes
})

// Migration client (single connection for migrations)
export const migrationClient = postgres(env.DATABASE_URL, { max: 1 })

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema })

// Export types for external use
export type Database = typeof db
export { schema }

// =====================================================
// HEALTH CHECK
// =====================================================

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

export async function closeDatabaseConnections(): Promise<void> {
  console.log('Closing database connections...')
  await queryClient.end()
  await migrationClient.end()
  console.log('Database connections closed')
}

// Handle process termination
process.on('SIGINT', async () => {
  await closeDatabaseConnections()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await closeDatabaseConnections()
  process.exit(0)
})
