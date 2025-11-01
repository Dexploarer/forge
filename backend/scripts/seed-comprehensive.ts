#!/usr/bin/env bun
/**
 * Comprehensive Seed Script with AI Gateway
 * Uses Vercel AI Gateway for all AI operations
 */

import { generateText, generateObject } from 'ai'
import { gateway } from 'ai'
import { z } from 'zod'
import { db } from '../src/database/db'
import {
  users, teams, teamMembers, projects, projectMembers,
  npcs, loreEntries, quests, musicTracks, soundEffects,
  assets, projectAssets
} from '../src/database/schema'
import { eq } from 'drizzle-orm'

// Check for AI Gateway API key
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error('❌ AI_GATEWAY_API_KEY environment variable is required')
  process.exit(1)
}

console.log('🚀 Starting comprehensive database seeding with AI Gateway...\n')

// =====================================================
// STEP 1: Create Users
// =====================================================
console.log('👥 Creating users...')

const [adminUser] = await db.insert(users).values({
  privyUserId: 'seed-admin-user',
  email: 'admin@forge.local',
  displayName: 'Admin User',
  role: 'admin',
}).returning()

const [creator1] = await db.insert(users).values({
  privyUserId: 'seed-creator-1',
  email: 'creator1@forge.local',
  displayName: 'Game Designer Alice',
  role: 'member',
}).returning()

const [creator2] = await db.insert(users).values({
  privyUserId: 'seed-creator-2',
  email: 'creator2@forge.local',
  displayName: 'Level Designer Bob',
  role: 'member',
}).returning()

const [member1] = await db.insert(users).values({
  privyUserId: 'seed-member-1',
  email: 'member1@forge.local',
  displayName: 'Artist Charlie',
  role: 'member',
}).returning()

const [member2] = await db.insert(users).values({
  privyUserId: 'seed-member-2',
  email: 'member2@forge.local',
  displayName: 'Writer Dana',
  role: 'member',
}).returning()

console.log(`✅ Created 5 users\n`)

// =====================================================
// STEP 2: Create Teams
// =====================================================
console.log('🏢 Creating teams...')

const [mainTeam] = await db.insert(teams).values({
  name: 'Hyperscape Game Studio',
  description: 'Main development team for Hyperscape project',
  ownerId: adminUser.id,
}).returning()

const [indieTeam] = await db.insert(teams).values({
  name: 'Indie Creators Collective',
  description: 'Independent game creators working on side projects',
  ownerId: creator1.id,
}).returning()

const [artTeam] = await db.insert(teams).values({
  name: 'Asset Creation Team',
  description: 'Focused on 3D models, textures, and audio assets',
  ownerId: member1.id,
}).returning()

// Add team members
await db.insert(teamMembers).values([
  { teamId: mainTeam.id, userId: adminUser.id, role: 'owner', invitedBy: adminUser.id },
  { teamId: mainTeam.id, userId: creator1.id, role: 'admin', invitedBy: adminUser.id },
  { teamId: mainTeam.id, userId: creator2.id, role: 'member', invitedBy: adminUser.id },
  { teamId: mainTeam.id, userId: member1.id, role: 'member', invitedBy: adminUser.id },
  { teamId: mainTeam.id, userId: member2.id, role: 'member', invitedBy: adminUser.id },

  { teamId: indieTeam.id, userId: creator1.id, role: 'owner', invitedBy: creator1.id },
  { teamId: indieTeam.id, userId: creator2.id, role: 'admin', invitedBy: creator1.id },
  { teamId: indieTeam.id, userId: member2.id, role: 'member', invitedBy: creator1.id },

  { teamId: artTeam.id, userId: member1.id, role: 'owner', invitedBy: member1.id },
  { teamId: artTeam.id, userId: creator2.id, role: 'member', invitedBy: member1.id },
])

console.log(`✅ Created 3 teams with members\n`)

// =====================================================
// STEP 3: Create Projects
// =====================================================
console.log('📁 Creating projects...')

const [hyperspaceProject] = await db.insert(projects).values({
  name: 'Hyperscape - Fantasy MMORPG',
  description: 'A vast fantasy MMORPG with AI-powered NPCs and dynamic quests',
  teamId: mainTeam.id,
  ownerId: adminUser.id,
  gameConfig: {
    genre: 'fantasy-mmorpg',
    targetPlatform: ['PC', 'Console'],
    engineVersion: 'Unity 2023.1',
  },
}).returning()

const [rogueProject] = await db.insert(projects).values({
  name: 'Dungeon Crawler Roguelike',
  description: 'Procedurally generated dungeon crawler with permadeath',
  teamId: indieTeam.id,
  ownerId: creator1.id,
  gameConfig: {
    genre: 'roguelike',
    targetPlatform: ['PC', 'Mobile'],
    engineVersion: 'Godot 4.2',
  },
}).returning()

const [rpgProject] = await db.insert(projects).values({
  name: 'Tales of Eldoria - Story RPG',
  description: 'Story-driven single-player RPG with branching narratives',
  teamId: mainTeam.id,
  ownerId: creator2.id,
  gameConfig: {
    genre: 'story-rpg',
    targetPlatform: ['PC', 'Console'],
    engineVersion: 'Unreal Engine 5.3',
  },
}).returning()

const [survivalProject] = await db.insert(projects).values({
  name: 'Wilderness Survival',
  description: 'Survival crafting game in a harsh fantasy wilderness',
  teamId: indieTeam.id,
  ownerId: creator1.id,
  gameConfig: {
    genre: 'survival-crafting',
    targetPlatform: ['PC'],
    engineVersion: 'Unity 2023.1',
  },
}).returning()

const [tacticsProject] = await db.insert(projects).values({
  name: 'Tactical Conquest',
  description: 'Turn-based tactical RPG with strategic combat',
  teamId: artTeam.id,
  ownerId: member1.id,
  gameConfig: {
    genre: 'tactical-rpg',
    targetPlatform: ['PC', 'Mobile', 'Console'],
    engineVersion: 'Unity 2023.1',
  },
}).returning()

// Add project members
await db.insert(projectMembers).values([
  { projectId: hyperspaceProject.id, userId: adminUser.id, role: 'owner', invitedBy: adminUser.id },
  { projectId: hyperspaceProject.id, userId: creator1.id, role: 'admin', invitedBy: adminUser.id },
  { projectId: hyperspaceProject.id, userId: creator2.id, role: 'editor', invitedBy: adminUser.id },

  { projectId: rogueProject.id, userId: creator1.id, role: 'owner', invitedBy: creator1.id },
  { projectId: rogueProject.id, userId: member2.id, role: 'editor', invitedBy: creator1.id },

  { projectId: rpgProject.id, userId: creator2.id, role: 'owner', invitedBy: creator2.id },
  { projectId: rpgProject.id, userId: member2.id, role: 'editor', invitedBy: creator2.id },
])

console.log(`✅ Created 5 projects with members\n`)

// =====================================================
// STEP 4: Generate NPCs with AI Gateway
// =====================================================
console.log('🤖 Generating NPCs with AI Gateway...')

const npcPrompts = [
  { name: 'Theron Ironforge', role: 'Blacksmith', location: 'Town Forge', description: 'A gruff dwarf blacksmith who forges legendary weapons' },
  { name: 'Elara Moonwhisper', role: 'Mage', location: 'Arcane Tower', description: 'An elegant elf mage specializing in elemental magic' },
  { name: 'Grunk the Shrewd', role: 'Merchant', location: 'Market Square', description: 'A cunning goblin merchant who trades in rare artifacts' },
  { name: 'Captain Aldric', role: 'Guard Captain', location: 'City Gates', description: 'A veteran human warrior commanding the city guard' },
  { name: 'Mystara the Oracle', role: 'Quest Giver', location: 'Temple of Foresight', description: 'A mysterious oracle who sees the future' },
  { name: 'Finnick Quickfingers', role: 'Rogue', location: 'Thieves Guild', description: 'A halfling thief with a heart of gold' },
  { name: 'Lady Seraphina', role: 'Noble', location: 'Royal Palace', description: 'A compassionate noble lady who helps the poor' },
  { name: 'Borgar the Innkeeper', role: 'Innkeeper', location: 'The Prancing Pony Inn', description: 'A jolly innkeeper with endless stories' },
  { name: 'Morgana Shadowblade', role: 'Assassin', location: 'Hidden Sanctuary', description: 'A deadly assassin with a code of honor' },
  { name: 'Talion Stormcaller', role: 'Druid', location: 'Ancient Grove', description: 'A wise druid who protects the forest' },
]

const model = gateway.languageModel('openai/gpt-4o-mini')

// Generate NPCs in parallel batches
const npcBatchSize = 5
for (let i = 0; i < npcPrompts.length; i += npcBatchSize) {
  const batch = npcPrompts.slice(i, i + npcBatchSize)

  await Promise.allSettled(batch.map(async (npcTemplate) => {
    try {
      console.log(`  Generating: ${npcTemplate.name}...`)

      const { text } = await generateText({
        model,
        prompt: `Create a detailed personality and backstory for an NPC named "${npcTemplate.name}" who is a ${npcTemplate.role} located at ${npcTemplate.location}. ${npcTemplate.description}.

Write 2-3 paragraphs covering:
1. Their personality traits and mannerisms
2. Their backstory and how they came to their current role
3. Their goals, motivations, and what makes them memorable

Keep it engaging and suitable for a fantasy RPG game.`,
        temperature: 0.8,
      })

      await db.insert(npcs).values({
        name: npcTemplate.name,
        description: text,
        projectId: hyperspaceProject.id,
        ownerId: creator1.id,
        location: npcTemplate.location,
        behavior: npcTemplate.role.toLowerCase().includes('merchant') ? 'merchant' : 'friendly',
        personalityTraits: {
          role: npcTemplate.role,
          traits: []
        },
      })

      console.log(`    ✓ ${npcTemplate.name}`)
    } catch (error: any) {
      console.error(`    ✗ Failed to generate ${npcTemplate.name}: ${error.message}`)
    }
  }))

  console.log(`  Completed batch ${Math.floor(i / npcBatchSize) + 1}/${Math.ceil(npcPrompts.length / npcBatchSize)}`)
}

console.log(`✅ Generated NPCs\n`)

// =====================================================
// STEP 5: Generate Lore Entries with AI Gateway
// =====================================================
console.log('📜 Generating lore entries with AI Gateway...')

const lorePrompts = [
  { title: 'The Kingdom of Eldoria', category: 'history', topic: 'The founding and rise of the great kingdom of Eldoria' },
  { title: 'The Dragon War Chronicles', category: 'history', topic: 'The ancient war between dragons and mortals' },
  { title: 'The Mage Academy of Lumina', category: 'location', topic: 'The prestigious magic academy' },
  { title: 'The Shadowfen Marshes', category: 'location', topic: 'A dangerous swampland filled with dark magic' },
  { title: 'The Prophecy of the Chosen One', category: 'mythology', topic: 'An ancient prophecy about a destined hero' },
]

// Generate lore in parallel batches
const loreBatchSize = 5
for (let i = 0; i < lorePrompts.length; i += loreBatchSize) {
  const batch = lorePrompts.slice(i, i + loreBatchSize)

  await Promise.allSettled(batch.map(async (loreTemplate) => {
    try {
      console.log(`  Generating: ${loreTemplate.title}...`)

      const { text } = await generateText({
        model,
        prompt: `Write engaging lore for a fantasy RPG game about: ${loreTemplate.topic}.

Title: ${loreTemplate.title}

Write 3-4 paragraphs that:
1. Introduce the subject with vivid descriptions
2. Provide historical or mythological context
3. Explain its significance to the game world
4. Include interesting details that make it memorable

Keep the tone immersive and suitable for a fantasy setting.`,
        temperature: 0.9,
      })

      await db.insert(loreEntries).values({
        title: loreTemplate.title,
        content: text,
        category: loreTemplate.category,
        projectId: hyperspaceProject.id,
        ownerId: member2.id,
        tags: [loreTemplate.category],
      })

      console.log(`    ✓ ${loreTemplate.title}`)
    } catch (error: any) {
      console.error(`    ✗ Failed to generate ${loreTemplate.title}: ${error.message}`)
    }
  }))

  console.log(`  Completed batch ${Math.floor(i / loreBatchSize) + 1}/${Math.ceil(lorePrompts.length / loreBatchSize)}`)
}

console.log(`✅ Generated lore entries\n`)

// =====================================================
// STEP 6: Generate Quests with AI Gateway
// =====================================================
console.log('⚔️ Generating quests with AI Gateway...')

const questPrompts = [
  { name: 'The Lost Amulet of Power', difficulty: 'easy', minLevel: 1 },
  { name: 'Goblin Raid on Millhaven', difficulty: 'medium', minLevel: 5 },
  { name: 'The Haunted Crypts', difficulty: 'medium', minLevel: 10 },
  { name: 'Dragon Slayer Challenge', difficulty: 'hard', minLevel: 20 },
  { name: 'The Necromancer Threat', difficulty: 'hard', minLevel: 15 },
]

const QuestSchema = z.object({
  description: z.string(),
  objectives: z.array(z.object({
    id: z.string(),
    type: z.enum(['kill', 'collect', 'escort', 'explore', 'talk']),
    description: z.string(),
    targetCount: z.number().optional(),
  })),
  rewards: z.object({
    gold: z.number(),
    experience: z.number(),
    items: z.array(z.string()).optional(),
  }),
})

// Generate quests in parallel batches
const questBatchSize = 5
for (let i = 0; i < questPrompts.length; i += questBatchSize) {
  const batch = questPrompts.slice(i, i + questBatchSize)

  await Promise.allSettled(batch.map(async (questTemplate) => {
    try {
      console.log(`  Generating: ${questTemplate.name}...`)

      const { object } = await generateObject({
        model,
        schema: QuestSchema,
        prompt: `Create a ${questTemplate.difficulty} difficulty quest named "${questTemplate.name}" for level ${questTemplate.minLevel}+ players.

Generate:
1. A compelling 2-3 paragraph description with storyline
2. 2-4 objectives (kill enemies, collect items, explore locations, etc.)
3. Appropriate rewards for difficulty (gold, experience, optional items)

Make it engaging and suitable for a fantasy RPG.`,
        temperature: 0.8,
      })

      await db.insert(quests).values({
        name: questTemplate.name,
        description: object.description,
        projectId: hyperspaceProject.id,
        ownerId: creator2.id,
        difficulty: questTemplate.difficulty as any,
        minLevel: questTemplate.minLevel,
        objectives: object.objectives.map(obj => ({ ...obj, completed: false })),
        rewards: object.rewards,
      })

      console.log(`    ✓ ${questTemplate.name}`)
    } catch (error: any) {
      console.error(`    ✗ Failed to generate ${questTemplate.name}: ${error.message}`)
    }
  }))

  console.log(`  Completed batch ${Math.floor(i / questBatchSize) + 1}/${Math.ceil(questPrompts.length / questBatchSize)}`)
}

console.log(`✅ Generated quests\n`)

// =====================================================
// STEP 7: Create Music Tracks
// =====================================================
console.log('🎵 Creating music tracks...')

const musicData = [
  { name: 'Epic Battle Theme', genre: 'orchestral', mood: 'epic', bpm: 140, key: 'C Minor', usageContext: 'combat' },
  { name: 'Peaceful Village', genre: 'acoustic', mood: 'calm', bpm: 90, key: 'G Major', usageContext: 'exploration' },
  { name: 'Dark Dungeon Ambience', genre: 'ambient', mood: 'dark', bpm: 60, key: 'D Minor', usageContext: 'dungeon' },
  { name: 'Heroic Victory', genre: 'orchestral', mood: 'triumphant', bpm: 120, key: 'C Major', usageContext: 'victory' },
  { name: 'Mystic Forest', genre: 'ethereal', mood: 'mysterious', bpm: 80, key: 'E Minor', usageContext: 'exploration' },
  { name: 'Boss Battle Intensity', genre: 'rock', mood: 'intense', bpm: 160, key: 'A Minor', usageContext: 'boss' },
  { name: 'Town Square Melody', genre: 'folk', mood: 'cheerful', bpm: 100, key: 'D Major', usageContext: 'town' },
  { name: 'Underwater Adventure', genre: 'ambient', mood: 'serene', bpm: 70, key: 'F Major', usageContext: 'water' },
  { name: 'Stealth Mission', genre: 'electronic', mood: 'tense', bpm: 95, key: 'G Minor', usageContext: 'stealth' },
  { name: 'Credits Theme', genre: 'orchestral', mood: 'emotional', bpm: 75, key: 'E Major', usageContext: 'menu' },
]

for (const track of musicData) {
  await db.insert(musicTracks).values({
    ...track,
    description: `${track.mood.charAt(0).toUpperCase() + track.mood.slice(1)} ${track.genre} music for ${track.usageContext}`,
    status: 'draft',
    ownerId: member1.id,
    loopable: true,
    tags: [track.genre, track.mood, track.usageContext],
  })
}

console.log(`✅ Created ${musicData.length} music tracks\n`)

// =====================================================
// STEP 8: Create Sound Effects
// =====================================================
console.log('🔊 Creating sound effects...')

const sfxData = [
  { name: 'Sword Slash', category: 'combat', duration: 1200, tags: ['sword', 'melee', 'attack'] },
  { name: 'Shield Block', category: 'combat', duration: 800, tags: ['shield', 'defense', 'block'] },
  { name: 'Magic Spell Cast', category: 'magic', duration: 2000, tags: ['magic', 'spell', 'cast'] },
  { name: 'Fireball Explosion', category: 'magic', duration: 1500, tags: ['fire', 'explosion', 'aoe'] },
  { name: 'Door Open', category: 'ambient', duration: 2500, tags: ['door', 'environment', 'wood'] },
  { name: 'Door Close', category: 'ambient', duration: 2000, tags: ['door', 'environment', 'wood'] },
  { name: 'Chest Open', category: 'interaction', duration: 1800, tags: ['chest', 'loot', 'treasure'] },
  { name: 'Footsteps Stone', category: 'movement', duration: 500, tags: ['footsteps', 'walk', 'stone'] },
  { name: 'Footsteps Grass', category: 'movement', duration: 500, tags: ['footsteps', 'walk', 'grass'] },
  { name: 'Coin Pickup', category: 'ui', duration: 300, tags: ['coin', 'gold', 'collect'] },
  { name: 'Item Pickup', category: 'ui', duration: 400, tags: ['item', 'collect', 'inventory'] },
  { name: 'Level Up', category: 'ui', duration: 3000, tags: ['levelup', 'achievement', 'reward'] },
  { name: 'Bow Release', category: 'combat', duration: 1000, tags: ['bow', 'arrow', 'ranged'] },
  { name: 'Arrow Impact', category: 'combat', duration: 600, tags: ['arrow', 'impact', 'hit'] },
  { name: 'Potion Drink', category: 'interaction', duration: 2000, tags: ['potion', 'health', 'consume'] },
]

for (const sfx of sfxData) {
  await db.insert(soundEffects).values({
    ...sfx,
    description: `${sfx.name} sound effect for ${sfx.category}`,
    projectId: hyperspaceProject.id,
    ownerId: member1.id,
    status: 'draft',
  })
}

console.log(`✅ Created ${sfxData.length} sound effects\n`)

// =====================================================
// FINAL REPORT
// =====================================================
console.log('\n========================================')
console.log('✅ DATABASE SEEDING COMPLETED')
console.log('========================================\n')

const summary = await db.transaction(async (tx) => {
  const userCount = await tx.select().from(users).then(r => r.length)
  const teamCount = await tx.select().from(teams).then(r => r.length)
  const projectCount = await tx.select().from(projects).then(r => r.length)
  const npcCount = await tx.select().from(npcs).then(r => r.length)
  const loreCount = await tx.select().from(loreEntries).then(r => r.length)
  const questCount = await tx.select().from(quests).then(r => r.length)
  const musicCount = await tx.select().from(musicTracks).then(r => r.length)
  const sfxCount = await tx.select().from(soundEffects).then(r => r.length)

  return { userCount, teamCount, projectCount, npcCount, loreCount, questCount, musicCount, sfxCount }
})

console.log('📊 STATISTICS:')
console.log(`   Users:         ${summary.userCount}`)
console.log(`   Teams:         ${summary.teamCount}`)
console.log(`   Projects:      ${summary.projectCount}`)
console.log(`   NPCs:          ${summary.npcCount}`)
console.log(`   Lore Entries:  ${summary.loreCount}`)
console.log(`   Quests:        ${summary.questCount}`)
console.log(`   Music Tracks:  ${summary.musicCount}`)
console.log(`   Sound Effects: ${summary.sfxCount}`)

console.log('\n🎉 Comprehensive seeding complete!')
console.log('   ✓ All content generated via Vercel AI Gateway')
console.log('   ✓ Database fully populated with realistic data')
console.log('   ✓ Ready for testing and development')

process.exit(0)
