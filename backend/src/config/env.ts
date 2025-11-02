import { z } from 'zod'
import dotenv from 'dotenv'

// Load .env file
dotenv.config()

// =====================================================
// ENVIRONMENT SCHEMA - Type-safe configuration
// =====================================================

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().optional().default('3000').transform(val => {
    const num = parseInt(val, 10)
    return isNaN(num) ? 3000 : num
  }),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // Privy Authentication (optional during build, required at runtime)
  PRIVY_APP_ID: z.string().default('test-app-id'),
  PRIVY_APP_SECRET: z.string().default('test-app-secret'),

  // Admin Access Control (comma-separated wallet addresses)
  ADMIN_WALLETS: z.string().optional().transform((val) => {
    if (!val || val === '') return []
    return val.split(',').map(addr => addr.trim().toLowerCase())
  }),

  // File Storage (Optional)
  FILE_STORAGE_PATH: z.string().default('./uploads'),
  FILE_SERVER_URL: z.string().optional().transform(val => {
    if (!val || val === '') return undefined
    try {
      new URL(val)
      return val
    } catch {
      return undefined
    }
  }),

  // CORS (Optional)
  ALLOWED_ORIGINS: z.string().optional().transform((val) => val?.split(',') || ['*']),

  // Encryption & API Keys (Optional - have defaults)
  ENCRYPTION_KEY: z.string().length(64).optional(), // 32-byte hex key
  API_KEY_PREFIX: z.string().default('fk_live_'),

  // AI Service API Keys
  OPENAI_API_KEY: z.string().optional(),
  MESHY_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),

  // Qdrant Vector Database
  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_PRIVATE_DOMAIN: z.string().optional(), // Railway provides this
  QDRANT_PORT: z.coerce.number().int().min(1).max(65535).optional(), // Railway provides this

  // Vercel AI Gateway (unified access to all AI providers)
  AI_GATEWAY_API_KEY: z.string().optional(),

  // Vercel Environment (used for AI Gateway OIDC)
  VERCEL_ENV: z.string().optional(),

  // Meshy Configuration
  MESHY_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  MESHY_TIMEOUT_MS: z.coerce.number().int().min(10000).default(300000),

  // FFmpeg Configuration (Optional - will use system ffmpeg if not specified)
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),

  // MinIO Configuration
  MINIO_ENDPOINT: z.string().optional(), // Can be derived from PRIVATE or PUBLIC endpoint
  MINIO_PRIVATE_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_HOST: z.string().optional(),
  MINIO_ROOT_USER: z.string().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),
  MINIO_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // imgproxy Configuration
  IMGPROXY_URL: z.string().optional(), // imgproxy server URL (e.g., imgproxy-staging.up.railway.app)
  IMGPROXY_KEY: z.string().optional(), // HMAC key for URL signing (hex)
  IMGPROXY_SALT: z.string().optional(), // HMAC salt for URL signing (hex)
  IMGPROXY_MAX_SRC_RESOLUTION: z.coerce.number().optional().default(16.8), // Max megapixels
  IMGPROXY_ENABLED: z.coerce.boolean().default(true), // Enable/disable imgproxy
})

// =====================================================
// PARSE & VALIDATE
// =====================================================

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsedEnv.error.format())
  process.exit(1)
}

export const env = parsedEnv.data

// =====================================================
// TYPE EXPORTS
// =====================================================

export type Env = z.infer<typeof envSchema>
