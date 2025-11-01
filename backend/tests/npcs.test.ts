import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, npcs } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('NPCs Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string
  let testNpcId: string

  beforeAll(async () => {
    // Cleanup
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'npc-test-member')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(npcs).where(eq(npcs.ownerId, userId))
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'npc-test-member'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'npc-test-member',
      email: 'npcmember@test.com',
      displayName: 'NPC Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-npcmember-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'NPC Test Team',
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
      name: 'NPC Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  test('POST /api/npcs creates an NPC', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/npcs',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Grimwald the Blacksmith',
        description: 'A gruff but skilled blacksmith.',
        projectId: testProjectId,
        title: 'Master Blacksmith',
        race: 'Dwarf',
        class: 'Craftsman',
        level: 25,
        faction: 'Iron Guild',
        behavior: 'friendly',
        location: 'Village Forge',
        health: 200,
        armor: 50,
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.npc).toBeDefined()
    expect(body.npc.name).toBe('Grimwald the Blacksmith')

    testNpcId = body.npc.id
  })

  test('GET /api/npcs lists NPCs', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/npcs?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npcs).toBeDefined()
    expect(body.npcs.length).toBeGreaterThan(0)
  })

  test('GET /api/npcs filters by behavior', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/npcs?projectId=${testProjectId}&behavior=friendly`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.npcs.forEach((npc: any) => {
      expect(npc.behavior).toBe('friendly')
    })
  })

  test('GET /api/npcs/:id returns NPC details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/npcs/${testNpcId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc.name).toBe('Grimwald the Blacksmith')
    expect(body.npc.title).toBe('Master Blacksmith')
  })

  test('PATCH /api/npcs/:id updates NPC', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/npcs/${testNpcId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        level: 30,
        health: 300,
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc.name).toBe('Grimwald the Blacksmith')
  })

  test('GET /api/npcs/:id/dialog returns NPC dialog', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/npcs/${testNpcId}/dialog`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.dialog).toBeDefined()
    expect(Array.isArray(body.dialog)).toBe(true)
  })

  test('POST /api/npcs/:id/voice assigns voice to NPC', async () => {
    const voiceId = '00000000-0000-0000-0000-000000000000'

    const response = await testServer.inject({
      method: 'POST',
      url: `/api/npcs/${testNpcId}/voice`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        voiceId,
        voiceSettings: { pitch: 0.8, speed: 1.0 }
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npc.voiceId).toBe(voiceId)
  })

  test('GET /api/npcs/location/:location returns NPCs by location', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/npcs/location/Village%20Forge?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.npcs).toBeDefined()
    expect(body.npcs.length).toBeGreaterThan(0)
  })

  test('POST /api/npcs/generate-stats generates NPC stats', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/npcs/generate-stats',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        level: 10,
        class: 'warrior'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.stats).toBeDefined()
    expect(body.stats.health).toBeGreaterThan(0)
    expect(body.stats.armor).toBeGreaterThan(0)
    expect(body.stats.damage).toBeGreaterThan(0)
  })

  test('POST /api/npcs/generate-loot generates loot table', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/npcs/generate-loot',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        level: 15,
        rarity: 'rare'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.lootTable).toBeDefined()
    expect(body.lootTable.items).toBeDefined()
    expect(Array.isArray(body.lootTable.items)).toBe(true)
  })

  test('POST /api/npcs/generate-dialog generates basic dialog', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/npcs/generate-dialog',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Merchant Bob',
        behavior: 'merchant'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.dialog).toBeDefined()
    expect(Array.isArray(body.dialog)).toBe(true)
    expect(body.dialog.length).toBeGreaterThan(0)
  })

  test('DELETE /api/npcs/:id deletes NPC', async () => {
    const [npc] = await testServer.db.insert(npcs).values({
      name: 'NPC to Delete',
      projectId: testProjectId,
      ownerId: memberUserId,
    }).returning()

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/npcs/${npc.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    const dbNpc = await testServer.db.query.npcs.findFirst({
      where: eq(npcs.id, npc.id)
    })

    expect(dbNpc).toBeUndefined()
  })
})
