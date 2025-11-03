import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Content Generation Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string

  beforeAll(async () => {
    // Cleanup
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'content-gen-test-user')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'content-gen-test-user'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'content-gen-test-user',
      email: 'contentgen@test.com',
      displayName: 'ContentGen Test User',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-contentgen-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'ContentGen Test Team',
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
      name: 'ContentGen Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  // =====================================================
  // DIALOGUE GENERATION TESTS
  // =====================================================

  test('POST /api/content-generation/generate-dialogue requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        npcName: 'Test NPC',
        npcPersonality: 'friendly',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/content-generation/generate-dialogue requires npcName', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcPersonality: 'friendly',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/content-generation/generate-dialogue generates dialogue nodes', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcName: 'Friendly Shopkeeper',
        npcPersonality: 'welcoming, helpful, talkative',
        context: 'The shopkeeper greets customers and offers wares',
        projectId: testProjectId,
        existingNodes: [],
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.nodes).toBeDefined()
    expect(Array.isArray(body.nodes)).toBe(true)
    expect(body.nodes.length).toBeGreaterThan(0)
    expect(body.model).toBeDefined()
    expect(body.rawResponse).toBeDefined()
  }, 30000)

  test('POST /api/content-generation/generate-dialogue with existing nodes', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcName: 'Quest Giver',
        npcPersonality: 'mysterious, urgent',
        context: 'Continuation of previous conversation',
        projectId: testProjectId,
        existingNodes: [
          {
            id: 'node_1',
            text: 'Greetings, adventurer. I have urgent news.',
            responses: []
          }
        ],
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.nodes).toBeDefined()
    expect(Array.isArray(body.nodes)).toBe(true)
  }, 30000)

  test('POST /api/content-generation/generate-dialogue with custom model', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcName: 'Sage',
        npcPersonality: 'wise, cryptic',
        projectId: testProjectId,
        model: 'gpt-4o-mini',
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.model).toBe('gpt-4o-mini')
  }, 30000)

  // =====================================================
  // NPC GENERATION TESTS
  // =====================================================

  test('POST /api/content-generation/generate-npc requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'warrior',
        prompt: 'Generate a brave warrior',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/content-generation/generate-npc requires archetype', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'Generate a character',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/content-generation/generate-npc generates complete NPC', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'warrior',
        prompt: 'A seasoned veteran who has seen many battles',
        context: 'Lives in a small village and trains new recruits',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc).toBeDefined()
    expect(body.npc.id).toBeDefined()
    expect(body.npc.name).toBeDefined()
    expect(body.npc.archetype).toBe('warrior')
    expect(body.npc.personality).toBeDefined()
    expect(body.npc.appearance).toBeDefined()
    expect(body.npc.dialogue).toBeDefined()
    expect(body.npc.behavior).toBeDefined()
    expect(body.npc.metadata).toBeDefined()
    expect(body.npc.metadata.generatedBy).toBe('AI')
    expect(body.model).toBeDefined()
    expect(body.rawResponse).toBeDefined()
  }, 30000)

  test('POST /api/content-generation/generate-npc with mage archetype', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'mage',
        prompt: 'An ancient wizard who guards forbidden knowledge',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc.archetype).toBe('mage')
  }, 30000)

  test('POST /api/content-generation/generate-npc with rogue archetype', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'rogue',
        prompt: 'A cunning thief who works in the shadows',
        context: 'Part of the thieves guild',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc.archetype).toBe('rogue')
  }, 30000)

  test('POST /api/content-generation/generate-npc with custom model', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'merchant',
        prompt: 'A traveling merchant with exotic goods',
        projectId: testProjectId,
        model: 'gpt-4o',
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.model).toBe('gpt-4o')
  }, 30000)

  // =====================================================
  // QUEST GENERATION TESTS
  // =====================================================

  test('POST /api/content-generation/generate-quest requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        questType: 'main',
        difficulty: 'medium',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('POST /api/content-generation/generate-quest requires questType', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        difficulty: 'medium',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/content-generation/generate-quest requires difficulty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'main',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/content-generation/generate-quest generates complete quest', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'main',
        difficulty: 'hard',
        theme: 'Ancient ruins exploration',
        context: 'Players must find a lost artifact',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quest).toBeDefined()
    expect(body.quest.id).toBeDefined()
    expect(body.quest.title).toBeDefined()
    expect(body.quest.description).toBeDefined()
    expect(body.quest.objectives).toBeDefined()
    expect(Array.isArray(body.quest.objectives)).toBe(true)
    expect(body.quest.rewards).toBeDefined()
    expect(body.quest.requirements).toBeDefined()
    expect(body.quest.npcs).toBeDefined()
    expect(body.quest.location).toBeDefined()
    expect(body.quest.story).toBeDefined()
    expect(body.quest.difficulty).toBe('hard')
    expect(body.quest.questType).toBe('main')
    expect(body.quest.metadata).toBeDefined()
    expect(body.quest.metadata.generatedBy).toBe('AI')
    expect(body.model).toBeDefined()
  }, 30000)

  test('POST /api/content-generation/generate-quest with side quest type', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'side',
        difficulty: 'easy',
        theme: 'Help a farmer find lost sheep',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quest.questType).toBe('side')
    expect(body.quest.difficulty).toBe('easy')
  }, 30000)

  test('POST /api/content-generation/generate-quest with medium difficulty', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'main',
        difficulty: 'medium',
        theme: 'Investigate mysterious disappearances',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quest.difficulty).toBe('medium')
  }, 30000)

  test('POST /api/content-generation/generate-quest with custom model', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'epic',
        difficulty: 'legendary',
        theme: 'Save the world from ancient evil',
        projectId: testProjectId,
        model: 'gpt-4o',
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.model).toBe('gpt-4o')
  }, 30000)

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  test('Generate NPC and dialogue for the same character', async () => {
    // Step 1: Generate NPC
    const npcResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'innkeeper',
        prompt: 'A friendly tavern owner who loves gossip',
        projectId: testProjectId,
      }
    })

    expect(npcResponse.statusCode).toBe(200)
    const npcBody = JSON.parse(npcResponse.body)
    const npcName = npcBody.npc.name

    // Step 2: Generate dialogue for this NPC
    const dialogueResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcName: npcName,
        npcPersonality: npcBody.npc.personality.traits.join(', '),
        context: 'The innkeeper greets a new customer',
        projectId: testProjectId,
      }
    })

    expect(dialogueResponse.statusCode).toBe(200)
    const dialogueBody = JSON.parse(dialogueResponse.body)
    expect(dialogueBody.nodes.length).toBeGreaterThan(0)
  }, 60000)

  test('Generate quest and related NPCs', async () => {
    // Step 1: Generate quest
    const questResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'main',
        difficulty: 'medium',
        theme: 'Rescue mission in haunted forest',
        projectId: testProjectId,
      }
    })

    expect(questResponse.statusCode).toBe(200)
    const questBody = JSON.parse(questResponse.body)

    // Step 2: Generate quest giver NPC
    const questGiverResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'villager',
        prompt: `Generate a quest giver for: ${questBody.quest.title}`,
        context: questBody.quest.description,
        projectId: testProjectId,
      }
    })

    expect(questGiverResponse.statusCode).toBe(200)
  }, 60000)

  test('All content types use consistent structure', async () => {
    // Generate dialogue
    const dialogueResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-dialogue',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        npcName: 'Test Character',
        npcPersonality: 'friendly',
        projectId: testProjectId,
      }
    })

    expect(dialogueResponse.statusCode).toBe(200)
    const dialogueBody = JSON.parse(dialogueResponse.body)
    expect(dialogueBody.model).toBeDefined()
    expect(dialogueBody.rawResponse).toBeDefined()

    // Generate NPC
    const npcResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-npc',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        archetype: 'guard',
        prompt: 'A city guard',
        projectId: testProjectId,
      }
    })

    expect(npcResponse.statusCode).toBe(200)
    const npcBody = JSON.parse(npcResponse.body)
    expect(npcBody.model).toBeDefined()
    expect(npcBody.rawResponse).toBeDefined()

    // Generate quest
    const questResponse = await testServer.inject({
      method: 'POST',
      url: '/api/content-generation/generate-quest',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        questType: 'side',
        difficulty: 'easy',
        projectId: testProjectId,
      }
    })

    expect(questResponse.statusCode).toBe(200)
    const questBody = JSON.parse(questResponse.body)
    expect(questBody.model).toBeDefined()
    expect(questBody.rawResponse).toBeDefined()
  }, 90000)
})
