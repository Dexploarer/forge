/**
 * Team Access Helpers
 * Verify team membership and permissions
 */

import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { teams, teamMembers } from '../database/schema'
import { ForbiddenError, NotFoundError } from '../utils/errors'

/**
 * Check if user is team owner (returns boolean)
 *
 * @example
 * const isOwner = await isTeamOwner(fastify, teamId, request.user!.id)
 */
export async function isTeamOwner(
  fastify: FastifyInstance,
  teamId: string,
  userId: string
): Promise<boolean> {
  const team = await fastify.db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  })

  return team?.ownerId === userId
}

/**
 * Check if user is team member (returns boolean)
 *
 * @example
 * const isMember = await isTeamMember(fastify, teamId, request.user!.id)
 */
export async function isTeamMember(
  fastify: FastifyInstance,
  teamId: string,
  userId: string
): Promise<boolean> {
  const membership = await fastify.db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  })

  return !!membership
}

/**
 * Verify user is team owner or admin
 * Throws 403 if not authorized
 *
 * @example
 * await verifyTeamOwner(fastify, teamId, request.user!.id, request.user!.role)
 */
export async function verifyTeamOwner(
  fastify: FastifyInstance,
  teamId: string,
  userId: string,
  userRole: string
): Promise<void> {
  // Admin always has access
  if (userRole === 'admin') {
    return
  }

  const team = await fastify.db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  })

  if (!team) {
    throw new NotFoundError('Team not found')
  }

  if (team.ownerId !== userId) {
    throw new ForbiddenError('Only the team owner can perform this action')
  }
}

/**
 * Verify user is team member or admin
 * Throws 403 if not authorized
 *
 * @example
 * await verifyTeamMembership(fastify, teamId, request.user!.id, request.user!.role)
 */
export async function verifyTeamMembership(
  fastify: FastifyInstance,
  teamId: string,
  userId: string,
  userRole: string
): Promise<void> {
  // Admin always has access
  if (userRole === 'admin') {
    return
  }

  const membership = await fastify.db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  })

  if (!membership) {
    throw new ForbiddenError('You are not a member of this team')
  }
}

/**
 * Get user's role in a team
 * Returns role or null if not a member
 *
 * @example
 * const role = await getTeamRole(fastify, teamId, request.user!.id)
 */
export async function getTeamRole(
  fastify: FastifyInstance,
  teamId: string,
  userId: string
): Promise<string | null> {
  const membership = await fastify.db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  })

  return membership?.role || null
}
