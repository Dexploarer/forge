import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env'
import * as schema from './schema'

// =====================================================
// QUERY LOGGING
// =====================================================

class QueryLogger {
  private queryCount = 0
  private slowQueryThreshold = 100 // ms

  logQuery(query: string, params: unknown[], duration?: number) {
    this.queryCount++

    // Sanitize sensitive data from query parameters
    const sanitizedParams = this.sanitizeParams(params)

    if (duration !== undefined) {
      if (duration > this.slowQueryThreshold) {
        console.warn('[DB] 🐌 Slow query detected', {
          query: this.truncateQuery(query),
          params: sanitizedParams,
          durationMs: duration,
          threshold: this.slowQueryThreshold,
          queryNumber: this.queryCount,
        })
      } else if (env.LOG_LEVEL === 'debug') {
        console.log('[DB] 🔍 Query executed', {
          query: this.truncateQuery(query),
          params: sanitizedParams,
          durationMs: duration,
          queryNumber: this.queryCount,
        })
      }
    }
  }

  private sanitizeParams(params: unknown[]): unknown[] {
    return params.map((param) => {
      if (typeof param === 'string' && param.length > 100) {
        return param.substring(0, 100) + '...[truncated]'
      }
      // Hide potential passwords or tokens
      if (typeof param === 'string' && (
        param.includes('password') ||
        param.includes('token') ||
        param.includes('secret') ||
        param.includes('key')
      )) {
        return '[REDACTED]'
      }
      return param
    })
  }

  private truncateQuery(query: string): string {
    if (query.length > 200) {
      return query.substring(0, 200) + '...[truncated]'
    }
    return query
  }

  getQueryCount(): number {
    return this.queryCount
  }

  reset(): void {
    this.queryCount = 0
  }
}

export const queryLogger = new QueryLogger()

// Custom Drizzle logger
const drizzleLogger = {
  logQuery(query: string, params: unknown[]): void {
    // Log query (Drizzle doesn't provide execution time in the logger callback)
    queryLogger.logQuery(query, params)
  }
}

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

  // Debug logging for queries
  debug: env.LOG_LEVEL === 'debug' ? (_connection: number, query: string, params: any[]) => {
    console.log('[DB] 🔧 postgres-js query', {
      query: query.substring(0, 200),
      paramCount: params?.length || 0,
    })
  } : false,

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

// Create Drizzle instance with schema and logger
export const db = drizzle(queryClient, {
  schema,
  logger: env.LOG_LEVEL === 'debug' ? drizzleLogger : false,
})

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
