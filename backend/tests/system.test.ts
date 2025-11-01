import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { testServer } from './setup'
import { users, notifications, activityLog, apiKeys, userCredentials, systemSettings } from '../src/database/schema'
import { eq, or } from 'drizzle-orm'
import { encryptApiKey, decryptApiKey } from '../src/helpers/encryption'
import { generateApiKey, validateApiKey } from '../src/helpers/api-key-generator'

describe('System Infrastructure - Real E2E Tests', () => {
  let adminToken: string
  let userToken: string
  let adminUserId: string
  let userId: string
  let testNotificationId: string
  let testApiKeyId: string
  let testApiKeyValue: string
  let testCredentialId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users and related data
    const existingUsers = await testServer.db.query.users.findMany({
      where: (users, { or, eq }) => or(
        eq(users.privyUserId, 'system-test-admin'),
        eq(users.privyUserId, 'system-test-member')
      )
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const uid of userIds) {
        await testServer.db.delete(notifications).where(eq(notifications.userId, uid))
        await testServer.db.delete(activityLog).where(eq(activityLog.userId, uid))
        await testServer.db.delete(apiKeys).where(eq(apiKeys.userId, uid))
        await testServer.db.delete(userCredentials).where(eq(userCredentials.userId, uid))
      }
    }

    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'system-test-admin'),
        eq(users.privyUserId, 'system-test-member')
      )
    )

    // Create admin user
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'system-test-admin',
      email: 'systemadmin@test.com',
      displayName: 'System Admin',
      role: 'admin',
    }).returning()

    adminUserId = adminUser.id
    adminToken = 'mock-systemadmin-token'

    // Create regular user
    const [regularUser] = await testServer.db.insert(users).values({
      privyUserId: 'system-test-member',
      email: 'systemmember@test.com',
      displayName: 'System Member',
      role: 'member',
    }).returning()

    userId = regularUser.id
    userToken = 'mock-systemmember-token'
  })

  afterAll(async () => {
    // Cleanup test data
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'system-test-admin'),
        eq(users.privyUserId, 'system-test-member')
      )
    )
  })

  // =====================================================
  // NOTIFICATIONS TESTS
  // =====================================================

  describe('Notifications', () => {
    test('POST /api/notifications creates notification (admin only)', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/notifications',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: {
          userId: userId,
          type: 'system',
          title: 'Test Notification',
          message: 'This is a test message',
          link: 'https://example.com',
          metadata: { test: true }
        }
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body.notification).toBeDefined()
      expect(body.notification.title).toBe('Test Notification')
      expect(body.notification.userId).toBe(userId)

      testNotificationId = body.notification.id
    })

    test('POST /api/notifications requires admin role', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/notifications',
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          userId: userId,
          type: 'system',
          title: 'Unauthorized',
          message: 'Should fail'
        }
      })

      expect(response.statusCode).toBe(403)
    })

    test('GET /api/notifications lists user notifications', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/notifications?page=1&limit=10',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.notifications).toBeDefined()
      expect(Array.isArray(body.notifications)).toBe(true)
      expect(body.notifications.length).toBeGreaterThanOrEqual(1)
      expect(body.pagination).toBeDefined()
    })

    test('GET /api/notifications/unread returns unread count', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/notifications/unread',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.count).toBeDefined()
      expect(typeof body.count).toBe('number')
      expect(body.count).toBeGreaterThanOrEqual(1)
    })

    test('PATCH /api/notifications/:id/read marks as read', async () => {
      const response = await testServer.inject({
        method: 'PATCH',
        url: `/api/notifications/${testNotificationId}/read`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.notification.isRead).toBe(true)
      expect(body.notification.readAt).toBeDefined()
    })

    test('PATCH /api/notifications/read-all marks all as read', async () => {
      // Create another notification
      await testServer.db.insert(notifications).values({
        userId,
        type: 'test',
        title: 'Test 2',
        message: 'Test',
        isRead: false,
      })

      const response = await testServer.inject({
        method: 'PATCH',
        url: '/api/notifications/read-all',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.count).toBeDefined()
      expect(typeof body.count).toBe('number')
    })

    test('DELETE /api/notifications/:id deletes notification', async () => {
      const response = await testServer.inject({
        method: 'DELETE',
        url: `/api/notifications/${testNotificationId}`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify deleted
      const deleted = await testServer.db.query.notifications.findFirst({
        where: eq(notifications.id, testNotificationId)
      })
      expect(deleted).toBeUndefined()
    })
  })

  // =====================================================
  // ACTIVITY LOG TESTS
  // =====================================================

  describe('Activity Log', () => {
    test('GET /api/activity lists all activity (admin only)', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/activity?page=1&limit=50',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.activities).toBeDefined()
      expect(Array.isArray(body.activities)).toBe(true)
      expect(body.pagination).toBeDefined()
    })

    test('GET /api/activity requires admin role', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/activity',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })

    test('GET /api/activity/user/:userId returns user activity', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: `/api/activity/user/${userId}`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.activities).toBeDefined()
      expect(Array.isArray(body.activities)).toBe(true)
    })

    test('GET /api/activity/user/:userId rejects viewing other user activity', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: `/api/activity/user/${adminUserId}`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })

    test('POST /api/activity creates activity log (admin only)', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/activity',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: {
          userId: userId,
          entityType: 'test',
          entityId: null,
          action: 'create',
          details: { test: true }
        }
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body.activity).toBeDefined()
      expect(body.activity.action).toBe('create')
    })
  })

  // =====================================================
  // API KEYS TESTS
  // =====================================================

  describe('API Keys', () => {
    test('POST /api/api-keys creates new API key', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          name: 'Test API Key',
          permissions: ['read', 'write']
        }
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body.apiKey).toBeDefined()
      expect(body.apiKey.key).toBeDefined() // Full key shown once
      expect(body.apiKey.name).toBe('Test API Key')
      expect(body.apiKey.permissions).toEqual(['read', 'write'])

      testApiKeyId = body.apiKey.id
      testApiKeyValue = body.apiKey.key
    })

    test('GET /api/api-keys lists user API keys', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.apiKeys).toBeDefined()
      expect(Array.isArray(body.apiKeys)).toBe(true)
      expect(body.apiKeys.length).toBeGreaterThanOrEqual(1)

      const testKey = body.apiKeys.find((k: any) => k.id === testApiKeyId)
      expect(testKey).toBeDefined()
      expect(testKey.key).toBeUndefined() // Key hash not exposed
    })

    test('PATCH /api/api-keys/:id updates API key', async () => {
      const response = await testServer.inject({
        method: 'PATCH',
        url: `/api/api-keys/${testApiKeyId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          name: 'Updated API Key',
          permissions: ['read']
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.apiKey.name).toBe('Updated API Key')
      expect(body.apiKey.permissions).toEqual(['read'])
    })

    test('POST /api/api-keys/:id/rotate rotates API key', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: `/api/api-keys/${testApiKeyId}/rotate`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.apiKey.key).toBeDefined()
      expect(body.apiKey.key).not.toBe(testApiKeyValue) // New key
    })

    test('DELETE /api/api-keys/:id revokes API key', async () => {
      const response = await testServer.inject({
        method: 'DELETE',
        url: `/api/api-keys/${testApiKeyId}`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify marked as inactive
      const revoked = await testServer.db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, testApiKeyId)
      })
      expect(revoked?.isActive).toBe(false)
      expect(revoked?.revokedAt).toBeDefined()
    })
  })

  // =====================================================
  // CREDENTIALS TESTS
  // =====================================================

  describe('Credentials', () => {
    test('POST /api/credentials adds service credential', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/credentials',
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          service: 'openai',
          apiKey: 'sk-test-1234567890abcdef'
        }
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body.credential).toBeDefined()
      expect(body.credential.service).toBe('openai')
      expect(body.credential.keyPrefix).toBeDefined()

      testCredentialId = body.credential.id
    })

    test('GET /api/credentials lists user credentials without exposing keys', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/credentials',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.credentials).toBeDefined()
      expect(Array.isArray(body.credentials)).toBe(true)
      expect(body.credentials.length).toBeGreaterThanOrEqual(1)

      const testCred = body.credentials[0]
      expect(testCred.encryptedApiKey).toBeUndefined() // Never exposed
      expect(testCred.keyPrefix).toBeDefined()
    })

    test('POST /api/credentials/:id/test validates credential', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: `/api/credentials/${testCredentialId}/test`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.valid).toBe(true)
      expect(body.service).toBe('openai')
    })

    test('PATCH /api/credentials/:id updates credential', async () => {
      const response = await testServer.inject({
        method: 'PATCH',
        url: `/api/credentials/${testCredentialId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          apiKey: 'sk-test-newkey1234567890',
          isActive: true
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.credential).toBeDefined()
    })

    test('DELETE /api/credentials/:id deletes credential', async () => {
      const response = await testServer.inject({
        method: 'DELETE',
        url: `/api/credentials/${testCredentialId}`,
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify deleted
      const deleted = await testServer.db.query.userCredentials.findFirst({
        where: eq(userCredentials.id, testCredentialId)
      })
      expect(deleted).toBeUndefined()
    })

    test('Encryption/decryption works correctly', () => {
      const testKey = 'sk-test-1234567890abcdef'
      const encrypted = encryptApiKey(testKey)
      const decrypted = decryptApiKey(encrypted)
      expect(decrypted).toBe(testKey)
    })
  })

  // =====================================================
  // SYSTEM SETTINGS TESTS
  // =====================================================

  describe('System Settings', () => {
    test('PUT /api/system/settings/:key creates setting (admin only)', async () => {
      const response = await testServer.inject({
        method: 'PUT',
        url: '/api/system/settings/test_setting',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: {
          value: { enabled: true, maxValue: 100 },
          description: 'Test setting'
        }
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body.setting).toBeDefined()
      expect(body.setting.settingKey).toBe('test_setting')
      expect(body.setting.settingValue).toEqual({ enabled: true, maxValue: 100 })
    })

    test('GET /api/system/settings lists all settings (admin only)', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/system/settings',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.settings).toBeDefined()
      expect(Array.isArray(body.settings)).toBe(true)
    })

    test('GET /api/system/settings/:key gets specific setting', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/system/settings/test_setting',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.setting.settingKey).toBe('test_setting')
    })

    test('PUT /api/system/settings/:key updates existing setting', async () => {
      const response = await testServer.inject({
        method: 'PUT',
        url: '/api/system/settings/test_setting',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: {
          value: { enabled: false, maxValue: 200 }
        }
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.setting.settingValue).toEqual({ enabled: false, maxValue: 200 })
    })

    test('DELETE /api/system/settings/:key deletes setting (admin only)', async () => {
      const response = await testServer.inject({
        method: 'DELETE',
        url: '/api/system/settings/test_setting',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify deleted
      const deleted = await testServer.db.query.systemSettings.findFirst({
        where: eq(systemSettings.settingKey, 'test_setting')
      })
      expect(deleted).toBeUndefined()
    })

    test('System settings require admin role', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/system/settings',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  // =====================================================
  // HELPER TESTS
  // =====================================================

  describe('Helper Functions', () => {
    test('API key generation and validation works', () => {
      const { key, hash, prefix } = generateApiKey()

      expect(key).toBeDefined()
      expect(hash).toBeDefined()
      expect(prefix).toBeDefined()
      expect(key.startsWith(prefix)).toBe(true)

      // Validate the key
      const isValid = validateApiKey(key, hash)
      expect(isValid).toBe(true)

      // Invalid key should fail
      const isInvalid = validateApiKey('wrong-key', hash)
      expect(isInvalid).toBe(false)
    })
  })
})
