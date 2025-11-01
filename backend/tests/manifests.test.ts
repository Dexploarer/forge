import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, gameManifests, manifestBuilds, assets, projectAssets } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('Manifests Routes - Real E2E Tests', () => {
  let ownerUserId: string
  let ownerToken: string
  let otherUserId: string
  let otherToken: string
  let adminToken: string
  let testTeamId: string
  let testProjectId: string
  let testManifestId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'manifest-test-owner')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'manifest-test-other')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, 'manifest-admin-privy-id')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: 'manifest-test-owner',
      email: 'manifestowner@test.com',
      displayName: 'Manifest Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-manifestowner-token'

    // Create other user
    const [other] = await testServer.db.insert(users).values({
      privyUserId: 'manifest-test-other',
      email: 'manifestother@test.com',
      displayName: 'Other User',
      role: 'member',
    }).returning()

    otherUserId = other.id
    otherToken = 'mock-manifestother-token'

    // Create admin
    await testServer.db.insert(users).values({
      privyUserId: 'manifest-admin-privy-id',
      email: 'admin@manifest.com',
      role: 'admin',
    })

    adminToken = 'mock-admin-token'

    // Create test team
    const [team] = await testServer.db.insert(teams).values({
      name: 'Manifest Test Team',
      description: 'For testing manifests',
      ownerId: ownerUserId,
    }).returning()

    testTeamId = team.id

    // Add owner to team
    await testServer.db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: ownerUserId,
      role: 'owner',
      invitedBy: ownerUserId,
    })

    // Create test project
    const [project] = await testServer.db.insert(projects).values({
      name: 'Manifest Test Project',
      description: 'For testing manifests',
      teamId: testTeamId,
      ownerId: ownerUserId,
    }).returning()

    testProjectId = project.id

    // Create test asset for the project (needed for manifest validation)
    const [asset] = await testServer.db.insert(assets).values({
      name: 'Test Asset for Manifest',
      type: 'model',
      status: 'published',
      ownerId: ownerUserId,
      visibility: 'public',
    }).returning()

    // Add asset to project
    await testServer.db.insert(projectAssets).values({
      projectId: testProjectId,
      assetId: asset.id,
      addedBy: ownerUserId,
    })

    // Create test manifest
    const [manifest] = await testServer.db.insert(gameManifests).values({
      name: 'Test Game Manifest',
      version: '1.0.0',
      description: 'Test manifest for E2E testing',
      projectId: testProjectId,
      ownerId: ownerUserId,
      manifestData: {},
      status: 'draft',
      tags: ['test', 'v1'],
    }).returning()

    testManifestId = manifest.id
  })

  // =====================================================
  // LIST MANIFESTS TESTS
  // =====================================================

  test('GET /api/manifests lists user manifests with pagination', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/manifests?page=1&limit=20',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    expect(body.manifests).toBeDefined()
    expect(Array.isArray(body.manifests)).toBe(true)
    expect(body.manifests.length).toBeGreaterThan(0)

    // Verify manifest structure
    const firstManifest = body.manifests[0]
    expect(firstManifest.id).toBeDefined()
    expect(firstManifest.name).toBeDefined()
    expect(firstManifest.version).toBeDefined()
    expect(firstManifest.projectId).toBeDefined()
    expect(firstManifest.status).toBeDefined()
    expect(firstManifest.project).toBeDefined()
    expect(firstManifest.project.name).toBeDefined()

    // Verify pagination
    expect(body.pagination).toBeDefined()
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(20)
    expect(body.pagination.total).toBeGreaterThan(0)
  })

  test('GET /api/manifests filters by projectId', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.manifests).toBeDefined()

    // All manifests should belong to the test project
    body.manifests.forEach((manifest: any) => {
      expect(manifest.projectId).toBe(testProjectId)
    })
  })

  test('GET /api/manifests filters by status', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/manifests?status=draft',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.manifests).toBeDefined()

    // All manifests should have draft status
    body.manifests.forEach((manifest: any) => {
      expect(manifest.status).toBe('draft')
    })
  })

  test('GET /api/manifests only shows user own manifests', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)

    // Should not contain the test manifest (owned by owner, not other)
    const hasTestManifest = body.manifests.some((m: any) => m.id === testManifestId)
    expect(hasTestManifest).toBe(false)
  })

  // =====================================================
  // CREATE MANIFEST TESTS
  // =====================================================

  test('POST /api/manifests creates new manifest', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'New Test Manifest',
        version: '2.0.0',
        description: 'A brand new manifest',
        projectId: testProjectId,
        tags: ['new', 'test'],
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.manifest).toBeDefined()
    expect(body.manifest.id).toBeDefined()
    expect(body.manifest.name).toBe('New Test Manifest')
    expect(body.manifest.version).toBe('2.0.0')
    expect(body.manifest.projectId).toBe(testProjectId)
    expect(body.manifest.status).toBe('draft')
    expect(body.manifest.createdAt).toBeDefined()
  })

  test('POST /api/manifests validates semantic version format', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Invalid Version Manifest',
        version: 'not-a-version',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('POST /api/manifests prevents duplicate versions', async () => {
    // Create first manifest with version
    await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Duplicate Test',
        version: '3.0.0',
        projectId: testProjectId,
      }
    })

    // Try to create another with same version
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Duplicate Test 2',
        version: '3.0.0',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('already exists')
  })

  test('POST /api/manifests requires project membership', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${otherToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unauthorized Manifest',
        version: '4.0.0',
        projectId: testProjectId,
      }
    })

    expect(response.statusCode).toBe(403)
  })

  // =====================================================
  // GET MANIFEST DETAILS TESTS
  // =====================================================

  test('GET /api/manifests/:id returns manifest details', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.manifest).toBeDefined()
    expect(body.manifest.id).toBe(testManifestId)
    expect(body.manifest.name).toBe('Test Game Manifest')
    expect(body.manifest.version).toBe('1.0.0')
    expect(body.manifest.description).toBe('Test manifest for E2E testing')
    expect(body.manifest.status).toBe('draft')
    expect(body.manifest.tags).toContain('test')
    expect(body.manifest.tags).toContain('v1')
    expect(body.manifest.assetCount).toBeDefined()
    expect(body.manifest.questCount).toBeDefined()
    expect(body.manifest.npcCount).toBeDefined()
    expect(body.manifest.project).toBeDefined()
    expect(body.manifest.project.name).toBe('Manifest Test Project')
  })

  test('GET /api/manifests/:id rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('GET /api/manifests/:id allows admin access', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  test('GET /api/manifests/:id with non-existent manifest returns 404', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/manifests/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)
  })

  // =====================================================
  // UPDATE MANIFEST TESTS
  // =====================================================

  test('PATCH /api/manifests/:id updates manifest name', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Updated Manifest Name',
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.manifest.name).toBe('Updated Manifest Name')
    expect(body.manifest.updatedAt).toBeDefined()
  })

  test('PATCH /api/manifests/:id updates description and tags', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        description: 'New description',
        tags: ['updated', 'production'],
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.manifest).toBeDefined()

    // Verify update persisted
    const verifyResponse = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const verifyBody = JSON.parse(verifyResponse.body)
    expect(verifyBody.manifest.description).toBe('New description')
    expect(verifyBody.manifest.tags).toContain('updated')
    expect(verifyBody.manifest.tags).toContain('production')
  })

  test('PATCH /api/manifests/:id rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${otherToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Hacked Name',
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('PATCH /api/manifests/:id allows admin to update', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        description: 'Admin updated',
      }
    })

    expect(response.statusCode).toBe(200)
  })

  // =====================================================
  // BUILD MANIFEST TESTS
  // =====================================================

  test('POST /api/manifests/:id/build starts build process', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${testManifestId}/build`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.build).toBeDefined()
    expect(body.build.id).toBeDefined()
    expect(body.build.manifestId).toBe(testManifestId)
    expect(body.build.buildNumber).toBeDefined()
    expect(body.build.status).toBe('building')
    expect(body.build.startedAt).toBeDefined()
  })

  test('POST /api/manifests/:id/build rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${testManifestId}/build`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('POST /api/manifests/:id/build allows admin', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${testManifestId}/build`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  // =====================================================
  // PUBLISH MANIFEST TESTS
  // =====================================================

  test('POST /api/manifests/:id/publish requires built manifest', async () => {
    // Create a new draft manifest (not built)
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unbuilt Manifest',
        version: '5.0.0',
        projectId: testProjectId,
      }
    })

    const createBody = JSON.parse(createResponse.body)
    const unbuiltManifestId = createBody.manifest.id

    // Try to publish without building
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${unbuiltManifestId}/publish`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('must be built')
  })

  test('POST /api/manifests/:id/publish rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${testManifestId}/publish`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  // =====================================================
  // DOWNLOAD MANIFEST TESTS
  // =====================================================

  test('GET /api/manifests/:id/download requires built manifest', async () => {
    // Create a new draft manifest (not built)
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Unbuilt Download Test',
        version: '6.0.0',
        projectId: testProjectId,
      }
    })

    const createBody = JSON.parse(createResponse.body)
    const unbuiltManifestId = createBody.manifest.id

    // Try to download without building
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${unbuiltManifestId}/download`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.message).toContain('not been built')
  })

  test('GET /api/manifests/:id/download rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}/download`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('GET /api/manifests/:id/download allows admin', async () => {
    // First build the manifest to enable download
    const buildResponse = await testServer.inject({
      method: 'POST',
      url: `/api/manifests/${testManifestId}/build`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(buildResponse.statusCode).toBe(200)

    // Wait longer for async build to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Try to download as admin
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}/download`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    // Should allow admin access (might be 400 if build not complete, but not 403)
    expect(response.statusCode).not.toBe(403)
  })

  // =====================================================
  // LIST BUILDS TESTS
  // =====================================================

  test('GET /api/manifests/:id/builds lists build history', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}/builds`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.builds).toBeDefined()
    expect(Array.isArray(body.builds)).toBe(true)

    // Should have at least one build from previous tests
    expect(body.builds.length).toBeGreaterThan(0)

    const firstBuild = body.builds[0]
    expect(firstBuild.id).toBeDefined()
    expect(firstBuild.buildNumber).toBeDefined()
    expect(firstBuild.status).toBeDefined()
    expect(firstBuild.startedAt).toBeDefined()
  })

  test('GET /api/manifests/:id/builds rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}/builds`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('GET /api/manifests/:id/builds allows admin', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${testManifestId}/builds`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(200)
  })

  test('GET /api/manifests/:id/builds returns 404 for non-existent manifest', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/manifests/00000000-0000-0000-0000-000000000000/builds',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)
  })

  // =====================================================
  // DELETE MANIFEST TESTS
  // =====================================================

  test('DELETE /api/manifests/:id deletes manifest', async () => {
    // Create a manifest to delete
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'To Be Deleted',
        version: '99.0.0',
        projectId: testProjectId,
      }
    })

    const createBody = JSON.parse(createResponse.body)
    const manifestToDelete = createBody.manifest.id

    // Delete it
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/manifests/${manifestToDelete}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify it's gone
    const verifyResponse = await testServer.inject({
      method: 'GET',
      url: `/api/manifests/${manifestToDelete}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(verifyResponse.statusCode).toBe(404)
  })

  test('DELETE /api/manifests/:id rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/manifests/${testManifestId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    expect(response.statusCode).toBe(403)
  })

  test('DELETE /api/manifests/:id allows admin', async () => {
    // Create a manifest for admin to delete
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/manifests',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json'
      },
      payload: {
        name: 'Admin Will Delete',
        version: '98.0.0',
        projectId: testProjectId,
      }
    })

    const createBody = JSON.parse(createResponse.body)
    const manifestToDelete = createBody.manifest.id

    // Admin deletes it
    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/manifests/${manifestToDelete}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    expect(response.statusCode).toBe(204)
  })

  test('DELETE /api/manifests/:id returns 404 for non-existent manifest', async () => {
    const response = await testServer.inject({
      method: 'DELETE',
      url: '/api/manifests/00000000-0000-0000-0000-000000000000',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(404)
  })
})
