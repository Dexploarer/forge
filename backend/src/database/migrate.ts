import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrationClient } from './db'
import path from 'path'
import { fileURLToPath } from 'url'

// =====================================================
// DATABASE MIGRATION RUNNER
// =====================================================

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  console.log('🔄 Running database migrations...')

  try {
    const db = drizzle(migrationClient)

    // Use absolute path to migrations folder
    const migrationsPath = path.join(__dirname, 'migrations')
    console.log(`📁 Migrations folder: ${migrationsPath}`)

    await migrate(db, {
      migrationsFolder: migrationsPath,
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
