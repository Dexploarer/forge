import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import { teams, teamMembers, users } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import { verifyTeamOwner, verifyTeamMembership } from '../helpers/team-access'
import { serializeAllTimestamps } from '../helpers/serialization'

const teamRoutes: FastifyPluginAsync = async (fastify) => {
  // List user's teams
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List all teams user is a member of',
      summary: 'List teams',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page'),
      }),
      response: {
        200: z.object({
          teams: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            ownerId: z.string().uuid(),
            isOwner: z.boolean(),
            role: z.string().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        }).describe('Teams list retrieved successfully')
      }
    }
  }, async (request) => {
    const { page, limit } = request.query as { page: number; limit: number }
    const offset = (page - 1) * limit
    const userId = request.user!.id

    // Get teams where user is owner
    const ownedTeams = await fastify.db.query.teams.findMany({
      where: eq(teams.ownerId, userId),
      limit,
      offset,
      orderBy: [desc(teams.createdAt)],
    })

    // Get teams where user is a member
    const membershipTeams = await fastify.db
      .select({
        team: teams,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(teams.createdAt))

    // Combine and deduplicate
    const allTeams = [
      ...ownedTeams.map(team => ({
        ...team,
        isOwner: true,
        role: 'owner' as string | null,
      })),
      ...membershipTeams.map(({ team, role }) => ({
        ...team,
        isOwner: team.ownerId === userId,
        role,
      })),
    ]

    // Remove duplicates by team ID
    const uniqueTeams = allTeams.filter((team, index, self) =>
      index === self.findIndex((t) => t.id === team.id)
    )

    // Get total count
    const [ownedCount] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(teams)
      .where(eq(teams.ownerId, userId))

    const [memberCount] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))

    const total = Number(ownedCount?.count ?? 0) + Number(memberCount?.count ?? 0)

    return {
      teams: serializeAllTimestamps(uniqueTeams) as any,
      pagination: { page, limit, total },
    }
  })

  // Create new team
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new team',
      summary: 'Create team',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        name: z.string().min(1).max(255).describe('Team name'),
        description: z.string().optional().describe('Team description'),
        settings: z.record(z.string(), z.any()).optional().describe('Team settings'),
      }),
      response: {
        201: z.object({
          team: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            ownerId: z.string().uuid(),
            createdAt: z.string().datetime(),
          })
        }).describe('Team created successfully')
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      description?: string
      settings?: Record<string, any>
    }

    const [team] = await fastify.db.insert(teams).values({
      name: data.name,
      description: data.description || null,
      ownerId: request.user!.id,
      settings: data.settings || {},
    }).returning()

    if (!team) {
      throw new ValidationError('Failed to create team')
    }

    // Automatically add owner as a team member
    await fastify.db.insert(teamMembers).values({
      teamId: team.id,
      userId: request.user!.id,
      role: 'owner',
    })

    reply.code(201).send({
      team: serializeAllTimestamps(team) as any,
    })
  })

  // Get team details
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get team details',
      summary: 'Get team',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
      }),
      response: {
        200: z.object({
          team: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            ownerId: z.string().uuid(),
            settings: z.record(z.string(), z.any()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            owner: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              avatarUrl: z.string().url().nullable(),
            }),
            memberCount: z.number(),
          })
        }).describe('Team details retrieved successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Not a team member'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Team not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    const team = await fastify.db.query.teams.findFirst({
      where: eq(teams.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (!team) {
      throw new NotFoundError('Team not found')
    }

    // Verify user is a team member or admin
    await verifyTeamMembership(fastify, id, request.user!.id, request.user!.role)

    // Get member count
    const [countResult] = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, id))

    const memberCount = Number(countResult?.count ?? 0)

    return {
      team: {
        ...team,
        createdAt: team.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: team.updatedAt?.toISOString() || new Date().toISOString(),
        memberCount,
      } as any,
    }
  })

  // Update team
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update team (owner only)',
      summary: 'Update team',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional().describe('Team name'),
        description: z.string().optional().describe('Team description'),
        settings: z.record(z.string(), z.any()).optional().describe('Team settings'),
      }),
      response: {
        200: z.object({
          team: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            updatedAt: z.string().datetime(),
          })
        }).describe('Team updated successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Only owner can update'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Team not found')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      description?: string
      settings?: Record<string, any>
    }

    // Verify user is team owner or admin
    await verifyTeamOwner(fastify, id, request.user!.id, request.user!.role)

    const [updatedTeam] = await fastify.db
      .update(teams)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id))
      .returning()

    if (!updatedTeam) {
      throw new NotFoundError('Team not found')
    }

    return {
      team: serializeAllTimestamps(updatedTeam) as any,
    }
  })

  // Delete team
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete team (owner only)',
      summary: 'Delete team',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
      }),
      response: {
        204: z.null().describe('Team deleted successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Only owner can delete'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Team not found')
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verify user is team owner or admin
    await verifyTeamOwner(fastify, id, request.user!.id, request.user!.role)

    await fastify.db.delete(teams).where(eq(teams.id, id))

    reply.code(204).send()
  })

  // List team members
  fastify.get('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List team members',
      summary: 'List team members',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
      }),
      response: {
        200: z.object({
          members: z.array(z.object({
            id: z.string().uuid(),
            teamId: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.string(),
            joinedAt: z.string().datetime(),
            user: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              avatarUrl: z.string().url().nullable(),
            }),
          }))
        }).describe('Team members retrieved successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Not a team member')
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    // Verify user is a team member or admin
    await verifyTeamMembership(fastify, id, request.user!.id, request.user!.role)

    const members = await fastify.db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, id),
      with: {
        user: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    return {
      members: serializeAllTimestamps(members) as any,
    }
  })

  // Add team member
  fastify.post('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add member to team (owner only)',
      summary: 'Add team member',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
      }),
      body: z.object({
        userId: z.string().uuid().describe('User ID to add'),
        role: z.enum(['owner', 'member']).default('member').describe('Member role'),
      }),
      response: {
        201: z.object({
          member: z.object({
            id: z.string().uuid(),
            teamId: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.string(),
            joinedAt: z.string().datetime(),
          })
        }).describe('Member added successfully'),
        400: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Bad request - User already a member'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Only owner can add members')
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId, role } = request.body as { userId: string; role: 'owner' | 'member' }

    // Verify user is team owner or admin
    await verifyTeamOwner(fastify, id, request.user!.id, request.user!.role)

    // Check if user is already a member
    const existingMember = await fastify.db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)),
    })

    if (existingMember) {
      throw new ValidationError('User is already a member of this team')
    }

    // Check if user exists
    const userExists = await fastify.db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!userExists) {
      throw new NotFoundError('User not found')
    }

    const [member] = await fastify.db.insert(teamMembers).values({
      teamId: id,
      userId,
      role,
      invitedBy: request.user!.id,
    }).returning()

    if (!member) {
      throw new ValidationError('Failed to add team member')
    }

    reply.code(201).send({
      member: serializeAllTimestamps(member) as any,
    })
  })

  // Remove team member
  fastify.delete('/:id/members/:userId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Remove member from team (owner only)',
      summary: 'Remove team member',
      tags: ['teams'],
      security: [{ bearerAuth: [] }],
      params: z.object({
        id: z.string().uuid().describe('Team ID'),
        userId: z.string().uuid().describe('User ID to remove'),
      }),
      response: {
        204: z.null().describe('Member removed successfully'),
        403: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Forbidden - Only owner can remove members'),
        404: z.object({
          message: z.string(),
          code: z.string(),
          statusCode: z.number(),
          name: z.string(),
        }).describe('Member not found')
      }
    }
  }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }

    // Verify user is team owner or admin (or removing themselves)
    const isRemovingSelf = userId === request.user!.id
    if (!isRemovingSelf) {
      await verifyTeamOwner(fastify, id, request.user!.id, request.user!.role)
    }

    // Cannot remove the team owner
    const team = await fastify.db.query.teams.findFirst({
      where: eq(teams.id, id),
    })

    if (team?.ownerId === userId) {
      throw new ForbiddenError('Cannot remove the team owner from the team')
    }

    const result = await fastify.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
      .returning()

    if (result.length === 0) {
      throw new NotFoundError('Member not found in team')
    }

    reply.code(204).send()
  })
}

export default teamRoutes
