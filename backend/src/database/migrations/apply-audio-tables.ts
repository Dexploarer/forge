import postgres from 'postgres'
import { env } from '../../config/env'

async function main() {
  const connection = postgres(env.DATABASE_URL)

  try {
    console.log('Creating audio tables...')

    // Read and execute the migration
    const fs = await import('fs/promises')
    const path = await import('path')

    const migrationPath = path.join(__dirname, '0003_next_fallen_one.sql')
    const sql = await fs.readFile(migrationPath, 'utf-8')

    // Split by statement breakpoint and filter to only audio tables
    const statements = sql.split('--> statement-breakpoint')

    const audioStatements = statements.filter(stmt => {
      const lowerStmt = stmt.toLowerCase().trim()
      return lowerStmt.includes('music_tracks') ||
             lowerStmt.includes('sound_effects') ||
             lowerStmt.includes('voice_profiles') ||
             lowerStmt.includes('voice_generations')
    })

    console.log(`Found ${audioStatements.length} audio-related statements`)

    for (const statement of audioStatements) {
      const trimmed = statement.trim()
      if (trimmed) {
        try {
          await connection.unsafe(trimmed)
          console.log('✓ Executed:', trimmed.substring(0, 60) + '...')
        } catch (error: any) {
          if (error.code === '42P07') {
            console.log('⚠ Already exists:', trimmed.substring(0, 60) + '...')
          } else {
            throw error
          }
        }
      }
    }

    console.log('\n✅ Audio tables created successfully')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main()
