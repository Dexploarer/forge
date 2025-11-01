import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Multi-Agent Routes - E2E Tests', () => {
  let userUserId: string
  let userToken: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'multi-agent-test-user')
    )

    // Create test user
    const [user] = await testServer.db.insert(users).values({
      privyUserId: 'multi-agent-test-user',
      email: 'agentmember@test.com',
      displayName: 'Multi-Agent Test User',
      role: 'member',
    }).returning()

    userUserId = user.id
    userToken = 'mock-agentmember-token'
  })

  // =====================================================
  // NPC COLLABORATION TESTS
  // =====================================================

  test('POST /api/multi-agent/generate-npc-collaboration generates dialogue collaboration', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Guard Captain',
            personality: 'stern, dutiful, protective',
            archetype: 'warrior',
            goals: ['Protect the city', 'Train new recruits'],
            specialties: ['Combat', 'Leadership'],
            background: 'Veteran soldier with 20 years of service'
          },
          {
            name: 'Merchant',
            personality: 'friendly, shrewd, talkative',
            archetype: 'trader',
            goals: ['Make profit', 'Expand trade network'],
            specialties: ['Negotiation', 'Market knowledge'],
            background: 'Traveled across many lands trading goods'
          }
        ],
        collaborationType: 'dialogue',
        context: {
          scenario: 'The merchant is trying to convince the guard to allow a special shipment through the gates',
          location: 'City gates'
        },
        rounds: 3
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.sessionId).toBeDefined()
    expect(body.sessionId).toMatch(/^collab_/)
    expect(body.collaborationType).toBe('dialogue')
    expect(body.npcCount).toBe(2)
    expect(body.rounds).toBeGreaterThan(0)
    expect(Array.isArray(body.conversation)).toBe(true)
    expect(body.emergentContent).toBeDefined()
    expect(body.stats).toBeDefined()
    expect(body.metadata).toBeDefined()
    expect(body.metadata.generatedBy).toBe('Multi-Agent Collaboration')
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration generates quest collaboration', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Village Elder',
            personality: 'wise, concerned, traditional',
            archetype: 'sage',
            goals: ['Protect village', 'Preserve traditions'],
            specialties: ['Ancient lore', 'Diplomacy']
          },
          {
            name: 'Adventurer',
            personality: 'bold, curious, optimistic',
            archetype: 'hero',
            goals: ['Seek adventure', 'Help others'],
            specialties: ['Combat', 'Exploration']
          }
        ],
        collaborationType: 'quest',
        context: {
          questSeed: 'A mysterious artifact has been stolen from the village temple',
          location: 'Village temple'
        },
        rounds: 4
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.collaborationType).toBe('quest')
    expect(body.npcCount).toBe(2)
    expect(body.conversation).toBeDefined()
    expect(Array.isArray(body.conversation)).toBe(true)
    expect(body.emergentContent).toBeDefined()
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration generates lore collaboration', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Librarian',
            personality: 'scholarly, meticulous, curious',
            archetype: 'scholar',
            specialties: ['History', 'Ancient texts']
          },
          {
            name: 'Bard',
            personality: 'charismatic, storyteller, entertaining',
            archetype: 'entertainer',
            specialties: ['Oral traditions', 'Music']
          }
        ],
        collaborationType: 'lore',
        context: {
          loreTopic: 'The founding of the ancient kingdom'
        },
        rounds: 3
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.collaborationType).toBe('lore')
    expect(body.emergentContent).toBeDefined()
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration generates relationship collaboration', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Blacksmith',
            personality: 'gruff, skilled, hardworking',
            archetype: 'craftsman'
          },
          {
            name: 'Apprentice',
            personality: 'eager, inexperienced, respectful',
            archetype: 'student'
          }
        ],
        collaborationType: 'relationship',
        context: {
          location: 'Blacksmith forge',
          situation: 'Teaching a new forging technique'
        },
        rounds: 3
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.collaborationType).toBe('relationship')
    expect(body.emergentContent).toBeDefined()
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration generates freeform collaboration', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'NPC One',
            personality: 'calm, thoughtful'
          },
          {
            name: 'NPC Two',
            personality: 'energetic, impulsive'
          }
        ],
        collaborationType: 'freeform',
        context: {
          situation: 'Meeting at the marketplace'
        },
        rounds: 2
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.collaborationType).toBe('freeform')
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration with custom model', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Wizard',
            personality: 'mysterious, powerful'
          },
          {
            name: 'Knight',
            personality: 'honorable, brave'
          }
        ],
        collaborationType: 'dialogue',
        rounds: 2,
        model: 'gpt-4o'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.metadata.model).toBe('gpt-4o')
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration with cross-validation disabled', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Character A',
            personality: 'friendly'
          },
          {
            name: 'Character B',
            personality: 'serious'
          }
        ],
        collaborationType: 'dialogue',
        rounds: 2,
        enableCrossValidation: false
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.metadata.crossValidated).toBe(false)
  }, { timeout: 30000 })

  test('POST /api/multi-agent/generate-npc-collaboration requires at least 2 NPCs', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Single NPC',
            personality: 'lonely'
          }
        ],
        collaborationType: 'dialogue'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/multi-agent/generate-npc-collaboration validates collaboration type', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          { name: 'NPC 1', personality: 'friendly' },
          { name: 'NPC 2', personality: 'serious' }
        ],
        collaborationType: 'invalid_type'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/multi-agent/generate-npc-collaboration requires NPC name', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          { personality: 'friendly' },
          { name: 'NPC 2', personality: 'serious' }
        ],
        collaborationType: 'dialogue'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/multi-agent/generate-npc-collaboration requires NPC personality', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          { name: 'NPC 1' },
          { name: 'NPC 2', personality: 'serious' }
        ],
        collaborationType: 'dialogue'
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/multi-agent/generate-npc-collaboration with minimal NPCs', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Minimal NPC 1',
            personality: 'simple'
          },
          {
            name: 'Minimal NPC 2',
            personality: 'basic'
          }
        ],
        collaborationType: 'dialogue'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npcCount).toBe(2)
  }, { timeout: 30000 })

  // =====================================================
  // PLAYTESTER SWARM TESTS
  // =====================================================

  test('POST /api/multi-agent/generate-playtester-swarm returns 503 service unavailable', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-playtester-swarm',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        contentToTest: {
          title: 'The Dragon Quest',
          description: 'Defeat the dragon',
          objectives: ['Find dragon', 'Slay dragon']
        },
        contentType: 'quest'
      }
    })

    expect(response.statusCode).toBe(503)

    const body = JSON.parse(response.body)
    expect(body.error).toBe('Service Unavailable')
    expect(body.details).toContain('PlaytesterSwarmOrchestrator')
  })

  test('POST /api/multi-agent/generate-playtester-swarm with all content types returns 503', async () => {
    const contentTypes = ['quest', 'dialogue', 'npc', 'combat', 'puzzle']

    for (const contentType of contentTypes) {
      const response = await testServer.inject({
        method: 'POST',
        url: '/api/multi-agent/generate-playtester-swarm',
        headers: {
          authorization: `Bearer ${userToken}`,
          'content-type': 'application/json'
        },
        payload: {
          contentToTest: { test: 'data' },
          contentType: contentType
        }
      })

      expect(response.statusCode).toBe(503)
    }
  })

  // =====================================================
  // PLAYTESTER PERSONAS TESTS
  // =====================================================

  test('GET /api/multi-agent/playtester-personas returns available personas', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/multi-agent/playtester-personas'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.availablePersonas).toBeDefined()
    expect(Array.isArray(body.availablePersonas)).toBe(true)
    expect(body.availablePersonas.length).toBeGreaterThan(0)
    expect(body.personas).toBeDefined()
    expect(typeof body.personas).toBe('object')
    expect(body.defaultSwarm).toBeDefined()
    expect(Array.isArray(body.defaultSwarm)).toBe(true)
    expect(body.description).toBeDefined()
  })

  test('GET /api/multi-agent/playtester-personas includes expected default personas', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/multi-agent/playtester-personas'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Check for common playtester archetypes in default swarm
    const expectedPersonas = ['completionist', 'casual', 'breaker', 'speedrunner', 'explorer']
    expectedPersonas.forEach(persona => {
      expect(body.defaultSwarm).toContain(persona)
    })
  })

  test('GET /api/multi-agent/playtester-personas has valid persona structure', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/multi-agent/playtester-personas'
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Check first persona has required fields
    const firstPersonaKey = body.availablePersonas[0]
    const firstPersona = body.personas[firstPersonaKey]

    expect(firstPersona).toBeDefined()
    expect(firstPersona.name).toBeDefined()
    expect(typeof firstPersona.name).toBe('string')
    expect(firstPersona.personality).toBeDefined()
    expect(typeof firstPersona.personality).toBe('string')
    expect(firstPersona.expectations).toBeDefined()
    expect(Array.isArray(firstPersona.expectations)).toBe(true)
  })

  test('GET /api/multi-agent/playtester-personas does not require authentication', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/multi-agent/playtester-personas'
    })

    // Should succeed without auth
    expect(response.statusCode).toBe(200)
  })

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  test('Multi-agent workflow: NPC collaboration with multiple rounds', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/multi-agent/generate-npc-collaboration',
      headers: {
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonas: [
          {
            name: 'Tavern Owner',
            personality: 'welcoming, gossip-loving, protective of regulars',
            archetype: 'innkeeper',
            goals: ['Run successful tavern', 'Keep customers happy'],
            specialties: ['Hospitality', 'Local knowledge'],
            background: 'Has run the tavern for 15 years and knows everyone'
          },
          {
            name: 'Traveling Bard',
            personality: 'charming, creative, adventurous',
            archetype: 'entertainer',
            goals: ['Collect stories', 'Entertain crowds'],
            specialties: ['Music', 'Storytelling'],
            background: 'Travels from town to town performing'
          },
          {
            name: 'Town Guard',
            personality: 'suspicious, duty-bound, observant',
            archetype: 'lawkeeper',
            goals: ['Maintain order', 'Investigate crimes'],
            specialties: ['Investigation', 'Combat'],
            background: 'Recently assigned to investigate strange occurrences'
          }
        ],
        collaborationType: 'dialogue',
        context: {
          scenario: 'A mysterious stranger was seen near the old mill at midnight. The three discuss what they know.',
          location: 'The tavern common room'
        },
        rounds: 5,
        enableCrossValidation: true
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Verify complete session data
    expect(body.sessionId).toMatch(/^collab_/)
    expect(body.collaborationType).toBe('dialogue')
    expect(body.npcCount).toBe(3)
    expect(body.rounds).toBeGreaterThan(0)

    // Verify conversation structure
    expect(Array.isArray(body.conversation)).toBe(true)
    expect(body.conversation.length).toBeGreaterThan(0)

    // Verify emergent content is generated
    expect(body.emergentContent).toBeDefined()

    // Verify validation was performed
    expect(body.validation).toBeDefined()

    // Verify stats are tracked
    expect(body.stats).toBeDefined()

    // Verify metadata
    expect(body.metadata).toBeDefined()
    expect(body.metadata.crossValidated).toBe(true)
    expect(body.metadata.timestamp).toBeDefined()
    expect(body.metadata.duration).toBeDefined()
    expect(typeof body.metadata.duration).toBe('number')
  }, { timeout: 30000 })
})
