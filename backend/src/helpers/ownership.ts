/**
 * Ownership Verification Helpers
 * Verify user ownership and access rights to resources
 */

import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { NotFoundError, ForbiddenError } from '../utils/errors'

/**
 * Verify that a resource exists and belongs to the user
 * Throws 404 if not found or not owned by user
 *
 * @param server - Fastify instance
 * @param table - Drizzle table definition
 * @param resourceId - ID of resource to verify
 * @param userId - ID of user claiming ownership
 * @param resourceName - Human-readable resource name for error messages
 * @returns The resource if found and owned by user
 * @throws NotFoundError if resource doesn't exist or isn't owned by user
 *
 * @example
 * const project = await verifyOwnership(server, projects, projectId, request.user!.id, 'Project')
 */
export async function verifyOwnership<T>(
  server: FastifyInstance,
  table: any,
  resourceId: string,
  userId: string,
  resourceName?: string
): Promise<T> {
  const tableName = table._?.name || table._.name

  if (!tableName) {
    throw new Error('Invalid table definition - cannot determine table name')
  }

  const resource = await (server.db.query as Record<string, any>)[tableName].findFirst({
    where: and(eq(table.id, resourceId), eq(table.ownerId, userId)),
  })

  if (!resource) {
    throw new NotFoundError(`${resourceName || 'Resource'} not found`)
  }

  return resource as T
}

/**
 * Verify ownership or admin role
 * Admins can access any resource, others must own it
 *
 * @param server - Fastify instance
 * @param table - Drizzle table definition
 * @param resourceId - ID of resource to verify
 * @param userId - ID of user claiming ownership
 * @param userRole - Role of the user ('admin', 'member', etc.)
 * @param resourceName - Human-readable resource name for error messages
 * @returns The resource if found and user has access
 * @throws NotFoundError if resource doesn't exist
 * @throws ForbiddenError if user doesn't have access
 *
 * @example
 * const asset = await verifyOwnershipOrAdmin(server, assets, assetId, request.user!.id, request.user!.role, 'Asset')
 */
export async function verifyOwnershipOrAdmin<T>(
  server: FastifyInstance,
  table: any,
  resourceId: string,
  userId: string,
  userRole: string,
  resourceName?: string
): Promise<T> {
  const tableName = table._?.name || table._.name

  if (!tableName) {
    throw new Error('Invalid table definition - cannot determine table name')
  }

  const resource = await (server.db.query as Record<string, any>)[tableName].findFirst({
    where: eq(table.id, resourceId),
  })

  if (!resource) {
    throw new NotFoundError(`${resourceName || 'Resource'} not found`)
  }

  // Admin or owner role can access any resource
  if (userRole === 'admin' || userRole === 'owner') {
    return resource as T
  }

  // Non-admin must own the resource
  if ((resource as Record<string, string>).ownerId !== userId) {
    throw new ForbiddenError(
      `You do not have access to this ${resourceName || 'resource'}`
    )
  }

  return resource as T
}

/**
 * Check if user owns a resource (returns boolean instead of throwing)
 *
 * @param server - Fastify instance
 * @param table - Drizzle table definition
 * @param resourceId - ID of resource to check
 * @param userId - ID of user to check ownership for
 * @returns True if user owns the resource, false otherwise
 *
 * @example
 * const isOwner = await isResourceOwner(server, projects, projectId, request.user!.id)
 */
export async function isResourceOwner(
  server: FastifyInstance,
  table: any,
  resourceId: string,
  userId: string
): Promise<boolean> {
  try {
    const tableName = table._?.name || table._.name

    if (!tableName) {
      return false
    }

    const resource = await (server.db.query as Record<string, any>)[tableName].findFirst({
      where: and(eq(table.id, resourceId), eq(table.ownerId, userId)),
    })

    return !!resource
  } catch (error) {
    server.log.error({ error, resourceId, userId }, 'Failed to check resource ownership')
    return false
  }
}

/**
 * Verify resource exists (regardless of ownership)
 * Throws 404 if not found
 *
 * @param server - Fastify instance
 * @param table - Drizzle table definition
 * @param resourceId - ID of resource to verify
 * @param resourceName - Human-readable resource name for error messages
 * @returns The resource if found
 * @throws NotFoundError if resource doesn't exist
 *
 * @example
 * const resource = await verifyResourceExists(server, teams, teamId, 'Team')
 */
export async function verifyResourceExists<T>(
  server: FastifyInstance,
  table: any,
  resourceId: string,
  resourceName?: string
): Promise<T> {
  const tableName = table._?.name || table._.name

  if (!tableName) {
    throw new Error('Invalid table definition - cannot determine table name')
  }

  const resource = await (server.db.query as Record<string, any>)[tableName].findFirst({
    where: eq(table.id, resourceId),
  })

  if (!resource) {
    throw new NotFoundError(`${resourceName || 'Resource'} not found`)
  }

  return resource as T
}
