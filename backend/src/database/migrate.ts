import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrationClient } from './db'

// =====================================================
// DATABASE MIGRATION RUNNER
// =====================================================

async function runMigrations() {
  console.log('🔄 Running database migrations...')

  try {
    const db = drizzle(migrationClient)

    await migrate(db, {
      migrationsFolder: './src/database/migrations',
    })

    console.log('✅ Migrations completed successfully')
    await migrationClient.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await migrationClient.end()
    process.exit(1)
  }
}

// Run migrations
runMigrations()
