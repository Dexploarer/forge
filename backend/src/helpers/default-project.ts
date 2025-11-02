import { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { teams, teamMembers, projects, projectMembers } from '../database/schema'

/**
 * Gets or creates a default project for a user
 * Creates default team and project if they don't exist
 */
export async function getOrCreateDefaultProject(
  fastify: FastifyInstance,
  userId: string
): Promise<string> {
  // First, check if user has any projects
  const existingProjects = await fastify.db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
    limit: 1,
  })

  if (existingProjects.length > 0) {
    return existingProjects[0]!.id
  }

  // No projects found - create default team and project
  // Check if user has a default team
  let defaultTeam = await fastify.db.query.teams.findFirst({
    where: and(
      eq(teams.ownerId, userId),
      eq(teams.name, 'Personal')
    ),
  })

  // Create default team if it doesn't exist
  if (!defaultTeam) {
    const [newTeam] = await fastify.db.insert(teams).values({
      name: 'Personal',
      description: 'Your personal workspace',
      ownerId: userId,
      settings: {},
    }).returning()

    if (!newTeam) {
      throw new Error('Failed to create default team')
    }

    // Add user as team member
    await fastify.db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId: userId,
      role: 'owner',
    })

    defaultTeam = newTeam
  }

  // Create default project in the team
  const [defaultProject] = await fastify.db.insert(projects).values({
    name: 'Default Project',
    description: 'Your default project workspace',
    teamId: defaultTeam.id,
    ownerId: userId,
    settings: { visibility: 'private' },
    tags: [],
    status: 'active',
  }).returning()

  if (!defaultProject) {
    throw new Error('Failed to create default project')
  }

  // Add user as project member
  await fastify.db.insert(projectMembers).values({
    projectId: defaultProject.id,
    userId: userId,
    role: 'owner',
  })

  return defaultProject.id
}
