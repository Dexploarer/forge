// =====================================================
// COLLABORATION PROMPTS
// =====================================================
// Prompt templates for NPC collaboration and multi-agent content generation

export interface CollaborationContext {
  topic: string
  participants: Array<{
    id: string
    name: string
    role: string
  }>
  goal: string
  constraints?: string[]
}

export interface DialogueCollaborationContext extends CollaborationContext {
  setting: string
  tone: string
  characterRelationships?: Record<string, string>
}

/**
 * Generate system prompt for NPC collaboration
 */
export function makeNPCCollaborationPrompt(
  npcName: string,
  npcRole: string,
  context: CollaborationContext
): string {
  return `You are ${npcName}, a ${npcRole} in a fantasy RPG game.

COLLABORATION CONTEXT:
Topic: ${context.topic}
Goal: ${context.goal}

OTHER PARTICIPANTS:
${context.participants.filter(p => p.name !== npcName).map(p => `- ${p.name} (${p.role})`).join('\n')}

${context.constraints && context.constraints.length > 0 ? `CONSTRAINTS:
${context.constraints.map(c => `- ${c}`).join('\n')}` : ''}

INSTRUCTIONS:
You are participating in a collaborative conversation to ${context.goal}. Stay in character as ${npcName}, drawing on your role as ${npcRole}. Contribute your unique perspective and expertise to the discussion.

When you're done contributing or want to hand off to another participant, end your response with: [HANDOFF: reason]

If the conversation should end naturally, include: [END_CONVERSATION]

YOUR CONTRIBUTION:`
}

/**
 * Generate dialogue collaboration prompt for character interactions
 */
export function makeDialogueCollaborationPrompt(
  npcName: string,
  npcRole: string,
  context: DialogueCollaborationContext
): string {
  const relationshipInfo = context.characterRelationships?.[npcName]
    ? `\nYOUR RELATIONSHIPS:\n${context.characterRelationships[npcName]}`
    : ''

  return `You are ${npcName}, a ${npcRole} in a fantasy RPG game.

SCENE SETTING:
${context.setting}

TONE: ${context.tone}

COLLABORATION GOAL:
${context.goal}

OTHER CHARACTERS PRESENT:
${context.participants.filter(p => p.name !== npcName).map(p => `- ${p.name} (${p.role})`).join('\n')}
${relationshipInfo}

${context.constraints && context.constraints.length > 0 ? `CONSTRAINTS:
${context.constraints.map(c => `- ${c}`).join('\n')}` : ''}

INSTRUCTIONS:
Create dialogue for ${npcName} that fits the scene and advances the conversation naturally. Stay true to your character's personality and role. The dialogue should feel authentic to a ${context.tone} tone.

When you're done speaking or want another character to respond, end with: [HANDOFF]

If the scene should end, include: [END_CONVERSATION]

YOUR DIALOGUE:`
}

/**
 * Generate quest collaboration prompt for multi-NPC quest design
 */
export function makeQuestCollaborationPrompt(
  npcName: string,
  npcRole: string,
  questContext: {
    theme: string
    difficulty: string
    location: string
    participants: Array<{ id: string; name: string; role: string }>
  }
): string {
  return `You are ${npcName}, a ${npcRole}, collaborating with other NPCs to design a ${questContext.difficulty} quest.

QUEST THEME: ${questContext.theme}
QUEST LOCATION: ${questContext.location}
DIFFICULTY: ${questContext.difficulty}

COLLABORATORS:
${questContext.participants.filter(p => p.name !== npcName).map(p => `- ${p.name} (${p.role})`).join('\n')}

INSTRUCTIONS:
As ${npcName}, contribute your ideas for this quest from your unique perspective as ${npcRole}. Consider:
- What objectives would make sense for your character?
- What rewards could you offer?
- What challenges fit the ${questContext.difficulty} difficulty?
- How does this quest relate to ${questContext.location}?

Share your ideas in a natural, conversational way. Build on what others have suggested.

When you're done contributing, end with: [HANDOFF: brief reason]

YOUR INPUT:`
}

/**
 * Generate lore collaboration prompt for world-building
 */
export function makeLoreCollaborationPrompt(
  npcName: string,
  npcRole: string,
  loreContext: {
    topic: string
    historicalPeriod?: string
    region?: string
    participants: Array<{ id: string; name: string; role: string }>
  }
): string {
  return `You are ${npcName}, a ${npcRole} with knowledge about ${loreContext.topic}.

LORE TOPIC: ${loreContext.topic}
${loreContext.historicalPeriod ? `HISTORICAL PERIOD: ${loreContext.historicalPeriod}` : ''}
${loreContext.region ? `REGION: ${loreContext.region}` : ''}

OTHER LORE KEEPERS:
${loreContext.participants.filter(p => p.name !== npcName).map(p => `- ${p.name} (${p.role})`).join('\n')}

INSTRUCTIONS:
As ${npcName}, share your knowledge and perspective on ${loreContext.topic}. Draw from your experience as ${npcRole}. Your contribution should:
- Add depth and detail to the world
- Be consistent with the fantasy RPG setting
- Build on or complement what others have shared
- Feel authentic to your character's perspective

When you've finished your contribution, end with: [HANDOFF]

SHARE YOUR LORE:`
}

/**
 * Generate item collaboration prompt for item design
 */
export function makeItemCollaborationPrompt(
  npcName: string,
  npcRole: string,
  itemContext: {
    itemType: string
    rarity: string
    purpose: string
    participants: Array<{ id: string; name: string; role: string }>
  }
): string {
  return `You are ${npcName}, a ${npcRole} collaborating to design a ${itemContext.rarity} ${itemContext.itemType}.

ITEM TYPE: ${itemContext.itemType}
RARITY: ${itemContext.rarity}
PURPOSE: ${itemContext.purpose}

DESIGN TEAM:
${itemContext.participants.filter(p => p.name !== npcName).map(p => `- ${p.name} (${p.role})`).join('\n')}

INSTRUCTIONS:
As ${npcName} (${npcRole}), contribute your ideas for this item's:
- Name and appearance
- Stats or abilities
- Lore and backstory
- How it fits the ${itemContext.rarity} rarity tier

Build on suggestions from other designers. Make it interesting and balanced for a fantasy RPG.

When done contributing, end with: [HANDOFF]

YOUR DESIGN IDEAS:`
}

/**
 * Extract handoff signals from agent responses
 */
export function detectCollaborationHandoff(response: string): {
  shouldEnd: boolean
  shouldHandoff: boolean
  handoffReason: string | undefined
} {
  const endMatch = response.match(/\[END_CONVERSATION\]/i)
  const handoffMatch = response.match(/\[HANDOFF(?::?\s*([^\]]+))?\]/i)

  return {
    shouldEnd: !!endMatch,
    shouldHandoff: !!handoffMatch,
    handoffReason: handoffMatch ? (handoffMatch[1]?.trim() || 'natural flow') : undefined,
  }
}

/**
 * Clean agent response by removing control signals
 */
export function cleanCollaborationResponse(response: string): string {
  return response
    .replace(/\[END_CONVERSATION\]/gi, '')
    .replace(/\[HANDOFF(?::?\s*[^\]]+)?\]/gi, '')
    .trim()
}
