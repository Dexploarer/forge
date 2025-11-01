import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env'
import * as schema from './schema'

// =====================================================
// DATABASE CONNECTION
// =====================================================

// Railway-optimized PostgreSQL connection configuration
// Prevents ECONNRESET errors by proactively managing connections
const queryClient = postgres(env.DATABASE_URL, {
  // Connection pool size - Railway PostgreSQL has connection limits
  max: env.NODE_ENV === 'production' ? 10 : 5,

  // Close idle connections BEFORE Railway's infrastructure does (~25s)
  idle_timeout: 20,        // 20 seconds (below Railway's threshold)

  // Connection establishment timeout
  connect_timeout: 30,     // 30 seconds (increased for Railway's network)

  // Maximum connection lifetime (prevent stale connections)
  max_lifetime: 60 * 30,   // 30 minutes

  // TCP keepalive to detect dead connections early
  keep_alive: 5000,        // Send keepalive every 5 seconds

  // Prepared statements management (better performance)
  prepare: true,           // Enable prepared statements

  // Connection lifecycle callbacks for debugging
  onnotice: (notice) => {
    if (env.LOG_LEVEL === 'debug') {
      console.log('[DB Notice]', notice)
    }
  },

  // Error handling - don't throw on connection errors, retry instead
  connection: {
    application_name: 'forge-backend',
  },
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
    const startTime = Date.now()
    await queryClient`SELECT 1`
    const duration = Date.now() - startTime

    if (env.LOG_LEVEL === 'debug') {
      console.log(`[DB Health] ✓ Connection healthy (${duration}ms)`)
    }

    return true
  } catch (error) {
    console.error('[DB Health] ✗ Database health check failed:', {
      error: error instanceof Error ? error.message : error,
      code: (error as any)?.code,
      timestamp: new Date().toISOString(),
    })
    return false
  }
}

// =====================================================
// CONNECTION METRICS (for debugging)
// =====================================================

export function getConnectionStats() {
  // postgres-js doesn't expose pool stats directly,
  // but we can track health check performance
  return {
    configured_max: env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 30,
    max_lifetime: 1800,
    keep_alive: 5000,
  }
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

export async function closeDatabaseConnections(): Promise<void> {
  console.log('[DB Shutdown] Closing database connections...')
  try {
    await queryClient.end({ timeout: 5 })
    await migrationClient.end({ timeout: 5 })
    console.log('[DB Shutdown] ✓ All database connections closed gracefully')
  } catch (error) {
    console.error('[DB Shutdown] ✗ Error closing connections:', error)
    throw error
  }
}

// Handle process termination signals
process.on('SIGINT', async () => {
  console.log('[DB Shutdown] Received SIGINT signal')
  await closeDatabaseConnections()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('[DB Shutdown] Received SIGTERM signal')
  await closeDatabaseConnections()
  process.exit(0)
})
