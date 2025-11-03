import { BaseAgent, type TestScenario, type ScenarioResult } from './base-agent'
import type { FastifyInstance } from 'fastify'
import { users, teams, teamMembers, projects, assets, riggingMetadata, fittingSessions, weaponDetection } from '../../src/database/schema'
import { eq } from 'drizzle-orm'

/**
 * MAYA - THE 3D ARTIST AGENT
 * Focuses on: 3D models, textures, rigging, fitting, weapon detection
 * Personality: Detail-oriented, technical, perfectionist
 */
export class Maya3DArtistAgent extends BaseAgent {
  private teamId: string = ''
  private projectId: string = ''

  constructor(server: FastifyInstance) {
    super(server, 'Maya', '3D Artist', '#FF6B6B')
  }

  async initialize(): Promise<void> {
    // Cleanup existing test data
    await this.cleanup()

    // Create test user
    const [user] = await this.server.db.insert(users).values({
      privyUserId: 'maya-3d-artist',
      email: 'maya@forge-test.com',
      displayName: 'Maya - 3D Artist',
      role: 'member',
    }).returning()

    this.userId = user.id

    // Create team
    const [team] = await this.server.db.insert(teams).values({
      name: 'Maya\'s 3D Studio',
      description: '3D asset creation and management',
      ownerId: this.userId,
    }).returning()

    this.teamId = team.id

    // Add to team
    await this.server.db.insert(teamMembers).values({
      teamId: this.teamId,
      userId: this.userId,
      role: 'owner',
      invitedBy: this.userId,
    })

    // Create project
    const [project] = await this.server.db.insert(projects).values({
      name: 'Character Assets Collection',
      description: 'High-quality 3D characters and equipment',
      teamId: this.teamId,
      ownerId: this.userId,
    }).returning()

    this.projectId = project.id
  }

  async cleanup(): Promise<void> {
    const existingUsers = await this.server.db.query.users.findMany({
      where: eq(users.privyUserId, 'maya-3d-artist')
    })

    for (const user of existingUsers) {
      // Delete all related data
      await this.server.db.delete(weaponDetection).where(
        eq(weaponDetection.assetId, user.id)
      )
      await this.server.db.delete(riggingMetadata).where(
        eq(riggingMetadata.projectId, this.projectId)
      )
      await this.server.db.delete(assets).where(eq(assets.ownerId, user.id))
      await this.server.db.delete(projects).where(eq(projects.ownerId, user.id))
      await this.server.db.delete(teamMembers).where(eq(teamMembers.userId, user.id))
      await this.server.db.delete(teams).where(eq(teams.ownerId, user.id))
    }

    await this.server.db.delete(users).where(eq(users.privyUserId, 'maya-3d-artist'))
  }

  getScenarios(): TestScenario[] {
    return [
      // ===== BASIC ASSET MANAGEMENT =====
      {
        name: '3D-001: Create character model asset',
        description: 'Create a 3D character model with metadata',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Warrior Hero Character',
              description: 'Main protagonist character model with high poly detail',
              type: 'model',
              visibility: 'public',
              metadata: {
                polyCount: 45000,
                textureResolution: '4K',
                format: 'FBX',
                software: 'Blender 4.0',
              },
            },
          })

          const success = response.statusCode === 201 && response.body.asset?.id
          if (success) {
            agent.storeTestData('characterModelId', response.body.asset.id)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-002: Create texture asset',
        description: 'Create a texture asset for character materials',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Hero Skin Albedo Texture',
              description: 'High-resolution skin texture with PBR workflow',
              type: 'texture',
              visibility: 'public',
              metadata: {
                resolution: '4096x4096',
                format: 'PNG',
                mapType: 'albedo',
                pbr: true,
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('textureAssetId', response.body.asset.id)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-003: List all model assets',
        description: 'Retrieve paginated list of model assets',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/assets?type=model&page=1&limit=20',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.assets)

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-004: Get specific asset details',
        description: 'Retrieve detailed information about a specific asset',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/assets/${assetId}`,
          })

          const success = response.statusCode === 200 && response.body.asset?.name === 'Warrior Hero Character'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-005: Update asset metadata',
        description: 'Update existing asset with new metadata',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/assets/${assetId}`,
            payload: {
              description: 'Updated: Main protagonist with rigging and animations',
              metadata: {
                polyCount: 45000,
                textureResolution: '4K',
                format: 'FBX',
                software: 'Blender 4.0',
                rigged: true,
                animated: true,
              },
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== RIGGING METADATA =====
      {
        name: '3D-006: Create rigging metadata for character',
        description: 'Add detailed rigging information to character model',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/3d/rigging/${assetId}`,
            payload: {
              projectId: (agent as any).projectId,
              skeletonType: 'humanoid',
              boneCount: 65,
              bones: {
                root: { children: ['pelvis'] },
                pelvis: { parent: 'root', children: ['spine1', 'leftLeg', 'rightLeg'] },
                spine1: { parent: 'pelvis', children: ['spine2'] },
                spine2: { parent: 'spine1', children: ['spine3', 'leftArm', 'rightArm'] },
                spine3: { parent: 'spine2', children: ['neck'] },
                neck: { parent: 'spine3', children: ['head'] },
              },
              hasBlendShapes: true,
              blendShapeCount: 32,
              hasIK: true,
              ikChains: [
                { name: 'leftArm', bones: ['leftShoulder', 'leftElbow', 'leftWrist'] },
                { name: 'rightArm', bones: ['rightShoulder', 'rightElbow', 'rightWrist'] },
                { name: 'leftLeg', bones: ['leftHip', 'leftKnee', 'leftAnkle'] },
                { name: 'rightLeg', bones: ['rightHip', 'rightKnee', 'rightAnkle'] },
              ],
              supportedAnimations: ['idle', 'walk', 'run', 'jump', 'attack', 'defend', 'death'],
              animationClips: [
                { name: 'idle', duration: 2.0, frameRate: 30 },
                { name: 'walk', duration: 1.2, frameRate: 30 },
                { name: 'run', duration: 0.8, frameRate: 30 },
                { name: 'jump', duration: 1.5, frameRate: 30 },
              ],
              riggerNotes: 'Full IK/FK rig with facial blend shapes. Optimized for game engine.',
              metadata: {
                rigger: 'Maya',
                version: '1.0',
                software: 'Blender',
                exportFormat: 'FBX',
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('riggingId', response.body.rigging.id)
          }

          return {
            success,
            points: success ? 100 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-007: Retrieve rigging metadata',
        description: 'Get rigging information for character model',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/3d/rigging/${assetId}`,
          })

          const success = response.statusCode === 200 && response.body.rigging?.skeletonType === 'humanoid'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-008: Update rigging metadata',
        description: 'Update existing rigging with additional animations',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/3d/rigging/${assetId}`,
            payload: {
              supportedAnimations: ['idle', 'walk', 'run', 'jump', 'attack', 'defend', 'death', 'dodge', 'block'],
              riggerNotes: 'Added combat animations: dodge and block',
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== EQUIPMENT & FITTING =====
      {
        name: '3D-009: Create armor equipment asset',
        description: 'Create an armor piece for character fitting',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Steel Plate Armor',
              description: 'Heavy armor chest piece with shoulder guards',
              type: 'model',
              visibility: 'public',
              metadata: {
                polyCount: 12000,
                armorType: 'heavy',
                slots: ['chest', 'shoulders'],
                defense: 85,
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('armorAssetId', response.body.asset.id)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-010: Create fitting session for armor',
        description: 'Fit armor piece onto character model',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          const characterId = agent.getTestData('characterModelId')
          const armorId = agent.getTestData('armorAssetId')

          if (!characterId || !armorId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'Missing asset IDs',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/3d/fitting',
            payload: {
              name: 'Hero Armor Fitting Session',
              baseAssetId: characterId,
              equipmentAssetId: armorId,
              projectId: (agent as any).projectId,
              attachmentPoints: {
                chest: { x: 0, y: 1.4, z: 0 },
                leftShoulder: { x: 0.25, y: 1.6, z: 0 },
                rightShoulder: { x: -0.25, y: 1.6, z: 0 },
              },
              transforms: {
                scale: 1.02,
                rotation: { x: 0, y: 0, z: 0 },
              },
              deformations: {
                chestExpansion: 0.05,
                shoulderBulge: 0.03,
              },
              metadata: {
                fitter: 'Maya',
                version: '1.0',
                notes: 'Slight scaling needed for proper fit',
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('fittingSessionId', response.body.session.id)
          }

          return {
            success,
            points: success ? 100 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-011: List all fitting sessions',
        description: 'Get all fitting sessions for the project',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/3d/fitting?projectId=${(agent as any).projectId}`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.sessions)

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-012: Get fitting session details',
        description: 'Retrieve detailed fitting session information',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const sessionId = agent.getTestData('fittingSessionId')

          if (!sessionId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No fitting session ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/3d/fitting/${sessionId}`,
          })

          const success = response.statusCode === 200 && response.body.session?.name === 'Hero Armor Fitting Session'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-013: Process fitting session',
        description: 'Start processing the fitting session',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          const sessionId = agent.getTestData('fittingSessionId')

          if (!sessionId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No fitting session ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/3d/fitting/${sessionId}/process`,
          })

          const success = response.statusCode === 200 && response.body.session?.status === 'processing'

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== WEAPON DETECTION =====
      {
        name: '3D-014: Create weapon asset (sword)',
        description: 'Create a sword model for weapon detection',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Legendary Longsword',
              description: 'An ancient blade with magical runes, razor-sharp edge',
              type: 'model',
              visibility: 'public',
              metadata: {
                polyCount: 8000,
                textureResolution: '2K',
                weaponCategory: 'melee',
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('swordAssetId', response.body.asset.id)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-015: Create weapon asset (bow)',
        description: 'Create a bow model for weapon detection',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Elven Hunting Bow',
              description: 'Graceful recurve bow made from enchanted wood, designed for long-range combat',
              type: 'model',
              visibility: 'public',
              metadata: {
                polyCount: 5000,
                weaponCategory: 'ranged',
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('bowAssetId', response.body.asset.id)
          }

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== ANALYTICS & SEARCH =====
      {
        name: '3D-016: Search for weapon assets',
        description: 'Use search to find weapon-related assets',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/search?q=weapon&type=assets',
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-017: Search for character models',
        description: 'Search for character-type assets',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/search?q=character&type=assets',
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-018: Get project analytics',
        description: 'Retrieve analytics for 3D project',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/analytics?projectId=${(agent as any).projectId}`,
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== EDGE CASES & ERROR HANDLING =====
      {
        name: '3D-019: Test invalid asset type',
        description: 'Try to create asset with invalid type',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Invalid Asset',
              type: 'invalid_type_xyz',
              visibility: 'public',
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Invalid asset type not properly validated',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: '3D-020: Test accessing non-existent asset',
        description: 'Try to get asset that doesn\'t exist',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/assets/00000000-0000-0000-0000-000000000000',
          })

          // Should return 404
          const success = response.statusCode === 404

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-021: Test duplicate rigging creation',
        description: 'Try to create rigging metadata for asset that already has it',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()
          const assetId = agent.getTestData('characterModelId')

          if (!assetId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No asset ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/3d/rigging/${assetId}`,
            payload: {
              projectId: (agent as any).projectId,
              skeletonType: 'humanoid',
              boneCount: 50,
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Duplicate rigging creation not prevented',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: '3D-022: Test fitting with texture asset',
        description: 'Try to create fitting session with non-model asset',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()
          const characterId = agent.getTestData('characterModelId')
          const textureId = agent.getTestData('textureAssetId')

          if (!characterId || !textureId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'Missing asset IDs',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/3d/fitting',
            payload: {
              name: 'Invalid Fitting',
              baseAssetId: characterId,
              equipmentAssetId: textureId, // This is a texture, not a model!
              projectId: (agent as any).projectId,
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Fitting allows non-model assets',
            severity: 'medium' as const,
          }

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
            bugDiscovered,
          }
        },
      },

      {
        name: '3D-023: Test pagination boundaries',
        description: 'Test asset pagination with extreme values',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          // Test page 0
          const response1 = await agent.apiCall({
            method: 'GET',
            url: '/api/assets?page=0&limit=20',
          })

          // Test very large page
          const response2 = await agent.apiCall({
            method: 'GET',
            url: '/api/assets?page=99999&limit=20',
          })

          // Both should handle gracefully
          const success = response1.statusCode === 200 && response2.statusCode === 200

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 2,
            dataVerified: false,
          }
        },
      },

      {
        name: '3D-024: Test asset deletion',
        description: 'Delete a test asset',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          // Create a disposable asset
          const createResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Disposable Test Asset',
              type: 'model',
              visibility: 'private',
            },
          })

          if (createResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 1,
              dataVerified: false,
              errorMessage: 'Failed to create disposable asset',
            }
          }

          const assetId = createResponse.body.asset.id

          // Delete it
          const deleteResponse = await agent.apiCall({
            method: 'DELETE',
            url: `/api/assets/${assetId}`,
          })

          const success = deleteResponse.statusCode === 204

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 2,
            dataVerified: success,
          }
        },
      },

      {
        name: '3D-025: Complete 3D workflow end-to-end',
        description: 'Full workflow: create model, rig it, add equipment, fit',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          // This is a complex workflow that ties everything together
          let apiCalls = 0

          // 1. Create new character model
          const modelResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Workflow Test Character',
              description: 'End-to-end workflow test',
              type: 'model',
              visibility: 'public',
            },
          })
          apiCalls++

          if (modelResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create model',
            }
          }

          const modelId = modelResponse.body.asset.id

          // 2. Add rigging
          const riggingResponse = await agent.apiCall({
            method: 'POST',
            url: `/api/3d/rigging/${modelId}`,
            payload: {
              projectId: (agent as any).projectId,
              skeletonType: 'humanoid',
              boneCount: 50,
              hasIK: true,
            },
          })
          apiCalls++

          if (riggingResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to add rigging',
            }
          }

          // 3. Create equipment
          const equipmentResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/assets',
            payload: {
              name: 'Workflow Test Armor',
              type: 'model',
              visibility: 'public',
            },
          })
          apiCalls++

          if (equipmentResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create equipment',
            }
          }

          const equipmentId = equipmentResponse.body.asset.id

          // 4. Create fitting session
          const fittingResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/3d/fitting',
            payload: {
              name: 'Workflow Test Fitting',
              baseAssetId: modelId,
              equipmentAssetId: equipmentId,
              projectId: (agent as any).projectId,
            },
          })
          apiCalls++

          const success = fittingResponse.statusCode === 201

          return {
            success,
            points: success ? 150 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
            metadata: {
              workflowSteps: ['create model', 'add rigging', 'create equipment', 'fit equipment'],
            },
          }
        },
      },
    ]
  }
}
