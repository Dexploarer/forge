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
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // Privy Authentication
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),

  // File Storage (Optional)
  FILE_STORAGE_PATH: z.string().default('./uploads'),
  FILE_SERVER_URL: z.string().url().optional(),

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
