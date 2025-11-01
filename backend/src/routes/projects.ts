import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { projects, projectMembers, projectAssets, users, assets } from '../database/schema'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors'
import {
  verifyProjectOwner,
  verifyProjectMembership,
  getProjectRole
} from '../helpers/project-access'
import { isTeamMember } from '../helpers/team-access'
import { serializeAllTimestamps } from '../helpers/serialization'

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================================================
  // LIST USER'S PROJECTS
  // =====================================================
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List projects accessible to the user',
      tags: ['projects'],
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        teamId: z.string().uuid().optional(),
      }),
      response: {
        200: z.object({
          projects: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            teamId: z.string().uuid(),
            ownerId: z.string().uuid(),
            settings: z.record(z.string(), z.any()),
            tags: z.array(z.string()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            isOwner: z.boolean(),
            role: z.string().nullable(),
            memberCount: z.number(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
          })
        })
      }
    }
  }, async (request) => {
    const { page, limit, teamId } = request.query as {
      page: number
      limit: number
      teamId?: string
    }
    const offset = (page - 1) * limit

    // Build where conditions - show projects where user is owner or member
    const conditions = []

    if (teamId) {
      conditions.push(eq(projects.teamId, teamId))
    }

    // Get projects where user is owner
    const ownerCondition = eq(projects.ownerId, request.user!.id)

    // Get projects where user is a member
    const memberProjects = await fastify.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, request.user!.id))

    const memberProjectIds = memberProjects.map(p => p.projectId)

    let whereClause
    if (memberProjectIds.length > 0) {
      conditions.push(
        or(
          ownerCondition,
          sql`${projects.id} = ANY(${sql.raw(`ARRAY[${memberProjectIds.map(id => `'${id}'::uuid`).join(',')}]`)})`
        )
      )
    } else {
      conditions.push(ownerCondition)
    }

    whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const projectsList = await fastify.db.query.projects.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(projects.createdAt)],
    })

    // Get member counts for each project
    const projectsWithDetails = await Promise.all(
      projectsList.map(async (project) => {
        const memberCountResult = await fastify.db
          .select({ count: sql<number>`count(*)` })
          .from(projectMembers)
          .where(eq(projectMembers.projectId, project.id))

        const memberCount = Number(memberCountResult[0]?.count ?? 0) + 1 // +1 for owner

        const role = await getProjectRole(fastify, project.id, request.user!.id)

        return {
          ...serializeAllTimestamps(project),
          isOwner: project.ownerId === request.user!.id,
          role,
          memberCount,
        }
      })
    )

    const countResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause)

    const total = Number(countResult[0]?.count ?? 0)

    return {
      projects: projectsWithDetails,
      pagination: { page, limit, total }
    }
  })

  // =====================================================
  // CREATE PROJECT
  // =====================================================
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new project (requires team membership)',
      tags: ['projects'],
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        teamId: z.string().uuid(),
        settings: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).default([]),
      }),
      response: {
        201: z.object({
          project: z.object({
            id: z.string().uuid(),
            name: z.string(),
            teamId: z.string().uuid(),
            ownerId: z.string().uuid(),
            createdAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const data = request.body as {
      name: string
      description?: string
      teamId: string
      settings?: Record<string, any>
      tags?: string[]
    }

    // Verify user is a member of the team (admins bypass this check)
    if (request.user!.role !== 'admin') {
      const teamMemberCheck = await isTeamMember(fastify, data.teamId, request.user!.id)
      if (!teamMemberCheck) {
        throw new ForbiddenError('You must be a team member to create projects')
      }
    }

    // Create project
    const [project] = await fastify.db.insert(projects).values({
      name: data.name,
      description: data.description,
      teamId: data.teamId,
      ownerId: request.user!.id,
      settings: data.settings || {},
      tags: data.tags || [],
    }).returning()

    if (!project) {
      throw new Error('Failed to create project')
    }

    // Automatically add owner as project member
    await fastify.db.insert(projectMembers).values({
      projectId: project.id,
      userId: request.user!.id,
      role: 'owner',
      invitedBy: request.user!.id,
    })

    reply.code(201).send({ project: serializeAllTimestamps(project) })
  })

  // =====================================================
  // GET PROJECT DETAILS
  // =====================================================
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get project details (requires membership)',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          project: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            teamId: z.string().uuid(),
            ownerId: z.string().uuid(),
            settings: z.record(z.string(), z.any()),
            tags: z.array(z.string()),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            owner: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              avatarUrl: z.string().url().nullable(),
            }),
            team: z.object({
              id: z.string().uuid(),
              name: z.string(),
            }),
            memberCount: z.number(),
            assetCount: z.number(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    await verifyProjectMembership(fastify, id, request)

    const project = await fastify.db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          }
        },
        team: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    const memberCountResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, id))

    const assetCountResult = await fastify.db
      .select({ count: sql<number>`count(*)` })
      .from(projectAssets)
      .where(eq(projectAssets.projectId, id))

    const memberCount = Number(memberCountResult[0]?.count ?? 0) + 1 // +1 for owner
    const assetCount = Number(assetCountResult[0]?.count ?? 0)

    return {
      project: {
        ...serializeAllTimestamps(project),
        memberCount,
        assetCount,
      }
    }
  })

  // =====================================================
  // UPDATE PROJECT
  // =====================================================
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update project (owner only)',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        settings: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          project: z.object({
            id: z.string().uuid(),
            name: z.string(),
            updatedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }
    const updates = request.body as {
      name?: string
      description?: string
      settings?: Record<string, any>
      tags?: string[]
    }

    await verifyProjectOwner(fastify, id, request)

    const [updatedProject] = await fastify.db
      .update(projects)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning()

    if (!updatedProject) {
      throw new NotFoundError('Project not found')
    }

    return { project: serializeAllTimestamps(updatedProject) }
  })

  // =====================================================
  // DELETE PROJECT
  // =====================================================
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete project (owner only)',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    await verifyProjectOwner(fastify, id, request)

    await fastify.db.delete(projects).where(eq(projects.id, id))

    reply.code(204).send()
  })

  // =====================================================
  // LIST PROJECT MEMBERS
  // =====================================================
  fastify.get('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List project members',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          members: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.string(),
            joinedAt: z.string().datetime(),
            user: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
              email: z.string().email().nullable(),
              avatarUrl: z.string().url().nullable(),
            })
          }))
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    await verifyProjectMembership(fastify, id, request)

    const members = await fastify.db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, id),
      with: {
        user: {
          columns: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          }
        }
      }
    })

    return {
      members: members.map(member => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      }))
    }
  })

  // =====================================================
  // ADD PROJECT MEMBER
  // =====================================================
  fastify.post('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add member to project (owner only, user must be team member)',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        userId: z.string().uuid(),
        role: z.enum(['owner', 'editor', 'viewer', 'member']).default('member'),
      }),
      response: {
        201: z.object({
          member: z.object({
            id: z.string().uuid(),
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.string(),
            joinedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId, role } = request.body as {
      userId: string
      role: string
    }

    await verifyProjectOwner(fastify, id, request)

    // Verify user exists
    const userExists = await fastify.db.query.users.findFirst({
      where: eq(users.id, userId)
    })

    if (!userExists) {
      throw new NotFoundError('User not found')
    }

    // Verify user is already a team member
    const project = await fastify.db.query.projects.findFirst({
      where: eq(projects.id, id)
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    const teamMemberCheck = await isTeamMember(fastify, project.teamId, userId)
    if (!teamMemberCheck) {
      throw new ValidationError('User must be a team member before being added to the project')
    }

    // Check if already a member
    const existingMember = await fastify.db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, userId)
      )
    })

    if (existingMember) {
      throw new ValidationError('User is already a member of this project')
    }

    const [member] = await fastify.db.insert(projectMembers).values({
      projectId: id,
      userId,
      role,
      invitedBy: request.user!.id,
    }).returning()

    if (!member) {
      throw new Error('Failed to add member')
    }

    reply.code(201).send({ member: serializeAllTimestamps(member) })
  })

  // =====================================================
  // REMOVE PROJECT MEMBER
  // =====================================================
  fastify.delete('/:id/members/:userId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Remove member from project (owner only, or self)',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid(),
        userId: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }

    const project = await fastify.db.query.projects.findFirst({
      where: eq(projects.id, id)
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    // Allow owner to remove anyone, or users to remove themselves
    if (project.ownerId !== request.user!.id && userId !== request.user!.id) {
      throw new ForbiddenError('Only the project owner can remove other members')
    }

    // Prevent removing the project owner
    if (userId === project.ownerId) {
      throw new ForbiddenError('Cannot remove the project owner from the project')
    }

    await fastify.db
      .delete(projectMembers)
      .where(and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, userId)
      ))

    reply.code(204).send()
  })

  // =====================================================
  // LIST PROJECT ASSETS
  // =====================================================
  fastify.get('/:id/assets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List assets in project',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          assets: z.array(z.object({
            id: z.string().uuid(),
            projectAssetId: z.string().uuid(),
            name: z.string(),
            type: z.enum(['model', 'texture', 'audio']),
            status: z.enum(['draft', 'processing', 'published', 'failed']),
            fileUrl: z.string().nullable(),
            addedAt: z.string().datetime(),
            notes: z.string().nullable(),
            addedBy: z.object({
              id: z.string().uuid(),
              displayName: z.string().nullable(),
            })
          }))
        })
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string }

    await verifyProjectMembership(fastify, id, request)

    const projectAssetsList = await fastify.db.query.projectAssets.findMany({
      where: eq(projectAssets.projectId, id),
      with: {
        asset: true,
        addedByUser: {
          columns: {
            id: true,
            displayName: true,
          }
        }
      },
      orderBy: [desc(projectAssets.addedAt)]
    })

    return {
      assets: projectAssetsList.map(pa => ({
        id: pa.asset.id,
        projectAssetId: pa.id,
        name: pa.asset.name,
        type: pa.asset.type,
        status: pa.asset.status,
        fileUrl: pa.asset.fileUrl,
        addedAt: pa.addedAt.toISOString(),
        notes: pa.notes,
        addedBy: pa.addedByUser,
      }))
    }
  })

  // =====================================================
  // ADD ASSET TO PROJECT
  // =====================================================
  fastify.post('/:id/assets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add asset to project',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid()
      }),
      body: z.object({
        assetId: z.string().uuid(),
        notes: z.string().optional(),
      }),
      response: {
        201: z.object({
          projectAsset: z.object({
            id: z.string().uuid(),
            projectId: z.string().uuid(),
            assetId: z.string().uuid(),
            addedAt: z.string().datetime(),
          })
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { assetId, notes } = request.body as {
      assetId: string
      notes?: string
    }

    await verifyProjectMembership(fastify, id, request)

    // Verify asset exists
    const asset = await fastify.db.query.assets.findFirst({
      where: eq(assets.id, assetId)
    })

    if (!asset) {
      throw new NotFoundError('Asset not found')
    }

    // Check if asset is already in project
    const existing = await fastify.db.query.projectAssets.findFirst({
      where: and(
        eq(projectAssets.projectId, id),
        eq(projectAssets.assetId, assetId)
      )
    })

    if (existing) {
      throw new ValidationError('Asset is already in this project')
    }

    const [projectAsset] = await fastify.db.insert(projectAssets).values({
      projectId: id,
      assetId,
      addedBy: request.user!.id,
      notes,
    }).returning()

    if (!projectAsset) {
      throw new Error('Failed to add asset to project')
    }

    reply.code(201).send({ projectAsset: serializeAllTimestamps(projectAsset) })
  })

  // =====================================================
  // REMOVE ASSET FROM PROJECT
  // =====================================================
  fastify.delete('/:id/assets/:assetId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Remove asset from project',
      tags: ['projects'],
      params: z.object({
        id: z.string().uuid(),
        assetId: z.string().uuid()
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string }

    await verifyProjectMembership(fastify, id, request)

    await fastify.db
      .delete(projectAssets)
      .where(and(
        eq(projectAssets.projectId, id),
        eq(projectAssets.assetId, assetId)
      ))

    reply.code(204).send()
  })
}

export default projectRoutes
