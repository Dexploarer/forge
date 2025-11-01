// =====================================================
// PLAYTESTER PROMPTS
// =====================================================
// Prompt templates and parsing logic for AI playtester swarm

// =====================================================
// TYPES
// =====================================================

export type TesterArchetype = 'completionist' | 'casual' | 'breaker' | 'speedrunner' | 'explorer'
export type KnowledgeLevel = 'beginner' | 'intermediate' | 'expert'
export type BugSeverity = 'critical' | 'major' | 'minor'
export type TestRecommendation = 'pass' | 'pass_with_changes' | 'fail'
export type PacingRating = 'too_fast' | 'just_right' | 'too_slow' | 'unknown'

export interface TesterConfig {
  id: string
  name: string
  archetype: TesterArchetype
  knowledgeLevel: KnowledgeLevel
  persona?: {
    background?: string
    goals?: string[]
    playstyle?: string
  }
}

export interface BugReport {
  description: string
  severity: BugSeverity
  reproduction?: string
  reporter: string
  reportCount?: number
  reporters?: string[]
}

export interface TestResult {
  testerId: string
  testerName: string
  archetype: TesterArchetype
  knowledgeLevel: KnowledgeLevel
  success: boolean
  error?: string
  bugs: BugReport[]
  engagement: number // 1-10
  difficulty: number // 1-10
  completed: boolean
  playthrough: string
  confusionPoints: string[]
  feedback: string
  recommendation: TestRecommendation
  rawResponse: string
  pacing: PacingRating
}

export interface AggregatedMetrics {
  totalTests: number
  completionRate: number
  averageDifficulty: number
  difficultyByLevel: Record<KnowledgeLevel, { average: number; count: number }>
  averageEngagement: number
  engagementByArchetype: Record<TesterArchetype, { average: number; count: number }>
  pacing: Record<PacingRating, number>
  bugReports: BugReport[]
  uniqueBugs: number
  criticalBugs: number
  majorBugs: number
  minorBugs: number
  confusionPoints: string[]
  recommendations: Record<TestRecommendation, number>
}

// =====================================================
// TESTER PERSONA DEFINITIONS
// =====================================================

export const TESTER_PERSONAS: Record<TesterArchetype, Omit<TesterConfig, 'id' | 'name'>> = {
  completionist: {
    archetype: 'completionist',
    knowledgeLevel: 'expert',
    persona: {
      background: 'Experienced player who wants to see and do everything in the game',
      goals: ['Find all content', 'Complete all objectives', 'Discover hidden features'],
      playstyle: 'Thorough, methodical, checks every corner, reads all dialogue',
    },
  },
  casual: {
    archetype: 'casual',
    knowledgeLevel: 'beginner',
    persona: {
      background: 'New or infrequent player who plays for fun and relaxation',
      goals: ['Have fun', 'Not get stuck', 'Enjoy the story'],
      playstyle: 'Skims dialogue, follows main path, may miss optional content',
    },
  },
  breaker: {
    archetype: 'breaker',
    knowledgeLevel: 'expert',
    persona: {
      background: 'QA-minded player who actively seeks bugs and exploits',
      goals: ['Find bugs', 'Test edge cases', 'Break the game'],
      playstyle: 'Tries unusual actions, tests boundaries, looks for exploits',
    },
  },
  speedrunner: {
    archetype: 'speedrunner',
    knowledgeLevel: 'expert',
    persona: {
      background: 'Competitive player focused on completing content as fast as possible',
      goals: ['Find optimal path', 'Skip unnecessary content', 'Minimize time'],
      playstyle: 'Rushes through, skips dialogue, takes shortcuts',
    },
  },
  explorer: {
    archetype: 'explorer',
    knowledgeLevel: 'intermediate',
    persona: {
      background: 'Player who loves discovering lore and exploring the world',
      goals: ['Uncover lore', 'Explore everywhere', 'Find secrets'],
      playstyle: 'Reads all lore, talks to NPCs, explores off the beaten path',
    },
  },
}

// =====================================================
// PROMPT GENERATION
// =====================================================

export function makePlaytestPrompt(
  tester: TesterConfig,
  content: any,
  _config: any = {}
): string {
  const persona = tester.persona || TESTER_PERSONAS[tester.archetype].persona!

  return `You are ${tester.name}, a ${tester.archetype} playtester with ${tester.knowledgeLevel} knowledge level.

PERSONA:
${persona.background}

GOALS:
${persona.goals?.map(g => `- ${g}`).join('\n')}

PLAYSTYLE:
${persona.playstyle}

CONTENT TO TEST:
${JSON.stringify(content, null, 2)}

INSTRUCTIONS:
Play through this content as your persona would. Report your findings in the following format:

PLAYTHROUGH:
[Describe how you played through the content step by step]

BUGS FOUND:
[List any bugs, issues, or problems. Format: SEVERITY: Description]
- CRITICAL: [game-breaking bugs]
- MAJOR: [significant issues affecting gameplay]
- MINOR: [small issues or polish problems]

CONFUSION POINTS:
[List anything that was unclear or confusing]

ENGAGEMENT: [Rate 1-10, where 1=boring, 10=extremely engaging]
DIFFICULTY: [Rate 1-10, where 1=too easy, 10=too hard]
PACING: [too_fast, just_right, or too_slow]
COMPLETED: [yes or no - did you complete the content?]

FEEDBACK:
[Overall thoughts and suggestions for improvement]

RECOMMENDATION: [pass, pass_with_changes, or fail]

YOUR RESPONSE:`
}

// =====================================================
// RESULT PARSING
// =====================================================

export function parseTestResult(response: string, tester: TesterConfig): TestResult {
  const result: TestResult = {
    testerId: tester.id,
    testerName: tester.name,
    archetype: tester.archetype,
    knowledgeLevel: tester.knowledgeLevel,
    success: true,
    bugs: [],
    engagement: 5,
    difficulty: 5,
    completed: false,
    playthrough: '',
    confusionPoints: [],
    feedback: '',
    recommendation: 'pass_with_changes',
    rawResponse: response,
    pacing: 'unknown',
  }

  try {
    // Extract playthrough
    const playthroughMatch = response.match(/PLAYTHROUGH:\s*\n([\s\S]*?)(?=\n\nBUGS FOUND:|$)/i)
    if (playthroughMatch) {
      result.playthrough = playthroughMatch[1]!.trim()
    }

    // Extract bugs
    const bugsSection = response.match(/BUGS FOUND:\s*\n([\s\S]*?)(?=\n\nCONFUSION POINTS:|$)/i)
    if (bugsSection) {
      const bugText = bugsSection[1]!
      const criticalBugs = bugText.match(/CRITICAL:\s*(.+?)(?=\n|$)/gi) || []
      const majorBugs = bugText.match(/MAJOR:\s*(.+?)(?=\n|$)/gi) || []
      const minorBugs = bugText.match(/MINOR:\s*(.+?)(?=\n|$)/gi) || []

      criticalBugs.forEach(bug => {
        result.bugs.push({
          severity: 'critical',
          description: bug.replace(/^CRITICAL:\s*/i, '').trim(),
          reporter: tester.name,
        })
      })

      majorBugs.forEach(bug => {
        result.bugs.push({
          severity: 'major',
          description: bug.replace(/^MAJOR:\s*/i, '').trim(),
          reporter: tester.name,
        })
      })

      minorBugs.forEach(bug => {
        result.bugs.push({
          severity: 'minor',
          description: bug.replace(/^MINOR:\s*/i, '').trim(),
          reporter: tester.name,
        })
      })
    }

    // Extract confusion points
    const confusionMatch = response.match(/CONFUSION POINTS:\s*\n([\s\S]*?)(?=\n\nENGAGEMENT:|$)/i)
    if (confusionMatch) {
      const points = confusionMatch[1]!.split('\n').filter(p => p.trim().startsWith('-'))
      result.confusionPoints = points.map(p => p.replace(/^-\s*/, '').trim())
    }

    // Extract engagement rating
    const engagementMatch = response.match(/ENGAGEMENT:\s*(\d+)/i)
    if (engagementMatch) {
      result.engagement = Math.min(10, Math.max(1, parseInt(engagementMatch[1]!)))
    }

    // Extract difficulty rating
    const difficultyMatch = response.match(/DIFFICULTY:\s*(\d+)/i)
    if (difficultyMatch) {
      result.difficulty = Math.min(10, Math.max(1, parseInt(difficultyMatch[1]!)))
    }

    // Extract pacing
    const pacingMatch = response.match(/PACING:\s*(too_fast|just_right|too_slow)/i)
    if (pacingMatch) {
      result.pacing = pacingMatch[1]!.toLowerCase() as PacingRating
    }

    // Extract completion status
    const completedMatch = response.match(/COMPLETED:\s*(yes|no)/i)
    if (completedMatch) {
      result.completed = completedMatch[1]!.toLowerCase() === 'yes'
    }

    // Extract feedback
    const feedbackMatch = response.match(/FEEDBACK:\s*\n([\s\S]*?)(?=\n\nRECOMMENDATION:|$)/i)
    if (feedbackMatch) {
      result.feedback = feedbackMatch[1]!.trim()
    }

    // Extract recommendation
    const recommendationMatch = response.match(/RECOMMENDATION:\s*(pass|pass_with_changes|fail)/i)
    if (recommendationMatch) {
      result.recommendation = recommendationMatch[1]!.toLowerCase() as TestRecommendation
    }
  } catch (error) {
    console.error('Error parsing test result:', error)
    result.success = false
    result.error = error instanceof Error ? error.message : 'Unknown parsing error'
  }

  return result
}

// =====================================================
// RECOMMENDATION GENERATION
// =====================================================

export function generateRecommendations(metrics: AggregatedMetrics): Array<{
  priority: string
  category: string
  message: string
  action: string
}> {
  const recommendations: Array<{
    priority: string
    category: string
    message: string
    action: string
  }> = []

  // Critical bugs
  if (metrics.criticalBugs > 0) {
    recommendations.push({
      priority: 'critical',
      category: 'bugs',
      message: `${metrics.criticalBugs} critical bug(s) found that prevent content completion`,
      action: 'Fix all critical bugs before release',
    })
  }

  // Difficulty issues
  if (metrics.averageDifficulty < 3) {
    recommendations.push({
      priority: 'high',
      category: 'difficulty',
      message: `Content is too easy (${metrics.averageDifficulty.toFixed(1)}/10)`,
      action: 'Increase difficulty by adding challenges or reducing hints',
    })
  } else if (metrics.averageDifficulty > 8) {
    recommendations.push({
      priority: 'high',
      category: 'difficulty',
      message: `Content is too difficult (${metrics.averageDifficulty.toFixed(1)}/10)`,
      action: 'Reduce difficulty or add more guidance',
    })
  }

  // Engagement issues
  if (metrics.averageEngagement < 6) {
    recommendations.push({
      priority: 'high',
      category: 'engagement',
      message: `Low engagement score (${metrics.averageEngagement.toFixed(1)}/10)`,
      action: 'Add more interesting mechanics, rewards, or story elements',
    })
  }

  // Completion rate
  if (metrics.completionRate < 50) {
    recommendations.push({
      priority: 'critical',
      category: 'completion',
      message: `Only ${metrics.completionRate.toFixed(0)}% of testers completed the content`,
      action: 'Investigate why players are unable to finish - may indicate blocking bugs or unclear objectives',
    })
  }

  // Pacing issues
  const totalPacing = metrics.pacing.too_fast + metrics.pacing.just_right + metrics.pacing.too_slow
  if (totalPacing > 0) {
    const tooSlowPct = (metrics.pacing.too_slow / totalPacing) * 100
    const tooFastPct = (metrics.pacing.too_fast / totalPacing) * 100

    if (tooSlowPct > 50) {
      recommendations.push({
        priority: 'medium',
        category: 'pacing',
        message: `${tooSlowPct.toFixed(0)}% of testers felt pacing was too slow`,
        action: 'Speed up progression or reduce repetitive content',
      })
    } else if (tooFastPct > 50) {
      recommendations.push({
        priority: 'medium',
        category: 'pacing',
        message: `${tooFastPct.toFixed(0)}% of testers felt pacing was too fast`,
        action: 'Add more content or slow down progression',
      })
    }
  }

  // Major bugs
  if (metrics.majorBugs > 0) {
    recommendations.push({
      priority: 'high',
      category: 'bugs',
      message: `${metrics.majorBugs} major bug(s) found affecting gameplay`,
      action: 'Address major bugs to improve player experience',
    })
  }

  // Confusion points
  if (metrics.confusionPoints.length > metrics.totalTests) {
    recommendations.push({
      priority: 'medium',
      category: 'clarity',
      message: `Players reported ${metrics.confusionPoints.length} confusion points`,
      action: 'Improve instructions, hints, or objective clarity',
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority]! - priorityOrder[b.priority]!
  })
}
