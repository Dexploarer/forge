import { openaiService, type ChatMessage } from './openai.service'

// =====================================================
// MULTI-AGENT SERVICE - AI Agent Orchestration
// =====================================================

export interface Agent {
  id: string
  name: string
  role: string
  systemPrompt: string
  model?: string
  temperature?: number
}

export interface AgentMessage {
  agentId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface OrchestrationResult {
  taskId: string
  status: 'completed' | 'failed' | 'partial'
  results: Array<{
    agentId: string
    agentName: string
    response: string
    tokensUsed: number
  }>
  totalTokens: number
  errors: string[]
}

export interface TestScenario {
  description: string
  initialState: Record<string, unknown>
  agents: Agent[]
  maxRounds?: number
}

export interface SwarmResult {
  scenario: string
  rounds: number
  interactions: Array<{
    round: number
    agentId: string
    action: string
    result: string
  }>
  finalState: Record<string, unknown>
  success: boolean
}

export class MultiAgentService {
  /**
   * Orchestrate multiple agents to complete a task
   */
  async orchestrate(
    task: string,
    agents: Agent[]
  ): Promise<OrchestrationResult> {
    const taskId = `task-${Date.now()}`
    const results: OrchestrationResult['results'] = []
    const errors: string[] = []
    let totalTokens = 0

    for (const agent of agents) {
      try {
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: agent.systemPrompt,
          },
          {
            role: 'user',
            content: task,
          },
        ]

        const response = await openaiService.chatCompletion(messages, {
          model: agent.model || 'gpt-3.5-turbo',
          temperature: agent.temperature || 0.7,
          maxTokens: 1000,
        })

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          response: response.content,
          tokensUsed: response.usage.totalTokens,
        })

        totalTokens += response.usage.totalTokens
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Agent ${agent.name} failed: ${errorMessage}`)
      }
    }

    return {
      taskId,
      status: errors.length === 0 ? 'completed' : errors.length === agents.length ? 'failed' : 'partial',
      results,
      totalTokens,
      errors,
    }
  }

  /**
   * Run a multi-agent swarm test scenario
   */
  async runSwarm(scenario: TestScenario): Promise<SwarmResult> {
    const maxRounds = scenario.maxRounds || 5
    const interactions: SwarmResult['interactions'] = []
    let currentState = { ...scenario.initialState }

    for (let round = 1; round <= maxRounds; round++) {
      for (const agent of scenario.agents) {
        try {
          // Build context from current state
          const context = JSON.stringify(currentState, null, 2)

          const messages: ChatMessage[] = [
            {
              role: 'system',
              content: agent.systemPrompt,
            },
            {
              role: 'user',
              content: `Current state:\n${context}\n\nWhat action do you take?`,
            },
          ]

          const response = await openaiService.chatCompletion(messages, {
            model: agent.model || 'gpt-3.5-turbo',
            temperature: agent.temperature || 0.7,
            maxTokens: 500,
          })

          // Record interaction
          interactions.push({
            round,
            agentId: agent.id,
            action: response.content,
            result: 'success',
          })

          // Update state based on agent action (simplified - in real scenario, parse and apply)
          currentState = {
            ...currentState,
            lastAction: {
              agent: agent.name,
              action: response.content,
              round,
            },
          }
        } catch (error) {
          interactions.push({
            round,
            agentId: agent.id,
            action: 'failed',
            result: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    return {
      scenario: scenario.description,
      rounds: maxRounds,
      interactions,
      finalState: currentState,
      success: interactions.every(i => i.result === 'success'),
    }
  }

  /**
   * Create a conversation between agents
   */
  async agentConversation(
    agents: Agent[],
    initialMessage: string,
    rounds: number = 3
  ): Promise<AgentMessage[]> {
    const conversation: AgentMessage[] = []
    let lastMessage = initialMessage

    for (let round = 0; round < rounds; round++) {
      for (const agent of agents) {
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: agent.systemPrompt,
          },
          {
            role: 'user',
            content: lastMessage,
          },
        ]

        const response = await openaiService.chatCompletion(messages, {
          model: agent.model || 'gpt-3.5-turbo',
          temperature: agent.temperature || 0.7,
          maxTokens: 300,
        })

        const agentMessage: AgentMessage = {
          agentId: agent.id,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        }

        conversation.push(agentMessage)
        lastMessage = response.content
      }
    }

    return conversation
  }
}

// Export singleton instance
export const multiAgentService = new MultiAgentService()
