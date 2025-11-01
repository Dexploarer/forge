/**
 * Encryption utilities for securely storing sensitive data
 * Uses AES-256-GCM for encryption
 */

import crypto from 'crypto'
import { env } from '@/config/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derives a key from the encryption key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for encrypting sensitive data')
  }

  return crypto.pbkdf2Sync(
    env.ENCRYPTION_KEY,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  )
}

/**
 * Encrypts a string value
 * @param text - The plaintext to encrypt
 * @returns Base64-encoded encrypted data with IV, salt, and auth tag
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty text')
  }

  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  // Generate random IV and salt
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)

  // Derive key from encryption key and salt
  const key = deriveKey(salt)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get authentication tag
  const authTag = cipher.getAuthTag()

  // Combine salt + iv + authTag + encrypted data
  const result = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ])

  return result.toString('base64')
}

/**
 * Decrypts an encrypted string
 * @param encryptedData - Base64-encoded encrypted data with IV, salt, and auth tag
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data')
  }

  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  try {
    // Convert from base64
    const buffer = Buffer.from(encryptedData, 'base64')

    // Extract salt, IV, auth tag, and encrypted data
    const salt = buffer.subarray(0, SALT_LENGTH)
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    // Derive key from encryption key and salt
    const key = deriveKey(salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Decrypt the data
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new Error('Failed to decrypt data - data may be corrupted or encryption key may have changed')
  }
}

/**
 * Extracts the first few characters of an API key for identification
 * @param apiKey - The API key
 * @returns The prefix (first 10 chars or less)
 */
export function extractKeyPrefix(apiKey: string): string {
  if (!apiKey) {
    return ''
  }

  // For keys like "sk-proj-xxxxx", keep the "sk-proj-" and first few chars
  const maxLength = 15
  return apiKey.length > maxLength ? apiKey.substring(0, maxLength) + '...' : apiKey
}

/**
 * Validates that an API key looks valid (basic format check)
 * @param service - The service name
 * @param apiKey - The API key to validate
 * @returns True if the format looks valid
 */
export function validateApiKeyFormat(service: string, apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false
  }

  // Basic validation rules for different services
  switch (service.toLowerCase()) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20
    case 'elevenlabs':
      return apiKey.length > 20 // ElevenLabs keys don't have a specific prefix
    case 'meshy':
      return apiKey.startsWith('msy_') && apiKey.length > 20
    case 'fal':
      return apiKey.length > 10 // FAL keys vary
    case 'openrouter':
      return apiKey.startsWith('sk-or-') && apiKey.length > 20
    default:
      // For unknown services, just check it's a reasonable length
      return apiKey.length > 10
  }
}
