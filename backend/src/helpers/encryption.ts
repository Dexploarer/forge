import crypto from 'crypto'
import { env } from '../config/env'

/**
 * Encryption Helper
 * AES-256-GCM encryption for sensitive data like API keys
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

/**
 * Get encryption key from environment
 * Falls back to a default key for development/testing
 */
function getEncryptionKey(): Buffer {
  // In production, this MUST be a 32-byte hex key from environment
  const key = env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000'

  if (!env.ENCRYPTION_KEY && env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt an API key or other sensitive string
 * Returns: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted API key
 * Input format: iv:authTag:encryptedData (all hex encoded)
 */
export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey()

  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, authTagHex, encryptedHex] = parts

  const iv = Buffer.from(ivHex!, 'hex')
  const authTag = Buffer.from(authTagHex!, 'hex')
  const encryptedData = encryptedHex!

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Test encryption/decryption round-trip
 * Useful for validating the encryption key is correct
 */
export function testEncryption(): boolean {
  const testString = 'test-api-key-' + Date.now()
  const encrypted = encryptApiKey(testString)
  const decrypted = decryptApiKey(encrypted)
  return testString === decrypted
}
