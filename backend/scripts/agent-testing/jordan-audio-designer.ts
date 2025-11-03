import { BaseAgent, type TestScenario, type ScenarioResult } from './base-agent'
import type { FastifyInstance } from 'fastify'
import { users, teams, teamMembers, projects, musicTracks, soundEffects, voiceSamples, voiceAssignments, npcs } from '../../src/database/schema'
import { eq } from 'drizzle-orm'

/**
 * JORDAN - THE AUDIO DESIGNER AGENT
 * Focuses on: Music tracks, sound effects, voice generation, voice assignments
 * Personality: Creative, experimental, production-focused
 */
export class JordanAudioDesignerAgent extends BaseAgent {
  private teamId: string = ''
  private projectId: string = ''

  constructor(server: FastifyInstance) {
    super(server, 'Jordan', 'Audio Designer', '#9B59B6')
  }

  async initialize(): Promise<void> {
    // Cleanup existing test data
    await this.cleanup()

    // Create test user
    const [user] = await this.server.db.insert(users).values({
      privyUserId: 'jordan-audio-designer',
      email: 'jordan@forge-test.com',
      displayName: 'Jordan - Audio Designer',
      role: 'member',
    }).returning()

    this.userId = user.id

    // Create team
    const [team] = await this.server.db.insert(teams).values({
      name: 'Jordan\'s Audio Studio',
      description: 'Professional game audio production',
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
      name: 'Epic Game Soundtrack',
      description: 'Complete audio package for fantasy RPG',
      teamId: this.teamId,
      ownerId: this.userId,
    }).returning()

    this.projectId = project.id
  }

  async cleanup(): Promise<void> {
    const existingUsers = await this.server.db.query.users.findMany({
      where: eq(users.privyUserId, 'jordan-audio-designer')
    })

    for (const user of existingUsers) {
      // Delete all related audio data
      await this.server.db.delete(voiceAssignments).where(eq(voiceAssignments.userId, user.id))
      await this.server.db.delete(voiceSamples).where(eq(voiceSamples.ownerId, user.id))
      await this.server.db.delete(soundEffects).where(eq(soundEffects.ownerId, user.id))
      await this.server.db.delete(musicTracks).where(eq(musicTracks.ownerId, user.id))
      await this.server.db.delete(npcs).where(eq(npcs.ownerId, user.id))
      await this.server.db.delete(projects).where(eq(projects.ownerId, user.id))
      await this.server.db.delete(teamMembers).where(eq(teamMembers.userId, user.id))
      await this.server.db.delete(teams).where(eq(teams.ownerId, user.id))
    }

    await this.server.db.delete(users).where(eq(users.privyUserId, 'jordan-audio-designer'))
  }

  getScenarios(): TestScenario[] {
    return [
      // ===== MUSIC TRACK MANAGEMENT =====
      {
        name: 'AUDIO-001: Create epic battle music track',
        description: 'Create a high-energy orchestral battle theme',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Battle of the Ancient Kings',
              description: 'Epic orchestral piece with heroic brass, intense strings, and powerful percussion',
              genre: 'orchestral',
              mood: 'epic',
              bpm: 145,
              key: 'D Minor',
              loopable: true,
              usageContext: 'combat',
              tags: ['battle', 'orchestral', 'epic', 'boss fight'],
              duration: 180,
              metadata: {
                composer: 'Jordan',
                instruments: ['strings', 'brass', 'percussion', 'choir'],
                dynamicRange: 'high',
              },
            },
          })

          const success = response.statusCode === 201 && response.body.track?.id
          if (success) {
            agent.storeTestData('battleTrackId', response.body.track.id)
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
        name: 'AUDIO-002: Create ambient exploration music',
        description: 'Create a calm atmospheric track for exploration',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Whispering Forest',
              description: 'Serene ambient music with nature sounds and ethereal pads',
              genre: 'ambient',
              mood: 'calm',
              bpm: 80,
              key: 'A Major',
              loopable: true,
              usageContext: 'exploration',
              tags: ['ambient', 'nature', 'peaceful', 'exploration'],
              duration: 240,
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('ambientTrackId', response.body.track.id)
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
        name: 'AUDIO-003: List all music tracks',
        description: 'Retrieve paginated list of music tracks',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/music?page=1&limit=20',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.tracks)

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
        name: 'AUDIO-004: Filter music by genre',
        description: 'Get all orchestral music tracks',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/music?genre=orchestral',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.tracks)

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
        name: 'AUDIO-005: Filter music by mood',
        description: 'Get all epic mood music tracks',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/music?mood=epic',
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
        name: 'AUDIO-006: Update music track metadata',
        description: 'Update existing music track details',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const trackId = agent.getTestData('battleTrackId')

          if (!trackId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No track ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/music/${trackId}`,
            payload: {
              description: 'Epic orchestral battle theme - UPDATED with additional percussion layers',
              bpm: 150,
              tags: ['battle', 'orchestral', 'epic', 'boss fight', 'cinematic'],
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

      {
        name: 'AUDIO-007: Generate AI music from prompt',
        description: 'Use AI to generate music from text prompt',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/music/generate',
            payload: {
              name: 'AI-Generated Victory Theme',
              prompt: 'Create an uplifting orchestral victory theme with triumphant horns, soaring strings, and celebratory percussion. Should feel heroic and inspiring.',
              genre: 'orchestral',
              mood: 'triumphant',
              bpm: 120,
              duration: 60,
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('aiMusicId', response.body.track.id)
          }

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== SOUND EFFECTS =====
      {
        name: 'AUDIO-008: Create sword impact sound effect',
        description: 'Add a metallic sword impact SFX',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/sfx',
            payload: {
              name: 'Sword Impact Metal',
              description: 'Sharp metallic impact sound for sword hits',
              category: 'combat',
              subcategory: 'weapon',
              tags: ['sword', 'impact', 'metal', 'combat'],
              duration: 1.2,
              loopable: false,
              metadata: {
                sampleRate: 48000,
                bitDepth: 24,
                channels: 2,
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('swordSfxId', response.body.soundEffect.id)
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
        name: 'AUDIO-009: Create ambient forest sounds',
        description: 'Add looping forest ambience SFX',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/sfx',
            payload: {
              name: 'Forest Ambience Loop',
              description: 'Natural forest sounds: birds, wind, rustling leaves',
              category: 'environment',
              subcategory: 'ambience',
              tags: ['forest', 'nature', 'ambient', 'loop'],
              duration: 30,
              loopable: true,
            },
          })

          const success = response.statusCode === 201

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
        name: 'AUDIO-010: Create footstep sound set',
        description: 'Add multiple footstep variations',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/sfx',
            payload: {
              name: 'Footsteps Stone Floor',
              description: 'Footstep sound variations on stone surface',
              category: 'movement',
              subcategory: 'footsteps',
              tags: ['footsteps', 'stone', 'walking', 'movement'],
              duration: 0.5,
              loopable: false,
              variations: 8,
            },
          })

          const success = response.statusCode === 201

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
        name: 'AUDIO-011: List sound effects by category',
        description: 'Get all combat sound effects',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/sfx?category=combat',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.soundEffects)

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
        name: 'AUDIO-012: Search for specific SFX',
        description: 'Search for sword-related sound effects',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/search?q=sword&type=sfx',
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

      // ===== VOICE GENERATION & ASSIGNMENTS =====
      {
        name: 'AUDIO-013: Create NPC for voice assignment',
        description: 'Create an NPC that will receive voice assignment',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Elder Sage Cornelius',
              description: 'Wise old wizard who guides the hero',
              projectId: (agent as any).projectId,
              personality: 'wise, patient, mysterious',
              voice: 'deep, calm, authoritative',
              age: 'elderly',
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('npcId', response.body.npc.id)
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
        name: 'AUDIO-014: Generate voice sample for elderly sage',
        description: 'Generate AI voice sample with ElevenLabs',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/voice/generate',
            payload: {
              text: 'Young adventurer, the path ahead is fraught with danger. Take this ancient amulet, it will protect you.',
              voiceId: 'premade-voice-elderly-male',
              stability: 0.7,
              similarityBoost: 0.8,
              style: 'wise',
              metadata: {
                character: 'Elder Sage',
                emotion: 'concerned',
                context: 'giving quest',
              },
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('voiceSampleId', response.body.voiceSample.id)
          }

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AUDIO-015: Assign voice to NPC',
        description: 'Link generated voice sample to NPC character',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          const npcId = agent.getTestData('npcId')
          const voiceId = agent.getTestData('voiceSampleId') || '00000000-0000-0000-0000-000000000000'

          if (!npcId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No NPC ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/npcs/${npcId}/voice`,
            payload: {
              voiceId,
              voiceSettings: {
                pitch: 0.8,
                speed: 0.95,
              },
            },
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AUDIO-016: Generate voice profile for character',
        description: 'Create AI-generated voice profile for NPC',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/voice/generate-profile',
            payload: {
              characterDescription: 'Gruff dwarf blacksmith, middle-aged, Scottish accent, deep gravelly voice',
              personality: 'grumpy but good-hearted',
              age: 45,
              gender: 'male',
            },
          })

          const success = response.statusCode === 200 || response.statusCode === 201

          return {
            success,
            points: success ? 50 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'AUDIO-017: List all voice samples',
        description: 'Retrieve all generated voice samples',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/voice',
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
        name: 'AUDIO-018: Get voice assignments for project',
        description: 'List all NPC voice assignments',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/voice-assignments?projectId=${(agent as any).projectId}`,
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

      // ===== ADVANCED WORKFLOWS =====
      {
        name: 'AUDIO-019: Create complete audio package',
        description: 'Create music track, SFX, and voice for a scene',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          let apiCalls = 0

          // 1. Create music track
          const musicResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Tavern Celebration',
              genre: 'folk',
              mood: 'cheerful',
              bpm: 110,
              loopable: true,
              usageContext: 'ambient',
            },
          })
          apiCalls++

          if (musicResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create music',
            }
          }

          // 2. Create ambient SFX
          const sfxResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/sfx',
            payload: {
              name: 'Tavern Ambience',
              category: 'environment',
              loopable: true,
            },
          })
          apiCalls++

          if (sfxResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create SFX',
            }
          }

          // 3. Create NPC
          const npcResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Jovial Bartender',
              projectId: (agent as any).projectId,
            },
          })
          apiCalls++

          const success = npcResponse.statusCode === 201

          return {
            success,
            points: success ? 150 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
            metadata: {
              workflowSteps: ['create music', 'create sfx', 'create npc'],
            },
          }
        },
      },

      // ===== EDGE CASES =====
      {
        name: 'AUDIO-020: Test invalid BPM value',
        description: 'Try to create music with negative BPM',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Invalid Track',
              bpm: -50,
              genre: 'electronic',
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Negative BPM value not properly validated',
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
        name: 'AUDIO-021: Test extremely long music duration',
        description: 'Try to create music with unrealistic duration',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Infinite Track',
              genre: 'ambient',
              duration: 999999,
            },
          })

          // Should either accept it or validate reasonably
          const success = response.statusCode === 201 || response.statusCode === 400

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
        name: 'AUDIO-022: Test deleting music track',
        description: 'Delete a music track successfully',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          // Create disposable track
          const createResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/music',
            payload: {
              name: 'Disposable Track',
              genre: 'test',
            },
          })

          if (createResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 1,
              dataVerified: false,
              errorMessage: 'Failed to create track',
            }
          }

          const trackId = createResponse.body.track.id

          // Delete it
          const deleteResponse = await agent.apiCall({
            method: 'DELETE',
            url: `/api/music/${trackId}`,
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
        name: 'AUDIO-023: Test SFX with missing category',
        description: 'Try to create SFX without required category',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/sfx',
            payload: {
              name: 'No Category SFX',
              description: 'Missing category field',
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'SFX category validation not enforced',
            severity: 'low' as const,
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
        name: 'AUDIO-024: Test voice generation with empty text',
        description: 'Try to generate voice with no text',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/voice/generate',
            payload: {
              text: '',
              voiceId: 'test-voice',
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Empty voice text not validated',
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
        name: 'AUDIO-025: Test music filtering by multiple criteria',
        description: 'Filter music by genre, mood, and BPM range',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/music?genre=orchestral&mood=epic&minBpm=120&maxBpm=160',
          })

          const success = response.statusCode === 200

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },
    ]
  }
}
