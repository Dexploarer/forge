/**
 * User Credentials Service
 * Manages encrypted storage and retrieval of user AI service API keys
 */

import { db } from '@/database/db'
import { userCredentials } from '@/database/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt, extractKeyPrefix, validateApiKeyFormat } from '@/utils/encryption'
import { env } from '@/config/env'

export type AIService =
  | 'openai'
  | 'anthropic'
  | 'elevenlabs'
  | 'meshy'
  | 'fal'
  | 'openrouter'
  | 'ai-gateway'

export interface UserCredential {
  id: string
  userId: string
  service: string
  keyPrefix: string | null
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

export class UserCredentialsService {
  /**
   * Store or update a user's API key for a service
   */
  async setCredential(
    userId: string,
    service: AIService,
    apiKey: string
  ): Promise<UserCredential> {
    // Validate API key format
    if (!validateApiKeyFormat(service, apiKey)) {
      throw new Error(`Invalid API key format for service: ${service}`)
    }

    // Encrypt the API key
    const encryptedApiKey = encrypt(apiKey)
    const keyPrefix = extractKeyPrefix(apiKey)

    // Check if credential already exists
    const existing = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.service, service)
      )
    })

    if (existing) {
      // Update existing credential
      const [updated] = await db
        .update(userCredentials)
        .set({
          encryptedApiKey,
          keyPrefix,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.id, existing.id))
        .returning()

      return this.sanitizeCredential(updated)
    }

    // Create new credential
    const [newCredential] = await db
      .insert(userCredentials)
      .values({
        userId,
        service,
        encryptedApiKey,
        keyPrefix,
        isActive: true,
      })
      .returning()

    return this.sanitizeCredential(newCredential)
  }

  /**
   * Get a decrypted API key for a user and service
   * Falls back to platform API key if user hasn't provided one
   */
  async getApiKey(userId: string, service: AIService): Promise<string | null> {
    // First try to get user's credential
    const credential = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.service, service),
        eq(userCredentials.isActive, true)
      )
    })

    if (credential) {
      try {
        // Update last used timestamp
        await db
          .update(userCredentials)
          .set({ lastUsedAt: new Date() })
          .where(eq(userCredentials.id, credential.id))

        // Decrypt and return the API key
        return decrypt(credential.encryptedApiKey)
      } catch (error) {
        console.error(`Failed to decrypt API key for user ${userId}, service ${service}:`, error)
        // Fall through to platform key
      }
    }

    // Fall back to platform API key from environment variables
    return this.getPlatformApiKey(service)
  }

  /**
   * Get platform API key from environment variables
   */
  private getPlatformApiKey(service: AIService): string | null {
    switch (service) {
      case 'openai':
        return env.OPENAI_API_KEY || null
      case 'anthropic':
        return env.ANTHROPIC_API_KEY || null
      case 'elevenlabs':
        return env.ELEVENLABS_API_KEY || null
      case 'meshy':
        return env.MESHY_API_KEY || null
      case 'fal':
        return env.FAL_KEY || null
      case 'openrouter':
        return env.OPENROUTER_API_KEY || null
      case 'ai-gateway':
        return env.AI_GATEWAY_API_KEY || null
      default:
        return null
    }
  }

  /**
   * Get all credentials for a user (without decrypting)
   */
  async getUserCredentials(userId: string): Promise<UserCredential[]> {
    const credentials = await db.query.userCredentials.findMany({
      where: eq(userCredentials.userId, userId)
    })

    return credentials.map(c => this.sanitizeCredential(c))
  }

  /**
   * Check if user has a credential for a service
   */
  async hasCredential(userId: string, service: AIService): Promise<boolean> {
    const credential = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.service, service),
        eq(userCredentials.isActive, true)
      )
    })

    return !!credential
  }

  /**
   * Delete a user's credential for a service
   */
  async deleteCredential(userId: string, service: AIService): Promise<boolean> {
    const result = await db
      .delete(userCredentials)
      .where(
        and(
          eq(userCredentials.userId, userId),
          eq(userCredentials.service, service)
        )
      )
      .returning()

    return result.length > 0
  }

  /**
   * Deactivate a credential (soft delete)
   */
  async deactivateCredential(userId: string, service: AIService): Promise<boolean> {
    const result = await db
      .update(userCredentials)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(userCredentials.userId, userId),
          eq(userCredentials.service, service)
        )
      )
      .returning()

    return result.length > 0
  }

  /**
   * Remove encrypted API key from credential object (for API responses)
   */
  private sanitizeCredential(credential: any): UserCredential {
    const { encryptedApiKey, ...safe } = credential
    return safe
  }
}

export const userCredentialsService = new UserCredentialsService()
