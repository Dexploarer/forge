import { BaseAgent, type TestScenario, type ScenarioResult } from './base-agent'
import type { FastifyInstance } from 'fastify'
import { users, teams, teamMembers, projects, npcs, loreEntries, quests, previewManifests } from '../../src/database/schema'
import { eq } from 'drizzle-orm'

/**
 * RIVER - THE GAME WRITER AGENT
 * Focuses on: NPCs, lore, quests, dialogue, multi-agent collaboration
 * Personality: Creative storyteller, world-builder, narrative designer
 */
export class RiverGameWriterAgent extends BaseAgent {
  private teamId: string = ''
  private projectId: string = ''

  constructor(server: FastifyInstance) {
    super(server, 'River', 'Game Writer', '#3498DB')
  }

  async initialize(): Promise<void> {
    // Cleanup existing test data
    await this.cleanup()

    // Create test user
    const [user] = await this.server.db.insert(users).values({
      privyUserId: 'river-game-writer',
      email: 'river@forge-test.com',
      displayName: 'River - Game Writer',
      role: 'member',
    }).returning()

    this.userId = user.id

    // Create team
    const [team] = await this.server.db.insert(teams).values({
      name: 'River\'s Story Studio',
      description: 'Narrative design and world-building',
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
      name: 'Chronicles of Etheria',
      description: 'Epic fantasy RPG with rich narrative and memorable characters',
      teamId: this.teamId,
      ownerId: this.userId,
    }).returning()

    this.projectId = project.id
  }

  async cleanup(): Promise<void> {
    const existingUsers = await this.server.db.query.users.findMany({
      where: eq(users.privyUserId, 'river-game-writer')
    })

    for (const user of existingUsers) {
      // Delete all related narrative data
      await this.server.db.delete(previewManifests).where(eq(previewManifests.userId, user.id))
      await this.server.db.delete(quests).where(eq(quests.ownerId, user.id))
      await this.server.db.delete(loreEntries).where(eq(loreEntries.ownerId, user.id))
      await this.server.db.delete(npcs).where(eq(npcs.ownerId, user.id))
      await this.server.db.delete(projects).where(eq(projects.ownerId, user.id))
      await this.server.db.delete(teamMembers).where(eq(teamMembers.userId, user.id))
      await this.server.db.delete(teams).where(eq(teams.ownerId, user.id))
    }

    await this.server.db.delete(users).where(eq(users.privyUserId, 'river-game-writer'))
  }

  getScenarios(): TestScenario[] {
    return [
      // ===== NPC CREATION & MANAGEMENT =====
      {
        name: 'WRITER-001: Create merchant NPC with personality',
        description: 'Create a merchant NPC with detailed personality and backstory',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Garen Ironforge',
              description: 'A stout dwarf merchant with a passion for rare artifacts',
              projectId: (agent as any).projectId,
              title: 'Master Merchant',
              race: 'Dwarf',
              class: 'Merchant',
              level: 15,
              faction: 'Ironforge Trading Company',
              personality: 'Shrewd but fair, loves to haggle, has a soft spot for adventurers',
              backstory: 'Former adventurer turned merchant after losing his right leg to a dragon. Now trades the finest weapons and armor.',
              behavior: 'merchant',
              location: 'Ironforge Market Square',
              health: 80,
              armor: 20,
            },
          })

          const success = response.statusCode === 201 && response.body.npc?.id
          if (success) {
            agent.storeTestData('merchantNpcId', response.body.npc.id)
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
        name: 'WRITER-002: Create quest giver NPC',
        description: 'Create an NPC that will serve as a quest giver',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Elder Theron',
              description: 'Ancient elven sage who protects the Sacred Grove',
              projectId: (agent as any).projectId,
              title: 'Keeper of the Grove',
              race: 'Elf',
              class: 'Sage',
              level: 50,
              faction: 'Guardians of Etheria',
              personality: 'Wise, patient, speaks in riddles, deeply concerned about nature',
              backstory: 'Has protected the Sacred Grove for over 800 years. Witnessed the Great War and seeks heroes to prevent its return.',
              behavior: 'friendly',
              location: 'Sacred Grove',
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('questGiverNpcId', response.body.npc.id)
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
        name: 'WRITER-003: Create hostile enemy NPC with abilities',
        description: 'Create a hostile NPC with combat abilities and loot',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Shadow Assassin',
              description: 'A deadly assassin cloaked in shadows',
              projectId: (agent as any).projectId,
              title: 'Elite Assassin',
              race: 'Human',
              class: 'Assassin',
              level: 25,
              faction: 'Shadow Syndicate',
              personality: 'Cold, calculating, speaks little',
              behavior: 'hostile',
              location: 'Dark Alley',
              health: 150,
              armor: 40,
              damage: 45,
              abilities: [
                {
                  id: 'shadow_strike',
                  name: 'Shadow Strike',
                  description: 'Teleports behind target and delivers devastating blow',
                  cooldown: 8,
                  damage: 120,
                },
                {
                  id: 'smoke_bomb',
                  name: 'Smoke Bomb',
                  description: 'Creates smoke cloud for quick escape',
                  cooldown: 15,
                },
              ],
              lootTable: [
                {
                  itemId: 'shadow_dagger',
                  itemName: 'Shadow Dagger',
                  dropChance: 0.15,
                  minQuantity: 1,
                  maxQuantity: 1,
                },
                {
                  itemId: 'gold',
                  itemName: 'Gold',
                  dropChance: 1.0,
                  minQuantity: 50,
                  maxQuantity: 150,
                },
              ],
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('enemyNpcId', response.body.npc.id)
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
        name: 'WRITER-004: List all NPCs for project',
        description: 'Retrieve all NPCs in the project',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/npcs?projectId=${(agent as any).projectId}`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.npcs)

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
        name: 'WRITER-005: Filter NPCs by behavior',
        description: 'Get all merchant NPCs',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/npcs?projectId=${(agent as any).projectId}&behavior=merchant`,
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
        name: 'WRITER-006: Update NPC with dialogue lines',
        description: 'Add dialogue tree to merchant NPC',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const npcId = agent.getTestData('merchantNpcId')

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
            method: 'PATCH',
            url: `/api/npcs/${npcId}`,
            payload: {
              dialogLines: [
                {
                  id: 'greeting',
                  text: 'Welcome, traveler! Looking for quality goods?',
                  responses: [
                    { text: 'Show me your weapons', nextId: 'weapons' },
                    { text: 'What armor do you have?', nextId: 'armor' },
                    { text: 'Just browsing', nextId: 'goodbye' },
                  ],
                },
                {
                  id: 'weapons',
                  text: 'Ah, a warrior I see! I have the finest blades this side of the mountains.',
                },
                {
                  id: 'armor',
                  text: 'Heavy or light? I stock both. Nothing but the best for my customers!',
                },
                {
                  id: 'goodbye',
                  text: 'Come back when you need something. Garen always has what you need!',
                },
              ],
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

      // ===== AI-GENERATED NPC CONTENT =====
      {
        name: 'WRITER-007: Generate NPC dialogue with AI',
        description: 'Use AI to generate dialogue for quest giver NPC',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()
          const npcId = agent.getTestData('questGiverNpcId')

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
            url: `/api/npcs/${npcId}/generate-dialogue`,
            payload: {
              context: 'quest introduction',
              tone: 'wise and mysterious',
              count: 5,
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
        name: 'WRITER-008: Generate NPC stats with AI',
        description: 'Use AI to generate balanced combat stats for NPC',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs/generate-stats',
            payload: {
              npcLevel: 30,
              npcClass: 'Warrior',
              difficulty: 'hard',
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

      // ===== LORE CREATION =====
      {
        name: 'WRITER-009: Create world history lore entry',
        description: 'Create lore entry about world history',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/lore',
            payload: {
              title: 'The Great War of the Ancients',
              content: `Over a thousand years ago, the world of Etheria was torn apart by a catastrophic conflict known as the Great War. The dragon lords, seeking dominion over all mortal races, descended from their mountain strongholds with fire and fury. For decades, cities burned and kingdoms fell. It was only through the sacrifice of the First Heroes that the dragon lords were finally sealed away in the Void. But prophecy speaks of their return...`,
              summary: 'The legendary war that nearly destroyed Etheria and sealed away the dragon lords',
              projectId: (agent as any).projectId,
              category: 'history',
              tags: ['war', 'dragons', 'ancient', 'prophecy'],
              era: 'Age of Dragons',
              region: 'Continental Etheria',
              timelinePosition: -1000,
              importanceLevel: 10,
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('warLoreId', response.body.lore.id)
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
        name: 'WRITER-010: Create location lore entry',
        description: 'Create lore entry about an important location',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/lore',
            payload: {
              title: 'The Sacred Grove',
              content: `Deep within the Whisperwood Forest lies the Sacred Grove, a place of ancient magic where the boundaries between worlds grow thin. The trees here are said to be as old as time itself, their roots reaching into the very heart of creation. Druids and sages come here to commune with nature spirits and seek wisdom from the Old Gods. A single silver fountain stands at the grove's center, its waters said to grant visions of past and future.`,
              summary: 'Ancient magical grove protected by druids and nature spirits',
              projectId: (agent as any).projectId,
              category: 'location',
              tags: ['magic', 'nature', 'sacred', 'druids'],
              era: 'Age of Harmony',
              region: 'Whisperwood Forest',
              importanceLevel: 8,
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('groveLoreId', response.body.lore.id)
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
        name: 'WRITER-011: Create character backstory lore',
        description: 'Create lore entry about a legendary character',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/lore',
            payload: {
              title: 'Aria the Lightbringer',
              content: `The greatest of the First Heroes, Aria wielded the legendary Sword of Dawn against the dragon lords. Born a simple farm girl, she discovered her destiny when the sword chose her as its bearer. Her final act was to seal herself alongside the dragon lords in the Void, ensuring they could never escape. Temples across Etheria bear her symbol: a rising sun behind crossed swords.`,
              summary: 'Legendary hero who sacrificed herself to seal away the dragon lords',
              projectId: (agent as any).projectId,
              category: 'character',
              tags: ['hero', 'legend', 'sacrifice', 'First Heroes'],
              era: 'Age of Dragons',
              region: 'All of Etheria',
              timelinePosition: -950,
              importanceLevel: 10,
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
        name: 'WRITER-012: List lore entries by category',
        description: 'Get all history lore entries',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/lore?projectId=${(agent as any).projectId}&category=history`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.lore)

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
        name: 'WRITER-013: Update lore with related content',
        description: 'Link lore entries with related characters and locations',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const loreId = agent.getTestData('warLoreId')
          const npcId = agent.getTestData('questGiverNpcId')

          if (!loreId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No lore ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/lore/${loreId}`,
            payload: {
              relatedCharacters: npcId ? [npcId] : [],
              relatedLocations: ['sacred-grove-001'],
              relatedEvents: ['dragon-sealing'],
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

      // ===== QUEST CREATION =====
      {
        name: 'WRITER-014: Create main story quest',
        description: 'Create a main quest with objectives and rewards',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          const questGiverId = agent.getTestData('questGiverNpcId')

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/quests',
            payload: {
              name: 'Shadows in the Grove',
              description: 'Elder Theron senses dark corruption spreading through the Sacred Grove. Investigate the source and cleanse the darkness before it consumes the forest.',
              projectId: (agent as any).projectId,
              questType: 'main',
              difficulty: 'medium',
              minLevel: 15,
              maxLevel: 20,
              questGiverNpcId: questGiverId,
              location: 'Sacred Grove',
              objectives: [
                {
                  id: 'investigate',
                  type: 'explore',
                  description: 'Investigate the corrupted area in the Sacred Grove',
                  completed: false,
                },
                {
                  id: 'defeat_cultists',
                  type: 'kill',
                  description: 'Defeat the shadow cultists',
                  target: 'shadow_cultist',
                  count: 8,
                  completed: false,
                },
                {
                  id: 'cleanse_fountain',
                  type: 'interact',
                  description: 'Cleanse the corrupted fountain',
                  target: 'fountain',
                  completed: false,
                },
              ],
              rewards: {
                experience: 2500,
                gold: 500,
                items: [
                  { id: 'grove_amulet', name: 'Amulet of the Grove', quantity: 1 },
                ],
                reputation: {
                  'Guardians of Etheria': 100,
                },
              },
              startDialog: 'I sense a great disturbance, young one. The Grove... it cries out in pain. Will you help us?',
              completeDialog: 'You have done well. The darkness has been pushed back... for now. But I fear this is only the beginning.',
              estimatedDuration: 30,
            },
          })

          const success = response.statusCode === 201
          if (success) {
            agent.storeTestData('mainQuestId', response.body.quest.id)
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
        name: 'WRITER-015: Create side quest',
        description: 'Create a side quest with simple objectives',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const merchantId = agent.getTestData('merchantNpcId')

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/quests',
            payload: {
              name: 'The Lost Shipment',
              description: 'Garen\'s shipment of rare metals was ambushed by bandits. Recover the stolen goods and he\'ll reward you handsomely.',
              projectId: (agent as any).projectId,
              questType: 'side',
              difficulty: 'easy',
              minLevel: 10,
              questGiverNpcId: merchantId,
              location: 'Ironforge Market',
              objectives: [
                {
                  id: 'find_bandits',
                  type: 'explore',
                  description: 'Find the bandit hideout',
                  completed: false,
                },
                {
                  id: 'recover_goods',
                  type: 'collect',
                  description: 'Recover stolen metal crates',
                  target: 'metal_crate',
                  count: 3,
                  completed: false,
                },
              ],
              rewards: {
                experience: 800,
                gold: 250,
              },
              estimatedDuration: 15,
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
        name: 'WRITER-016: Create repeatable daily quest',
        description: 'Create a daily repeatable quest',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/quests',
            payload: {
              name: 'Hunter\'s Bounty',
              description: 'The town needs fresh meat. Hunt wild boars in the forest.',
              projectId: (agent as any).projectId,
              questType: 'daily',
              difficulty: 'easy',
              minLevel: 5,
              location: 'Whisperwood Forest',
              repeatable: true,
              cooldownHours: 24,
              objectives: [
                {
                  id: 'hunt_boars',
                  type: 'kill',
                  description: 'Hunt wild boars',
                  target: 'wild_boar',
                  count: 5,
                  completed: false,
                },
              ],
              rewards: {
                experience: 200,
                gold: 50,
              },
              estimatedDuration: 10,
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
        name: 'WRITER-017: List quests by difficulty',
        description: 'Get all medium difficulty quests',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/quests?projectId=${(agent as any).projectId}&difficulty=medium`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.quests)

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
        name: 'WRITER-018: Get quest details',
        description: 'Retrieve detailed quest information',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()
          const questId = agent.getTestData('mainQuestId')

          if (!questId) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: 0,
              dataVerified: false,
              errorMessage: 'No quest ID available',
            }
          }

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/quests/${questId}`,
          })

          const success = response.statusCode === 200 && response.body.quest?.name === 'Shadows in the Grove'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== MULTI-AGENT COLLABORATION =====
      {
        name: 'WRITER-019: Multi-agent NPC dialogue generation',
        description: 'Generate collaborative dialogue between multiple NPCs',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/multi-agent/generate-dialogue',
            payload: {
              projectId: (agent as any).projectId,
              npcIds: [
                agent.getTestData('merchantNpcId'),
                agent.getTestData('questGiverNpcId'),
              ].filter(Boolean),
              scenario: 'discussing rumors about dark forces in the forest',
              turns: 6,
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
        name: 'WRITER-020: Multi-agent quest generation',
        description: 'Generate quest using multiple AI agents for collaboration',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/multi-agent/generate-quest',
            payload: {
              projectId: (agent as any).projectId,
              questTheme: 'ancient artifact recovery',
              difficulty: 'hard',
              involvedNpcs: 3,
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
        name: 'WRITER-021: Multi-agent lore collaboration',
        description: 'Generate interconnected lore using multiple AI agents',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/multi-agent/generate-lore',
            payload: {
              projectId: (agent as any).projectId,
              theme: 'forgotten kingdom',
              depth: 'detailed',
              relatedEntries: 5,
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
        name: 'WRITER-022: Multi-agent relationship building',
        description: 'Generate complex NPC relationships and interactions',
        category: 'ai-generation',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/multi-agent/generate-relationships',
            payload: {
              projectId: (agent as any).projectId,
              npcCount: 4,
              relationshipType: 'faction_conflict',
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

      // ===== MANIFEST MANAGEMENT =====
      {
        name: 'WRITER-023: Create preview manifest for NPCs',
        description: 'Create a preview manifest with NPC data',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/manifests/preview',
            payload: {
              manifestType: 'npcs',
              content: [
                {
                  id: agent.getTestData('merchantNpcId') || 'npc-001',
                  name: 'Garen Ironforge',
                  type: 'merchant',
                },
              ],
            },
          })

          const success = response.statusCode === 200 || response.statusCode === 201

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
        name: 'WRITER-024: Create preview manifest for lore',
        description: 'Create a preview manifest with lore entries',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/manifests/preview',
            payload: {
              manifestType: 'lore',
              content: [
                {
                  id: agent.getTestData('warLoreId') || 'lore-001',
                  title: 'The Great War',
                  category: 'history',
                },
              ],
            },
          })

          const success = response.statusCode === 200 || response.statusCode === 201

          return {
            success,
            points: success ? 30 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      // ===== SEARCH & FILTERING =====
      {
        name: 'WRITER-025: Search NPCs by name',
        description: 'Search for NPCs with specific name pattern',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/search?q=Elder&type=npcs',
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
        name: 'WRITER-026: Search lore by tags',
        description: 'Search lore entries by specific tags',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/lore?tags=dragons,war',
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
        name: 'WRITER-027: Test NPC creation without required fields',
        description: 'Try to create NPC without name',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              projectId: (agent as any).projectId,
              description: 'NPC without name',
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'NPC name validation not enforced',
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
        name: 'WRITER-028: Test quest with invalid difficulty',
        description: 'Try to create quest with invalid difficulty value',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/quests',
            payload: {
              name: 'Invalid Quest',
              description: 'Test quest',
              projectId: (agent as any).projectId,
              difficulty: 'super_hard_impossible',
              objectives: [],
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Quest difficulty validation not enforced',
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
        name: 'WRITER-029: Test lore with negative importance level',
        description: 'Try to create lore with invalid importance level',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/lore',
            payload: {
              title: 'Invalid Lore',
              content: 'Test content',
              projectId: (agent as any).projectId,
              importanceLevel: -5,
            },
          })

          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Lore importance level validation not enforced',
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
        name: 'WRITER-030: Complete narrative workflow',
        description: 'Full workflow: Create NPC, lore, and quest all connected',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          let apiCalls = 0

          // 1. Create new NPC
          const npcResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/npcs',
            payload: {
              name: 'Workflow Test NPC',
              description: 'Test NPC for complete workflow',
              projectId: (agent as any).projectId,
              behavior: 'friendly',
            },
          })
          apiCalls++

          if (npcResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create NPC',
            }
          }

          const workflowNpcId = npcResponse.body.npc.id

          // 2. Create related lore
          const loreResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/lore',
            payload: {
              title: 'Workflow Test Lore',
              content: 'Test lore content for complete workflow',
              projectId: (agent as any).projectId,
              category: 'character',
              relatedCharacters: [workflowNpcId],
            },
          })
          apiCalls++

          if (loreResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create lore',
            }
          }

          // 3. Create quest with NPC as quest giver
          const questResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/quests',
            payload: {
              name: 'Workflow Test Quest',
              description: 'Test quest for complete workflow',
              projectId: (agent as any).projectId,
              questGiverNpcId: workflowNpcId,
              questType: 'side',
              objectives: [
                {
                  id: 'test_obj',
                  type: 'explore',
                  description: 'Test objective',
                },
              ],
            },
          })
          apiCalls++

          const success = questResponse.statusCode === 201

          return {
            success,
            points: success ? 150 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
            metadata: {
              workflowSteps: ['create NPC', 'create lore', 'create quest with connections'],
            },
          }
        },
      },
    ]
  }
}
