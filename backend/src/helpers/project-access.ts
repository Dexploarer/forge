import { FastifyRequest } from 'fastify'
import { eq, and } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { projects, projectMembers, teamMembers } from '../database/schema'
import { ForbiddenError, NotFoundError } from '../utils/errors'

/**
 * Check if a user is the project owner
 */
export async function isProjectOwner(
  fastify: FastifyInstance,
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await fastify.db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (!project) {
    return false
  }

  return project.ownerId === userId
}

/**
 * Check if a user is a project member (including owner)
 */
export async function isProjectMember(
  fastify: FastifyInstance,
  projectId: string,
  userId: string
): Promise<boolean> {
  // Check if user is project owner
  if (await isProjectOwner(fastify, projectId, userId)) {
    return true
  }

  // Check if user is in project members
  const membership = await fastify.db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    )
  })

  return !!membership
}

/**
 * Check if a user is a team member for the project's team
 */
export async function isProjectTeamMember(
  fastify: FastifyInstance,
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await fastify.db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (!project) {
    return false
  }

  // Check if user is team member
  const teamMembership = await fastify.db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, project.teamId),
      eq(teamMembers.userId, userId)
    )
  })

  return !!teamMembership
}

/**
 * Verify project ownership and throw error if not owner
 * Admins bypass this check
 */
export async function verifyProjectOwner(
  fastify: FastifyInstance,
  projectId: string,
  request: FastifyRequest
): Promise<void> {
  // Admin bypass
  if (request.user?.role === 'admin') {
    return
  }

  if (!request.user) {
    throw new ForbiddenError('Authentication required')
  }

  const project = await fastify.db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  if (project.ownerId !== request.user.id) {
    throw new ForbiddenError('Only the project owner can perform this action')
  }
}

/**
 * Verify project membership (owner or member) and throw error if not a member
 */
export async function verifyProjectMembership(
  fastify: FastifyInstance,
  projectId: string,
  request: FastifyRequest
): Promise<void> {
  if (!request.user) {
    throw new ForbiddenError('Authentication required')
  }

  const project = await fastify.db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  const isMember = await isProjectMember(fastify, projectId, request.user.id)
  if (!isMember) {
    throw new ForbiddenError('You are not a member of this project')
  }
}

/**
 * Verify team membership for the project's team
 * Required for adding assets or members to a project
 */
export async function verifyProjectTeamMembership(
  fastify: FastifyInstance,
  projectId: string,
  request: FastifyRequest
): Promise<void> {
  if (!request.user) {
    throw new ForbiddenError('Authentication required')
  }

  const project = await fastify.db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  const isTeamMember = await isProjectTeamMember(fastify, projectId, request.user.id)
  if (!isTeamMember) {
    throw new ForbiddenError('You must be a team member to access this project')
  }
}

/**
 * Get user's role in a project
 */
export async function getProjectRole(
  fastify: FastifyInstance,
  projectId: string,
  userId: string
): Promise<string | null> {
  // Check if owner
  if (await isProjectOwner(fastify, projectId, userId)) {
    return 'owner'
  }

  // Check project membership
  const membership = await fastify.db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    )
  })

  return membership?.role ?? null
}
