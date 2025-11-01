import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, voiceManifests } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Voice Manifests Tests', () => {
  let ownerUserId: string
  let ownerToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'voice-manifest-test-owner')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'voice-manifest-test-owner',
      email: 'voicemanifestowner@test.com',
      displayName: 'Voice Manifest Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-voicemanifestowner-token'
  })

  // =====================================================
  // VOICE MANIFESTS CRUD TESTS
  // =====================================================

  test('POST /api/voice-assignments creates voice manifest', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Test Voice Manifest',
        description: 'A test voice manifest for NPCs',
        ownerId: ownerUserId,
        assignments: [
          {
            npcId: 'npc-1',
            voiceId: 'voice-1',
            voiceName: 'Hero Voice',
          },
          {
            npcId: 'npc-2',
            voiceId: 'voice-2',
            voiceName: 'Villain Voice',
          },
        ],
      }
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.manifestId).toBeDefined()
    expect(body.assignments).toHaveLength(2)
  })

  test('GET /api/voice-assignments/by-owner/:ownerId lists manifests', async () => {
    // Create a manifest first
    await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Another Manifest',
        ownerId: ownerUserId,
        assignments: [
          { npcId: 'npc-3', voiceId: 'voice-3', voiceName: 'Merchant Voice' },
        ],
      }
    })

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice-assignments/by-owner/${ownerUserId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.count).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(body.manifests)).toBe(true)
  })

  test('GET /api/voice-assignments/:manifestId returns manifest', async () => {
    // Create a manifest
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Specific Manifest',
        ownerId: ownerUserId,
        assignments: [
          { npcId: 'npc-4', voiceId: 'voice-4', voiceName: 'Guard Voice' },
        ],
      }
    })

    const { manifestId } = JSON.parse(createResponse.body)

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/voice-assignments/${manifestId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.manifestId).toBe(manifestId)
    expect(body.name).toBe('Specific Manifest')
  })

  test('PUT /api/voice-assignments/:manifestId updates manifest with versioning', async () => {
    // Create a manifest
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Update Test Manifest',
        ownerId: ownerUserId,
        assignments: [
          { npcId: 'npc-5', voiceId: 'voice-5', voiceName: 'Original Voice' },
        ],
      }
    })

    const { manifestId } = JSON.parse(createResponse.body)

    const response = await testServer.inject({
      method: 'PUT',
      url: `/api/voice-assignments/${manifestId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Updated Manifest Name',
        assignments: [
          { npcId: 'npc-5', voiceId: 'voice-6', voiceName: 'Updated Voice' },
        ],
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.version).toBe(2) // Version should increment
    expect(body.assignments[0].voiceId).toBe('voice-6')
  })

  test('DELETE /api/voice-assignments/:manifestId deletes manifest', async () => {
    // Create a manifest
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Delete Test Manifest',
        ownerId: ownerUserId,
        assignments: [
          { npcId: 'npc-6', voiceId: 'voice-7', voiceName: 'Temp Voice' },
        ],
      }
    })

    const { manifestId } = JSON.parse(createResponse.body)

    const deleteResponse = await testServer.inject({
      method: 'DELETE',
      url: `/api/voice-assignments/${manifestId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(deleteResponse.statusCode).toBe(200)

    // Verify deletion
    const getResponse = await testServer.inject({
      method: 'GET',
      url: `/api/voice-assignments/${manifestId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(getResponse.statusCode).toBe(404)
  })

  test('POST /api/voice-assignments validates required fields', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: '', // Invalid: empty name
        ownerId: ownerUserId,
        assignments: [],
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('PUT /api/voice-assignments/:manifestId requires valid fields', async () => {
    // Create a manifest
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Validation Test',
        ownerId: ownerUserId,
        assignments: [
          { npcId: 'npc-7', voiceId: 'voice-8', voiceName: 'Test Voice' },
        ],
      }
    })

    const { manifestId } = JSON.parse(createResponse.body)

    const response = await testServer.inject({
      method: 'PUT',
      url: `/api/voice-assignments/${manifestId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {}, // No fields to update
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/voice-assignments requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/voice-assignments',
      payload: {
        name: 'Unauthorized Test',
        ownerId: ownerUserId,
        assignments: [],
      }
    })

    expect(response.statusCode).toBe(401)
  })
})
