// =====================================================
// NPC GENERATOR TYPES
// =====================================================

export interface Stats {
  health: number
  armor: number
  damage: number
  level: number
}

export interface LootTable {
  items: Array<{
    itemId: string
    itemName: string
    dropChance: number
    minQuantity: number
    maxQuantity: number
  }>
}

// =====================================================
// STAT GENERATION
// =====================================================

/**
 * Generate NPC stats based on level and class
 * Uses balanced formulas for different classes
 */
export function generateNPCStats(level: number, npcClass: string): Stats {
  // Base stats at level 1
  const baseHealth = 100
  const baseArmor = 10
  const baseDamage = 10

  // Class multipliers
  const classMultipliers: Record<string, { health: number; armor: number; damage: number }> = {
    warrior: { health: 1.5, armor: 1.5, damage: 1.0 },
    tank: { health: 2.0, armor: 2.0, damage: 0.8 },
    rogue: { health: 0.8, armor: 0.7, damage: 1.5 },
    assassin: { health: 0.7, armor: 0.6, damage: 1.8 },
    mage: { health: 0.7, armor: 0.5, damage: 1.6 },
    healer: { health: 1.0, armor: 0.8, damage: 0.7 },
    ranger: { health: 1.0, armor: 0.9, damage: 1.3 },
    paladin: { health: 1.3, armor: 1.4, damage: 1.1 },
    necromancer: { health: 0.8, armor: 0.6, damage: 1.4 },
    berserker: { health: 1.2, armor: 0.8, damage: 1.7 },
    default: { health: 1.0, armor: 1.0, damage: 1.0 },
  }

  // Get multipliers for the class (or use default)
  const multipliers = classMultipliers[npcClass.toLowerCase()] || classMultipliers.default!

  // Calculate level scaling
  const levelScaling = 1 + (level - 1) * 0.15 // 15% increase per level

  // Calculate final stats
  const health = Math.floor(baseHealth * multipliers.health * levelScaling)
  const armor = Math.floor(baseArmor * multipliers.armor * levelScaling)
  const damage = Math.floor(baseDamage * multipliers.damage * levelScaling)

  return {
    health,
    armor,
    damage,
    level,
  }
}

// =====================================================
// LOOT TABLE GENERATION
// =====================================================

/**
 * Generate a loot table based on NPC level and rarity
 * Higher level and rarity = better loot
 */
export function generateLootTable(level: number, rarity: string): LootTable {
  // Rarity multipliers for drop chances
  const rarityMultipliers: Record<string, number> = {
    common: 1.0,
    uncommon: 0.7,
    rare: 0.4,
    epic: 0.15,
    legendary: 0.05,
  }

  const rarityMultiplier = rarityMultipliers[rarity.toLowerCase()] || rarityMultipliers.common!

  // Base loot templates
  const lootTemplates = [
    {
      itemId: 'gold_coins',
      itemName: 'Gold Coins',
      dropChance: 0.9 * rarityMultiplier,
      minQuantity: level * 5,
      maxQuantity: level * 15,
    },
    {
      itemId: 'health_potion',
      itemName: 'Health Potion',
      dropChance: 0.6 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: Math.min(3, Math.floor(level / 5) + 1),
    },
    {
      itemId: 'mana_potion',
      itemName: 'Mana Potion',
      dropChance: 0.5 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: Math.min(3, Math.floor(level / 5) + 1),
    },
  ]

  // Add equipment drops based on level
  if (level >= 5) {
    lootTemplates.push({
      itemId: `weapon_tier_${Math.floor(level / 10) + 1}`,
      itemName: `Tier ${Math.floor(level / 10) + 1} Weapon`,
      dropChance: 0.15 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: 1,
    })
  }

  if (level >= 10) {
    lootTemplates.push({
      itemId: `armor_tier_${Math.floor(level / 10) + 1}`,
      itemName: `Tier ${Math.floor(level / 10) + 1} Armor`,
      dropChance: 0.12 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: 1,
    })
  }

  if (level >= 15) {
    lootTemplates.push({
      itemId: 'rare_crafting_material',
      itemName: 'Rare Crafting Material',
      dropChance: 0.25 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: Math.floor(level / 10),
    })
  }

  if (level >= 20) {
    lootTemplates.push({
      itemId: 'enchantment_scroll',
      itemName: 'Enchantment Scroll',
      dropChance: 0.08 * rarityMultiplier,
      minQuantity: 1,
      maxQuantity: 1,
    })
  }

  // Cap drop chances at 1.0
  const items = lootTemplates.map(item => ({
    ...item,
    dropChance: Math.min(item.dropChance, 1.0),
  }))

  return { items }
}

// =====================================================
// DIALOG GENERATION
// =====================================================

/**
 * Generate basic dialog tree for an NPC based on behavior
 */
export function generateBasicDialog(
  npcName: string,
  behavior: string
): Array<{
  id: string
  trigger?: string
  text: string
  responses?: Array<{ text: string; nextId?: string }>
}> {
  const dialogs: Array<{
    id: string
    trigger?: string
    text: string
    responses?: Array<{ text: string; nextId?: string }>
  }> = []

  switch (behavior.toLowerCase()) {
    case 'friendly':
      dialogs.push({
        id: 'greeting',
        trigger: 'onInteract',
        text: `Hello traveler! I'm ${npcName}. How can I help you today?`,
        responses: [
          { text: 'Tell me about yourself', nextId: 'about' },
          { text: 'Do you have any quests?', nextId: 'quests' },
          { text: 'Goodbye', nextId: 'farewell' },
        ],
      })
      dialogs.push({
        id: 'about',
        text: `I've lived in these parts for many years. It's a peaceful place, though we sometimes have troubles.`,
        responses: [
          { text: 'What kind of troubles?', nextId: 'troubles' },
          { text: 'Interesting. Anything else?', nextId: 'greeting' },
        ],
      })
      dialogs.push({
        id: 'quests',
        text: 'Not at the moment, but check back later!',
        responses: [{ text: 'Okay, thanks!', nextId: 'farewell' }],
      })
      dialogs.push({
        id: 'farewell',
        text: 'Safe travels, friend!',
      })
      break

    case 'merchant':
      dialogs.push({
        id: 'greeting',
        trigger: 'onInteract',
        text: `Welcome! ${npcName}'s shop has the finest goods in the land. What can I get for you?`,
        responses: [
          { text: 'Show me your wares', nextId: 'shop' },
          { text: 'Do you buy items?', nextId: 'buying' },
          { text: 'Just browsing', nextId: 'farewell' },
        ],
      })
      dialogs.push({
        id: 'shop',
        text: 'Here are my current offerings. Take your time!',
      })
      dialogs.push({
        id: 'buying',
        text: 'Yes, I buy certain items at fair prices. Show me what you have.',
      })
      dialogs.push({
        id: 'farewell',
        text: 'Come back anytime!',
      })
      break

    case 'hostile':
      dialogs.push({
        id: 'greeting',
        trigger: 'onInteract',
        text: 'You dare approach me? Prepare to fight!',
      })
      break

    case 'neutral':
    default:
      dialogs.push({
        id: 'greeting',
        trigger: 'onInteract',
        text: `I'm ${npcName}. I'm busy right now.`,
        responses: [
          { text: 'Can I ask you something?', nextId: 'ask' },
          { text: 'Sorry to bother you', nextId: 'farewell' },
        ],
      })
      dialogs.push({
        id: 'ask',
        text: 'Make it quick.',
        responses: [{ text: 'Never mind', nextId: 'farewell' }],
      })
      dialogs.push({
        id: 'farewell',
        text: 'Goodbye.',
      })
      break
  }

  return dialogs
}
