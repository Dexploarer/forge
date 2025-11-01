import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers } from '../src/database/schema'
import { eq, or } from 'drizzle-orm'

describe('Teams Routes - Real E2E Tests', () => {
  let adminToken: string
  let ownerToken: string
  let memberToken: string
  let nonMemberToken: string
  let adminUserId: string
  let ownerUserId: string
  let memberUserId: string
  let nonMemberUserId: string
  let testTeamId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users and teams
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'teams-test-admin'),
        eq(users.privyUserId, 'teams-test-owner'),
        eq(users.privyUserId, 'teams-test-member'),
        eq(users.privyUserId, 'teams-test-nonmember')
      )
    )

    // Create admin user
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'teams-test-admin',
      email: 'teamsadmin@test.com',
      displayName: 'Teams Admin',
      role: 'admin',
    }).returning()

    adminUserId = adminUser.id
    adminToken = 'mock-admin-token'

    // Create team owner user
    const [ownerUser] = await testServer.db.insert(users).values({
      privyUserId: 'teams-test-owner',
      email: 'teamowner@test.com',
      displayName: 'Team Owner',
      role: 'member',
    }).returning()

    ownerUserId = ownerUser.id
    ownerToken = 'mock-teamowner-token'

    // Create team member user
    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'teams-test-member',
      email: 'teammember@test.com',
      displayName: 'Team Member',
      role: 'member',
    }).returning()

    memberUserId = memberUser.id
    memberToken = 'mock-teammember-token'

    // Create non-member user
    const [nonMemberUser] = await testServer.db.insert(users).values({
      privyUserId: 'teams-test-nonmember',
      email: 'teamnonmember@test.com',
      displayName: 'Non Member',
      role: 'member',
    }).returning()

    nonMemberUserId = nonMemberUser.id
    nonMemberToken = 'mock-teamnonmember-token'
  })

  afterAll(async () => {
    // Cleanup test data
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'teams-test-admin'),
        eq(users.privyUserId, 'teams-test-owner'),
        eq(users.privyUserId, 'teams-test-member'),
        eq(users.privyUserId, 'teams-test-nonmember')
      )
    )
  })

  test('POST /api/teams creates a new team', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/teams',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Test Team',
        description: 'A team for testing',
        settings: { color: 'blue' }
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.team).toBeDefined()
    expect(body.team.name).toBe('Test Team')
    expect(body.team.description).toBe('A team for testing')
    expect(body.team.ownerId).toBe(ownerUserId)
    expect(body.team.id).toBeDefined()
    expect(typeof body.team.createdAt).toBe('string')

    testTeamId = body.team.id

    // Verify team was created in database
    const dbTeam = await testServer.db.query.teams.findFirst({
      where: eq(teams.id, testTeamId)
    })
    expect(dbTeam).toBeDefined()
    expect(dbTeam!.name).toBe('Test Team')

    // Verify owner was added as team member
    const membership = await testServer.db.query.teamMembers.findFirst({
      where: (teamMembers, { and, eq }) => and(
        eq(teamMembers.teamId, testTeamId),
        eq(teamMembers.userId, ownerUserId)
      )
    })
    expect(membership).toBeDefined()
    expect(membership!.role).toBe('owner')
  })

  test('POST /api/teams requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/teams',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unauthorized Team'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  test('GET /api/teams lists user teams', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/teams?page=1&limit=10',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.teams).toBeDefined()
    expect(Array.isArray(body.teams)).toBe(true)
    expect(body.teams.length).toBeGreaterThanOrEqual(1)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBeGreaterThanOrEqual(1)

    // Find our test team
    const testTeam = body.teams.find((t: any) => t.id === testTeamId)
    expect(testTeam).toBeDefined()
    expect(testTeam.isOwner).toBe(true)
    expect(testTeam.role).toBe('owner')
  })

  test('GET /api/teams/:id returns team details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.team).toBeDefined()
    expect(body.team.id).toBe(testTeamId)
    expect(body.team.name).toBe('Test Team')
    expect(body.team.owner).toBeDefined()
    expect(body.team.owner.id).toBe(ownerUserId)
    expect(body.team.owner.displayName).toBe('Team Owner')
    expect(body.team.memberCount).toBeGreaterThanOrEqual(1)
    expect(typeof body.team.createdAt).toBe('string')
    expect(typeof body.team.updatedAt).toBe('string')
  })

  test('GET /api/teams/:id requires team membership', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${nonMemberToken}`
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('not a member')
  })

  test('PATCH /api/teams/:id updates team', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Updated Test Team',
        description: 'Updated description'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.team.name).toBe('Updated Test Team')
    expect(body.team.description).toBe('Updated description')
    expect(typeof body.team.updatedAt).toBe('string')

    // Verify database was updated
    const dbTeam = await testServer.db.query.teams.findFirst({
      where: eq(teams.id, testTeamId)
    })
    expect(dbTeam!.name).toBe('Updated Test Team')
  })

  test('PATCH /api/teams/:id rejects non-owner updates', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${nonMemberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Hacked Team'
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')

    // Verify team was NOT updated
    const dbTeam = await testServer.db.query.teams.findFirst({
      where: eq(teams.id, testTeamId)
    })
    expect(dbTeam!.name).toBe('Updated Test Team') // Still the previous name
  })

  test('GET /api/teams/:id/members lists team members', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/teams/${testTeamId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.members).toBeDefined()
    expect(Array.isArray(body.members)).toBe(true)
    expect(body.members.length).toBeGreaterThanOrEqual(1)

    // Owner should be in the list
    const ownerMember = body.members.find((m: any) => m.userId === ownerUserId)
    expect(ownerMember).toBeDefined()
    expect(ownerMember.role).toBe('owner')
    expect(ownerMember.user).toBeDefined()
    expect(ownerMember.user.displayName).toBe('Team Owner')
    expect(typeof ownerMember.joinedAt).toBe('string')
  })

  test('POST /api/teams/:id/members adds a new member', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/teams/${testTeamId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: memberUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.member).toBeDefined()
    expect(body.member.userId).toBe(memberUserId)
    expect(body.member.teamId).toBe(testTeamId)
    expect(body.member.role).toBe('member')
    expect(typeof body.member.joinedAt).toBe('string')

    // Verify member was added to database
    const dbMember = await testServer.db.query.teamMembers.findFirst({
      where: (teamMembers, { and, eq }) => and(
        eq(teamMembers.teamId, testTeamId),
        eq(teamMembers.userId, memberUserId)
      )
    })
    expect(dbMember).toBeDefined()
    expect(dbMember!.role).toBe('member')
  })

  test('POST /api/teams/:id/members rejects duplicate members', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/teams/${testTeamId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: memberUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('already a member')
  })

  test('POST /api/teams/:id/members rejects non-owner adding members', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/teams/${testTeamId}/members`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: nonMemberUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')
  })

  test('GET /api/teams/:id allows members to view team', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.team.id).toBe(testTeamId)
  })

  test('DELETE /api/teams/:id/members removes a member', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/teams/${testTeamId}/members/${memberUserId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify member was removed from database
    const dbMember = await testServer.db.query.teamMembers.findFirst({
      where: (teamMembers, { and, eq }) => and(
        eq(teamMembers.teamId, testTeamId),
        eq(teamMembers.userId, memberUserId)
      )
    })
    expect(dbMember).toBeUndefined()
  })

  test('DELETE /api/teams/:id/members prevents removing team owner', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/teams/${testTeamId}/members/${ownerUserId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')
  })

  test('DELETE /api/teams/:id/members allows self-removal', async () => {
    // First add the member back
    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId
    })

    // Member removes themselves
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/teams/${testTeamId}/members/${memberUserId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify member was removed
    const dbMember = await testServer.db.query.teamMembers.findFirst({
      where: (teamMembers, { and, eq }) => and(
        eq(teamMembers.teamId, testTeamId),
        eq(teamMembers.userId, memberUserId)
      )
    })
    expect(dbMember).toBeUndefined()
  })

  test('DELETE /api/teams/:id deletes team (owner only)', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/teams/${testTeamId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify team was deleted from database
    const dbTeam = await testServer.db.query.teams.findFirst({
      where: eq(teams.id, testTeamId)
    })
    expect(dbTeam).toBeUndefined()

    // Verify team members were cascade deleted
    const dbMembers = await testServer.db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, testTeamId)
    })
    expect(dbMembers.length).toBe(0)
  })

  test('DELETE /api/teams/:id rejects non-owner deletion', async () => {
    // Create a new team for this test
    const [newTeam] = await testServer.db.insert(teams).values({
      name: 'Team to Keep',
      ownerId: ownerUserId,
    }).returning()

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/teams/${newTeam.id}`,
      headers: {
        authorization: `Bearer ${nonMemberToken}`
      }
    })

    expect(response.statusCode).toBe(403)

    // Verify team was NOT deleted
    const dbTeam = await testServer.db.query.teams.findFirst({
      where: eq(teams.id, newTeam.id)
    })
    expect(dbTeam).toBeDefined()

    // Cleanup
    await testServer.db.delete(teams).where(eq(teams.id, newTeam.id))
  })

  test('GET /api/teams/:id returns 404 for non-existent team', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/teams/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('not found')
  })

  test('Admin can update any team', async () => {
    // Create a team owned by someone else
    const [newTeam] = await testServer.db.insert(teams).values({
      name: 'Other Team',
      ownerId: ownerUserId,
    }).returning()

    // Admin updates it
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/teams/${newTeam.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Admin Updated Team'
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.team.name).toBe('Admin Updated Team')

    // Cleanup
    await testServer.db.delete(teams).where(eq(teams.id, newTeam.id))
  })
})
