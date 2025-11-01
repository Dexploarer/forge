import crypto from 'crypto'
import { env } from '../config/env'

/**
 * API Key Generator
 * Secure generation and validation of API keys
 */

const KEY_LENGTH = 32 // 32 bytes = 256 bits
const PREFIX = env.API_KEY_PREFIX || 'fk_live_'

/**
 * Generate a new API key with prefix, random bytes, and hash
 * Returns: { key, hash, prefix }
 * - key: Full API key with prefix (to show to user once)
 * - hash: SHA-256 hash of the key (to store in database)
 * - prefix: Key prefix for identification
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(KEY_LENGTH)
  const randomString = randomBytes.toString('base64url') // URL-safe base64

  // Create full key with prefix
  const key = `${PREFIX}${randomString}`

  // Generate SHA-256 hash for storage
  const hash = hashApiKey(key)

  return {
    key,
    hash,
    prefix: PREFIX,
  }
}

/**
 * Hash an API key using SHA-256
 * This is what gets stored in the database
 */
export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex')
}

/**
 * Validate an API key against its hash
 * Returns true if the key matches the hash
 */
export function validateApiKey(key: string, hash: string): boolean {
  const computedHash = hashApiKey(key)
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hash, 'hex')
  )
}

/**
 * Extract prefix from API key
 */
export function extractPrefix(key: string): string | null {
  if (key.startsWith(PREFIX)) {
    return PREFIX
  }
  // Support other prefixes for migration
  const match = key.match(/^([a-z_]+)_/)
  return match ? match[1]! + '_' : null
}
