/**
 * Quest Fix Service
 * Fixes quests based on playtester feedback using AI and embedding context
 */

import { generateText } from 'ai'
import { promises as fs } from 'fs'
import path from 'path'
import type { AISDKService } from './ai-sdk.service'
import { ContentEmbedderService, type SimilarContent } from './content-embedder.service'

interface QuestObjective {
  type: string
  description: string
  target?: string
  count?: number
  location?: string
  optional?: boolean
}

interface QuestRewards {
  experience?: number
  gold?: number
  items?: Array<{ name?: string; itemId?: string; count?: number }>
}

interface Quest {
  id?: string
  title?: string
  description?: string
  difficulty?: string
  questGiver?: string
  objectives: QuestObjective[]
  rewards: QuestRewards
  [key: string]: any
}

interface BugReport {
  severity: string
  description: string
  reportCount?: number
}

interface Recommendation {
  priority: string
  message: string
  action?: string
}

interface PlaytestFindings {
  grade?: string
  gradeScore?: number
  recommendation?: string
  consensus?: string
  bugReports?: BugReport[]
  recommendations?: Recommendation[]
  completionRate?: string | number
  avgDifficulty?: string | number
  avgEngagement?: string | number
  pacing?: string
  confusionPoints?: string[]
}

interface FixResult {
  originalQuest: Quest
  fixedQuest: Quest
  changes: Array<{ field: string; oldValue: any; newValue: any; reason: string }>
  fixedIssues: {
    bugsFixed?: BugReport[]
    recommendationsApplied?: Recommendation[]
  }
  summary: string
  embeddings: {
    similarQuests: Array<{ id: string; similarity: number; preview: string }>
    contextUsed: boolean
  }
  metadata: {
    duration: number
    model: string
    temperature: number
    timestamp: string
  }
}

interface QuestFixOptions {
  useEmbeddings?: boolean
  model?: string | null
  temperature?: number
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class QuestFixService {
  private embedder: ContentEmbedderService
  private prompts: any = null

  constructor(
    private aiService: AISDKService
  ) {
    this.embedder = new ContentEmbedderService()
  }

  /**
   * Load quest fix prompts from JSON file
   */
  async loadPrompts(): Promise<any> {
    if (this.prompts) return this.prompts

    try {
      // Try Fastify app location first, fall back to Express app
      const possiblePaths = [
        path.join(process.cwd(), 'public/prompts/quest-fix-prompts.json'),
        path.join(process.cwd(), '../api/public/prompts/quest-fix-prompts.json'),
        path.join(process.cwd(), '../../public/prompts/quest-fix-prompts.json'),
      ]

      let data: string | null = null
      for (const promptsPath of possiblePaths) {
        try {
          data = await fs.readFile(promptsPath, 'utf-8')
          console.log(`[QuestFixService] Loaded prompts from ${promptsPath}`)
          break
        } catch {
          continue
        }
      }

      if (!data) {
        throw new Error('Prompts file not found in any expected location')
      }

      this.prompts = JSON.parse(data)
      return this.prompts
    } catch (error: any) {
      console.error('[QuestFixService] Failed to load prompts:', error.message)
      throw new Error('Failed to load quest fix prompts')
    }
  }

  /**
   * Build prompt context from playtester findings
   */
  buildPromptContext(quest: Quest, playtestFindings: PlaytestFindings, similarQuests: SimilarContent[] = []): { systemPrompt: string; userPrompt: string } {
    const prompts = this.prompts.fixQuestFromPlaytestFeedback

    // Format objectives
    const objectivesText = quest.objectives
      .map((obj, idx) => {
        const parts = [
          `${idx + 1}. [${obj.type.toUpperCase()}] ${obj.description}`,
          obj.target ? `   Target: ${obj.target}` : '',
          obj.count ? `   Count: ${obj.count}` : '',
          obj.location ? `   Location: ${obj.location}` : '',
          obj.optional ? '   (Optional)' : ''
        ].filter(Boolean)
        return parts.join('\n')
      })
      .join('\n\n')

    // Format rewards
    const rewardsText = [
      `- Experience: ${quest.rewards.experience || 0} XP`,
      `- Gold: ${quest.rewards.gold || 0}`,
      quest.rewards.items && quest.rewards.items.length > 0
        ? `- Items: ${quest.rewards.items.map(i => `${i.count || 1}x ${i.name || i.itemId}`).join(', ')}`
        : null
    ].filter(Boolean).join('\n')

    // Format bug reports
    const bugReportsText = playtestFindings.bugReports && playtestFindings.bugReports.length > 0
      ? playtestFindings.bugReports
          .map(bug => `[${bug.severity.toUpperCase()}] ${bug.description}${bug.reportCount && bug.reportCount > 1 ? ` (reported ${bug.reportCount}x)` : ''}`)
          .join('\n')
      : 'No bugs reported'

    // Format recommendations
    const recommendationsText = playtestFindings.recommendations && playtestFindings.recommendations.length > 0
      ? playtestFindings.recommendations
          .map(rec => `[${rec.priority.toUpperCase()}] ${rec.message}${rec.action ? `\n  Action: ${rec.action}` : ''}`)
          .join('\n\n')
      : 'No specific recommendations'

    // Format confusion points
    const confusionPointsText = playtestFindings.confusionPoints && playtestFindings.confusionPoints.length > 0
      ? playtestFindings.confusionPoints
          .map((point, idx) => `${idx + 1}. ${point}`)
          .join('\n')
      : 'No confusion points reported'

    // Format similar quests context
    const similarQuestsContext = similarQuests.length > 0
      ? similarQuests.map((q, idx) => {
          return `### Similar Quest ${idx + 1} (${Math.round(q.similarity * 100)}% relevant)\n${q.content}`
        }).join('\n\n')
      : ''

    // Build final prompt
    let prompt = prompts.userPrompt
      .replace('{{questTitle}}', quest.title || 'Untitled Quest')
      .replace('{{questDescription}}', quest.description || 'No description')
      .replace('{{questDifficulty}}', quest.difficulty || 'medium')
      .replace('{{questGiver}}', quest.questGiver || 'Unknown NPC')
      .replace('{{questObjectives}}', objectivesText)
      .replace('{{questRewards}}', rewardsText)
      .replace('{{playtestGrade}}', playtestFindings.grade || 'N/A')
      .replace('{{playtestScore}}', String(playtestFindings.gradeScore || 0))
      .replace('{{playtestRecommendation}}', playtestFindings.recommendation || 'unknown')
      .replace('{{playtestConsensus}}', playtestFindings.consensus || 'No consensus')
      .replace('{{bugReports}}', bugReportsText)
      .replace('{{recommendations}}', recommendationsText)
      .replace('{{completionRate}}', String(playtestFindings.completionRate || 'N/A'))
      .replace('{{avgDifficulty}}', String(playtestFindings.avgDifficulty || 'N/A'))
      .replace('{{targetDifficulty}}', quest.difficulty === 'easy' ? '3-4' : quest.difficulty === 'hard' ? '7-8' : '5-6')
      .replace('{{avgEngagement}}', String(playtestFindings.avgEngagement || 'N/A'))
      .replace('{{pacing}}', playtestFindings.pacing || 'unknown')
      .replace('{{confusionPoints}}', confusionPointsText)

    // Handle conditional similar quests section
    if (similarQuests.length > 0) {
      prompt = prompt.replace('{{#if hasSimilarQuests}}', '')
        .replace('{{/if}}', '')
        .replace('{{similarQuestsContext}}', similarQuestsContext)
    } else {
      // Remove the conditional section
      const startMarker = '{{#if hasSimilarQuests}}'
      const endMarker = '{{/if}}'
      const start = prompt.indexOf(startMarker)
      const end = prompt.indexOf(endMarker)
      if (start !== -1 && end !== -1) {
        prompt = prompt.substring(0, start) + prompt.substring(end + endMarker.length)
      }
    }

    return {
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompt
    }
  }

  /**
   * Find similar successful quests for context
   */
  async findSimilarSuccessfulQuests(quest: Quest, limit: number = 3): Promise<SimilarContent[]> {
    try {
      // Build search query from quest
      const searchQuery = [
        quest.title,
        quest.description,
        quest.objectives.map(o => o.description).join(', ')
      ].filter(Boolean).join('\n')

      // Search for similar quests
      const similarQuests = await this.embedder.findSimilar(searchQuery, {
        contentType: 'quest',
        limit: limit * 2, // Get more to filter for successful ones
        threshold: 0.6
      })

      // Filter for successful quests (would need grade in metadata)
      // For now, just return top similar quests
      return similarQuests.slice(0, limit)
    } catch (error: any) {
      console.warn('[QuestFixService] Failed to find similar quests:', error.message)
      return []
    }
  }

  /**
   * Fix a quest based on playtester feedback
   */
  async fixQuest(quest: Quest, playtestFindings: PlaytestFindings, options: QuestFixOptions = {}): Promise<FixResult> {
    const startTime = Date.now()

    const {
      useEmbeddings = true,
      model = null,
      temperature = 0.3
    } = options

    console.log(`[QuestFixService] Fixing quest: ${quest.title || quest.id}`)

    try {
      // Load prompts
      await this.loadPrompts()

      // Find similar successful quests for context
      let similarQuests: SimilarContent[] = []
      if (useEmbeddings) {
        console.log('[QuestFixService] Finding similar successful quests...')
        similarQuests = await this.findSimilarSuccessfulQuests(quest)
        console.log(`[QuestFixService] Found ${similarQuests.length} similar quests`)
      }

      // Build prompt context
      const { systemPrompt, userPrompt } = this.buildPromptContext(
        quest,
        playtestFindings,
        similarQuests
      )

      // Get configured model
      const aiModel = model
        ? await this.aiService.getModel(
            model.replace(/^(openai|anthropic)\//, ''),
            (model.startsWith('openai') ? 'openai' : 'anthropic') as 'openai' | 'anthropic'
          )
        : await this.aiService.getConfiguredModel('quest-generation', 'gpt-4', 'openai')

      console.log('[QuestFixService] Generating quest fixes with AI...')

      // Generate fixes with AI
      const result = await generateText({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        temperature
      })

      const duration = Date.now() - startTime

      console.log(`[QuestFixService] Quest fixes generated (${duration}ms)`)

      // Parse AI response
      let fixResult: any
      try {
        // Try to extract JSON from markdown code blocks if present
        let responseText = result.text.trim()
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                         responseText.match(/```\n([\s\S]*?)\n```/)

        if (jsonMatch) {
          responseText = jsonMatch[1]!
        }

        fixResult = JSON.parse(responseText)
      } catch (parseError: any) {
        console.error('[QuestFixService] Failed to parse AI response:', parseError.message)
        console.error('[QuestFixService] Raw response:', result.text.substring(0, 500))
        throw new Error('AI returned invalid JSON response')
      }

      // Validate response structure
      if (!fixResult.fixedQuest || !fixResult.changes) {
        throw new Error('AI response missing required fields (fixedQuest, changes)')
      }

      // Return complete result
      return {
        originalQuest: quest,
        fixedQuest: fixResult.fixedQuest,
        changes: fixResult.changes || [],
        fixedIssues: fixResult.fixedIssues || { bugsFixed: [], recommendationsApplied: [] },
        summary: fixResult.summary || 'Quest fixed based on playtester feedback',
        embeddings: {
          similarQuests: similarQuests.map(q => ({
            id: q.contentId,
            similarity: q.similarity,
            preview: q.content.substring(0, 200)
          })),
          contextUsed: similarQuests.length > 0
        },
        metadata: {
          duration,
          model: aiModel.modelId || 'unknown',
          temperature,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error: any) {
      console.error('[QuestFixService] Failed to fix quest:', error.message)
      console.error('[QuestFixService] Error stack:', error.stack)
      throw error
    }
  }

  /**
   * Validate fixed quest
   */
  validateFixedQuest(fixResult: Pick<FixResult, 'fixedQuest' | 'changes'>): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const { fixedQuest, changes } = fixResult

    // Check required fields
    if (!fixedQuest.title || fixedQuest.title.trim() === '') {
      errors.push('Fixed quest missing title')
    }

    if (!fixedQuest.objectives || fixedQuest.objectives.length === 0) {
      errors.push('Fixed quest has no objectives')
    }

    // Check objectives structure
    if (fixedQuest.objectives) {
      fixedQuest.objectives.forEach((obj, idx) => {
        if (!obj.description || obj.description.trim() === '') {
          errors.push(`Objective ${idx + 1} missing description`)
        }
        if (!obj.type) {
          errors.push(`Objective ${idx + 1} missing type`)
        }
      })
    }

    // Check rewards
    if (!fixedQuest.rewards) {
      warnings.push('Fixed quest missing rewards structure')
    } else {
      if (!fixedQuest.rewards.experience && !fixedQuest.rewards.gold && !fixedQuest.rewards.items) {
        warnings.push('Fixed quest has no rewards')
      }
    }

    // Check changes are documented
    if (!changes || changes.length === 0) {
      warnings.push('No changes documented - quest might be identical to original')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
