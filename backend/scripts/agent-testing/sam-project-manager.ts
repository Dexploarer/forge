import { BaseAgent, type TestScenario, type ScenarioResult } from './base-agent'
import type { FastifyInstance } from 'fastify'
import { users, teams, teamMembers, teamInvitations, projects, projectMembers, apiKeys, activityLog, notifications } from '../../src/database/schema'
import { eq } from 'drizzle-orm'

/**
 * SAM - THE PROJECT MANAGER AGENT
 * Focuses on: Teams, projects, analytics, permissions, admin operations
 * Personality: Organized, strategic, data-driven, leadership-focused
 */
export class SamProjectManagerAgent extends BaseAgent {
  private teamId: string = ''
  private secondTeamId: string = ''
  private projectId: string = ''
  private secondUserId: string = ''

  constructor(server: FastifyInstance) {
    super(server, 'Sam', 'Project Manager', '#F39C12')
  }

  async initialize(): Promise<void> {
    // Cleanup existing test data
    await this.cleanup()

    // Create test user (Sam - the project manager)
    const [user] = await this.server.db.insert(users).values({
      privyUserId: 'sam-project-manager',
      email: 'sam@forge-test.com',
      displayName: 'Sam - Project Manager',
      role: 'admin', // Sam is an admin for testing admin operations
    }).returning()

    this.userId = user.id

    // Create a second user for collaboration testing
    const [user2] = await this.server.db.insert(users).values({
      privyUserId: 'sam-team-member',
      email: 'member@forge-test.com',
      displayName: 'Team Member',
      role: 'member',
    }).returning()

    this.secondUserId = user2.id

    // Create primary team
    const [team] = await this.server.db.insert(teams).values({
      name: 'Sam\'s Game Studio',
      description: 'Professional game development team',
      ownerId: this.userId,
    }).returning()

    this.teamId = team.id

    // Add Sam to team
    await this.server.db.insert(teamMembers).values({
      teamId: this.teamId,
      userId: this.userId,
      role: 'owner',
      invitedBy: this.userId,
    })

    // Create primary project
    const [project] = await this.server.db.insert(projects).values({
      name: 'Epic RPG Project',
      description: 'Large-scale RPG with advanced asset management',
      teamId: this.teamId,
      ownerId: this.userId,
      status: 'active',
    }).returning()

    this.projectId = project.id
  }

  async cleanup(): Promise<void> {
    const existingUsers = await this.server.db.query.users.findMany({
      where: eq(users.privyUserId, 'sam-project-manager')
    })

    for (const user of existingUsers) {
      // Delete all related data
      await this.server.db.delete(activityLog).where(eq(activityLog.userId, user.id))
      await this.server.db.delete(notifications).where(eq(notifications.userId, user.id))
      await this.server.db.delete(apiKeys).where(eq(apiKeys.userId, user.id))
      await this.server.db.delete(projectMembers).where(eq(projectMembers.userId, user.id))
      await this.server.db.delete(projects).where(eq(projects.ownerId, user.id))
      await this.server.db.delete(teamInvitations).where(eq(teamInvitations.invitedBy, user.id))
      await this.server.db.delete(teamMembers).where(eq(teamMembers.userId, user.id))
      await this.server.db.delete(teams).where(eq(teams.ownerId, user.id))
    }

    await this.server.db.delete(users).where(eq(users.privyUserId, 'sam-project-manager'))
    await this.server.db.delete(users).where(eq(users.privyUserId, 'sam-team-member'))
  }

  getScenarios(): TestScenario[] {
    return [
      // ===== TEAM MANAGEMENT =====
      {
        name: 'PM-001: Create a new team',
        description: 'Create a second team for multi-team management',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/teams',
            payload: {
              name: 'Indie Dev Collective',
              description: 'Collaborative team for indie game development',
            },
          })

          const success = response.statusCode === 201 && response.body.team?.id
          if (success) {
            (agent as any).secondTeamId = response.body.team.id
            agent.storeTestData('secondTeamId', response.body.team.id)
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
        name: 'PM-002: List all teams',
        description: 'Retrieve all teams that the user owns or is a member of',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/teams',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.teams)

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
        name: 'PM-003: Get specific team details',
        description: 'Retrieve detailed information about a specific team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/teams/${(agent as any).teamId}`,
          })

          const success = response.statusCode === 200 && response.body.team?.name === 'Sam\'s Game Studio'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'PM-004: Update team settings',
        description: 'Update team name and description',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/teams/${(agent as any).teamId}`,
            payload: {
              name: 'Sam\'s Game Studio Pro',
              description: 'Professional game development team - Enterprise Edition',
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

      // ===== TEAM MEMBER MANAGEMENT =====
      {
        name: 'PM-005: Add member to team',
        description: 'Add an existing user to the team',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/teams/${(agent as any).teamId}/members`,
            payload: {
              userId: (agent as any).secondUserId,
              role: 'member',
            },
          })

          const success = response.statusCode === 201

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
        name: 'PM-006: List team members',
        description: 'Retrieve all members of a team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/teams/${(agent as any).teamId}/members`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.members)

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
        name: 'PM-007: Update member role',
        description: 'Change a team member\'s role (member to admin)',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/teams/${(agent as any).teamId}/members/${(agent as any).secondUserId}`,
            payload: {
              role: 'admin',
            },
          })

          const success = response.statusCode === 200

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
        name: 'PM-008: Send team invitation',
        description: 'Invite a new user to the team via email',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/teams/${(agent as any).teamId}/invitations`,
            payload: {
              email: 'newdev@forge-test.com',
              role: 'member',
            },
          })

          const success = response.statusCode === 201 && response.body.invitation?.token
          if (success) {
            agent.storeTestData('invitationToken', response.body.invitation.token)
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

      // ===== PROJECT MANAGEMENT =====
      {
        name: 'PM-009: Create a new project',
        description: 'Create a project under the team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/projects',
            payload: {
              name: 'Mobile Puzzle Game',
              description: 'Casual puzzle game for mobile platforms',
              teamId: (agent as any).teamId,
              status: 'active',
              tags: ['mobile', 'puzzle', 'casual'],
            },
          })

          const success = response.statusCode === 201 && response.body.project?.id
          if (success) {
            agent.storeTestData('secondProjectId', response.body.project.id)
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
        name: 'PM-010: List all projects',
        description: 'Retrieve all projects for the user',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/projects',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.projects)

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
        name: 'PM-011: Get project details',
        description: 'Retrieve detailed information about a specific project',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/projects/${(agent as any).projectId}`,
          })

          const success = response.statusCode === 200 && response.body.project?.name === 'Epic RPG Project'

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: success,
          }
        },
      },

      {
        name: 'PM-012: Update project settings',
        description: 'Update project metadata and settings',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'PATCH',
            url: `/api/projects/${(agent as any).projectId}`,
            payload: {
              description: 'Large-scale RPG with advanced asset management and AI-powered content generation',
              tags: ['rpg', 'multiplayer', 'ai-content'],
              settings: {
                visibility: 'team',
                allowComments: true,
                requireApproval: true,
              },
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
        name: 'PM-013: Filter projects by team',
        description: 'Get all projects for a specific team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/projects?teamId=${(agent as any).teamId}`,
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.projects)

          return {
            success,
            points: success ? 10 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      // ===== ANALYTICS & ADMIN OPERATIONS =====
      {
        name: 'PM-014: View team analytics',
        description: 'Retrieve analytics dashboard for team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: `/api/analytics?teamId=${(agent as any).teamId}`,
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

      {
        name: 'PM-015: View activity logs',
        description: 'Retrieve activity logs for audit trail',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/activity-logs?limit=50',
          })

          const success = response.statusCode === 200 && Array.isArray(response.body.logs)

          return {
            success,
            points: success ? 20 : -5,
            duration: Date.now() - start,
            apiCallsMade: 1,
            dataVerified: false,
          }
        },
      },

      {
        name: 'PM-016: Create API key for team',
        description: 'Generate an API key for programmatic access',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/api-keys',
            payload: {
              name: 'CI/CD Pipeline Key',
              teamId: (agent as any).teamId,
              permissions: ['read:assets', 'write:assets'],
            },
          })

          const success = response.statusCode === 201 && response.body.apiKey?.key
          if (success) {
            agent.storeTestData('apiKeyId', response.body.apiKey.id)
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
        name: 'PM-017: Search for users',
        description: 'Search for users to add to team',
        category: 'basic',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'GET',
            url: '/api/users/search?q=member',
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

      // ===== EDGE CASES & PERMISSION TESTING =====
      {
        name: 'PM-018: Test duplicate team creation',
        description: 'Try to create a team with duplicate name (should succeed)',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: '/api/teams',
            payload: {
              name: 'Sam\'s Game Studio Pro', // Same name as existing team
              description: 'Duplicate name test',
            },
          })

          // Should succeed (duplicate names allowed for different owners)
          const success = response.statusCode === 201

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
        name: 'PM-019: Test invalid team member role',
        description: 'Try to add member with invalid role',
        category: 'edge-case',
        execute: async (agent) => {
          const start = Date.now()

          const response = await agent.apiCall({
            method: 'POST',
            url: `/api/teams/${(agent as any).teamId}/members`,
            payload: {
              userId: (agent as any).secondUserId,
              role: 'super_admin_xyz', // Invalid role
            },
          })

          // Should fail with 400
          const success = response.statusCode === 400
          const bugDiscovered = success ? undefined : {
            description: 'Invalid team member role not properly validated',
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
        name: 'PM-020: Complete project management workflow',
        description: 'Full workflow: create team, invite members, create project, assign members',
        category: 'workflow',
        execute: async (agent) => {
          const start = Date.now()
          let apiCalls = 0

          // 1. Create new team
          const teamResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/teams',
            payload: {
              name: 'Workflow Test Team',
              description: 'End-to-end workflow test',
            },
          })
          apiCalls++

          if (teamResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create team',
            }
          }

          const workflowTeamId = teamResponse.body.team.id

          // 2. Add member to team
          const memberResponse = await agent.apiCall({
            method: 'POST',
            url: `/api/teams/${workflowTeamId}/members`,
            payload: {
              userId: (agent as any).secondUserId,
              role: 'admin',
            },
          })
          apiCalls++

          if (memberResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to add team member',
            }
          }

          // 3. Create project under team
          const projectResponse = await agent.apiCall({
            method: 'POST',
            url: '/api/projects',
            payload: {
              name: 'Workflow Test Project',
              description: 'Complete workflow test',
              teamId: workflowTeamId,
              status: 'active',
            },
          })
          apiCalls++

          if (projectResponse.statusCode !== 201) {
            return {
              success: false,
              points: -5,
              duration: Date.now() - start,
              apiCallsMade: apiCalls,
              dataVerified: false,
              errorMessage: 'Failed to create project',
            }
          }

          const workflowProjectId = projectResponse.body.project.id

          // 4. Verify project is in team's projects
          const listResponse = await agent.apiCall({
            method: 'GET',
            url: `/api/projects?teamId=${workflowTeamId}`,
          })
          apiCalls++

          const success = listResponse.statusCode === 200 &&
                         Array.isArray(listResponse.body.projects) &&
                         listResponse.body.projects.some((p: any) => p.id === workflowProjectId)

          return {
            success,
            points: success ? 200 : -5,
            duration: Date.now() - start,
            apiCallsMade: apiCalls,
            dataVerified: success,
            metadata: {
              workflowSteps: ['create team', 'add member', 'create project', 'verify project listing'],
              teamId: workflowTeamId,
              projectId: workflowProjectId,
            },
          }
        },
      },
    ]
  }
}
