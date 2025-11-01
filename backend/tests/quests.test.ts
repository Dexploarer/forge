import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, quests } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Quests Routes - E2E Tests', () => {
  let memberToken: string
  let memberUserId: string
  let testTeamId: string
  let testProjectId: string
  let testQuestId: string

  beforeAll(async () => {
    // Cleanup
    const existingUsers = await testServer.db.query.users.findMany({
      where: eq(users.privyUserId, 'quest-test-member')
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)
      for (const userId of userIds) {
        await testServer.db.delete(quests).where(eq(quests.ownerId, userId))
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
        await testServer.db.delete(teamMembers).where(eq(teamMembers.userId, userId))
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    await testServer.db.delete(users).where(eq(users.privyUserId, 'quest-test-member'))

    // Create test user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'quest-test-member',
      email: 'questmember@test.com',
      displayName: 'Quest Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-questmember-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Quest Test Team',
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
      name: 'Quest Test Project',
      teamId: testTeamId,
      ownerId: memberUserId,
    }).returning()

    testProjectId = project.id
  })

  test('POST /api/quests creates a quest', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/quests',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Slay the Dragon',
        description: 'A fearsome dragon terrorizes the village.',
        projectId: testProjectId,
        questType: 'main',
        difficulty: 'hard',
        minLevel: 20,
        maxLevel: 30,
        objectives: [
          { id: 'obj1', type: 'kill', description: 'Defeat the dragon', target: 'dragon', count: 1 }
        ],
        rewards: {
          experience: 5000,
          gold: 1000,
          items: [{ id: 'sword1', name: 'Dragon Slayer Sword', quantity: 1 }]
        },
        requirements: {
          level: 20
        },
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.quest).toBeDefined()
    expect(body.quest.name).toBe('Slay the Dragon')

    testQuestId = body.quest.id
  })

  test('GET /api/quests lists quests', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/quests?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quests).toBeDefined()
    expect(body.quests.length).toBeGreaterThan(0)
  })

  test('GET /api/quests filters by questType', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/quests?projectId=${testProjectId}&questType=main`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.quests.forEach((quest: any) => {
      expect(quest.questType).toBe('main')
    })
  })

  test('GET /api/quests/:id returns quest details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/quests/${testQuestId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quest.name).toBe('Slay the Dragon')
    expect(body.quest.objectives).toBeDefined()
    expect(body.quest.rewards).toBeDefined()
  })

  test('PATCH /api/quests/:id updates quest', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/quests/${testQuestId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Slay the Ancient Dragon',
        difficulty: 'expert',
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.quest.name).toBe('Slay the Ancient Dragon')
  })

  test('GET /api/quests/:id/chain returns quest chain', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/quests/${testQuestId}/chain`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.chain).toBeDefined()
    expect(Array.isArray(body.chain)).toBe(true)
  })

  test('POST /api/quests/:id/duplicate duplicates quest', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/quests/${testQuestId}/duplicate`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.quest).toBeDefined()
    expect(body.quest.name).toContain('Copy')
  })

  test('DELETE /api/quests/:id deletes quest', async () => {
    const [quest] = await testServer.db.insert(quests).values({
      name: 'Quest to Delete',
      description: 'Will be deleted.',
      projectId: testProjectId,
      ownerId: memberUserId,
      objectives: [{ id: '1', type: 'test', description: 'test' }],
    }).returning()

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/quests/${quest.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    const dbQuest = await testServer.db.query.quests.findFirst({
      where: eq(quests.id, quest.id)
    })

    expect(dbQuest).toBeUndefined()
  })
})
