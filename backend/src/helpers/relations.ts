/**
 * Relations Helpers
 * Handle include/expand query parameters for fetching related resources
 */

import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import {
  users,
  teams,
  projects,
  teamMembers,
} from '../database/schema'

/**
 * Parse include/expand query parameter
 * Supports comma-separated values: "team,owner,assets"
 *
 * @param includeParam - Comma-separated list of relations to include
 * @returns Array of relation names
 *
 * @example
 * const includes = parseIncludeParam('team,owner,assets')
 * // Returns: ['team', 'owner', 'assets']
 */
export function parseIncludeParam(includeParam?: string): string[] {
  if (!includeParam) return []

  return includeParam
    .split(',')
    .map((rel) => rel.trim())
    .filter(Boolean)
}

/**
 * Validate include parameter against allowed relations
 *
 * @param includes - Array of requested relations
 * @param allowedRelations - Array of allowed relation names
 * @returns Object with valid flag and invalid relation names
 *
 * @example
 * const validation = validateIncludeParam(['team', 'owner', 'invalid'], ['team', 'owner', 'assets'])
 * // Returns: { valid: false, invalidRelations: ['invalid'] }
 */
export function validateIncludeParam(
  includes: string[],
  allowedRelations: string[]
): { valid: boolean; invalidRelations: string[] } {
  const invalidRelations = includes.filter((rel) => !allowedRelations.includes(rel))

  return {
    valid: invalidRelations.length === 0,
    invalidRelations,
  }
}

/**
 * Fetch owner (user) for a resource
 *
 * @param server - Fastify instance
 * @param ownerId - ID of owner
 * @returns User object or null
 */
export async function fetchOwner(
  server: FastifyInstance,
  ownerId: string | null
): Promise<any | null> {
  if (!ownerId) return null

  const owner = await server.db.query.users.findFirst({
    where: eq(users.id, ownerId),
  })

  return owner || null
}

/**
 * Fetch team for a resource
 *
 * @param server - Fastify instance
 * @param teamId - ID of team
 * @returns Team object or null
 */
export async function fetchTeam(
  server: FastifyInstance,
  teamId: string | null
): Promise<any | null> {
  if (!teamId) return null

  const team = await server.db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  })

  return team || null
}

/**
 * Fetch project for a resource
 *
 * @param server - Fastify instance
 * @param projectId - ID of project
 * @returns Project object or null
 */
export async function fetchProject(
  server: FastifyInstance,
  projectId: string | null
): Promise<any | null> {
  if (!projectId) return null

  const project = await server.db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  return project || null
}

/**
 * Fetch assets for a project
 *
 * @param server - Fastify instance
 * @param projectId - ID of project
 * @param limit - Maximum number of assets to fetch (default: 50)
 * @returns Array of assets
 */
export async function fetchProjectAssets(
  _server: FastifyInstance,
  _projectId: string,
  _limit: number = 50
): Promise<any[]> {
  // Note: assets table doesn't have a direct projectId field
  // This would need to query through projectAssets junction table
  // For now, returning empty array - implement via projectAssets if needed
  return []
}

/**
 * Fetch team members for a team
 *
 * @param server - Fastify instance
 * @param teamId - ID of team
 * @param limit - Maximum number of members to fetch (default: 100)
 * @returns Array of team members with user details
 */
export async function fetchTeamMembers(
  server: FastifyInstance,
  teamId: string,
  limit: number = 100
): Promise<any[]> {
  const members = await server.db.query.teamMembers.findMany({
    where: eq(teamMembers.teamId, teamId),
    limit,
    with: {
      user: true,
    },
  })

  return members
}

/**
 * Attach relations to a single resource
 * Fetches and attaches requested relations to a resource object
 *
 * @param server - Fastify instance
 * @param resource - Resource object to attach relations to
 * @param includes - Array of relation names to include
 * @param relationConfig - Configuration mapping relation names to fetch functions
 * @returns Resource with attached relations
 *
 * @example
 * const projectWithRelations = await attachRelations(
 *   server,
 *   project,
 *   ['owner', 'team', 'assets'],
 *   {
 *     owner: () => fetchOwner(server, project.ownerId),
 *     team: () => fetchTeam(server, project.teamId),
 *     assets: () => fetchProjectAssets(server, project.id)
 *   }
 * )
 */
export async function attachRelations<T extends Record<string, any>>(
  server: FastifyInstance,
  resource: T,
  includes: string[],
  relationConfig: RelationConfig
): Promise<T & { [key: string]: any }> {
  const result: Record<string, any> = { ...resource }

  for (const relation of includes) {
    const fetcher = relationConfig[relation]
    if (fetcher) {
      try {
        result[relation] = await fetcher()
      } catch (error) {
        server.log.error(
          { error, relation, resourceId: resource.id },
          `Failed to fetch relation: ${relation}`
        )
        result[relation] = null
      }
    }
  }

  return result as T & { [key: string]: any }
}

/**
 * Attach relations to multiple resources
 * Efficiently fetches and attaches relations to an array of resources
 *
 * @param server - Fastify instance
 * @param resources - Array of resources
 * @param includes - Array of relation names to include
 * @param relationConfigFactory - Function that creates relation config for each resource
 * @returns Array of resources with attached relations
 *
 * @example
 * const projectsWithRelations = await attachRelationsToMany(
 *   server,
 *   projects,
 *   ['owner', 'team'],
 *   (project) => ({
 *     owner: () => fetchOwner(server, project.ownerId),
 *     team: () => fetchTeam(server, project.teamId)
 *   })
 * )
 */
export async function attachRelationsToMany<T extends Record<string, any>>(
  server: FastifyInstance,
  resources: T[],
  includes: string[],
  relationConfigFactory: (resource: T) => RelationConfig
): Promise<(T & { [key: string]: any })[]> {
  return Promise.all(
    resources.map((resource) =>
      attachRelations(server, resource, includes, relationConfigFactory(resource))
    )
  )
}

// Type definitions
export type RelationConfig = {
  [relationName: string]: () => Promise<any>
}

/**
 * Common relation configurations for reuse
 */
export const commonRelationConfigs = {
  /**
   * Get relation config for resources with owner and team
   */
  ownerAndTeam: (ownerId: string | null, teamId: string | null, server: FastifyInstance): RelationConfig => ({
    owner: () => fetchOwner(server, ownerId),
    team: () => fetchTeam(server, teamId),
  }),

  /**
   * Get relation config for project relations
   */
  project: (projectId: string | null, server: FastifyInstance): RelationConfig => ({
    project: () => fetchProject(server, projectId),
  }),
}
