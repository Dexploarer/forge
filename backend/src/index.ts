import { buildServer } from './server'
import { env } from './config/env'
import { fileStorageService } from './services/file.service'

// =====================================================
// MAIN APPLICATION ENTRY POINT
// =====================================================

async function start() {
  let server

  try {
    // Initialize file storage (create upload directories)
    await fileStorageService.initialize()

    // Build server
    server = await buildServer()

    // Start listening
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    })

    server.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    server.log.info('🚀 Forge Backend Started')
    server.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    server.log.info(`📍 API:    http://${env.HOST}:${env.PORT}/api`)
    server.log.info(`🏥 Health: http://localhost:${env.PORT}/health`)
    server.log.info(`🔧 Env:    ${env.NODE_ENV}`)
    server.log.info(`📝 Log:    ${env.LOG_LEVEL}`)
    server.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }

  // Graceful shutdown handlers
  const signals = ['SIGINT', 'SIGTERM'] as const

  for (const signal of signals) {
    process.on(signal, async () => {
      if (!server) return

      server.log.info(`\n📡 Received ${signal}, starting graceful shutdown...`)

      try {
        await server.close()
        server.log.info('✅ HTTP server closed')
        server.log.info('👋 Graceful shutdown complete')
        process.exit(0)
      } catch (error) {
        server.log.error({ error }, '❌ Error during shutdown')
        process.exit(1)
      }
    })
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason)
    process.exit(1)
  })
}

// Start the application
start()
