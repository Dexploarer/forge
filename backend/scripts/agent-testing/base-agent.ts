import type { FastifyInstance } from 'fastify'

/**
 * FORGE AGENT TESTING FRAMEWORK
 * Base Agent class for competitive testing of user flows
 */

export interface TestScenario {
  name: string
  description: string
  category: 'basic' | 'ai-generation' | 'workflow' | 'edge-case'
  execute: (agent: BaseAgent) => Promise<ScenarioResult>
}

export interface ScenarioResult {
  success: boolean
  points: number
  duration: number
  apiCallsMade: number
  dataVerified: boolean
  errorMessage?: string
  bugDiscovered?: {
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }
  metadata?: Record<string, any>
}

export interface AgentScore {
  totalPoints: number
  scenariosCompleted: number
  scenariosFailed: number
  successRate: number
  bugsDiscovered: number
  totalDuration: number
  speedBonus: number
  dataQualityScore: number
}

export interface AgentReport {
  agentName: string
  persona: string
  score: AgentScore
  scenarios: Array<{
    name: string
    result: ScenarioResult
  }>
  ranking?: number
  awards?: string[]
}

export abstract class BaseAgent {
  protected server: FastifyInstance
  protected authToken: string
  protected userId: string
  protected testData: Map<string, any> = new Map()

  public name: string
  public persona: string
  public color: string

  protected score: AgentScore = {
    totalPoints: 0,
    scenariosCompleted: 0,
    scenariosFailed: 0,
    successRate: 0,
    bugsDiscovered: 0,
    totalDuration: 0,
    speedBonus: 0,
    dataQualityScore: 0,
  }

  protected scenarioResults: Array<{ name: string; result: ScenarioResult }> = []

  constructor(
    server: FastifyInstance,
    name: string,
    persona: string,
    color: string
  ) {
    this.server = server
    this.name = name
    this.persona = persona
    this.color = color
    this.authToken = `mock-${name.toLowerCase().replace(/\s+/g, '-')}-token`
    this.userId = '' // Will be set during initialization
  }

  /**
   * Initialize the agent (create user, team, project, etc.)
   */
  abstract initialize(): Promise<void>

  /**
   * Get all test scenarios for this agent
   */
  abstract getScenarios(): TestScenario[]

  /**
   * Clean up test data after completion
   */
  abstract cleanup(): Promise<void>

  /**
   * Run all scenarios for this agent
   */
  async runAllScenarios(): Promise<AgentReport> {
    console.log(`\n🤖 ${this.name} (${this.persona}) starting test run...\n`)

    const startTime = Date.now()
    const scenarios = this.getScenarios()

    for (const scenario of scenarios) {
      console.log(`  ▶️  Testing: ${scenario.name}`)

      try {
        const scenarioStart = Date.now()
        const result = await scenario.execute(this)
        result.duration = Date.now() - scenarioStart

        this.processResult(scenario.name, result)

        const status = result.success ? '✅' : '❌'
        console.log(`  ${status} ${scenario.name} (+${result.points} points, ${result.duration}ms)`)

        if (result.bugDiscovered) {
          console.log(`  🐛 BUG FOUND: ${result.bugDiscovered.description}`)
        }
      } catch (error) {
        const result: ScenarioResult = {
          success: false,
          points: -5,
          duration: 0,
          apiCallsMade: 0,
          dataVerified: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        }

        this.processResult(scenario.name, result)
        console.log(`  ❌ ${scenario.name} (CRASHED: ${result.errorMessage})`)
      }
    }

    this.score.totalDuration = Date.now() - startTime
    this.calculateFinalScore()

    console.log(`\n✨ ${this.name} completed in ${this.score.totalDuration}ms`)
    console.log(`   Total Score: ${this.score.totalPoints} points`)
    console.log(`   Success Rate: ${this.score.successRate.toFixed(1)}%\n`)

    return this.generateReport()
  }

  /**
   * Process scenario result and update score
   */
  protected processResult(scenarioName: string, result: ScenarioResult): void {
    this.scenarioResults.push({ name: scenarioName, result })

    if (result.success) {
      this.score.scenariosCompleted++
      this.score.totalPoints += result.points

      if (result.dataVerified) {
        this.score.dataQualityScore += 10
      }
    } else {
      this.score.scenariosFailed++
      this.score.totalPoints += result.points // Will be negative
    }

    if (result.bugDiscovered) {
      this.score.bugsDiscovered++

      // Bonus points based on severity
      const bonusPoints = {
        low: 25,
        medium: 50,
        high: 75,
        critical: 100,
      }[result.bugDiscovered.severity]

      this.score.totalPoints += bonusPoints
    }
  }

  /**
   * Calculate final score with bonuses
   */
  protected calculateFinalScore(): void {
    const totalScenarios = this.score.scenariosCompleted + this.score.scenariosFailed
    this.score.successRate = totalScenarios > 0
      ? (this.score.scenariosCompleted / totalScenarios) * 100
      : 0

    // Speed bonus: faster agents get bonus points
    if (this.score.totalDuration < 30000) { // Under 30 seconds
      this.score.speedBonus = Math.floor(this.score.totalPoints * 0.1)
      this.score.totalPoints += this.score.speedBonus
    }

    // Data quality bonus
    if (this.score.dataQualityScore > 0) {
      this.score.totalPoints += this.score.dataQualityScore
    }
  }

  /**
   * Generate final report
   */
  protected generateReport(): AgentReport {
    return {
      agentName: this.name,
      persona: this.persona,
      score: this.score,
      scenarios: this.scenarioResults,
    }
  }

  /**
   * Helper: Make API call using testServer.inject
   */
  protected async apiCall(config: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
    url: string
    payload?: any
    expectStatus?: number
  }): Promise<{ statusCode: number; body: any }> {
    const response = await this.server.inject({
      method: config.method,
      url: config.url,
      headers: {
        authorization: `Bearer ${this.authToken}`,
        'content-type': 'application/json',
      },
      payload: config.payload,
    })

    let body: any
    try {
      body = JSON.parse(response.body)
    } catch {
      body = response.body
    }

    return { statusCode: response.statusCode, body }
  }

  /**
   * Helper: Verify data in database
   */
  protected async verifyInDatabase(
    table: string,
    condition: any
  ): Promise<boolean> {
    try {
      // This will be implemented per agent based on their specific tables
      return true
    } catch {
      return false
    }
  }

  /**
   * Helper: Store test data for later reference
   */
  protected storeTestData(key: string, value: any): void {
    this.testData.set(key, value)
  }

  /**
   * Helper: Get stored test data
   */
  protected getTestData(key: string): any {
    return this.testData.get(key)
  }

  /**
   * Helper: Wait for async operation (e.g., AI generation)
   */
  protected async waitForCompletion(
    checkFn: () => Promise<boolean>,
    timeout: number = 30000,
    interval: number = 1000
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await checkFn()) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    return false
  }
}
