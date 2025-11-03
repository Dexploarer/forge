import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Embeddings Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string

  beforeAll(async () => {
    // Cleanup
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'embeddings-test-user')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'embeddings-test-user'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'embeddings-test-user',
      email: 'embeddings@test.com',
      displayName: 'Embeddings Test User',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-embeddings-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Embeddings Test Team',
      ownerId: memberUserId,
    }).returning()

    testTeamId = team.id

    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: memberUserId,
      role: 'owner',
      invitedBy: memberUserId,
    })

    // Create test project
    const [project] = await testServer.db.insert(projects).values({
      name: 'Embeddings Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  // =====================================================
  // SEARCH TESTS (GET)
  // =====================================================

  test('GET /api/embeddings/search requires query parameter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/search',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(400) // Missing required 'q' parameter
  })

  test('GET /api/embeddings/search performs semantic search', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/search?q=dragon quest adventure&limit=5',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.query).toBe('dragon quest adventure')
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.count).toBeDefined()
    expect(body.duration).toBeDefined()
    expect(typeof body.duration).toBe('number')
  })

  test('GET /api/embeddings/search with content type filter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/search?q=blacksmith&type=npc&limit=10',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.contentType).toBe('npc')
    expect(body.results).toBeDefined()
  })

  test('GET /api/embeddings/search with custom threshold', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/search?q=magic spell&threshold=0.8&limit=3',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.results).toBeDefined()
    expect(body.results.length).toBeLessThanOrEqual(3)
  })

  test('GET /api/embeddings/search respects limit parameter', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/search?q=forest adventure&limit=2',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.results.length).toBeLessThanOrEqual(2)
  })

  // =====================================================
  // SEARCH TESTS (POST)
  // =====================================================

  test('POST /api/embeddings/search requires query field', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/search',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        projectId: testProjectId,
        // Missing 'query' field
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/embeddings/search performs semantic search', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/search',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'ancient ruins exploration',
        projectId: testProjectId,
        limit: 10,
        threshold: 0.7,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.query).toBe('ancient ruins exploration')
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.count).toBeDefined()
  })

  test('POST /api/embeddings/search with content type filter', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/search',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'mysterious prophecy',
        contentType: 'lore',
        projectId: testProjectId,
        limit: 5,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.contentType).toBe('lore')
  })

  // =====================================================
  // BUILD CONTEXT TESTS
  // =====================================================

  test('POST /api/embeddings/build-context requires query', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/build-context',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        projectId: testProjectId,
        // Missing 'query'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/embeddings/build-context builds AI context', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/build-context',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'kingdom history and legends',
        projectId: testProjectId,
        limit: 5,
        threshold: 0.7,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.query).toBe('kingdom history and legends')
    expect(body.hasContext).toBeDefined()
    expect(typeof body.hasContext).toBe('boolean')
    expect(body.context).toBeDefined()
    expect(typeof body.context).toBe('string')
    expect(body.sources).toBeDefined()
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.duration).toBeDefined()
  })

  test('POST /api/embeddings/build-context with custom parameters', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/build-context',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'epic boss battle',
        contentType: 'quest',
        projectId: testProjectId,
        limit: 3,
        threshold: 0.8,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.sources.length).toBeLessThanOrEqual(3)
  })

  // =====================================================
  // STATS TESTS
  // =====================================================

  test('GET /api/embeddings/stats returns statistics', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/embeddings/stats',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.stats).toBeDefined()
    expect(Array.isArray(body.stats)).toBe(true)
    expect(body.duration).toBeDefined()
  })

  // =====================================================
  // EMBED TESTS
  // =====================================================

  test('POST /api/embeddings/embed requires valid content type', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'invalid_type',
        contentId: 'test-id',
        projectId: testProjectId,
        data: { test: 'data' }
      }
    })

    expect(response.statusCode).toBe(400) // Invalid enum value
  })

  test('POST /api/embeddings/embed creates lore embedding', async () => {
    const contentId = `lore_${Date.now()}`

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'lore',
        contentId: contentId,
        projectId: testProjectId,
        data: {
          title: 'The Legend of the Ancient Sword',
          content: 'Long ago, a powerful sword was forged by the gods...',
          category: 'weapons',
        }
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.contentType).toBe('lore')
    expect(body.contentId).toBe(contentId)
    expect(body.embeddingId).toBeDefined()
    expect(body.duration).toBeDefined()
  })

  test('POST /api/embeddings/embed creates quest embedding', async () => {
    const contentId = `quest_${Date.now()}`

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'quest',
        contentId: contentId,
        projectId: testProjectId,
        data: {
          title: 'Rescue the Princess',
          description: 'The princess has been kidnapped by bandits',
          objectives: ['Find the hideout', 'Defeat the bandits', 'Rescue the princess'],
        }
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.contentType).toBe('quest')
  })

  test('POST /api/embeddings/embed creates NPC embedding', async () => {
    const contentId = `npc_${Date.now()}`

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'npc',
        contentId: contentId,
        projectId: testProjectId,
        data: {
          name: 'Elderly Sage',
          personality: 'wise, patient, mysterious',
          role: 'Quest giver and advisor',
        }
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.contentType).toBe('npc')
  })

  // =====================================================
  // BATCH EMBED TESTS
  // =====================================================

  test('POST /api/embeddings/batch requires items array', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/batch',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'lore',
        projectId: testProjectId,
        // Missing 'items' array
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/embeddings/batch embeds multiple items', async () => {
    const timestamp = Date.now()

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/batch',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'lore',
        projectId: testProjectId,
        items: [
          {
            id: `lore_batch_1_${timestamp}`,
            data: {
              title: 'The First Age',
              content: 'In the beginning, there was darkness...',
            }
          },
          {
            id: `lore_batch_2_${timestamp}`,
            data: {
              title: 'The Second Age',
              content: 'Then came the light and the world was born...',
            }
          },
          {
            id: `lore_batch_3_${timestamp}`,
            data: {
              title: 'The Third Age',
              content: 'Mortals walked the earth and civilizations rose...',
            }
          }
        ]
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.contentType).toBe('lore')
    expect(body.count).toBe(3)
    expect(body.duration).toBeDefined()
  })

  test('POST /api/embeddings/batch with metadata', async () => {
    const timestamp = Date.now()

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/batch',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'npc',
        projectId: testProjectId,
        items: [
          {
            id: `npc_batch_1_${timestamp}`,
            data: {
              name: 'Guard Captain',
              role: 'Security',
            },
            metadata: {
              location: 'City Gates',
              faction: 'City Watch',
            }
          },
          {
            id: `npc_batch_2_${timestamp}`,
            data: {
              name: 'Merchant',
              role: 'Trading',
            },
            metadata: {
              location: 'Market Square',
              faction: 'Merchants Guild',
            }
          }
        ]
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.count).toBe(2)
  })

  // =====================================================
  // DELETE TESTS
  // =====================================================

  test('DELETE /api/embeddings/:contentType/:contentId deletes embedding', async () => {
    // First create an embedding
    const contentId = `lore_delete_test_${Date.now()}`

    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'lore',
        contentId: contentId,
        projectId: testProjectId,
        data: {
          title: 'Temporary Lore',
          content: 'This will be deleted',
        }
      }
    })

    expect(createResponse.statusCode).toBe(200)

    // Now delete it
    const deleteResponse = await testServer.inject({
      method: 'DELETE',
      url: `/api/embeddings/lore/${contentId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(deleteResponse.statusCode).toBe(200)

    const body = JSON.parse(deleteResponse.body)
    expect(body.success).toBe(true)
    expect(body.contentType).toBe('lore')
    expect(body.contentId).toBe(contentId)
    expect(body.duration).toBeDefined()
  })

  test('DELETE /api/embeddings/:contentType/:contentId returns 404 for non-existent', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: '/api/embeddings/npc/non-existent-id-12345',
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(404)

    const body = JSON.parse(response.body)
    expect(body.error).toBe('Embedding not found')
    expect(body.code).toBe('EMBED_3007')
  })

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  test('Full workflow: Embed, search, and delete', async () => {
    const contentId = `workflow_test_${Date.now()}`

    // Step 1: Create embedding
    const embedResponse = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/embed',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'quest',
        contentId: contentId,
        projectId: testProjectId,
        data: {
          title: 'The Lost Artifact Quest',
          description: 'Find the ancient artifact hidden in the temple',
          difficulty: 'hard',
        }
      }
    })

    expect(embedResponse.statusCode).toBe(200)

    // Step 2: Search for it (may or may not find it depending on vector DB state)
    const searchResponse = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/search',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'ancient artifact temple',
        contentType: 'quest',
        projectId: testProjectId,
        limit: 10,
      }
    })

    expect(searchResponse.statusCode).toBe(200)

    // Step 3: Delete it
    const deleteResponse = await testServer.inject({
      method: 'DELETE',
      url: `/api/embeddings/quest/${contentId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(deleteResponse.statusCode).toBe(200)
  })

  test('Batch embed and build context workflow', async () => {
    const timestamp = Date.now()

    // Step 1: Batch embed lore
    const batchResponse = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/batch',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentType: 'lore',
        projectId: testProjectId,
        items: [
          {
            id: `lore_context_1_${timestamp}`,
            data: {
              title: 'Dragon Mythology',
              content: 'Dragons are ancient beings of immense power',
            }
          },
          {
            id: `lore_context_2_${timestamp}`,
            data: {
              title: 'Dragon Slayers',
              content: 'Only the bravest heroes dare face a dragon',
            }
          }
        ]
      }
    })

    expect(batchResponse.statusCode).toBe(200)

    // Step 2: Build context using related query
    const contextResponse = await testServer.inject({
      method: 'POST',
      url: '/api/embeddings/build-context',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        query: 'information about dragons and dragon slaying',
        projectId: testProjectId,
        limit: 5,
      }
    })

    expect(contextResponse.statusCode).toBe(200)

    const contextBody = JSON.parse(contextResponse.body)
    expect(contextBody.context).toBeDefined()
  })
})
