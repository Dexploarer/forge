/**
 * AI Playtester Swarm Orchestrator
 *
 * Coordinates multiple AI agents acting as synthetic players to test game content.
 * Generates automated bug reports, engagement predictions, and difficulty assessments.
 *
 * NEW FEATURES:
 * - Auto-generate fixes from playtester feedback
 * - AI-powered fix suggestion system
 * - Automatic content improvement recommendations
 *
 * Features:
 * - Synthetic players with diverse playstyles
 * - Parallel testing across agent swarm
 * - Automated bug detection and reporting
 * - Engagement and difficulty prediction
 * - Statistical correlation with human player performance
 *
 * Research Sources:
 * - arxiv.org/html/2509.22170v1 (LLM Agents for Automated Video Game Testing)
 * - arxiv.org/html/2507.09490v1 (Towards LLM-Based Automatic Playtest)
 * - arxiv.org/abs/2410.02829 (LLMs as Game Difficulty Testers)
 * - EA's Adversarial Reinforcement Learning for Procedural Content Generation
 */

import { generateText } from 'ai'
import { AISDKService } from './ai-sdk.service'
import {
  type TesterConfig,
  type TestResult,
  type AggregatedMetrics,
  type BugReport,
  type BugSeverity,
  type TestRecommendation,
  type PacingRating,
  makePlaytestPrompt,
  parseTestResult,
  generateRecommendations,
} from '../utils/playtester-prompts'

// =====================================================
// TYPES
// =====================================================

export interface TesterState extends TesterConfig {
  testsCompleted: number
  bugsFound: number
  averageEngagement: number
}

export interface SwarmTestConfig {
  parallel?: boolean
  temperature?: number
  autoGenerateFixes?: boolean // NEW: Enable auto-fix generation
}

export interface TestConsensus {
  recommendation: TestRecommendation
  confidence: number
  agreement: 'strong' | 'moderate' | 'weak'
  summary: string
}

export interface SwarmTestResult {
  testCount: number
  individualResults: TestResult[]
  aggregatedMetrics: AggregatedMetrics
  consensus: TestConsensus
  recommendations: Array<{
    priority: string
    category: string
    message: string
    action: string
  }>
  autoFixes?: AutoFixResult[] // NEW: Auto-generated fixes
}

export interface BugFix {
  bugDescription: string
  severity: BugSeverity
  suggestedFix: string
  codeChanges?: string
  rationale: string
  confidence: number
}

export interface AutoFixResult {
  category: 'bugs' | 'difficulty' | 'engagement' | 'pacing' | 'completion'
  fixes: BugFix[]
  summary: string
  appliedFixesCount: number
}

// =====================================================
// SERVICE
// =====================================================

export class PlaytesterSwarmOrchestrator {
  private testers: Map<string, TesterState>
  private config: Required<SwarmTestConfig>
  private aiService: AISDKService

  constructor(config: SwarmTestConfig = {}) {
    this.testers = new Map()
    this.config = {
      parallel: config.parallel !== false,
      temperature: config.temperature || 0.7,
      autoGenerateFixes: config.autoGenerateFixes !== false, // NEW: Default to true
    }
    this.aiService = new AISDKService()
  }

  /**
   * Register a playtester agent with specific persona
   */
  registerTester(testerConfig: TesterConfig): void {
    if (!testerConfig.id || !testerConfig.name || !testerConfig.archetype) {
      throw new Error('Tester must have id, name, and archetype')
    }

    this.testers.set(testerConfig.id, {
      ...testerConfig,
      testsCompleted: 0,
      bugsFound: 0,
      averageEngagement: 0,
    })
  }

  /**
   * Run swarm playtest on content
   */
  async runSwarmPlaytest(
    contentToTest: any,
    testConfig: any = {}
  ): Promise<SwarmTestResult> {
    const testers = Array.from(this.testers.values())

    if (testers.length === 0) {
      throw new Error('No testers registered. Add testers before running playtest.')
    }

    console.log(`[PlaytesterSwarm] Running swarm playtest with ${testers.length} testers...`)

    // Run tests in parallel or sequential based on config
    let results: Array<PromiseSettledResult<TestResult> | { status: string; value: TestResult }>

    if (this.config.parallel) {
      const testPromises = testers.map(tester => this.runSingleTest(tester, contentToTest, testConfig))
      results = await Promise.allSettled(testPromises)
    } else {
      results = await this.runSequentialTests(testers, contentToTest, testConfig)
    }

    // Process results
    const successfulTests = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<TestResult>).value)

    // Aggregate metrics
    const aggregated = this.aggregateTestResults(successfulTests)

    // Update tester stats
    for (const result of successfulTests) {
      const tester = this.testers.get(result.testerId)
      if (tester) {
        tester.testsCompleted++
        tester.bugsFound += result.bugs.length
        tester.averageEngagement =
          (tester.averageEngagement * (tester.testsCompleted - 1) + result.engagement) /
          tester.testsCompleted
      }
    }

    const consensus = this.buildConsensus(successfulTests)
    const recommendations = generateRecommendations(aggregated)

    const swarmResult: SwarmTestResult = {
      testCount: successfulTests.length,
      individualResults: successfulTests,
      aggregatedMetrics: aggregated,
      consensus,
      recommendations,
    }

    // NEW: Auto-generate fixes if enabled
    if (this.config.autoGenerateFixes) {
      console.log('[PlaytesterSwarm] Generating automated fixes from feedback...')
      swarmResult.autoFixes = await this.generateAutoFixes(contentToTest, aggregated, successfulTests)
    }

    return swarmResult
  }

  /**
   * Run test with a single tester agent
   */
  private async runSingleTest(
    tester: TesterState,
    content: any,
    testConfig: any
  ): Promise<TestResult> {
    console.log(`[PlaytesterSwarm] [${tester.name}] Starting playtest...`)

    const testPrompt = makePlaytestPrompt(tester, content, testConfig)

    try {
      const model = await this.aiService.getConfiguredModel(
        'quest_generation',
        this.config.temperature.toString(),
        'openai'
      )

      const response = await generateText({
        model,
        prompt: testPrompt,
        temperature: this.config.temperature,
      })

      // Parse test results from response
      const testResult = parseTestResult(response.text, tester)

      console.log(
        `[PlaytesterSwarm] [${tester.name}] Completed. Found ${testResult.bugs.length} issues, engagement: ${testResult.engagement}/10`
      )

      return testResult
    } catch (error) {
      console.error(`[PlaytesterSwarm] [${tester.name}] Test failed:`, error)
      return {
        testerId: tester.id,
        testerName: tester.name,
        archetype: tester.archetype,
        knowledgeLevel: tester.knowledgeLevel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        bugs: [],
        engagement: 0,
        difficulty: 0,
        completed: false,
        playthrough: '',
        confusionPoints: [],
        feedback: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendation: 'fail',
        rawResponse: '',
        pacing: 'unknown',
      }
    }
  }

  /**
   * Run tests sequentially (for testing or low resource environments)
   */
  private async runSequentialTests(
    testers: TesterState[],
    content: any,
    testConfig: any
  ): Promise<Array<{ status: string; value: TestResult }>> {
    const results: Array<{ status: string; value: TestResult }> = []

    for (const tester of testers) {
      const result = await this.runSingleTest(tester, content, testConfig)
      results.push({ status: 'fulfilled', value: result })
    }

    return results
  }

  /**
   * Aggregate results from multiple testers
   */
  private aggregateTestResults(results: TestResult[]): AggregatedMetrics {
    const aggregated: AggregatedMetrics = {
      totalTests: results.length,
      completionRate: 0,
      averageDifficulty: 0,
      difficultyByLevel: {
        beginner: { average: 0, count: 0 },
        intermediate: { average: 0, count: 0 },
        expert: { average: 0, count: 0 },
      },
      averageEngagement: 0,
      engagementByArchetype: {
        completionist: { average: 0, count: 0 },
        casual: { average: 0, count: 0 },
        breaker: { average: 0, count: 0 },
        speedrunner: { average: 0, count: 0 },
        explorer: { average: 0, count: 0 },
      },
      pacing: { too_fast: 0, just_right: 0, too_slow: 0, unknown: 0 },
      bugReports: [],
      uniqueBugs: 0,
      criticalBugs: 0,
      majorBugs: 0,
      minorBugs: 0,
      confusionPoints: [],
      recommendations: { pass: 0, pass_with_changes: 0, fail: 0 },
    }

    if (results.length === 0) {
      return aggregated
    }

    // Calculate completion rate
    const completed = results.filter(r => r.completed).length
    aggregated.completionRate = (completed / results.length) * 100

    // Calculate average difficulty
    const difficulties = results.map(r => r.difficulty).filter(d => d > 0)
    aggregated.averageDifficulty =
      difficulties.length > 0
        ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
        : 0

    // Difficulty by knowledge level
    for (const result of results) {
      if (!aggregated.difficultyByLevel[result.knowledgeLevel]) {
        aggregated.difficultyByLevel[result.knowledgeLevel] = { average: 0, count: 0 }
      }
      const levelData = aggregated.difficultyByLevel[result.knowledgeLevel]!
      levelData.average =
        (levelData.average * levelData.count + result.difficulty) / (levelData.count + 1)
      levelData.count++
    }

    // Calculate average engagement
    const engagements = results.map(r => r.engagement).filter(e => e > 0)
    aggregated.averageEngagement =
      engagements.length > 0
        ? engagements.reduce((sum, e) => sum + e, 0) / engagements.length
        : 0

    // Engagement by archetype
    for (const result of results) {
      if (!aggregated.engagementByArchetype[result.archetype]) {
        aggregated.engagementByArchetype[result.archetype] = { average: 0, count: 0 }
      }
      const archetypeData = aggregated.engagementByArchetype[result.archetype]!
      archetypeData.average =
        (archetypeData.average * archetypeData.count + result.engagement) /
        (archetypeData.count + 1)
      archetypeData.count++
    }

    // Aggregate pacing
    for (const result of results) {
      if (result.pacing in aggregated.pacing) {
        aggregated.pacing[result.pacing as PacingRating]++
      }
    }

    // Collect all bugs
    const allBugs: BugReport[] = []
    for (const result of results) {
      for (const bug of result.bugs) {
        allBugs.push(bug)

        // Count by severity
        if (bug.severity === 'critical') aggregated.criticalBugs++
        else if (bug.severity === 'major') aggregated.majorBugs++
        else aggregated.minorBugs++
      }
    }

    // Deduplicate similar bugs
    aggregated.bugReports = this.deduplicateBugs(allBugs)
    aggregated.uniqueBugs = aggregated.bugReports.length

    // Collect confusion points
    for (const result of results) {
      aggregated.confusionPoints.push(...result.confusionPoints)
    }

    // Aggregate recommendations
    for (const result of results) {
      aggregated.recommendations[result.recommendation]++
    }

    return aggregated
  }

  /**
   * Deduplicate similar bug reports
   */
  private deduplicateBugs(bugs: BugReport[]): BugReport[] {
    const unique: BugReport[] = []
    const seen = new Set<string>()

    for (const bug of bugs) {
      // Simple deduplication: lowercase first 50 chars
      const key = bug.description.toLowerCase().slice(0, 50)

      if (!seen.has(key)) {
        seen.add(key)
        unique.push({
          ...bug,
          reportCount: 1,
          reporters: [bug.reporter],
        })
      } else {
        // Find existing bug and increment count
        const existing = unique.find(b => b.description.toLowerCase().slice(0, 50) === key)
        if (existing) {
          existing.reportCount = (existing.reportCount || 0) + 1
          if (!existing.reporters) existing.reporters = []
          if (!existing.reporters.includes(bug.reporter)) {
            existing.reporters.push(bug.reporter)
          }
          // Upgrade severity if higher
          const severityOrder: Record<BugSeverity, number> = {
            critical: 3,
            major: 2,
            minor: 1,
          }
          if (severityOrder[bug.severity] > severityOrder[existing.severity]) {
            existing.severity = bug.severity
          }
        }
      }
    }

    // Sort by report count (most reported first) then severity
    unique.sort((a, b) => {
      if ((b.reportCount || 0) !== (a.reportCount || 0)) {
        return (b.reportCount || 0) - (a.reportCount || 0)
      }
      const severityOrder: Record<BugSeverity, number> = { critical: 3, major: 2, minor: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })

    return unique
  }

  /**
   * Build consensus summary from test results
   */
  private buildConsensus(results: TestResult[]): TestConsensus {
    const totalTesters = results.length
    const passRate = results.filter(r => r.recommendation === 'pass').length / totalTesters
    const failRate = results.filter(r => r.recommendation === 'fail').length / totalTesters

    let consensusRecommendation: TestRecommendation = 'pass_with_changes'
    if (passRate >= 0.7) consensusRecommendation = 'pass'
    else if (failRate >= 0.5) consensusRecommendation = 'fail'

    const confidence = Math.max(passRate, failRate)
    const agreement = passRate >= 0.7 || failRate >= 0.5 ? 'strong' : passRate >= 0.5 || failRate >= 0.3 ? 'moderate' : 'weak'

    return {
      recommendation: consensusRecommendation,
      confidence,
      agreement,
      summary: this.generateConsensusSummary(results, consensusRecommendation),
    }
  }

  /**
   * Generate natural language consensus summary
   */
  private generateConsensusSummary(
    results: TestResult[],
    recommendation: TestRecommendation
  ): string {
    const totalTesters = results.length
    const completed = results.filter(r => r.completed).length
    const avgDifficulty = results.reduce((sum, r) => sum + r.difficulty, 0) / totalTesters
    const avgEngagement = results.reduce((sum, r) => sum + r.engagement, 0) / totalTesters
    const totalBugs = results.reduce((sum, r) => sum + r.bugs.length, 0)

    return (
      `${totalTesters} AI playtesters evaluated this content. ` +
      `${completed} of ${totalTesters} completed it successfully. ` +
      `Average difficulty was ${avgDifficulty.toFixed(1)}/10, ` +
      `engagement was ${avgEngagement.toFixed(1)}/10. ` +
      `${totalBugs} potential issues were reported. ` +
      `Overall recommendation: ${recommendation.toUpperCase().replace('_', ' ')}.`
    )
  }

  /**
   * NEW: Auto-generate fixes from playtester feedback
   * Uses AI to analyze bugs and suggest concrete fixes
   */
  private async generateAutoFixes(
    originalContent: any,
    metrics: AggregatedMetrics,
    testResults: TestResult[]
  ): Promise<AutoFixResult[]> {
    const fixes: AutoFixResult[] = []

    try {
      // 1. Generate bug fixes for reported issues
      if (metrics.bugReports.length > 0) {
        const bugFixes = await this.generateBugFixes(originalContent, metrics.bugReports)
        if (bugFixes.length > 0) {
          fixes.push({
            category: 'bugs',
            fixes: bugFixes,
            summary: `Generated ${bugFixes.length} automated fix(es) for reported bugs`,
            appliedFixesCount: bugFixes.filter(f => f.confidence >= 0.7).length,
          })
        }
      }

      // 2. Generate difficulty adjustments
      if (metrics.averageDifficulty < 3 || metrics.averageDifficulty > 8) {
        const difficultyFixes = await this.generateDifficultyFixes(originalContent, metrics)
        if (difficultyFixes.length > 0) {
          fixes.push({
            category: 'difficulty',
            fixes: difficultyFixes,
            summary: `Generated ${difficultyFixes.length} difficulty adjustment(s)`,
            appliedFixesCount: difficultyFixes.filter(f => f.confidence >= 0.7).length,
          })
        }
      }

      // 3. Generate engagement improvements
      if (metrics.averageEngagement < 6) {
        const engagementFixes = await this.generateEngagementFixes(originalContent, metrics, testResults)
        if (engagementFixes.length > 0) {
          fixes.push({
            category: 'engagement',
            fixes: engagementFixes,
            summary: `Generated ${engagementFixes.length} engagement improvement(s)`,
            appliedFixesCount: engagementFixes.filter(f => f.confidence >= 0.7).length,
          })
        }
      }

      // 4. Generate pacing improvements
      const totalPacing = metrics.pacing.too_fast + metrics.pacing.just_right + metrics.pacing.too_slow
      if (totalPacing > 0 && (metrics.pacing.too_slow > totalPacing * 0.5 || metrics.pacing.too_fast > totalPacing * 0.5)) {
        const pacingFixes = await this.generatePacingFixes(originalContent, metrics)
        if (pacingFixes.length > 0) {
          fixes.push({
            category: 'pacing',
            fixes: pacingFixes,
            summary: `Generated ${pacingFixes.length} pacing improvement(s)`,
            appliedFixesCount: pacingFixes.filter(f => f.confidence >= 0.7).length,
          })
        }
      }
    } catch (error) {
      console.error('[PlaytesterSwarm] Failed to generate auto-fixes:', error)
    }

    return fixes
  }

  /**
   * Generate fixes for reported bugs using AI
   */
  private async generateBugFixes(content: any, bugReports: BugReport[]): Promise<BugFix[]> {
    const fixes: BugFix[] = []

    // Focus on critical and major bugs first
    const priorityBugs = bugReports
      .filter(b => b.severity === 'critical' || b.severity === 'major')
      .slice(0, 5) // Limit to top 5 bugs

    for (const bug of priorityBugs) {
      try {
        const fixPrompt = `You are an expert game designer fixing bugs in game content.

BUG REPORT:
- Severity: ${bug.severity}
- Description: ${bug.description}
- Reported by: ${(bug.reporters || [bug.reporter]).join(', ')}
- Report count: ${bug.reportCount || 1}

ORIGINAL CONTENT:
${JSON.stringify(content, null, 2)}

Generate a specific, actionable fix for this bug.

OUTPUT FORMAT (JSON):
{
  "suggestedFix": "Clear, specific description of the fix",
  "codeChanges": "Exact changes to make (if applicable)",
  "rationale": "Why this fix resolves the issue",
  "confidence": 0.95
}

Return ONLY valid JSON, no additional text.`

        const model = await this.aiService.getConfiguredModel('quest_generation', 'gpt-4o', 'openai')

        const response = await generateText({
          model,
          prompt: fixPrompt,
          temperature: 0.3, // Low temperature for consistent fixes
        })

        // Parse JSON response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const fixData = JSON.parse(jsonMatch[0]!)

          fixes.push({
            bugDescription: bug.description,
            severity: bug.severity,
            suggestedFix: fixData.suggestedFix,
            codeChanges: fixData.codeChanges,
            rationale: fixData.rationale,
            confidence: fixData.confidence || 0.8,
          })
        }
      } catch (error) {
        console.error(`[PlaytesterSwarm] Failed to generate fix for bug:`, bug.description, error)
      }
    }

    return fixes
  }

  /**
   * Generate difficulty adjustment fixes
   */
  private async generateDifficultyFixes(content: any, metrics: AggregatedMetrics): Promise<BugFix[]> {
    const fixes: BugFix[] = []
    const issue = metrics.averageDifficulty < 3 ? 'too easy' : 'too difficult'

    try {
      const fixPrompt = `You are an expert game designer adjusting difficulty.

ISSUE: Content is ${issue} (average difficulty: ${metrics.averageDifficulty.toFixed(1)}/10)
TARGET: Difficulty should be around 5-6/10

ORIGINAL CONTENT:
${JSON.stringify(content, null, 2)}

Suggest specific changes to adjust difficulty to target range.

OUTPUT FORMAT (JSON):
{
  "suggestedFix": "Specific changes to make",
  "rationale": "Why this improves difficulty balance",
  "confidence": 0.85
}

Return ONLY valid JSON.`

      const model = await this.aiService.getConfiguredModel('quest_generation', 'gpt-4o', 'openai')
      const response = await generateText({
        model,
        prompt: fixPrompt,
        temperature: 0.4,
      })

      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const fixData = JSON.parse(jsonMatch[0]!)
        fixes.push({
          bugDescription: `Content difficulty is ${issue} (${metrics.averageDifficulty.toFixed(1)}/10)`,
          severity: 'major',
          suggestedFix: fixData.suggestedFix,
          rationale: fixData.rationale,
          confidence: fixData.confidence || 0.75,
        })
      }
    } catch (error) {
      console.error('[PlaytesterSwarm] Failed to generate difficulty fixes:', error)
    }

    return fixes
  }

  /**
   * Generate engagement improvement fixes
   */
  private async generateEngagementFixes(
    content: any,
    metrics: AggregatedMetrics,
    testResults: TestResult[]
  ): Promise<BugFix[]> {
    const fixes: BugFix[] = []

    // Collect common feedback themes
    const feedbackThemes = testResults
      .map(r => r.feedback)
      .filter(f => f.length > 0)
      .join('\n')

    try {
      const fixPrompt = `You are an expert game designer improving player engagement.

ISSUE: Low engagement score (${metrics.averageEngagement.toFixed(1)}/10)

PLAYTESTER FEEDBACK:
${feedbackThemes}

ORIGINAL CONTENT:
${JSON.stringify(content, null, 2)}

Suggest specific improvements to increase engagement and fun.

OUTPUT FORMAT (JSON):
{
  "suggestedFix": "Specific changes to improve engagement",
  "rationale": "Why this makes content more engaging",
  "confidence": 0.80
}

Return ONLY valid JSON.`

      const model = await this.aiService.getConfiguredModel('quest_generation', 'gpt-4o', 'openai')
      const response = await generateText({
        model,
        prompt: fixPrompt,
        temperature: 0.5,
      })

      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const fixData = JSON.parse(jsonMatch[0]!)
        fixes.push({
          bugDescription: `Low engagement (${metrics.averageEngagement.toFixed(1)}/10)`,
          severity: 'major',
          suggestedFix: fixData.suggestedFix,
          rationale: fixData.rationale,
          confidence: fixData.confidence || 0.7,
        })
      }
    } catch (error) {
      console.error('[PlaytesterSwarm] Failed to generate engagement fixes:', error)
    }

    return fixes
  }

  /**
   * Generate pacing improvement fixes
   */
  private async generatePacingFixes(content: any, metrics: AggregatedMetrics): Promise<BugFix[]> {
    const fixes: BugFix[] = []
    const totalPacing = metrics.pacing.too_fast + metrics.pacing.just_right + metrics.pacing.too_slow
    const issue = metrics.pacing.too_slow > totalPacing * 0.5 ? 'too slow' : 'too fast'

    try {
      const fixPrompt = `You are an expert game designer improving pacing.

ISSUE: Content pacing is ${issue}
PACING BREAKDOWN: ${JSON.stringify(metrics.pacing)}

ORIGINAL CONTENT:
${JSON.stringify(content, null, 2)}

Suggest specific changes to improve pacing.

OUTPUT FORMAT (JSON):
{
  "suggestedFix": "Specific pacing improvements",
  "rationale": "Why this improves pacing",
  "confidence": 0.75
}

Return ONLY valid JSON.`

      const model = await this.aiService.getConfiguredModel('quest_generation', 'gpt-4o', 'openai')
      const response = await generateText({
        model,
        prompt: fixPrompt,
        temperature: 0.4,
      })

      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const fixData = JSON.parse(jsonMatch[0]!)
        fixes.push({
          bugDescription: `Pacing is ${issue}`,
          severity: 'minor',
          suggestedFix: fixData.suggestedFix,
          rationale: fixData.rationale,
          confidence: fixData.confidence || 0.7,
        })
      }
    } catch (error) {
      console.error('[PlaytesterSwarm] Failed to generate pacing fixes:', error)
    }

    return fixes
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    const testers = Array.from(this.testers.values())

    return {
      testerCount: testers.length,
      totalTestsRun: testers.reduce((sum, t) => sum + t.testsCompleted, 0),
      totalBugsFound: testers.reduce((sum, t) => sum + t.bugsFound, 0),
      testerBreakdown: testers.map(t => ({
        name: t.name,
        archetype: t.archetype,
        knowledgeLevel: t.knowledgeLevel,
        testsCompleted: t.testsCompleted,
        bugsFound: t.bugsFound,
        averageEngagement: t.averageEngagement.toFixed(1),
      })),
    }
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    // Reset tester stats
    for (const tester of this.testers.values()) {
      tester.testsCompleted = 0
      tester.bugsFound = 0
      tester.averageEngagement = 0
    }
  }
}
