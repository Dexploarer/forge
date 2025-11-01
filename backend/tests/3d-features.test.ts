import { test, expect, describe, beforeAll } from 'bun:test'
import { testServer } from './setup'
import { users, teams, teamMembers, projects, assets, riggingMetadata, fittingSessions, weaponDetection } from '../src/database/schema'
import { eq } from 'drizzle-orm'

describe('3D Features Routes - Real E2E Tests', () => {
  let ownerUserId: string
  let ownerToken: string
  let otherUserId: string
  let otherToken: string
  let adminToken: string
  let testProjectId: string
  let testModelAssetId: string
  let otherModelAssetId: string
  let equipmentAssetId: string

  beforeAll(async () => {
    // Cleanup: Delete any existing test users from previous runs
    await testServer.db.delete(users).where(
      eq(users.privyUserId, '3d-test-owner')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, '3d-test-other')
    )
    await testServer.db.delete(users).where(
      eq(users.privyUserId, '3d-admin-privy-id')
    )

    // Create owner user
    const [owner] = await testServer.db.insert(users).values({
      privyUserId: '3d-test-owner',
      email: '3downer@test.com',
      displayName: '3D Test Owner',
      role: 'member',
    }).returning()

    ownerUserId = owner.id
    ownerToken = 'mock-3downer-token'

    // Create other user
    const [other] = await testServer.db.insert(users).values({
      privyUserId: '3d-test-other',
      email: '3dother@test.com',
      displayName: '3D Other User',
      role: 'member',
    }).returning()

    otherUserId = other.id
    otherToken = 'mock-3dother-token'

    // Create admin user
    await testServer.db.insert(users).values({
      privyUserId: '3d-admin-privy-id',
      email: 'admin@3d.com',
      role: 'admin',
    })

    adminToken = 'mock-admin-token'

    // Create test team (required for projects)
    const [team] = await testServer.db.insert(teams).values({
      name: '3D Test Team',
      description: 'For testing 3D features',
      ownerId: ownerUserId,
    }).returning()

    // Add owner to team
    await testServer.db.insert(teamMembers).values({
      teamId: team.id,
      userId: ownerUserId,
      role: 'owner',
      invitedBy: ownerUserId,
    })

    // Create test project with teamId
    const [project] = await testServer.db.insert(projects).values({
      name: '3D Test Project',
      description: 'For testing 3D features',
      teamId: team.id,
      ownerId: ownerUserId,
    }).returning()

    testProjectId = project.id

    // Create test model asset
    const [modelAsset] = await testServer.db.insert(assets).values({
      name: 'Test Character Model',
      description: 'A humanoid character model for testing',
      type: 'model',
      status: 'published',
      visibility: 'public',
      ownerId: ownerUserId,
    }).returning()

    testModelAssetId = modelAsset.id

    // Create equipment asset for fitting tests
    const [equipment] = await testServer.db.insert(assets).values({
      name: 'Test Armor',
      description: 'Armor piece for fitting tests',
      type: 'model',
      status: 'published',
      visibility: 'public',
      ownerId: ownerUserId,
    }).returning()

    equipmentAssetId = equipment.id

    // Create model asset owned by other user
    const [otherModel] = await testServer.db.insert(assets).values({
      name: 'Other User Model',
      type: 'model',
      status: 'published',
      visibility: 'public',
      ownerId: otherUserId,
    }).returning()

    otherModelAssetId = otherModel.id
  })

  // =====================================================
  // RIGGING METADATA TESTS
  // =====================================================

  test('POST /api/3d/rigging/:assetId creates rigging metadata', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId: testProjectId,
        skeletonType: 'humanoid',
        boneCount: 53,
        bones: {
          root: { children: ['spine'] },
          spine: { parent: 'root', children: ['head', 'leftArm', 'rightArm'] }
        },
        hasBlendShapes: true,
        blendShapeCount: 10,
        hasIK: true,
        ikChains: [{ name: 'leftLeg', bones: ['thigh', 'shin', 'foot'] }],
        supportedAnimations: ['walk', 'run', 'jump', 'idle'],
        animationClips: [{ name: 'walk', duration: 1.5, frameRate: 30 }],
        riggerNotes: 'Fully rigged humanoid character',
        metadata: { rigger: 'TestRigger', version: '1.0' }
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.rigging).toBeDefined()
    expect(body.rigging.id).toBeDefined()
    expect(body.rigging.assetId).toBe(testModelAssetId)
    expect(body.rigging.createdAt).toBeDefined()
  })

  test('POST /api/3d/rigging/:assetId rejects duplicate rigging metadata', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId: testProjectId,
        skeletonType: 'humanoid',
        boneCount: 50,
      }
    })

    // Should fail - rigging already exists
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('already exists')
  })

  test('POST /api/3d/rigging/:assetId requires asset ownership', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: `/api/3d/rigging/${otherModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId: testProjectId,
        skeletonType: 'humanoid',
        boneCount: 50,
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('GET /api/3d/rigging/:assetId returns rigging metadata', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.rigging).toBeDefined()
    expect(body.rigging.assetId).toBe(testModelAssetId)
    expect(body.rigging.skeletonType).toBe('humanoid')
    expect(body.rigging.boneCount).toBe(53)
    expect(body.rigging.hasBlendShapes).toBe(true)
    expect(body.rigging.blendShapeCount).toBe(10)
    expect(body.rigging.hasIK).toBe(true)
    expect(body.rigging.supportedAnimations).toContain('walk')
    expect(body.rigging.riggerNotes).toBe('Fully rigged humanoid character')
  })

  test('GET /api/3d/rigging/:assetId rejects non-owner', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('GET /api/3d/rigging/:assetId allows admin access', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    // Admin should be able to view
    expect(response.statusCode).toBe(200)
  })

  test('PATCH /api/3d/rigging/:assetId updates rigging metadata', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        boneCount: 55,
        riggerNotes: 'Updated rigging with additional bones',
        supportedAnimations: ['walk', 'run', 'jump', 'idle', 'attack']
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.rigging).toBeDefined()
    expect(body.rigging.updatedAt).toBeDefined()
  })

  test('PATCH /api/3d/rigging/:assetId requires ownership', async () => {
    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/3d/rigging/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      },
      payload: {
        boneCount: 60
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('DELETE /api/3d/rigging/:assetId removes rigging metadata', async () => {
    // Create a new asset with rigging just for deletion test
    const [deleteAsset] = await testServer.db.insert(assets).values({
      name: 'Delete Test Model',
      type: 'model',
      status: 'draft',
      ownerId: ownerUserId,
    }).returning()

    await testServer.db.insert(riggingMetadata).values({
      assetId: deleteAsset.id,
      projectId: testProjectId,
      skeletonType: 'custom',
      boneCount: 10,
    })

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/3d/rigging/${deleteAsset.id}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deletion
    const deleted = await testServer.db.query.riggingMetadata.findFirst({
      where: eq(riggingMetadata.assetId, deleteAsset.id)
    })

    expect(deleted).toBeUndefined()
  })

  // =====================================================
  // FITTING SESSIONS TESTS
  // =====================================================

  test('POST /api/3d/fitting creates fitting session', async () => {
    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        name: 'Character Armor Fitting',
        baseAssetId: testModelAssetId,
        equipmentAssetId: equipmentAssetId,
        projectId: testProjectId,
        attachmentPoints: {
          chest: { x: 0, y: 1.5, z: 0 },
          shoulders: { x: 0.3, y: 1.6, z: 0 }
        },
        transforms: {
          scale: 1.05,
          rotation: { x: 0, y: 0, z: 0 }
        },
        deformations: {
          chestExpansion: 0.1
        },
        metadata: {
          fitter: 'TestUser',
          version: '1.0'
        }
      }
    })

    expect(response.statusCode).toBe(201)

    const body = JSON.parse(response.body)
    expect(body.session).toBeDefined()
    expect(body.session.id).toBeDefined()
    expect(body.session.name).toBe('Character Armor Fitting')
    expect(body.session.status).toBe('draft')
    expect(body.session.createdAt).toBeDefined()
  })

  test('POST /api/3d/fitting requires both assets to be models', async () => {
    // Create a texture asset (not a model)
    const [textureAsset] = await testServer.db.insert(assets).values({
      name: 'Test Texture',
      type: 'texture',
      status: 'published',
      ownerId: ownerUserId,
    }).returning()

    const response = await testServer.inject({
      method: 'POST',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        name: 'Invalid Fitting',
        baseAssetId: testModelAssetId,
        equipmentAssetId: textureAsset.id,
        projectId: testProjectId,
      }
    })

    // Should fail - texture is not a model
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('must be 3D models')
  })

  test('GET /api/3d/fitting lists fitting sessions', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.sessions).toBeDefined()
    expect(Array.isArray(body.sessions)).toBe(true)
    expect(body.sessions.length).toBeGreaterThanOrEqual(1)

    // Verify session structure
    const session = body.sessions[0]
    expect(session.id).toBeDefined()
    expect(session.name).toBeDefined()
    expect(session.baseAssetId).toBeDefined()
    expect(session.equipmentAssetId).toBeDefined()
    expect(session.status).toBeDefined()
    expect(session.createdAt).toBeDefined()
  })

  test('GET /api/3d/fitting filters by projectId', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/fitting?projectId=${testProjectId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.sessions.forEach((session: any) => {
      expect(session.projectId).toBe(testProjectId)
    })
  })

  test('GET /api/3d/fitting filters by status', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting?status=draft',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    body.sessions.forEach((session: any) => {
      expect(session.status).toBe('draft')
    })
  })

  test('GET /api/3d/fitting/:id returns fitting session details', async () => {
    // Get the session ID from the list
    const listResponse = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const listBody = JSON.parse(listResponse.body)
    const sessionId = listBody.sessions[0].id

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/fitting/${sessionId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.session).toBeDefined()
    expect(body.session.id).toBe(sessionId)
    expect(body.session.name).toBe('Character Armor Fitting')
    expect(body.session.baseAssetId).toBe(testModelAssetId)
    expect(body.session.equipmentAssetId).toBe(equipmentAssetId)
    expect(body.session.ownerId).toBe(ownerUserId)
    expect(body.session.attachmentPoints).toBeDefined()
    expect(body.session.transforms).toBeDefined()
    expect(body.session.metadata).toBeDefined()
  })

  test('GET /api/3d/fitting/:id rejects non-owner', async () => {
    const listResponse = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const listBody = JSON.parse(listResponse.body)
    const sessionId = listBody.sessions[0].id

    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/fitting/${sessionId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('POST /api/3d/fitting/:id/process processes fitting session', async () => {
    const listResponse = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const listBody = JSON.parse(listResponse.body)
    const sessionId = listBody.sessions[0].id

    const response = await testServer.inject({
      method: 'POST',
      url: `/api/3d/fitting/${sessionId}/process`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.session).toBeDefined()
    expect(body.session.status).toBe('processing')
    expect(body.session.updatedAt).toBeDefined()
  })

  test('POST /api/3d/fitting/:id/process requires ownership', async () => {
    const listResponse = await testServer.inject({
      method: 'GET',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    const listBody = JSON.parse(listResponse.body)
    const sessionId = listBody.sessions[0].id

    const response = await testServer.inject({
      method: 'POST',
      url: `/api/3d/fitting/${sessionId}/process`,
      headers: {
        authorization: `Bearer ${otherToken}`
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('DELETE /api/3d/fitting/:id removes fitting session', async () => {
    // Create a session just for deletion
    const createResponse = await testServer.inject({
      method: 'POST',
      url: '/api/3d/fitting',
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        name: 'Session to Delete',
        baseAssetId: testModelAssetId,
        equipmentAssetId: equipmentAssetId,
        projectId: testProjectId,
      }
    })

    const createBody = JSON.parse(createResponse.body)
    const sessionId = createBody.session.id

    const response = await testServer.inject({
      method: 'DELETE',
      url: `/api/3d/fitting/${sessionId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(204)

    // Verify deletion
    const deleted = await testServer.db.query.fittingSessions.findFirst({
      where: eq(fittingSessions.id, sessionId)
    })

    expect(deleted).toBeUndefined()
  })

  // =====================================================
  // WEAPON DETECTION TESTS
  // =====================================================

  test('GET /api/3d/weapon/:assetId returns 404 for non-existent detection', async () => {
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/weapon/${testModelAssetId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    // Should fail - no weapon detection exists yet
    expect(response.statusCode).toBe(404)
  })

  test('Weapon detection can be added and retrieved', async () => {
    // Create a weapon-like asset
    const [weaponAsset] = await testServer.db.insert(assets).values({
      name: 'Sword of Testing',
      description: 'A sharp blade for combat',
      type: 'model',
      status: 'published',
      ownerId: ownerUserId,
    }).returning()

    // Manually create weapon detection (since AI requires API keys)
    await testServer.db.insert(weaponDetection).values({
      assetId: weaponAsset.id,
      isWeapon: true,
      confidence: '0.95',
      weaponType: 'sword',
      weaponClass: 'melee',
      estimatedDamage: 50,
      estimatedRange: 2,
      handedness: 'one-handed',
      gripPoints: [{ name: 'handle', position: { x: 0, y: 0, z: 0 } }],
      aiModel: 'gpt-4-turbo',
      analysisData: { reason: 'Name contains "sword"' },
      processingTime: 1500,
      verified: false,
    })

    // Now retrieve it
    const response = await testServer.inject({
      method: 'GET',
      url: `/api/3d/weapon/${weaponAsset.id}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.detection).toBeDefined()
    expect(body.detection.assetId).toBe(weaponAsset.id)
    expect(body.detection.isWeapon).toBe(true)
    expect(body.detection.confidence).toBe('0.95')
    expect(body.detection.weaponType).toBe('sword')
    expect(body.detection.weaponClass).toBe('melee')
    expect(body.detection.estimatedDamage).toBe(50)
    expect(body.detection.estimatedRange).toBe(2)
    expect(body.detection.handedness).toBe('one-handed')
    expect(body.detection.verified).toBe(false)
  })

  test('PATCH /api/3d/weapon/:assetId/verify verifies weapon detection', async () => {
    // Get the weapon asset we created
    const weaponAsset = await testServer.db.query.assets.findFirst({
      where: eq(assets.name, 'Sword of Testing')
    })

    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/3d/weapon/${weaponAsset!.id}/verify`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        estimatedDamage: 55,
        estimatedRange: 3
      }
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.detection).toBeDefined()
    expect(body.detection.verified).toBe(true)
    expect(body.detection.updatedAt).toBeDefined()
  })

  test('PATCH /api/3d/weapon/:assetId/verify requires ownership', async () => {
    const weaponAsset = await testServer.db.query.assets.findFirst({
      where: eq(assets.name, 'Sword of Testing')
    })

    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/3d/weapon/${weaponAsset!.id}/verify`,
      headers: {
        authorization: `Bearer ${otherToken}`
      },
      payload: {
        estimatedDamage: 60
      }
    })

    // Should fail - not the owner
    expect(response.statusCode).toBe(403)
  })

  test('PATCH /api/3d/weapon/:assetId/verify allows admin access', async () => {
    const weaponAsset = await testServer.db.query.assets.findFirst({
      where: eq(assets.name, 'Sword of Testing')
    })

    const response = await testServer.inject({
      method: 'PATCH',
      url: `/api/3d/weapon/${weaponAsset!.id}/verify`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        weaponType: 'longsword'
      }
    })

    // Admin should be able to verify
    expect(response.statusCode).toBe(200)
  })

  test('All authentication checks work correctly', async () => {
    // Test various endpoints without auth
    const endpoints = [
      { method: 'GET', url: `/api/3d/rigging/${testModelAssetId}` },
      { method: 'GET', url: '/api/3d/fitting' },
      { method: 'GET', url: `/api/3d/weapon/${testModelAssetId}` },
    ]

    for (const endpoint of endpoints) {
      const response = await testServer.inject({
        method: endpoint.method,
        url: endpoint.url
      })

      expect(response.statusCode).toBe(401)
    }
  })

  // =====================================================
  // NOTE: AI-Powered Endpoints That Require External APIs
  // =====================================================
  // POST /api/3d/detect-weapon/:assetId - Requires OpenAI API key
  //
  // This endpoint uses openaiService.chatCompletion() which requires:
  // - Valid OPENAI_API_KEY in environment variables
  // - Real API call to OpenAI (expensive and slow)
  //
  // The weapon detection logic, validation, and database operations are tested
  // above by manually creating weapon detection records. The AI integration
  // is tested separately if API keys are available.
})
