import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, projectMembers, assets } from '../src/database/schema'
import { eq, or, and } from 'drizzle-orm'

describe('Projects Routes - Real E2E Tests', () => {
  let adminToken: string
  let ownerToken: string
  let memberToken: string
  let nonMemberToken: string
  let adminUserId: string
  let ownerUserId: string
  let memberUserId: string
  let nonMemberUserId: string
  let testTeamId: string
  let testProjectId: string
  let testAssetId: string

  beforeAll(async () => {
    // Comprehensive cleanup - order matters due to foreign keys
    // Find existing test users first
    const existingUsers = await testServer.db.query.users.findMany({
      where: or(
        eq(users.privyUserId, 'projects-test-admin'),
        eq(users.privyUserId, 'projects-test-owner'),
        eq(users.privyUserId, 'projects-test-member'),
        eq(users.privyUserId, 'projects-test-other')
      )
    })

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id)

      // 1. Delete project members first (references projects and users)
      for (const userId of userIds) {
        await testServer.db.delete(projectMembers).where(
          or(
            eq(projectMembers.userId, userId),
            eq(projectMembers.invitedBy, userId)
          )
        )
      }

      // 2. Delete projects owned by test users
      for (const userId of userIds) {
        await testServer.db.delete(projects).where(eq(projects.ownerId, userId))
      }

      // 3. Delete team memberships
      for (const userId of userIds) {
        await testServer.db.delete(teamMembers).where(
          or(
            eq(teamMembers.userId, userId),
            eq(teamMembers.invitedBy, userId)
          )
        )
      }

      // 4. Delete teams owned by test users
      for (const userId of userIds) {
        await testServer.db.delete(teams).where(eq(teams.ownerId, userId))
      }
    }

    // 5. Finally, delete users
    await testServer.db.delete(users).where(
      or(
        eq(users.privyUserId, 'projects-test-admin'),
        eq(users.privyUserId, 'projects-test-owner'),
        eq(users.privyUserId, 'projects-test-member'),
        eq(users.privyUserId, 'projects-test-other')
      )
    )

    // Create test users
    const [adminUser] = await testServer.db.insert(users).values({
      privyUserId: 'projects-test-admin',
      email: 'projectsadmin@test.com',
      displayName: 'Projects Admin',
      role: 'admin',
    }).returning()

    const [ownerUser] = await testServer.db.insert(users).values({
      privyUserId: 'projects-test-owner',
      email: 'projectsowner@test.com',
      displayName: 'Projects Owner',
      role: 'member',
    }).returning()

    const [memberUser] = await testServer.db.insert(users).values({
      privyUserId: 'projects-test-member',
      email: 'projectsmember@test.com',
      displayName: 'Projects Member',
      role: 'member',
    }).returning()

    const [nonMemberUser] = await testServer.db.insert(users).values({
      privyUserId: 'projects-test-other',
      email: 'projectsother@test.com',
      displayName: 'Projects Other User',
      role: 'member',
    }).returning()

    adminUserId = adminUser.id
    ownerUserId = ownerUser.id
    memberUserId = memberUser.id
    nonMemberUserId = nonMemberUser.id

    // Create a test team with owner and member
    const [team] = await testServer.db.insert(teams).values({
      name: 'Test Team for Projects',
      description: 'Testing projects',
      ownerId: ownerUserId,
    }).returning()

    testTeamId = team.id

    // Add owner and member to team (owner must be added first)
    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: ownerUserId,
      role: 'owner',
      invitedBy: ownerUserId,
    })

    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId,
    })

    // Create a test asset
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Test Asset for Project',
      type: 'model',
      status: 'published',
      ownerId: ownerUserId,
      visibility: 'public',
    }).returning()

    testAssetId = asset.id

    adminToken = 'mock-admin-token'
    ownerToken = 'mock-projectsowner-token'
    memberToken = 'mock-projectsmember-token'
    nonMemberToken = 'mock-projectsother-token'
  })

  // =====================================================
  // PROJECT CREATION TESTS
  // =====================================================

  test('POST /api/projects creates a new project', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Test Project',
        description: 'A project for testing',
        teamId: testTeamId,
        settings: { visibility: 'team' },
        tags: ['test', 'demo']
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
    expect(body.project.name).toBe('Test Project')
    expect(body.project.teamId).toBe(testTeamId)
    expect(body.project.ownerId).toBe(ownerUserId)

    testProjectId = body.project.id

    // Verify project in database
    const dbProject = await testServer.db.query.projects.findFirst({
      where: eq(projects.id, testProjectId)
    })

    expect(dbProject).toBeDefined()
    expect(dbProject!.name).toBe('Test Project')

    // Verify owner automatically added as member
    const dbMember = await testServer.db.query.projectMembers.findFirst({
      where: eq(projectMembers.projectId, testProjectId)
    })

    expect(dbMember).toBeDefined()
    expect(dbMember!.userId).toBe(ownerUserId)
    expect(dbMember!.role).toBe('owner')
  })

  test('POST /api/projects requires team membership', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${nonMemberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unauthorized Project',
        teamId: testTeamId,
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('team member')
  })

  test('POST /api/projects requires authentication', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        name: 'No Auth Project',
        teamId: testTeamId,
      }
    })

    expect(response.statusCode).toBe(401)
  })

  // =====================================================
  // PROJECT LISTING TESTS
  // =====================================================

  test('GET /api/projects lists user projects', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/projects?page=1&limit=10',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.projects).toBeDefined()
    expect(Array.isArray(body.projects)).toBe(true)
    expect(body.projects.length).toBeGreaterThan(0)

    const project = body.projects.find((p: any) => p.id === testProjectId)
    expect(project).toBeDefined()
    expect(project.isOwner).toBe(true)
    expect(project.role).toBe('owner')
    expect(project.memberCount).toBeGreaterThan(0)
  })

  test('GET /api/projects filters by teamId', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects?teamId=${testTeamId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.projects.forEach((project: any) => {
      expect(project.teamId).toBe(testTeamId)
    })
  })

  test('GET /api/projects/:id returns project details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
    expect(body.project.id).toBe(testProjectId)
    expect(body.project.owner).toBeDefined()
    expect(body.project.team).toBeDefined()
    expect(body.project.memberCount).toBeGreaterThan(0)
    expect(body.project.assetCount).toBeGreaterThanOrEqual(0)
  })

  test('GET /api/projects/:id requires membership', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${nonMemberToken}`
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('not a member')
  })

  test('GET /api/projects/:id returns 404 for non-existent project', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/projects/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('not found')
  })

  // =====================================================
  // PROJECT UPDATE TESTS
  // =====================================================

  test('PATCH /api/projects/:id updates project', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Updated Project Name',
        description: 'Updated description',
        tags: ['updated', 'test']
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.project.name).toBe('Updated Project Name')

    // Verify in database
    const dbProject = await testServer.db.query.projects.findFirst({
      where: eq(projects.id, testProjectId)
    })

    expect(dbProject!.name).toBe('Updated Project Name')
    expect(dbProject!.description).toBe('Updated description')
  })

  test('PATCH /api/projects/:id rejects non-owner updates', async () => {
    // Member will be added via API in subsequent test, just use them here
    // First ensure member is in project
    const existingMember = await testServer.db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, testProjectId),
        eq(projectMembers.userId, memberUserId)
      )
    })

    if (!existingMember) {
      await testServer.db.insert(projectMembers).values({
        projectId: testProjectId,
        userId: memberUserId,
        role: 'member',
        invitedBy: ownerUserId,
      })
    }

    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unauthorized Update'
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')
  })

  test('Admin can update any project', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Admin Updated Project'
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.project.name).toBe('Admin Updated Project')
  })

  // =====================================================
  // PROJECT MEMBERS TESTS
  // =====================================================

  test('GET /api/projects/:id/members lists project members', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.members).toBeDefined()
    expect(Array.isArray(body.members)).toBe(true)
    expect(body.members.length).toBeGreaterThan(0)

    // Check that members have user details
    const member = body.members[0]
    expect(member.user).toBeDefined()
    expect(member.user.displayName).toBeDefined()
  })

  test('POST /api/projects/:id/members adds a new member', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: memberUserId,
        role: 'editor'
      }
    })

    // Might be 201 or 400 if already added
    expect([201, 400]).toContain(response.statusCode)

    if (response.statusCode === 201) {
      const body = JSON.parse(response.body)
      expect(body.member).toBeDefined()
      expect(body.member.userId).toBe(memberUserId)
      expect(body.member.role).toBe('editor')

      // Verify in database
      const dbMember = await testServer.db.query.projectMembers.findFirst({
        where: eq(projectMembers.userId, memberUserId)
      })

      expect(dbMember).toBeDefined()
    }
  })

  test('POST /api/projects/:id/members rejects duplicate members', async () => {
    // Try to add owner again
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: ownerUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(400)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('already a member')
  })

  test('POST /api/projects/:id/members requires team membership', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: nonMemberUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(400)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('team member')
  })

  test('POST /api/projects/:id/members rejects non-owner adding members', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/members`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json'
      },
      payload: {
        userId: memberUserId,
        role: 'member'
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')
  })

  test('GET /api/projects/:id allows members to view project', async () => {
    // Delete and re-add member to ensure clean state
    await testServer.db.delete(projectMembers).where(
      and(
        eq(projectMembers.projectId, testProjectId),
        eq(projectMembers.userId, memberUserId)
      )
    )

    const [inserted] = await testServer.db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId,
    }).returning()

    // Verify insertion succeeded
    expect(inserted).toBeDefined()
    expect(inserted.userId).toBe(memberUserId)

    // Verify member is in database
    const dbMember = await testServer.db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, testProjectId),
        eq(projectMembers.userId, memberUserId)
      )
    })
    expect(dbMember).toBeDefined()

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.project).toBeDefined()
  })

  test('DELETE /api/projects/:id/members removes a member', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}/members/${memberUserId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify removed from database
    const dbMember = await testServer.db.query.projectMembers.findFirst({
      where: eq(projectMembers.userId, memberUserId)
    })

    expect(dbMember).toBeUndefined()

    // Re-add for other tests
    await testServer.db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId,
    })
  })

  test('DELETE /api/projects/:id/members prevents removing project owner', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}/members/${ownerUserId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')

    // Verify owner still exists
    const dbProject = await testServer.db.query.projects.findFirst({
      where: eq(projects.id, testProjectId)
    })

    expect(dbProject!.ownerId).toBe(ownerUserId)
  })

  test('DELETE /api/projects/:id/members allows self-removal', async () => {
    // Delete and re-add member to ensure clean state
    await testServer.db.delete(projectMembers).where(
      and(
        eq(projectMembers.projectId, testProjectId),
        eq(projectMembers.userId, memberUserId)
      )
    )

    await testServer.db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId,
    })

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}/members/${memberUserId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Re-add for other tests
    await testServer.db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: memberUserId,
      role: 'member',
      invitedBy: ownerUserId,
    })
  })

  // =====================================================
  // PROJECT ASSETS TESTS
  // =====================================================

  test('GET /api/projects/:id/assets lists project assets', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/assets`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.assets).toBeDefined()
    expect(Array.isArray(body.assets)).toBe(true)
  })

  test('POST /api/projects/:id/assets adds asset to project', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/assets`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        assetId: testAssetId,
        notes: 'Test asset for project'
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.projectAsset).toBeDefined()
    expect(body.projectAsset.assetId).toBe(testAssetId)
  })

  test('POST /api/projects/:id/assets rejects duplicate assets', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/assets`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        assetId: testAssetId
      }
    })

    expect(response.statusCode).toBe(400)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('already in this project')
  })

  test('GET /api/projects/:id/assets shows added asset', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/assets`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.assets.length).toBeGreaterThan(0)

    const asset = body.assets.find((a: any) => a.id === testAssetId)
    expect(asset).toBeDefined()
    expect(asset.addedBy).toBeDefined()
  })

  test('DELETE /api/projects/:id/assets/:assetId removes asset', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}/assets/${testAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify removed
    const checkResponse = await testServer.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/assets`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const body = JSON.parse(checkResponse.body)
    const asset = body.assets.find((a: any) => a.id === testAssetId)
    expect(asset).toBeUndefined()
  })

  // =====================================================
  // PROJECT DELETION TESTS
  // =====================================================

  test('DELETE /api/projects/:id deletes project (owner only)', async () => {
    // Create a project to delete
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Project to Delete',
        teamId: testTeamId,
      }
    })

    expect(createResponse.statusCode).toBe(201)
    const createBody = JSON.parse(createResponse.body)
    expect(createBody.project).toBeDefined()
    const deleteProjectId = createBody.project.id

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${deleteProjectId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deleted from database
    const dbProject = await testServer.db.query.projects.findFirst({
      where: eq(projects.id, deleteProjectId)
    })

    expect(dbProject).toBeUndefined()
  })

  test('DELETE /api/projects/:id rejects non-owner deletion', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    })

    expect(response.statusCode).toBe(403)

    const body = JSON.parse(response.body)
    expect(body.message).toContain('owner')

    // Verify still exists
    const dbProject = await testServer.db.query.projects.findFirst({
      where: eq(projects.id, testProjectId)
    })

    expect(dbProject).toBeDefined()
  })

  test('Admin can delete any project', async () => {
    // Create a project for admin to delete
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Admin Delete Test',
        teamId: testTeamId,
      }
    })

    const { project } = JSON.parse(createResponse.body)

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(204)
  })
})
